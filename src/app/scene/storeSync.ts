import { useSimulatorStore } from '../store/useSimulatorStore';
import { syncQueueMarkers } from './queueMarkers';
import type { SimulationContext } from './types';

/**
 * Mirrors store state that the 3D scene has to reflect.
 * Returns a function that unsubscribes and removes what it added.
 */
export const syncSceneWithStore = ({
  scene,
  cameraManager,
  launcherView,
  earthView,
}: SimulationContext) => {
  const initial = useSimulatorStore.getState();
  cameraManager.miniWindowEnabled = !initial.isMiniWindowFolded;
  let queueMarkers = syncQueueMarkers(
    scene,
    earthView.ringMarkers,
    initial.launchQueue,
    initial.selectedQueueItemId,
    []
  );

  const unsubscribe = useSimulatorStore.subscribe((state, prev) => {
    if (
      state.launchQueue !== prev.launchQueue ||
      state.selectedQueueItemId !== prev.selectedQueueItemId
    ) {
      queueMarkers = syncQueueMarkers(
        scene,
        earthView.ringMarkers,
        state.launchQueue,
        state.selectedQueueItemId,
        queueMarkers
      );
    }

    if (state.isMiniWindowFolded !== prev.isMiniWindowFolded) {
      cameraManager.miniWindowEnabled = !state.isMiniWindowFolded;
    }

    // Selection ended (picked, cancelled or toggled off): drop the preview
    const wasSelecting = prev.startPositionActive || prev.targetPositionActive;
    const isSelecting = state.startPositionActive || state.targetPositionActive;
    if (wasSelecting && !isSelecting) {
      launcherView.activePositionWasSet();
    }
  });

  return () => {
    unsubscribe();
    queueMarkers.forEach((marker) => marker.removeFromParent());
  };
};
