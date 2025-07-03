import * as THREE from 'three';
import { FlightTrajectory } from '../FlightTrajectory';
import Earth from '../earth/Earth';
import LauncherGui from './LauncherGui';
import Rocket from 'app/rocket/Rocket';

export default class Launcher {
  rocketStartPosition: THREE.Vector3 = Earth.geoCoordinatesToPosition(0, 0);
  rocketTargetPosition: THREE.Vector3 = Earth.geoCoordinatesToPosition(180, 0);
  startInclineAfterDistance = 8; // km
  thrustInclineMaxDuration = 160; // seconds
  thrustInclineVelocity = THREE.MathUtils.degToRad(0.5); // radians per second
  fuelCombustionTime = 180; // seconds

  constructor(
    private launcherGui: LauncherGui,
    private earth: Earth
  ) {
    this.launcherGui.onCalculateTrajectory = this.calcTrajectory;
  }

  setStartPosition = (coordinates: THREE.Vector3) => {
    this.rocketStartPosition = coordinates.clone();
  };

  setTargetPosition = (coordinates: THREE.Vector3) => {
    this.rocketTargetPosition = coordinates.clone();
  };

  private calcTrajectory = async () => {
    const euclideanDistance = this.rocketStartPosition
      .clone()
      .sub(this.rocketTargetPosition)
      .length();

    const flightTrajectory = new FlightTrajectory(
      this.earth,
      this.rocketStartPosition,
      this.rocketTargetPosition,
      {
        startInclineAfterDistance: {
          min: 1,
          max: 1000,
        },
        thrustInclineMaxDuration: {
          min: 10,
          max: 40 * 60,
        },
        thrustInclineVelocity: {
          min: 0,
          max: THREE.MathUtils.degToRad(20),
        },
        fuelCombustionTime: {
          min: 60 * 1,
          max: 60 * 5,
        },
      },
      {
        maxDistanceThreshold: euclideanDistance * 4,
        maxFlightTimeSeconds: 60 * 60, // 45 minutes
        maxAltitude: 4000,
      }
    );

    flightTrajectory.onProgress = (bestGenome, progress) => {
      // console.log(
      //   `Progress: ${progress.toFixed(1)}% Best fitness = ${bestGenome.fitness.toFixed(1)}`
      // );
    };

    const bestGenome = await flightTrajectory.calcTrajectory(0);

    this.setRocketParams(bestGenome);

  };


  private setRocketParams = (genome: any) => {
    const [startInclineAfterDistance, thrustInclineMaxDuration, thrustInclineVelocity, fuelCombustionTime] = genome;
    
    this.startInclineAfterDistance = startInclineAfterDistance;
    this.thrustInclineMaxDuration = thrustInclineMaxDuration;
    this.thrustInclineVelocity = thrustInclineVelocity;
    this.fuelCombustionTime = fuelCombustionTime;

    const rocket = genome.rocket;

    this.launcherGui.startInclineAfterDistance = this.startInclineAfterDistance;
    this.launcherGui.currentThrustInclineDuration =
      rocket.currentThrustInclineDuration;
    this.launcherGui.thrustInclineVelocity = this.thrustInclineVelocity;
    this.launcherGui.fuelCombustionTime = this.fuelCombustionTime;

    this.launcherGui.maxAltitude = rocket.maxAltitude;
    this.launcherGui.travelledDistance = rocket.travelledDistance.length();
    this.launcherGui.flightTime = rocket.flightTime;
  };

  createRocket = () => {
    const targetInclineVector = this.rocketTargetPosition
      .clone()
      .sub(this.rocketStartPosition)
      .normalize();

    const rocket = new Rocket(
      this.earth,
      this.rocketStartPosition,
      targetInclineVector,
      this.startInclineAfterDistance,
      this.thrustInclineMaxDuration,
      this.thrustInclineVelocity,
      this.fuelCombustionTime
    );

    return rocket;
  };
}
