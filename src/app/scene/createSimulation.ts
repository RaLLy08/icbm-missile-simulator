import * as THREE from 'three';
import { Pane } from 'tweakpane';
import Earth from '../earth/Earth';
import EarthView from '../earth/EarthView';
import EarthGui from '../earth/Earth.gui';
import WorldGui from '../WorldGui';
import Launcher from '../launcher/Launcher';
import LauncherView from '../launcher/LauncherView';
import LauncherGui from '../launcher/Launcher.gui';
import RocketTrackingView from '../rocket/RocketTrackingView';
import MouseTracker from '../helpers/MouseTracker';
import MouseTrackerGui from '../helpers/MouseTracker.gui';
import CameraManager from '../helpers/CameraManager';
import { setAudioListener } from '../helpers/SpatialAudio';
import StarField from '../space/StarField';
import { isMobileViewport } from '../viewport';
import { useSimulatorStore } from '../store/useSimulatorStore';
import { createScene } from './createScene';
import {
    createFullScreenRenderer,
    createMiniWindowRenderer,
} from './renderers';
import { createTrajectoryPreview } from './trajectoryPreview';
import { createTrajectoryCalculator } from './trajectoryCalculation';
import { createRocketLauncher } from './rocketLaunching';
import { setupPositionPicking } from './positionPicking';
import { syncSceneWithStore } from './storeSync';
import type { SimulationContext, Updatable } from './types';

export type SimulationElements = {
  sceneContainer: HTMLElement;
  mainGuiContainer: HTMLElement;
  rocketGuiContainer: HTMLElement;
  miniWindow: HTMLElement;
  mouseFollower: HTMLElement | null;
};

export type SimulationOptions = {
  /** Extra items ticked every frame (e.g. the FPS meter). */
  extraTriggers?: Updatable[];
  /** Called with the formatted simulated time whenever it changes. */
  onTimePassedUpdate?: (text: string) => void;
};

/**
 * Builds the whole 3D simulation inside the given DOM elements, wires it to
 * the store and starts the render loop. Returns a dispose function.
 */
export const createSimulation = (
  elements: SimulationElements,
  { extraTriggers = [], onTimePassedUpdate }: SimulationOptions = {}
) => {
  const store = useSimulatorStore.getState;
  const scene = createScene();
  const clock = new THREE.Clock();
  const updateTriggers: Updatable[] = [...extraTriggers];

  // On phones both panes start collapsed so they don't cover the globe
  const isMobile = isMobileViewport();
  const mainPane = new Pane({
    title: 'Main Controls',
    container: elements.mainGuiContainer,
    expanded: !isMobile,
  });
  const rocketGuiPane = new Pane({
    title: 'Missile Controls',
    container: elements.rocketGuiContainer,
    expanded: !isMobile,
  });

  const fullScreenRenderer = createFullScreenRenderer(elements.sceneContainer);
  const miniWindowRenderer = createMiniWindowRenderer(
    elements.miniWindow,
    isMobile
  );

  const mouseTracker = new MouseTracker(window);

  const starField = new StarField(scene);
  const earth = new Earth();
  const cameraManager = new CameraManager(
    scene,
    fullScreenRenderer,
    miniWindowRenderer,
    mouseTracker
  );
  const earthGui = new EarthGui(mainPane);
  const earthView = new EarthView(earth, scene, earthGui);
  updateTriggers.push(starField, earth, cameraManager, earthView);

  cameraManager.setEarthCamera(earth);
  setAudioListener(() => cameraManager.getCamera());

  // Set camera for atmospheric glow updates
  const camera = cameraManager.getCamera();
  if (camera) {
    // Warm up the missile camera's GL context so launch doesn't stall
    RocketTrackingView.prewarm(scene, camera);
    earthView.setCamera(camera);
  }

  const launcherGui = new LauncherGui(mainPane);
  const launcherView = new LauncherView(earth, scene);
  const launcher = new Launcher(launcherGui, earth);

  // WorldGui owns time/audio; the store mirrors it for the React UI
  const worldGui = new WorldGui(mainPane, clock);
  updateTriggers.push(worldGui);
  starField.setVisible(worldGui.showStars);
  worldGui.onShowStarsChange = (show) => starField.setVisible(show);
  worldGui.onMutedChange = (muted) => store().setIsMuted(muted);
  worldGui.onTimeMultiplierChange = (value) => store().setTimeMultiplier(value);
  worldGui.onTimeRunningChange = (running) => store().setIsTimeRunning(running);
  if (onTimePassedUpdate) worldGui.onTimePassedUpdate = onTimePassedUpdate;

  updateTriggers.push(new MouseTrackerGui(worldGui.folder, mouseTracker));

  const ctx: SimulationContext = {
    scene,
    updateTriggers,
    earth,
    earthView,
    cameraManager,
    launcher,
    launcherGui,
    launcherView,
    worldGui,
    rocketGuiPane,
    rocketGuiContainer: elements.rocketGuiContainer,
  };

  const focusOnEarth = () => {
    cameraManager.setEarthCamera(earth);
    store().focusEarthView();
  };
  earthGui.onFocusCameraClick = focusOnEarth;

  store().registerCommands({
    calculateTrajectory: createTrajectoryCalculator(
      ctx,
      createTrajectoryPreview(scene)
    ),
    launchRocket: createRocketLauncher(ctx),
    focusOnEarth,
    setTimeMultiplier: (value) => worldGui.setTimeMultiplier(value),
    toggleTime: () => worldGui.toggleTime(),
    setMuted: (muted) => worldGui.setMuted(muted),
  });

  const stopStoreSync = syncSceneWithStore(ctx);
  const picking = setupPositionPicking(
    ctx,
    fullScreenRenderer.domElement,
    elements.mouseFollower
  );

  // Wall-clock time for camera / UI smoothing: `clock` is stopped while
  // time is paused, which would freeze zoom and rotation easing.
  const realClock = new THREE.Clock();

  fullScreenRenderer.setAnimationLoop(() => {
    const deltaTime = clock.getDelta();
    // Capped so a background tab doesn't cause one huge jump
    const realDeltaTime = Math.min(realClock.getDelta(), 0.1);

    mouseTracker.update(deltaTime);
    picking.update();

    updateTriggers.forEach((trigger) => {
      trigger.update(trigger.usesRealTime ? realDeltaTime : deltaTime);
    });
  });

  return () => {
    fullScreenRenderer.setAnimationLoop(null);
    store().resetCommands();
    stopStoreSync();
    picking.dispose();

    elements.sceneContainer.removeChild(fullScreenRenderer.domElement);
    starField.dispose();
    fullScreenRenderer.dispose();
    miniWindowRenderer.dispose();
  };
};
