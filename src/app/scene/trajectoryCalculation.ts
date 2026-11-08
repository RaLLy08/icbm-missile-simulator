import type * as THREE from 'three';
import Earth from '../earth/Earth';
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
  const rocket = bestGenome?.rocket;
  if (!rocket) return null;

  const [
    startInclineAfterDistance,
    thrustInclineMaxDuration,
    thrustInclineVelocity,
    fuelMass,
    exhaustVelocity,
    massFlowRate,
  ] = bestGenome;

  return {
    generation,
    fitness: bestGenome.fitness,
    // Real impact distance, unlike fitness which may also include
    // flight time when "minimize flight time" is enabled
    missDistance: rocket.position.distanceTo(targetPos),
    startInclineAfterDistance,
    thrustInclineMaxDuration,
    thrustInclineVelocity,
    fuelMass,
    exhaustVelocity,
    massFlowRate,
    payloadMass: rocket.payloadMass,
    fuelCombustionTime: rocket.fuelCombustionTime,
    maxAltitude: rocket.maxAltitude,
    travelledDistance: rocket.travelledDistance.length(),
    flightTime: rocket.flightTime,
  };
};

/** Runs the trajectory search and appends the result to the launch queue. */
export const createTrajectoryCalculator =
  ({ launcher }: SimulationContext, preview: TrajectoryPreview) =>
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
          startInclineAfterDistance: launcher.startInclineAfterDistance,
          thrustInclineMaxDuration: launcher.thrustInclineMaxDuration,
          thrustInclineVelocity: launcher.thrustInclineVelocity,
          fuelMass: launcher.fuelMass,
          exhaustVelocity: launcher.exhaustVelocity,
          massFlowRate: launcher.massFlowRate,
        },
        candidate: lastCandidate,
      });
      store().finishCalculation();
      preview.show(null);
    });
  };
