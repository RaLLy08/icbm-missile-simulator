import * as THREE from 'three';
import { useEffect, useId, useRef } from 'react';
import { ListBladeApi, Pane } from 'tweakpane';
import Stats from 'three/examples/jsm/libs/stats.module';
import s from './OrbitalVelocity.module.scss';
import clsx from 'clsx';

import Earth from './earth/Earth';
import EarthView from './earth/EarthView';
import RocketView from './rocket/RocketView';
import EarthGui from './earth/Earth.gui';
import WorldGui from './WorldGui';
import Launcher from './launcher/Launcher';
import LauncherView from './launcher/LauncherView';
import LauncherGui from './launcher/Launcher.gui';
import RocketGui from './rocket/Rocket.gui';
import RocketTrackingView from './rocket/RocketTrackingView';
import FrameTimeManager from './helpers/FrameTimeManager';
import MouseTracker from './helpers/MouseTracker';
import MouseTrackerGui from './helpers/MouseTracker.gui';
import CameraManager from './helpers/CameraManager';
import { setAudioListener } from './helpers/SpatialAudio';
import {
    announceCalculatingTrajectory,
    announceLaunch,
} from './helpers/Speech';
import StarField from './space/StarField';
import { isMobileViewport } from './viewport';
import { useSimulatorStore } from './store/useSimulatorStore';
import type { BestCandidate } from './store/types';
import { syncQueueMarkers } from './scene/queueMarkers';
import { subscribeInstructionsToHash } from './instructions/navigation';
import LaunchPad from './components/LaunchPad';
import ReturnToEarthBar from './components/ReturnToEarthBar';
import PositionSelectionOverlay from './components/PositionSelectionOverlay';
import MiniWindow from './components/MiniWindow';
import InstructionsModal from './components/InstructionsModal';

const scene = new THREE.Scene();

// Strong ambient light for even illumination across the entire Earth
const ambientLight = new THREE.AmbientLight(0xffffff, 2.5);
scene.add(ambientLight);

// Subtle directional light for minimal definition without harsh shadows
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.3);
directionalLight.position.set(5, 3, 5).normalize();
directionalLight.castShadow = false;

scene.add(directionalLight);

// Add hemisphere light for global illumination (sky and ground bounce light)
const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.8);
scene.add(hemisphereLight);

const clock = new THREE.Clock();

const stats = new Stats();
stats.showPanel(0);
// stats.js sets position:fixed/top-left inline; let the CSS wrapper place it
stats.dom.style.cssText = 'position:relative;cursor:pointer;opacity:0.9;';

const updateTriggers: {
  [key: string]: any;
  update: (deltaTime?: number) => void;
}[] = [stats];

