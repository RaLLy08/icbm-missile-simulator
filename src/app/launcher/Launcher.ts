import * as THREE from 'three';
import { FlightTrajectory } from '../FlightTrajectory';
import Earth from '../earth/Earth';
import LauncherGui from './Launcher.gui';
import Rocket from 'app/rocket/Rocket';
import { getMissileById, type MissileSpec } from './MissileDatabase';

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
  ) {
    this.applyCurrentMissilePreset();

    launcherGui.onMissileSelected = (spec: MissileSpec) => {
      this.applyMissileSpec(spec);
    };
  }

  private applyCurrentMissilePreset() {
    const spec = getMissileById(this.launcherGui.selectedMissileId);
    if (spec) {
      this.applyMissileSpec(spec);
    }
  }

  private applyMissileSpec(spec: MissileSpec) {
    this.exhaustVelocity = spec.exhaustVelocity;
    this.massFlowRate = spec.massFlowRate;
    this.fuelMass = spec.fuelMass;
    this.payloadMass = spec.payloadMass;
    this.startInclineAfterDistance = spec.startInclineAfterDistance;
    this.thrustInclineMaxDuration = spec.thrustInclineMaxDuration;
    this.thrustInclineVelocity = THREE.MathUtils.degToRad(spec.thrustInclineVelocityDeg);

    this.launcherGui.startInclineAfterDistance = spec.startInclineAfterDistance;
    this.launcherGui.currentThrustInclineDuration = 0;
    this.launcherGui.thrustInclineVelocity = THREE.MathUtils.degToRad(spec.thrustInclineVelocityDeg);
    this.launcherGui.fuelCombustionTime = spec.fuelMass / spec.massFlowRate;
    this.launcherGui.fuelMass = spec.fuelMass;
    this.launcherGui.massFlowRate = spec.massFlowRate;
    this.launcherGui.exhaustVelocity = spec.exhaustVelocity;
    this.launcherGui.payloadMass = spec.payloadMass;
  }

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
        fuelMass: {
          min: 300,
          max: 70000,
        },
        exhaustVelocity: {
          min: 1,
          max: 3,
        },
        massFlowRate: {
          min: 1,
          max: 100,
        },
      },
      {
        maxDistanceThreshold: euclideanDistance * 6,
        maxFlightTimeSeconds: 60 * 120,
        maxAltitude: 6000,
      },
      this.launcherGui.minimizeFlightTime,
      this.launcherGui.increaseCalculationAccuracy
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

    const rocket = genome.rocket;

    this.launcherGui.startInclineAfterDistance = this.startInclineAfterDistance;
    this.launcherGui.currentThrustInclineDuration =
      rocket.currentThrustInclineDuration;
    this.launcherGui.thrustInclineVelocity = this.thrustInclineVelocity;
    this.launcherGui.fuelMass = this.fuelMass;

    this.launcherGui.fuelCombustionTime = rocket.fuelCombustionTime;
    this.launcherGui.maxAltitude = rocket.maxAltitude;
    this.launcherGui.travelledDistance = rocket.travelledDistance.length();
    this.launcherGui.flightTime = rocket.flightTime;

    this.payloadMass = rocket.payloadMass;
    this.launcherGui.payloadMass = rocket.payloadMass;
    this.launcherGui.fuelMass = rocket.fuelMass;
    this.launcherGui.massFlowRate = rocket.massFlowRate;
    this.launcherGui.exhaustVelocity = rocket.exhaustVelocity;
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
      this.payloadMass,
    );

    rocket.id = this.counter++;

    return rocket;
  };
}
