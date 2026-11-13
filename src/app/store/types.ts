import type * as THREE from 'three';
import type { RocketStage } from '../rocket/MultiStageRocket';

export type GeoPosition = {
  latitude: number;
  longitude: number;
};

export type BestCandidate = {
  generation: number;
  fitness: number;
  missDistance: number;
  startInclineAfterDistance: number;
  thrustInclineMaxDuration: number;
  thrustInclineVelocity: number;
  stages: RocketStage[];
  /** Total fuel mass of all stages */
  fuelMass: number;
  payloadMass: number;
  fuelCombustionTime: number;
  maxAltitude: number;
  travelledDistance: number;
  flightTime: number;
};

export type TrajectoryParams = {
  startInclineAfterDistance: number;
  thrustInclineMaxDuration: number;
  thrustInclineVelocity: number;
  stages: RocketStage[];
};

export type LaunchQueueItem = {
  id: number;
  startPosition: THREE.Vector3;
  targetPosition: THREE.Vector3;
  startGeo: GeoPosition;
  targetGeo: GeoPosition;
  trajectoryParams: TrajectoryParams;
  candidate: BestCandidate | null;
  /**
   * Real length of the selected missile preset, m. Null/absent for Custom
   * (and for queue items persisted before this field existed).
   */
  missileHeight?: number | null;
};

/** Imperative entry points into the three.js engine, registered on mount. */
export type SimulatorCommands = {
  calculateTrajectory: () => void;
  launchRocket: () => void;
  focusOnEarth: () => void;
  setTimeMultiplier: (value: number) => void;
  toggleTime: () => void;
  setMuted: (muted: boolean) => void;
  /** Removes every launched rocket with its trail and markers. */
  clearWorld: () => void;
};
