import type Earth from './earth/Earth';
import DE from './ga/DE';
import Rocket from './rocket/Rocket';
import MultiStageRocket, { type RocketStage } from './rocket/MultiStageRocket';
import * as THREE from 'three';

const randFloat = (min: number, max: number) => {
  return Math.random() * (max - min) + min;
};

export type ParamConstrain = {
  min: number;
  max: number;
};

/** Search range of one engine stage. Stages burn in ascending `stage` order. */
export type StageConstraint = {
  stage: number;
  exhaustVelocity: ParamConstrain;
  massFlowRate: ParamConstrain;
  fuelMass: ParamConstrain;
};

export type RocketConstraints = {
  startInclineAfterAltitude: ParamConstrain;
  thrustInclineMaxDuration: ParamConstrain;
  thrustInclineVelocity: ParamConstrain;
  stages: StageConstraint[];
  /** Fixed payload mass, kg (Rocket default when omitted) */
  payloadMass?: number;
};

/** Genes before the per-stage genes. */
const GUIDANCE_GENES = 3;
/** Genes per stage: exhaustVelocity, massFlowRate, fuelMass. */
const STAGE_GENES = 3;

export type DecodedGenome = {
  startInclineAfterAltitude: number;
  thrustInclineMaxDuration: number;
  thrustInclineVelocity: number;
  stages: RocketStage[];
};

/**
 * Genome layout:
 * [startInclineAfterAltitude, thrustInclineMaxDuration, thrustInclineVelocity,
 *  ...per stage: exhaustVelocity, massFlowRate, fuelMass]
 */
export const decodeGenome = (genome: ArrayLike<number>): DecodedGenome => {
  const stageCount = Math.floor((genome.length - GUIDANCE_GENES) / STAGE_GENES);
  const stages: RocketStage[] = [];

  for (let i = 0; i < stageCount; i++) {
    const offset = GUIDANCE_GENES + i * STAGE_GENES;
    stages.push({
      exhaustVelocity: genome[offset],
      massFlowRate: genome[offset + 1],
      fuelMass: genome[offset + 2],
    });
  }

  return {
    startInclineAfterAltitude: genome[0],
    thrustInclineMaxDuration: genome[1],
    thrustInclineVelocity: genome[2],
    stages,
  };
};

type DEParams = {
  maxGenerations: number;
  populationSize: number;
  mutationRate: number;
  bestSurvivePercent: number;
  elite: number;
  genomeLength: number;
  fitnessFunction: (genome: number[]) => number;
  genomeConstraints: ParamConstrain[];
  randMutationFunction: () => number;
  CR: number;
  scalingFactor: number;
};

export class FlightTrajectory {
  private de: DE | null = null;
  public onProgress: (
    bestGenome: any,
    progress: number,
    bestTrajectory: THREE.Vector3[]
  ) => void = () => {};
  elapsedTime: number = 0;
  private _tempDistanceVec = new THREE.Vector3();

  constructor(
    private earth: Earth,
    private start: THREE.Vector3,
    private target: THREE.Vector3,
    private rocketConstrains: RocketConstraints,
    private flightConstraints: {
      maxDistanceThreshold?: number; // minimize
      maxFlightTimeSeconds: number;
      maxAltitude?: number; // optional, not used in current implementation
    },
    private minimizeFlightTime: boolean = false,
    private increaseCalculationAccuracy: boolean = false,
    private traceBestTrajectory: boolean = false
  ) {}

  async calcTrajectory(delayBetweenGenerationsMs: number | null = null) {
    if (!this.earth || !this.start || !this.target) {
      throw new Error(
        'Earth, start position, and target position must be set before calculating the trajectory.'
      );
    }

    if (this.rocketConstrains.stages.length === 0) {
      throw new Error('At least one rocket stage constraint is required.');
    }

    this.elapsedTime = 0;
    const startTime = performance.now();

    const populationSize = this.increaseCalculationAccuracy ? 200 : 80;
    const genomeConstraints = this.genomeConstraints();

    const bestGenome = await this.runDe(
      {
        maxGenerations: 80,
        populationSize,
        mutationRate: 0.96,
        bestSurvivePercent: 0.8,
        elite: 0.1,
        genomeLength: genomeConstraints.length,
        fitnessFunction: this.fitnessFunction,
        genomeConstraints,
        randMutationFunction: () => randFloat(-2, 2),
        CR: 0.9,
        scalingFactor: 0.4,
      },
      delayBetweenGenerationsMs
    );

    this.elapsedTime = (performance.now() - startTime) / 1000;

    return bestGenome;
  }

