import type * as THREE from 'three';
import Earth from '../earth/Earth';
import type MultiStageMissile from '../missile/MultiStageMissile';
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
  const multiStageMissile: MultiStageMissile | undefined =
    bestGenome?.multiStageMissile;
  if (!multiStageMissile) return null;
  const { missile } = multiStageMissile;

  return {
    generation,
    fitness: bestGenome.fitness,
    // Real impact distance, unlike fitness which may also include
    // flight time when "minimize flight time" is enabled
    missDistance: missile.position.distanceTo(targetPos),
    startInclineAfterAltitude: missile.startInclineAfterAltitude,
    thrustInclineMaxDuration: missile.thrustInclineMaxDuration,
    thrustInclineVelocity: missile.thrustInclineVelocity,
    stages: multiStageMissile.stages.map((s) => ({ ...s })),
    fuelMass: missile.fuelMass,
    payloadMass: missile.payloadMass,
    fuelCombustionTime: missile.fuelCombustionTime,
    maxAltitude: missile.maxAltitude,
    travelledDistance: missile.travelledDistance.length(),
    flightTime: missile.flightTime,
  };
};

/** Runs the trajectory search and appends the result to the launch queue. */
export const createTrajectoryCalculator =
  ({ launcher, launcherGui }: SimulationContext, preview: TrajectoryPreview) =>
  () => {
    if (!launcher.missileStartPosition || !launcher.missileTargetPosition) {
      console.error('Start or target position is not set.');
      return;
    }

    const store = useSimulatorStore.getState;
    store().startCalculation();
    announceCalculatingTrajectory();

    const startPos = launcher.missileStartPosition.clone();
    const targetPos = launcher.missileTargetPosition.clone();
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
