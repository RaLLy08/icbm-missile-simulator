import type * as THREE from 'three';
import Earth from '../earth/Earth';
import type MultiStageRocket from '../rocket/MultiStageRocket';
import { announceCalculatingTrajectory } from '../helpers/Speech';
import { useSimulatorStore } from '../store/useSimulatorStore';
import type { BestCandidate } from '../store/types';
import type { TrajectoryPreview } from './trajectoryPreview';
import type { SimulationContext } from './types';

/** Snapshot of the GA's best genome, shown later in the candidate panel. */
const toCandidate = (
  bestGenome: any,
  generation: number,
  targetPos: THREE.Vector3
): BestCandidate | null => {
  const multiStageRocket: MultiStageRocket | undefined =
    bestGenome?.multiStageRocket;
  if (!multiStageRocket) return null;
  const { rocket } = multiStageRocket;

  return {
    generation,
    fitness: bestGenome.fitness,
    // Real impact distance, unlike fitness which may also include
    // flight time when "minimize flight time" is enabled
    missDistance: rocket.position.distanceTo(targetPos),
    startInclineAfterAltitude: rocket.startInclineAfterAltitude,
    thrustInclineMaxDuration: rocket.thrustInclineMaxDuration,
    thrustInclineVelocity: rocket.thrustInclineVelocity,
    stages: multiStageRocket.stages.map((s) => ({ ...s })),
    fuelMass: rocket.fuelMass,
    payloadMass: rocket.payloadMass,
    fuelCombustionTime: rocket.fuelCombustionTime,
    maxAltitude: rocket.maxAltitude,
    travelledDistance: rocket.travelledDistance.length(),
    flightTime: rocket.flightTime,
  };
};

/** Runs the trajectory search and appends the result to the launch queue. */
export const createTrajectoryCalculator =
  ({ launcher, launcherGui }: SimulationContext, preview: TrajectoryPreview) =>
  () => {
    if (!launcher.rocketStartPosition || !launcher.rocketTargetPosition) {
      console.error('Start or target position is not set.');
      return;
    }

    const store = useSimulatorStore.getState;
    store().startCalculation();
    announceCalculatingTrajectory();

    const startPos = launcher.rocketStartPosition.clone();
    const targetPos = launcher.rocketTargetPosition.clone();
    // Snapshot now: the preset may change before this item is launched
    const missileHeight = launcherGui.missileHeight;

    let generation = 0;
    let lastCandidate: BestCandidate | null = null;
    const onProgress = (
      bestGenome: any,
      progress: number,
      bestTrajectory: THREE.Vector3[]
    ) => {
      store().setCalculationProgress(progress);
      preview.show(bestTrajectory);
      generation++;
      lastCandidate =
        toCandidate(bestGenome, generation, targetPos) ?? lastCandidate;
    };

    launcher.calcTrajectory(onProgress).then(() => {
      store().enqueueLaunch({
        startPosition: startPos,
        targetPosition: targetPos,
        startGeo: Earth.positionToGeoCoordinates(startPos),
        targetGeo: Earth.positionToGeoCoordinates(targetPos),
        trajectoryParams: {
          startInclineAfterAltitude: launcher.startInclineAfterAltitude,
          thrustInclineMaxDuration: launcher.thrustInclineMaxDuration,
          thrustInclineVelocity: launcher.thrustInclineVelocity,
          stages: launcher.stages.map((s) => ({ ...s })),
        },
        candidate: lastCandidate,
        missileHeight,
      });
      store().finishCalculation();
      preview.show(null);
    });
  };
