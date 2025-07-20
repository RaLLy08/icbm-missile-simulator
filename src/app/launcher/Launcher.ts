import * as THREE from 'three';
import { FlightTrajectory } from '../FlightTrajectory';
import Earth from '../earth/Earth';
import LauncherGui from './Launcher.gui';
import Rocket from 'app/rocket/Rocket';

export default class Launcher {
  rocketStartPosition: THREE.Vector3 | null = null;
  rocketTargetPosition: THREE.Vector3 | null = null;
  startInclineAfterDistance = 8; // km
  thrustInclineMaxDuration = 160; // seconds
  thrustInclineVelocity = THREE.MathUtils.degToRad(0.5); // radians per second
  fuelCombustionTime = 180; // seconds
  inclineAngle = 0; // radians

  rocketCount = 0;

  constructor(
    private launcherGui: LauncherGui,
    private earth: Earth
  ) {}

  setStartPosition = (coordinates: THREE.Vector3) => {
    this.rocketStartPosition = coordinates.clone();
  };

  setTargetPosition = (coordinates: THREE.Vector3) => {
    this.rocketTargetPosition = coordinates.clone();
  };

  calcTrajectory = async (
    onProgress = (bestGenome: any, progress: number) => {}
  ) => {
    if (!this.rocketStartPosition || !this.rocketTargetPosition) {
      return;
    }

    const start = this.earth.withRotation(this.rocketStartPosition.clone());
    const target = this.earth.withRotation(this.rocketTargetPosition.clone());

    const euclideanDistance = start.clone().sub(target).length();

    const flightTrajectory = new FlightTrajectory(
      this.earth,
      start,
      target,
      {
        startInclineAfterDistance: {
          min: 1,
          max: 4,
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
        maxDistanceThreshold: euclideanDistance * 6,
        maxFlightTimeSeconds: 60 * 120,
        maxAltitude: 5000,
      },
      this.launcherGui.minimizeFlightTime
    );

    flightTrajectory.onProgress = onProgress;

    const bestGenome = await flightTrajectory.calcTrajectory(0);

    this.setRocketParams(bestGenome);
  };

  private setRocketParams = (genome: any) => {
    const [
      inclineAngle,
      startInclineAfterDistance,
      thrustInclineMaxDuration,
      thrustInclineVelocity,
      fuelCombustionTime,
    ] = genome;

    this.startInclineAfterDistance = startInclineAfterDistance;
    this.thrustInclineMaxDuration = thrustInclineMaxDuration;
    this.thrustInclineVelocity = thrustInclineVelocity;
    this.fuelCombustionTime = fuelCombustionTime;
    this.inclineAngle = inclineAngle;

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
    if (!this.rocketStartPosition || !this.rocketTargetPosition) {
      return;
    }
    this.rocketCount++;
    this.launcherGui.rocketCount = this.rocketCount;

    const start = this.earth.withRotation(this.rocketStartPosition.clone());
    const center = new THREE.Vector3(0, 0, 0); // rotation center

    const radiusVector = start.clone().sub(center);
    const normal = new THREE.Vector3(0, 0, 1); // change this if you want a different rotation plane
    const quaternion = new THREE.Quaternion();
    quaternion.setFromAxisAngle(normal.normalize(), this.inclineAngle);

    // Apply rotation
    const rotatedVector = radiusVector.clone().applyQuaternion(quaternion);
    const newVector = center.clone().add(rotatedVector);

    const rocket = new Rocket(
      this.earth,
      start,
      newVector,
      this.startInclineAfterDistance,
      this.thrustInclineMaxDuration,
      this.thrustInclineVelocity,
      this.fuelCombustionTime
    );

    return rocket;
  };
}
