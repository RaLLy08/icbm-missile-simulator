import * as THREE from 'three';
import { FlightTrajectory } from '../FlightTrajectory';
import Earth from '../earth/Earth';
import LauncherGui from './Launcher.gui';
import Rocket from '../rocket/Rocket';
import MultiStageRocket, { type RocketStage } from '../rocket/MultiStageRocket';

export default class Launcher {
  counter = 0;

  rocketStartPosition: THREE.Vector3 | null = null;
  rocketTargetPosition: THREE.Vector3 | null = null;
  startInclineAfterDistance = 8; // km
  thrustInclineMaxDuration = 160; // seconds
  thrustInclineVelocity = THREE.MathUtils.degToRad(0.5); // radians per second
  stages: RocketStage[] = [
    { exhaustVelocity: 4, massFlowRate: 50, fuelMass: 30000 },
  ];
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
        stages: bounds.stages.map((s) => ({
          stage: s.stage,
          exhaustVelocity: { ...s.exhaustVelocity },
          massFlowRate: { ...s.massFlowRate },
          fuelMass: { ...s.fuelMass },
        })),
        payloadMass: this.launcherGui.payloadMass,
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
    const multiStageRocket: MultiStageRocket = genome.multiStageRocket;
    const { rocket } = multiStageRocket;

    this.startInclineAfterDistance = rocket.startInclineAfterDistance;
    this.thrustInclineMaxDuration = rocket.thrustInclineMaxDuration;
    this.thrustInclineVelocity = rocket.thrustInclineVelocity;
    this.stages = multiStageRocket.stages.map((s) => ({ ...s }));

    this.payloadMass = rocket.payloadMass;
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
      undefined, // fuel and engine are set per stage by MultiStageRocket
      undefined,
      undefined,
      this.payloadMass
    );

    rocket.id = this.counter++;

    return new MultiStageRocket(rocket, this.stages);
  };

  /** Restarts rocket numbering after all launched rockets are removed. */
  resetRockets = () => {
    this.counter = 0;
    this.rocketCount = 0;
    this.launcherGui.rocketCount = 0;
  };
}