const OrbitalVelocity = () => {
  // Updated imperatively every frame to avoid re-rendering React
  const timePassedTextRef = useRef(WorldGui.formatTimePassed(0));
  const timePassedElRef = useRef<HTMLDivElement | null>(null);

  const isFocusedOnEarth = useSimulatorStore((st) => st.isFocusedOnEarth);
  const isPositionSelectionActive = useSimulatorStore(
    (st) => st.startPositionActive || st.targetPositionActive
  );

  const sceneContainerId = useId();
  const mainGuiContainerId = useId();
  const rocketGuiContainerId = useId();
  const mouseFollowerId = useId();
  const miniWindowId = useId();

  useEffect(() => subscribeInstructionsToHash(), []);

  useEffect(() => {
    const sceneContainer = document.getElementById(sceneContainerId);
    const mainGuiContainer = document.getElementById(mainGuiContainerId);
    const rocketGuiContainer = document.getElementById(rocketGuiContainerId);
    const mouseFollower = document.getElementById(mouseFollowerId);
    const miniWindow = document.getElementById(miniWindowId);
    const store = useSimulatorStore;

    if (!sceneContainer) return;

    // On phones both panes start collapsed so they don't cover the globe
    const isMobile = isMobileViewport();
    const mainPane = new Pane({
      title: 'Main Controls',
      container: mainGuiContainer!,
      expanded: !isMobile,
    });
    const rocketGuiPane = new Pane({
      title: 'Missile Controls',
      container: rocketGuiContainer!,
      expanded: !isMobile,
    });

    const createMiniWindowRenderer = () => {
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        logarithmicDepthBuffer: true,
      });
      renderer.setClearColor(0x000000, 1);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      // must match .miniWindowContainer size in the stylesheet
      const miniSize = isMobile ? 180 : 300;
      miniWindow!.style.width = `${miniSize}px`;
      miniWindow!.style.height = `${miniSize}px`;

      // Don't measure the element: on phones the minimap starts folded
      // (display: none), which would report 0x0 and leave the canvas empty.
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(miniSize, miniSize);
      miniWindow!.appendChild(renderer.domElement);

      return renderer;
    };

    const createFullScreenRenderer = () => {
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        logarithmicDepthBuffer: true,
      });
      renderer.setClearColor(0x000000, 1);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(window.innerWidth, window.innerHeight);
      sceneContainer!.appendChild(renderer.domElement);

      return renderer;
    };

    const fullScreenRenderer = createFullScreenRenderer();
    const miniWindowRenderer = createMiniWindowRenderer();

    const mouseTracker = new MouseTracker(window);

    const starField = new StarField(scene);
    updateTriggers.push(starField);

    const earth = new Earth();
    updateTriggers.push(earth);

    const cameraManager = new CameraManager(
      scene,
      fullScreenRenderer,
      miniWindowRenderer,
      mouseTracker
    );
    cameraManager.miniWindowEnabled = !store.getState().isMiniWindowFolded;
    updateTriggers.push(cameraManager);

    const earthGui = new EarthGui(mainPane);
    const earthView = new EarthView(earth, scene, earthGui);
    updateTriggers.push(earthView);
    cameraManager.setEarthCamera(earth);
    setAudioListener(() => cameraManager.getCamera());

    // Set camera for atmospheric glow updates
    const camera = cameraManager.getCamera();
    if (camera) {
      // Warm up the missile camera's GL context so launch doesn't stall
      RocketTrackingView.prewarm(scene, camera);
      earthView.setCamera(camera);
    }

    const focusOnEarth = () => {
      cameraManager.setEarthCamera(earth);
      store.getState().focusEarthView();
    };
    earthGui.onFocusCameraClick = focusOnEarth;

    const launcherGui = new LauncherGui(mainPane);
    const launcherView = new LauncherView(earth, scene);
    const launcher = new Launcher(launcherGui, earth);

    // Live preview of the best candidate's flight path while calculating
    const bestTrajectoryLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: 0xff4500,
        transparent: true,
        opacity: 0.9,
      })
    );
    bestTrajectoryLine.frustumCulled = false;
    bestTrajectoryLine.visible = false;
    scene.add(bestTrajectoryLine);

    const bestImpactMarker = new THREE.Mesh(
      new THREE.SphereGeometry(40, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xff4500 })
    );
    bestImpactMarker.visible = false;
    scene.add(bestImpactMarker);

    let shownTrajectory: THREE.Vector3[] | null = null;
    const showBestTrajectory = (points: THREE.Vector3[] | null) => {
      if (points === shownTrajectory) return;
      shownTrajectory = points;

      bestTrajectoryLine.geometry.dispose();
      bestTrajectoryLine.geometry = new THREE.BufferGeometry().setFromPoints(
        points ?? []
      );

      const hasPoints = !!points && points.length > 1;
      bestTrajectoryLine.visible = hasPoints;
      bestImpactMarker.visible = hasPoints;
      if (hasPoints) bestImpactMarker.position.copy(points[points.length - 1]);
    };

    const worldGui = new WorldGui(mainPane, clock);
    updateTriggers.push(worldGui);

    // WorldGui owns time/audio; the store mirrors it for the React UI
    starField.setVisible(worldGui.showStars);
    worldGui.onShowStarsChange = (show) => starField.setVisible(show);
    worldGui.onMutedChange = (muted) => store.getState().setIsMuted(muted);
    worldGui.onTimeMultiplierChange = (value) =>
      store.getState().setTimeMultiplier(value);
    worldGui.onTimeRunningChange = (isRunning) =>
      store.getState().setIsTimeRunning(isRunning);
    worldGui.onTimePassedUpdate = (text) => {
      if (text === timePassedTextRef.current) return;
      timePassedTextRef.current = text;
      if (timePassedElRef.current) {
        timePassedElRef.current.textContent = `⏱ ${text}`;
      }
    };

    const mouseTrackedGui = new MouseTrackerGui(worldGui.folder, mouseTracker);
    updateTriggers.push(mouseTrackedGui);

    const calculateTrajectory = () => {
      if (!launcher.rocketStartPosition || !launcher.rocketTargetPosition) {
        console.error('Start or target position is not set.');
        return;
      }

      store.getState().startCalculation();

      announceCalculatingTrajectory();

      const startPos = launcher.rocketStartPosition.clone();
      const targetPos = launcher.rocketTargetPosition.clone();

      let generation = 0;
      // Final snapshot is stored with the queue item for later inspection
      let lastCandidate: BestCandidate | null = null;
      const onProgress = (
        bestGenome: any,
        progress: number,
        bestTrajectory: THREE.Vector3[]
      ) => {
        store.getState().setCalculationProgress(progress);
        showBestTrajectory(bestTrajectory);
        generation++;

        const rocket = bestGenome?.rocket;
        if (!rocket) return;

        const [
          startInclineAfterDistance,
          thrustInclineMaxDuration,
          thrustInclineVelocity,
          fuelMass,
          exhaustVelocity,
          massFlowRate,
        ] = bestGenome;

        lastCandidate = {
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
      const startGeoPos = Earth.positionToGeoCoordinates(startPos);
      const targetGeoPos = Earth.positionToGeoCoordinates(targetPos);

      launcher.calcTrajectory(onProgress).then(() => {
        const st = store.getState();
        st.enqueueLaunch({
          startPosition: startPos,
          targetPosition: targetPos,
          startGeo: startGeoPos,
          targetGeo: targetGeoPos,
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
        st.finishCalculation();
        showBestTrajectory(null);
      });
    };

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

    const launchRocket = () => {
      const nextLaunch = store.getState().launchQueue[0];
      if (!nextLaunch) {
        console.error('No launches in queue.');
        return;
      }

      // Set launcher params from queue item
      launcher.rocketStartPosition = nextLaunch.startPosition;
      launcher.rocketTargetPosition = nextLaunch.targetPosition;
      launcher.startInclineAfterDistance =
        nextLaunch.trajectoryParams.startInclineAfterDistance;
      launcher.thrustInclineMaxDuration =
        nextLaunch.trajectoryParams.thrustInclineMaxDuration;
      launcher.thrustInclineVelocity =
        nextLaunch.trajectoryParams.thrustInclineVelocity;
      launcher.fuelMass = nextLaunch.trajectoryParams.fuelMass;
      launcher.exhaustVelocity = nextLaunch.trajectoryParams.exhaustVelocity;
      launcher.massFlowRate = nextLaunch.trajectoryParams.massFlowRate;

      const rocket = launcher.createRocket();

      if (!rocket) {
        // Keep the item queued so the user can retry
        console.error('Rocket could not be created. Check launcher settings.');
        return;
      }
      store.getState().dequeueLaunch();

      const rocketView = new RocketView(rocket, scene, earthView);
      rocketView.setSize(launcherGui.rocketSizeMultiplier);
      rocketView.init();
      rocketView.updatePrevFromRocket();

      const frameTimeManager = new FrameTimeManager(
        rocket,
        rocketView,
        worldGui
      );

      earthView.addTorusMarker(nextLaunch.startPosition, 0x0000ff, 40, 4);
      earthView.addTorusMarker(nextLaunch.targetPosition, 0x00ff00, 40, 4);
      launcherView.remove();

      store.getState().setRocketCount(launcher.rocketCount);

      // Same number as the "Missile N" label in the GUI
      announceLaunch(rocket.id);

      const setActiveRocketGui = () => {
        if (activeRocketGui) {
          activeRocketGui.remove();
          updateTriggers.splice(updateTriggers.indexOf(activeRocketGui), 1);
        }

        const rocketGui = new RocketGui(
          rocketGuiPane,
          rocketGuiContainer!,
          rocket,
          rocketView,
          scene
        );
        activeRocketGui = rocketGui;

        rocketGui.onFocusCameraClick = () => {
          cameraManager.setRocketCamera(rocketGui.trackingView);
          store.getState().focusRocketView();
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

      missileActivators.set(rocket.id, setActiveRocketGui);

      // Physics/view must update before the GUI so the tracking camera
      // renders the current frame's missile position.
      updateTriggers.push(frameTimeManager);

      setActiveRocketGui();
      updateMissileSelector(rocket.id);
    };

    store.getState().registerCommands({
      calculateTrajectory,
      launchRocket,
      focusOnEarth,
      setTimeMultiplier: (value) => worldGui.setTimeMultiplier(value),
      toggleTime: () => worldGui.toggleTime(),
      setMuted: (muted) => worldGui.setMuted(muted),
    });

    // React to store changes that the scene has to mirror
    let queueMarkers = syncQueueMarkers(
      scene,
      store.getState().launchQueue,
      store.getState().selectedQueueItemId,
      []
    );
    const unsubscribeStore = store.subscribe((state, prev) => {
      if (
        state.launchQueue !== prev.launchQueue ||
        state.selectedQueueItemId !== prev.selectedQueueItemId
      ) {
        queueMarkers = syncQueueMarkers(
          scene,
          state.launchQueue,
          state.selectedQueueItemId,
          queueMarkers
        );
      }

      if (state.isMiniWindowFolded !== prev.isMiniWindowFolded) {
        cameraManager.miniWindowEnabled = !state.isMiniWindowFolded;
      }

      // Selection ended (picked, cancelled or toggled off): drop the preview
      const wasSelecting =
        prev.startPositionActive || prev.targetPositionActive;
      const isSelecting =
        state.startPositionActive || state.targetPositionActive;
      if (wasSelecting && !isSelecting) {
        launcherView.activePositionWasSet();
      }
    });

    const pickAt = (clientX: number, clientY: number) => {
      const ndc = new THREE.Vector2(
        (clientX / window.innerWidth) * 2 - 1,
        -(clientY / window.innerHeight) * 2 + 1
      );
      const earthIntersection = cameraManager.getMeshIntersectionPoint(
        earthView.mesh,
        ndc
      );

      if (earthIntersection == null) {
        return;
      }
      const geoCords = Earth.positionToGeoCoordinates(earthIntersection);
      const { startPositionActive, targetPositionActive } = store.getState();

      if (startPositionActive) {
        launcherView.setStartPosition(earthIntersection);
        launcher.setStartPosition(earthIntersection);
        store.getState().setStartPicked(geoCords);
      }

      if (targetPositionActive) {
        launcherView.setTargetPosition(earthIntersection);
        launcher.setTargetPosition(earthIntersection);
        store.getState().setTargetPicked(geoCords);
      }

      store
        .getState()
        .setIsCalculateTrajectoryDisabled(
          !(launcher.rocketStartPosition && launcher.rocketTargetPosition)
        );
    };

    // Pointer position for the selection preview, taken only from pointers
    // over the 3D canvas. The global mouse tracker also receives the emulated
    // mousemove of a tap on a UI button (e.g. "Set Start" on mobile), which
    // would put the preview on the Earth behind the panel.
    const previewPointer = { x: 0, y: 0, valid: false };

    const onMove = () => {
      const { startPositionActive, targetPositionActive } = store.getState();
      if (!startPositionActive && !targetPositionActive) {
        return;
      }

      if (mouseFollower) {
        mouseFollower.style.visibility = previewPointer.valid ? '' : 'hidden';
      }
      if (!previewPointer.valid) return;

      if (mouseFollower) {
        mouseFollower.style.left = `${previewPointer.x}px`;
        mouseFollower.style.top = `${previewPointer.y}px`;
      }

      const earthIntersection = cameraManager.getMeshIntersectionPoint(
        earthView.mesh,
        new THREE.Vector2(
          (previewPointer.x / window.innerWidth) * 2 - 1,
          -(previewPointer.y / window.innerHeight) * 2 + 1
        )
      );

      if (earthIntersection == null) {
        return;
      }

      const geoCords = Earth.positionToGeoCoordinates(earthIntersection);

      if (startPositionActive) {
        launcherView.setActivePosition(earthIntersection, 'start');
      }
      if (targetPositionActive) {
        launcherView.setActivePosition(earthIntersection, 'target');
      }
      store.getState().setActivePositionGeo(geoCords);
    };

    // Pick only on a tap/click that starts and ends on the 3D canvas without
    // dragging. Listening on window made presses on UI buttons (e.g. the tap
    // that enables "Set Start" on mobile) immediately pick the point behind
    // them, and rotating the globe placed a point too.
    const canvas = fullScreenRenderer.domElement;
    const TAP_MAX_MOVE_PX = 8;
    let tapStart: { id: number; x: number; y: number } | null = null;

    const onCanvasPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      // Second finger -> pinch/rotate gesture, not a tap
      tapStart = tapStart
        ? null
        : { id: e.pointerId, x: e.clientX, y: e.clientY };
    };
    const onCanvasPointerUp = (e: PointerEvent) => {
      const start = tapStart;
      tapStart = null;
      if (!start || start.id !== e.pointerId) return;
      if (e.target !== canvas) return;
      const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
      if (moved > TAP_MAX_MOVE_PX) return;
      pickAt(e.clientX, e.clientY);
    };
    const onCanvasPointerCancel = () => {
      tapStart = null;
    };

    canvas.addEventListener('pointerdown', onCanvasPointerDown);
    window.addEventListener('pointerup', onCanvasPointerUp);
    window.addEventListener('pointercancel', onCanvasPointerCancel);

    // Preview follows only pointers over the canvas (hover for mouse, the
    // finger for touch). Any press elsewhere (UI) invalidates it.
    const onPreviewPointer = (e: PointerEvent) => {
      if (e.target !== canvas) {
        if (e.type === 'pointerdown') previewPointer.valid = false;
        return;
      }
      previewPointer.x = e.clientX;
      previewPointer.y = e.clientY;
      previewPointer.valid = true;
    };
    window.addEventListener('pointerdown', onPreviewPointer, true);
    window.addEventListener('pointermove', onPreviewPointer, true);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        store.getState().resetActivePosition();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    // Wall-clock time for camera / UI smoothing: `clock` is stopped while
    // time is paused, which would freeze zoom and rotation easing.
    const realClock = new THREE.Clock();

    const animateLoop = () => {
      const deltaTime = clock.getDelta();
      // Capped so a background tab doesn't cause one huge jump
      const realDeltaTime = Math.min(realClock.getDelta(), 0.1);

      mouseTracker.update(deltaTime);
      onMove();

      updateTriggers.forEach((trigger) => {
        trigger.update(trigger.usesRealTime ? realDeltaTime : deltaTime);
      });
    };

    fullScreenRenderer.setAnimationLoop(animateLoop);

    return () => {
      unsubscribeStore();
      store.getState().registerCommands({
        calculateTrajectory: () => {},
        launchRocket: () => {},
        focusOnEarth: () => {},
        setTimeMultiplier: () => {},
        toggleTime: () => {},
        setMuted: () => {},
      });
      queueMarkers.forEach((marker) => scene.remove(marker));

      canvas.removeEventListener('pointerdown', onCanvasPointerDown);
      window.removeEventListener('pointerup', onCanvasPointerUp);
      window.removeEventListener('pointercancel', onCanvasPointerCancel);
      window.removeEventListener('pointerdown', onPreviewPointer, true);
      window.removeEventListener('pointermove', onPreviewPointer, true);
      window.removeEventListener('keydown', onKeyDown);

      sceneContainer.removeChild(fullScreenRenderer.domElement);
      fullScreenRenderer.setAnimationLoop(null);
      starField.dispose();

      fullScreenRenderer.dispose();
      miniWindowRenderer.dispose();
    };
  }, []);

  return (
    <>
      <div id={sceneContainerId} className={s.sceneContainer}></div>
      <div
        className={clsx(s.container, { [s.hide]: isPositionSelectionActive })}
      >
        <div id={rocketGuiContainerId} className={s.rocketGui}></div>
        <div className={s.topRightPanel}>
          <div
            className={s.stats}
            ref={(el) => el && el.appendChild(stats.dom)}
          ></div>
          <div id={mainGuiContainerId} className={s.mainGui}></div>
        </div>

        <div
          className={s.timePassed}
          title="Simulated time passed"
          ref={(el) => {
            timePassedElRef.current = el;
            if (el) el.textContent = `⏱ ${timePassedTextRef.current}`;
          }}
        />

        {isFocusedOnEarth ? <LaunchPad /> : <ReturnToEarthBar />}

        <div className={s.versionBadge}>v{__VERSION__}</div>
      </div>

      <PositionSelectionOverlay mouseFollowerId={mouseFollowerId} />
      <MiniWindow miniWindowId={miniWindowId} />
      <InstructionsModal />
    </>
  );
};

export default OrbitalVelocity;
