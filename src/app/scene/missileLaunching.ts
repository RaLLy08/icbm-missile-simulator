import type * as THREE from 'three';
import type { ListBladeApi } from 'tweakpane';
import MissileView from '../missile/missile-view/MissileView';
import MissileGui from '../missile/Missile.gui';
import FrameTimeManager from '../helpers/FrameTimeManager';
import { announceEstimatedFlightTime, announceLaunch } from '../helpers/Speech';
import { useSimulatorStore } from '../store/useSimulatorStore';
import type { LaunchQueueItem } from '../store/types';
import { removeTrigger, type SimulationContext } from './types';

const applyQueueItemToLauncher = (
  launcher: SimulationContext['launcher'],
  item: LaunchQueueItem
) => {
  const p = item.trajectoryParams;
  launcher.missileStartPosition = item.startPosition;
  launcher.missileTargetPosition = item.targetPosition;
  launcher.startInclineAfterAltitude = p.startInclineAfterAltitude;
  launcher.thrustInclineMaxDuration = p.thrustInclineMaxDuration;
  launcher.thrustInclineVelocity = p.thrustInclineVelocity;
  launcher.stages = p.stages.map((s) => ({ ...s }));
};

/** Everything one launch adds to the scene, so it can be removed again. */
type LaunchedMissile = {
  missileView: MissileView;
  frameTimeManager: FrameTimeManager;
  markers: THREE.Mesh[];
};

/**
 * Launches the next queued item and can clear every launched missile. Owns
 * the "Missile Controls" pane: one MissileGui at a time, switched with the
 * missile selector.
 */
export const createMissileLauncher = (ctx: SimulationContext) => {
  const {
    scene,
    updateTriggers,
    earthView,
    cameraManager,
    launcher,
    launcherGui,
    launcherView,
    worldGui,
    missileGuiPane,
    missileGuiContainer,
  } = ctx;
  const store = useSimulatorStore.getState;

  let activeMissileGui: MissileGui | null = null;
  let activeMissileId: number | null = null;
  const missileActivators = new Map<number, () => void>();
  let missileSelector: ListBladeApi<number> | null = null;
  const launchedMissiles: LaunchedMissile[] = [];

  const updateMissileSelector = (selectedId: number) => {
    const options = [...missileActivators.keys()].map((id) => ({
      text: `Missile ${id}`,
      value: id,
    }));

    if (!missileSelector) {
      missileSelector = missileGuiPane.addBlade({
        view: 'list',
        label: 'Missile',
        options,
        value: selectedId,
        index: 0,
      }) as ListBladeApi<number>;

      missileSelector.on('change', (ev) => {
        if (ev.value === activeMissileId) return;
        missileActivators.get(ev.value)?.();
      });
      return;
    }

    missileSelector.options = options;
    missileSelector.value = selectedId;
  };

  const showMissileGui = (
    multiStageMissile: NonNullable<ReturnType<typeof launcher.createMissile>>,
    missileView: MissileView
  ) => {
    const { missile } = multiStageMissile;
    if (activeMissileGui) {
      activeMissileGui.remove();
      removeTrigger(updateTriggers, activeMissileGui);
    }

    const missileGui = new MissileGui(
      missileGuiPane,
      missileGuiContainer,
      multiStageMissile,
      missileView,
      scene
    );
    activeMissileGui = missileGui;

    missileGui.onFocusCameraClick = () => {
      cameraManager.setMissileCamera(missileGui.trackingView);
      store().focusMissileView();
    };

    // The main view mirrors the Missile Controls viewport, so while
    // chasing it follows whichever missile is selected there.
    if (cameraManager.isChasing) {
      // Compute the new view's pose now: the main view renders before
      // the GUI updates, and would otherwise show one empty frame.
      missileGui.update(0);
      cameraManager.setMissileCamera(missileGui.trackingView);
    }

    updateTriggers.push(missileGui);
    activeMissileId = missile.id;
  };

  const launch = () => {
    const nextLaunch = store().launchQueue[0];
    if (!nextLaunch) {
      console.error('No launches in queue.');
      return;
    }

    applyQueueItemToLauncher(launcher, nextLaunch);
    const multiStageMissile = launcher.createMissile();
    if (!multiStageMissile) {
      // Keep the item queued so the user can retry
      console.error('Missile could not be created. Check launcher settings.');
      return;
    }
    const { missile } = multiStageMissile;
    store().dequeueLaunch();

    const missileView = new MissileView(
      missile,
      scene,
      earthView,
      nextLaunch.targetPosition.clone()
    );
    missileView.setSize(
      launcherGui.missileSizeMultiplier *
        MissileView.heightScale(nextLaunch.missileHeight),
      multiStageMissile.stages.length
    );
    missileView.setMaxBurnRate(
      Math.max(...multiStageMissile.stages.map((s) => s.massFlowRate))
    );
    missileView.init();
    missileView.updatePrevFromMissile();

    const markers = [
      earthView.addTorusMarker(nextLaunch.startPosition, 0x0000ff, 40_000, 4_000),
      earthView.addTorusMarker(nextLaunch.targetPosition, 0x00ff00, 40_000, 4_000),
    ];
    launcherView.remove();

    store().setMissileCount(launcher.missileCount);

    // Same number as the "Missile N" label in the GUI
    announceLaunch(missile.id);
    // From the trajectory calculation this launch was queued with
    announceEstimatedFlightTime(nextLaunch.candidate?.flightTime);

    // Physics/view must update before the GUI so the tracking camera
    // renders the current frame's missile position.
    const frameTimeManager = new FrameTimeManager(
      multiStageMissile,
      missileView,
      worldGui
    );
    updateTriggers.push(frameTimeManager);
    launchedMissiles.push({ missileView, frameTimeManager, markers });

    missileActivators.set(missile.id, () =>
      showMissileGui(multiStageMissile, missileView)
    );
    showMissileGui(multiStageMissile, missileView);
    updateMissileSelector(missile.id);
  };

  /** Removes every launched missile, its trail, markers and GUI. */
  const clear = () => {
    // The chase camera renders the active missile's tracking view, which is
    // disposed below
    if (cameraManager.isChasing) store().commands.focusOnEarth();

    if (activeMissileGui) {
      activeMissileGui.remove();
      removeTrigger(updateTriggers, activeMissileGui);
      activeMissileGui = null;
    }
    activeMissileId = null;

    missileSelector?.dispose();
    missileSelector = null;
    missileActivators.clear();

    launchedMissiles.forEach(({ missileView, frameTimeManager, markers }) => {
      removeTrigger(updateTriggers, frameTimeManager);
      missileView.remove();
      markers.forEach((marker) => {
        scene.remove(marker);
        marker.geometry.dispose();
        (marker.material as THREE.Material).dispose();
      });
    });
    launchedMissiles.length = 0;

    launcher.resetMissiles();
    store().setMissileCount(0);
  };

  return { launch, clear };
};
