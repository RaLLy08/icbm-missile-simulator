import Earth from './earth/Earth';
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

  constructor(
    private earth: Earth,
    private start: THREE.Vector3,
    private target: THREE.Vector3,
    private rocketConstrains: {
      startInclineAfterDistance: ParamConstrain;
      thrustInclineMaxDuration: ParamConstrain;
      thrustInclineVelocity: ParamConstrain;
      fuelCombustionTime: ParamConstrain;
    },
    private flightConstraints: {
      maxDistanceThreshold?: number; // minimize
      maxFlightTimeSeconds: number;
      maxAltitude?: number; // optional, not used in current implementation
    },
    private minimizeFlightTime: boolean = false
  ) {}

  async calcTrajectory(delayBetweenGenerationsMs: number | null = null) {
    if (!this.earth || !this.start || !this.target) {
      throw new Error(
        'Earth, start position, and target position must be set before calculating the trajectory.'
      );
    }
      
    this.ellapsedTime = 0;
    const startTime = performance.now();

    const bestGenome = await this.runDe(
      {
        maxGenerations: 70,
        populationSize: 160,
        mutationRate: 0.96,
        bestSurvivePercent: 0.9,
        elite: 0.1,
        genomeLength: 5,
        fitnessFunction: this.fitnessFunction,
        genomeConstraints: [
          {
            min: 0,
            max: Math.PI * 2,
          },
          this.rocketConstrains.startInclineAfterDistance,
          this.rocketConstrains.thrustInclineMaxDuration,
          this.rocketConstrains.thrustInclineVelocity,
          this.rocketConstrains.fuelCombustionTime,
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
      this.de.run(delayBetweenGenerationsMs, (generation: number) => {
        const bestGenome = this.de.population[0];

        this.onProgress(
          bestGenome,
          (generation * 100) / (deParams.maxGenerations - 1)
        );

        const isFinished = generation + 1 === deParams.maxGenerations;

        if (isFinished) {
          resolve(this.de.population[0]);
        }
      });
    });
  };

  private fitnessFunction = (genome: any) => {
    const [
      angleRad,
      startInclineAfterDistance,
      thrustInclineMaxDuration,
      thrustInclineVelocity,
      fuelCombustionTime,
    ] = genome;


    const center = new THREE.Vector3(0, 0, 0); // rotation center
    const start = this.start.clone(); // your starting point

    const radiusVector = start.clone().sub(center);
    const normal = new THREE.Vector3(0, 0, 1); // change this if you want a different rotation plane
    const quaternion = new THREE.Quaternion();
    quaternion.setFromAxisAngle(normal.normalize(), angleRad);

    // Apply rotation
    const rotatedVector = radiusVector.clone().applyQuaternion(quaternion);
    const newVector = center.clone().add(rotatedVector);

    const rocket = new Rocket(
      this.earth,
      this.start,
      newVector,
      startInclineAfterDistance,
      thrustInclineMaxDuration,
      thrustInclineVelocity,
      fuelCombustionTime
    );

    this.simulateFlight(rocket);

    genome.rocket = rocket;

    const rotationY = Earth.EARTH_ROTATION_SPEED * rocket.flightTime;

    const rotationMatrix = new THREE.Matrix4().makeRotationY(rotationY);
    const targetWithRotation = this.target.clone().applyMatrix4(rotationMatrix);


    let fitness = rocket.position.clone().distanceTo(targetWithRotation);

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

      if (maxDistanceThreshold != null &&traveledDistance > maxDistanceThreshold) {
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
