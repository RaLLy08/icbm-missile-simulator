import type Earth from './earth/Earth';
import DE from './ga/DE';
import Rocket from './rocket/Rocket';
import * as THREE from 'three';

const randFloat = (min: number, max: number) => {
  return Math.random() * (max - min) + min;
};

type ParamConstrain = {
  min: number;
  max: number;
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
  public onProgress: (bestGenome: any, progress: number) => void = () => {};
  ellapsedTime: number = 0;
  private _tempDistanceVec = new THREE.Vector3();

  constructor(
    private earth: Earth,
    private start: THREE.Vector3,
    private target: THREE.Vector3,
    private rocketConstrains: {
      startInclineAfterDistance: ParamConstrain;
      thrustInclineMaxDuration: ParamConstrain;
      thrustInclineVelocity: ParamConstrain;
      fuelMass: ParamConstrain;
      exhaustVelocity: ParamConstrain;
      massFlowRate: ParamConstrain;
    },
    private flightConstraints: {
      maxDistanceThreshold?: number; // minimize
      maxFlightTimeSeconds: number;
      maxAltitude?: number; // optional, not used in current implementation
    },
    private minimizeFlightTime: boolean = false,
    private increaseCalculationAccuracy: boolean = false
  ) {}

  async calcTrajectory(delayBetweenGenerationsMs: number | null = null) {
    if (!this.earth || !this.start || !this.target) {
      throw new Error(
        'Earth, start position, and target position must be set before calculating the trajectory.'
      );
    }

    this.ellapsedTime = 0;
    const startTime = performance.now();

    const populationSize = this.increaseCalculationAccuracy ? 200 : 80;

    const bestGenome = await this.runDe(
      {
        maxGenerations: 80,
        populationSize,
        mutationRate: 0.96,
        bestSurvivePercent: 0.8,
        elite: 0.1,
        genomeLength: 6,
        fitnessFunction: this.fitnessFunction,
        genomeConstraints: [
          this.rocketConstrains.startInclineAfterDistance,
          this.rocketConstrains.thrustInclineMaxDuration,
          this.rocketConstrains.thrustInclineVelocity,
          this.rocketConstrains.fuelMass,
          this.rocketConstrains.exhaustVelocity,
          this.rocketConstrains.massFlowRate,
        ],
        randMutationFunction: () => randFloat(-2, 2),
        CR: 0.9,
        scalingFactor: 0.4,
      },
      delayBetweenGenerationsMs
    );

    this.ellapsedTime = (performance.now() - startTime) / 1000;

    return bestGenome;
  }

  private runDe = async (
    deParams: DEParams,
    delayBetweenGenerationsMs?: number | null
  ) => {
    this.de = new DE(deParams);

    if (!this.de) {
      throw new Error('DE instance is not set. Call setDe() first.');
    }

    return new Promise<any>((resolve) => {
      let lastBestFitness = Infinity;
      let noImprovementCount = 0;
      const convergenceThreshold = 0.001; // km
      const maxNoImprovementGenerations = 20;

      this.de.run(delayBetweenGenerationsMs, (generation: number) => {
        const bestGenome = this.de.population[0];

        this.onProgress(
          bestGenome,
          (generation * 100) / (deParams.maxGenerations - 1)
        );

        // Early termination: check for convergence
        const fitnessImprovement = Math.abs(lastBestFitness - bestGenome.fitness);
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

  private fitnessFunction = (genome: any) => {
    const [
      startInclineAfterDistance,
      thrustInclineMaxDuration,
      thrustInclineVelocity,
      fuelMass,
      exhaustVelocity,
      massFlowRate,
    ] = genome;

    const rocket = new Rocket(
      this.earth,
      this.start,
      this.target,
      startInclineAfterDistance,
      thrustInclineMaxDuration,
      thrustInclineVelocity,
      fuelMass,
      exhaustVelocity,
      massFlowRate
    );

    this.simulateFlight(rocket);

    genome.rocket = rocket;

    // Use cached vector for distance calculation to avoid allocation
    let fitness = this._tempDistanceVec.copy(rocket.position).distanceTo(this.target);

    if (this.minimizeFlightTime) {
      fitness += rocket.flightTime;
    }

    return fitness;
  };

  private simulateFlight = (rocket: Rocket, stepInSeconds = 1) => {
    const { maxFlightTimeSeconds, maxDistanceThreshold, maxAltitude } =
      this.flightConstraints;

    for (let i = 0; i < maxFlightTimeSeconds / stepInSeconds; i++) {
      rocket.update(stepInSeconds);

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
