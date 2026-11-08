import type * as THREE from 'three';

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
  fuelMass: number;
  exhaustVelocity: number;
  massFlowRate: number;
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
  fuelMass: number;
  exhaustVelocity: number;
  massFlowRate: number;
};

export type LaunchQueueItem = {
  id: number;
  startPosition: THREE.Vector3;
  targetPosition: THREE.Vector3;
  startGeo: GeoPosition;
  targetGeo: GeoPosition;
  trajectoryParams: TrajectoryParams;
  candidate: BestCandidate | null;
};

/** Imperative entry points into the three.js engine, registered on mount. */
export type SimulatorCommands = {
  calculateTrajectory: () => void;
  launchRocket: () => void;
  focusOnEarth: () => void;
  setTimeMultiplier: (value: number) => void;
  toggleTime: () => void;
  setMuted: (muted: boolean) => void;
};
