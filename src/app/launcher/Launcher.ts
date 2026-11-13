import * as THREE from 'three';
import { FlightTrajectory } from '../FlightTrajectory';
import Earth from '../earth/Earth';
import LauncherGui from './Launcher.gui';
import Rocket from 'app/rocket/Rocket';

export default class Launcher {
  counter = 0;

  rocketStartPosition: THREE.Vector3 | null = null;
  rocketTargetPosition: THREE.Vector3 | null = null;
  startInclineAfterDistance = 8; // km
  thrustInclineMaxDuration = 160; // seconds
  thrustInclineVelocity = THREE.MathUtils.degToRad(0.5); // radians per second
  fuelMass = 30000; // kg
  exhaustVelocity = 4; // km/s
  massFlowRate = 50; // kg/s
  payloadMass = 800; // kg

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
    onProgress = (
      _bestGenome: any,
      _progress: number,
      _bestTrajectory: THREE.Vector3[]
    ) => {}
  ) => {
    if (!this.rocketStartPosition || !this.rocketTargetPosition) {
      return;
    }

    const euclideanDistance = this.rocketStartPosition
      .clone()
      .sub(this.rocketTargetPosition)
      .length();

    const bounds = this.launcherGui.calculationBounds;

    const flightTrajectory = new FlightTrajectory(
      this.earth,
      this.rocketStartPosition,
      this.rocketTargetPosition,
      {
        startInclineAfterDistance: { ...bounds.startInclineAfterDistance },
        thrustInclineMaxDuration: { ...bounds.thrustInclineMaxDuration },
        thrustInclineVelocity: {
          min: THREE.MathUtils.degToRad(bounds.thrustInclineVelocityDeg.min),
          max: THREE.MathUtils.degToRad(bounds.thrustInclineVelocityDeg.max),
        },
        fuelMass: { ...bounds.fuelMass },
        exhaustVelocity: { ...bounds.exhaustVelocity },
        massFlowRate: { ...bounds.massFlowRate },
      },
      {
        maxDistanceThreshold: euclideanDistance * 6,
        maxFlightTimeSeconds: 60 * 120,
        maxAltitude: 6000,
      },
      this.launcherGui.minimizeFlightTime,
      this.launcherGui.increaseCalculationAccuracy,
      this.launcherGui.showCalculationPreview
    );

    flightTrajectory.onProgress = onProgress;

    const bestGenome = await flightTrajectory.calcTrajectory(0);

    this.setRocketParams(bestGenome);
  };

  private setRocketParams = (genome: any) => {
    const [
      startInclineAfterDistance,
      thrustInclineMaxDuration,
      thrustInclineVelocity,
      fuelMass,
      exhaustVelocity,
      massFlowRate,
    ] = genome;

    this.startInclineAfterDistance = startInclineAfterDistance;
    this.thrustInclineMaxDuration = thrustInclineMaxDuration;
    this.thrustInclineVelocity = thrustInclineVelocity;
    this.fuelMass = fuelMass;
    this.exhaustVelocity = exhaustVelocity;
    this.massFlowRate = massFlowRate;

    this.payloadMass = genome.rocket.payloadMass;
  };

  createRocket = () => {
    if (!this.rocketStartPosition || !this.rocketTargetPosition) {
      return;
    }

    this.rocketCount++;
    this.launcherGui.rocketCount = this.rocketCount;

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
      this.fuelMass,
      this.exhaustVelocity,
      this.massFlowRate,
      this.payloadMass
    );

    rocket.id = this.counter++;

    return rocket;
  };

  /** Restarts rocket numbering after all launched rockets are removed. */
  resetRockets = () => {
    this.counter = 0;
    this.rocketCount = 0;
    this.launcherGui.rocketCount = 0;
  };
}