  /** Flattens the constraints in the genome layout of `decodeGenome`. */
  private genomeConstraints = (): ParamConstrain[] => {
    const { startInclineAfterAltitude, thrustInclineMaxDuration, stages } =
      this.rocketConstrains;

    const stageConstraints: ParamConstrain[] = [];
    [...stages]
      .sort((a, b) => a.stage - b.stage)
      .forEach((s) => {
        stageConstraints.push(s.exhaustVelocity, s.massFlowRate, s.fuelMass);
      });

    return [
      startInclineAfterAltitude,
      thrustInclineMaxDuration,
      this.rocketConstrains.thrustInclineVelocity,
      ...stageConstraints,
    ];
  };

  private runDe = async (
    deParams: DEParams,
    delayBetweenGenerationsMs?: number | null
  ) => {
    this.de = new DE(deParams);

    return new Promise<any>((resolve) => {
      let lastBestFitness = Infinity;
      let noImprovementCount = 0;
      const convergenceThreshold = 0.001; // km
      const maxNoImprovementGenerations = 20;
      let tracedGenome: any = null;
      let bestTrajectory: THREE.Vector3[] = [];

      this.de.run(delayBetweenGenerationsMs, (generation: number) => {
        const bestGenome = this.de.population[0];

        // Re-trace the path only when enabled and a new best genome appears
        if (this.traceBestTrajectory && bestGenome !== tracedGenome) {
          tracedGenome = bestGenome;
          bestTrajectory = this.traceTrajectory(bestGenome);
        }

        this.onProgress(
          bestGenome,
          (generation * 100) / (deParams.maxGenerations - 1),
          bestTrajectory
        );

        // Early termination: check for convergence
        const fitnessImprovement = Math.abs(
          lastBestFitness - bestGenome.fitness
        );
        if (fitnessImprovement < convergenceThreshold) {
          noImprovementCount++;
          if (noImprovementCount >= maxNoImprovementGenerations) {
            this.de.terminate();
            resolve(this.de.population[0]);
            return;
          }
        } else {
          noImprovementCount = 0;
        }
        lastBestFitness = bestGenome.fitness;

        const isFinished = generation + 1 === deParams.maxGenerations;

        if (isFinished) {
          resolve(this.de.population[0]);
        }
      });
    });
  };

  private createMultistageRocket = (genome: any) => {
    const {
      startInclineAfterAltitude,
      thrustInclineMaxDuration,
      thrustInclineVelocity,
      stages,
    } = decodeGenome(genome);

    const rocket = new Rocket(
      this.earth,
      this.start,
      this.target,
      startInclineAfterAltitude,
      thrustInclineMaxDuration,
      thrustInclineVelocity,
      undefined, // fuel and engine are set per stage by MultiStageRocket
      undefined,
      undefined,
      this.rocketConstrains.payloadMass
    );

    return new MultiStageRocket(rocket, stages);
  };

  /**
   * Re-simulates a genome exactly as the fitness function does and records
   * the rocket position after every step, for visualizing the flight path.
   */
  traceTrajectory = (genome: any) => {
    const multiStageRocket = this.createMultistageRocket(genome);
    const { rocket } = multiStageRocket;
    const points: THREE.Vector3[] = [rocket.position.clone()];

    this.simulateFlight(multiStageRocket, 1, () =>
      points.push(rocket.position.clone())
    );

    return points;
  };

  private fitnessFunction = (genome: any) => {
    const multiStageRocket = this.createMultistageRocket(genome);
    const { rocket } = multiStageRocket;

    this.simulateFlight(multiStageRocket);

    genome.rocket = rocket;
    genome.multiStageRocket = multiStageRocket;

    // Use cached vector for distance calculation to avoid allocation
    let fitness = this._tempDistanceVec
      .copy(rocket.position)
      .distanceTo(this.target);

    if (this.minimizeFlightTime) {
      fitness += rocket.flightTime;
    }

    return fitness;
  };

  private simulateFlight = (
    multiStageRocket: MultiStageRocket,
    stepInSeconds = 1,
    onStep?: () => void
  ) => {
    const { maxFlightTimeSeconds, maxDistanceThreshold, maxAltitude } =
      this.flightConstraints;
    const { rocket } = multiStageRocket;

    for (let i = 0; i < maxFlightTimeSeconds / stepInSeconds; i++) {
      multiStageRocket.update(stepInSeconds);
      onStep?.();

      const traveledDistance = rocket.travelledDistance.length();

      if (
        maxDistanceThreshold != null &&
        traveledDistance > maxDistanceThreshold
      ) {
        // console.log(
        //   `Rocket traveled too far: ${traveledDistance} > ${constraints.maxDistanceThreshold}`
        // );
        break;
      }

      if (maxAltitude != null && rocket.altitude > maxAltitude) {
        // console.log(`Rocket reached too high altitude: ${rocket.altitude} > ${maxAltitude}`);
        break;
      }

      if (rocket.hasLanded) {
        // console.log(`Rocket landed after ${i} iterations.`);
        break;
      }
    }
  };
}
