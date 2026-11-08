import type { ListBladeApi } from 'tweakpane';
import RocketView from '../rocket/RocketView';
import RocketGui from '../rocket/Rocket.gui';
import FrameTimeManager from '../helpers/FrameTimeManager';
import { announceLaunch } from '../helpers/Speech';
import { useSimulatorStore } from '../store/useSimulatorStore';
import type { LaunchQueueItem } from '../store/types';
import { removeTrigger, type SimulationContext } from './types';

const applyQueueItemToLauncher = (
  launcher: SimulationContext['launcher'],
  item: LaunchQueueItem
) => {
  const p = item.trajectoryParams;
  launcher.rocketStartPosition = item.startPosition;
  launcher.rocketTargetPosition = item.targetPosition;
  launcher.startInclineAfterDistance = p.startInclineAfterDistance;
  launcher.thrustInclineMaxDuration = p.thrustInclineMaxDuration;
  launcher.thrustInclineVelocity = p.thrustInclineVelocity;
  launcher.fuelMass = p.fuelMass;
  launcher.exhaustVelocity = p.exhaustVelocity;
  launcher.massFlowRate = p.massFlowRate;
};

/**
 * Launches the next queued item. Owns the "Missile Controls" pane: one
 * RocketGui at a time, switched with the missile selector.
 */
export const createRocketLauncher = (ctx: SimulationContext) => {
  const {
    scene,
    updateTriggers,
    earthView,
    cameraManager,
    launcher,
    launcherGui,
    launcherView,
    worldGui,
    rocketGuiPane,
    rocketGuiContainer,
  } = ctx;
  const store = useSimulatorStore.getState;

  let activeRocketGui: RocketGui | null = null;
  let activeRocketId: number | null = null;
  const missileActivators = new Map<number, () => void>();
  let missileSelector: ListBladeApi<number> | null = null;

  const updateMissileSelector = (selectedId: number) => {
    const options = [...missileActivators.keys()].map((id) => ({
      text: `Missile ${id}`,
      value: id,
    }));

    if (!missileSelector) {
      missileSelector = rocketGuiPane.addBlade({
        view: 'list',
        label: 'Missile',
        options,
        value: selectedId,
        index: 0,
      }) as ListBladeApi<number>;

      missileSelector.on('change', (ev) => {
        if (ev.value === activeRocketId) return;
        missileActivators.get(ev.value)?.();
      });
      return;
    }

    missileSelector.options = options;
    missileSelector.value = selectedId;
  };

  const showRocketGui = (
    rocket: NonNullable<ReturnType<typeof launcher.createRocket>>,
    rocketView: RocketView
  ) => {
    if (activeRocketGui) {
      activeRocketGui.remove();
      removeTrigger(updateTriggers, activeRocketGui);
    }

    const rocketGui = new RocketGui(
      rocketGuiPane,
      rocketGuiContainer,
      rocket,
      rocketView,
      scene
    );
    activeRocketGui = rocketGui;

    rocketGui.onFocusCameraClick = () => {
      cameraManager.setRocketCamera(rocketGui.trackingView);
      store().focusRocketView();
    };

    // The main view mirrors the Missile Controls viewport, so while
    // chasing it follows whichever missile is selected there.
    if (cameraManager.isChasing) {
      // Compute the new view's pose now: the main view renders before
      // the GUI updates, and would otherwise show one empty frame.
      rocketGui.update(0);
      cameraManager.setRocketCamera(rocketGui.trackingView);
    }

    updateTriggers.push(rocketGui);
    activeRocketId = rocket.id;
  };

  return () => {
    const nextLaunch = store().launchQueue[0];
    if (!nextLaunch) {
      console.error('No launches in queue.');
      return;
    }

    applyQueueItemToLauncher(launcher, nextLaunch);
    const rocket = launcher.createRocket();
    if (!rocket) {
      // Keep the item queued so the user can retry
      console.error('Rocket could not be created. Check launcher settings.');
      return;
    }
    store().dequeueLaunch();

    const rocketView = new RocketView(rocket, scene, earthView);
    rocketView.setSize(launcherGui.rocketSizeMultiplier);
    rocketView.init();
    rocketView.updatePrevFromRocket();

    earthView.addTorusMarker(nextLaunch.startPosition, 0x0000ff, 40, 4);
    earthView.addTorusMarker(nextLaunch.targetPosition, 0x00ff00, 40, 4);
    launcherView.remove();

    store().setRocketCount(launcher.rocketCount);

    // Same number as the "Missile N" label in the GUI
    announceLaunch(rocket.id);

    // Physics/view must update before the GUI so the tracking camera
    // renders the current frame's missile position.
    updateTriggers.push(new FrameTimeManager(rocket, rocketView, worldGui));

    missileActivators.set(rocket.id, () => showRocketGui(rocket, rocketView));
    showRocketGui(rocket, rocketView);
    updateMissileSelector(rocket.id);
  };
};
