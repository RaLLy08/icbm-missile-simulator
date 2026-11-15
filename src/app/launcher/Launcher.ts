import * as THREE from 'three';
import { FlightTrajectory } from '../FlightTrajectory';
import Earth from '../earth/Earth';
import LauncherGui from './Launcher.gui';
import Missile from '../missile/Missile';
import MultiStageMissile, { type MissileStage } from '../missile/MultiStageMissile';

export default class Launcher {
  counter = 0;

  missileStartPosition: THREE.Vector3 | null = null;
  missileTargetPosition: THREE.Vector3 | null = null;
  startInclineAfterAltitude = 8; // km
  thrustInclineMaxDuration = 160; // seconds
  thrustInclineVelocity = THREE.MathUtils.degToRad(0.5); // radians per second
  stages: MissileStage[] = [
    { exhaustVelocity: 4, massFlowRate: 50, fuelMass: 30000 },
  ];
  payloadMass = 800; // kg

  missileCount = 0;

  constructor(
    private launcherGui: LauncherGui,
    private earth: Earth
  ) {}

  setStartPosition = (coordinates: THREE.Vector3) => {
    this.missileStartPosition = coordinates.clone();
  };

  setTargetPosition = (coordinates: THREE.Vector3) => {
    this.missileTargetPosition = coordinates.clone();
  };

  calcTrajectory = async (
    onProgress = (
      _bestGenome: any,
      _progress: number,
      _bestTrajectory: THREE.Vector3[]
    ) => {}
  ) => {
    if (!this.missileStartPosition || !this.missileTargetPosition) {
      return;
    }

    const euclideanDistance = this.missileStartPosition
      .clone()
      .sub(this.missileTargetPosition)
      .length();

    const bounds = this.launcherGui.calculationBounds;

    const flightTrajectory = new FlightTrajectory(
      this.earth,
      this.missileStartPosition,
      this.missileTargetPosition,
      {
        startInclineAfterAltitude: { ...bounds.startInclineAfterAltitude },
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

    this.setMissileParams(bestGenome);
  };

  private setMissileParams = (genome: any) => {
    const multiStageMissile: MultiStageMissile = genome.multiStageMissile;
    const { missile } = multiStageMissile;

    this.startInclineAfterAltitude = missile.startInclineAfterAltitude;
    this.thrustInclineMaxDuration = missile.thrustInclineMaxDuration;
    this.thrustInclineVelocity = missile.thrustInclineVelocity;
    this.stages = multiStageMissile.stages.map((s) => ({ ...s }));

    this.payloadMass = missile.payloadMass;
  };

  createMissile = () => {
    if (!this.missileStartPosition || !this.missileTargetPosition) {
      return;
    }

    this.missileCount++;
    this.launcherGui.missileCount = this.missileCount;

    const targetInclineVector = this.missileTargetPosition
      .clone()
      .sub(this.missileStartPosition)
      .normalize();

    const missile = new Missile(
      this.earth,
      this.missileStartPosition,
      targetInclineVector,
      this.startInclineAfterAltitude,
      this.thrustInclineMaxDuration,
      this.thrustInclineVelocity,
      undefined, // fuel and engine are set per stage by MultiStageMissile
      undefined,
      undefined,
      this.payloadMass
    );

    missile.id = this.counter++;

    return new MultiStageMissile(missile, this.stages);
  };

  /** Restarts missile numbering after all launched missiles are removed. */
  resetMissiles = () => {
    this.counter = 0;
    this.missileCount = 0;
    this.launcherGui.missileCount = 0;
  };
}
