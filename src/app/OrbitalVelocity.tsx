import * as THREE from 'three';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
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
import { isAudioMuted, setAudioListener } from './helpers/SpatialAudio';
import {
    announceCalculatingTrajectory,
    announceLaunch,
} from './helpers/Speech';
import StarField from './space/StarField';
import { formatSeconds } from './utils';

const INSTRUCTIONS_MENU = 'help';

const INSTRUCTIONS_PAGES = [
  {
    id: 'how-to-launch',
    label: 'How to Launch a Rocket?',
    description: 'Step-by-step guide to setting up and firing launches',
  },
  {
    id: 'how-it-works',
    label: 'How does it work?',
    description: 'The physics and the trajectory search behind the simulator',
  },
] as const;

type InstructionsPage =
  | typeof INSTRUCTIONS_MENU
  | (typeof INSTRUCTIONS_PAGES)[number]['id'];

const getInstructionsPageFromHash = (): InstructionsPage | null => {
  const hash = window.location.hash.replace(/^#/, '');
  if (hash === INSTRUCTIONS_MENU) return INSTRUCTIONS_MENU;
  return INSTRUCTIONS_PAGES.some((p) => p.id === hash)
    ? (hash as InstructionsPage)
    : null;
};

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

const TIME_MULTIPLIER_PRESETS = [1, 2, 5, 10, 50];

const formatMissDistance = (km: number) => {
  if (km < 10) return `${km.toFixed(2)} km`;
  if (km < 1000) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
};

type BestCandidate = {
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

const formatDuration = (seconds: number) => {
  const { value, unit } = formatSeconds(seconds);
  return `${value.toFixed(1)} ${unit}`;
};

const getCandidateRows = (c: BestCandidate) => [
  {
    key: 'miss',
    label: 'Miss Distance',
    value: formatMissDistance(c.missDistance),
    highlight: true,
  },
  { key: 'fitness', label: 'Fitness', value: c.fitness.toFixed(3) },
  { key: 'd1', label: null, value: null },
  {
    key: 'incline',
    label: 'Turn Start Altitude',
    value: `${c.startInclineAfterDistance.toFixed(2)} km`,
  },
  {
    key: 'turnDuration',
    label: 'Gravity Turn Duration',
    value: formatDuration(c.thrustInclineMaxDuration),
  },
  {
    key: 'turnVelocity',
    label: 'Gravity Turn Rate',
    value: `${THREE.MathUtils.radToDeg(c.thrustInclineVelocity).toFixed(2)}°/s`,
  },
  { key: 'fuel', label: 'Fuel Mass', value: `${c.fuelMass.toFixed(1)} kg` },
  {
    key: 'payload',
    label: 'Payload Mass',
    value: `${c.payloadMass.toFixed(1)} kg`,
  },
  {
    key: 'flow',
    label: 'Mass Flow Rate (ṁ)',
    value: `${c.massFlowRate.toFixed(1)} kg/s`,
  },
  {
    key: 'exhaust',
    label: 'Exhaust Velocity (vₑ)',
    value: `${c.exhaustVelocity.toFixed(2)} km/s`,
  },
  { key: 'd2', label: null, value: null },
  {
    key: 'burn',
    label: 'Burn Time',
    value: formatDuration(c.fuelCombustionTime),
  },
  {
    key: 'apogee',
    label: 'Max Altitude',
    value: `${c.maxAltitude.toFixed(1)} km`,
  },
  {
    key: 'travelled',
    label: 'Travelled Distance',
    value: `${c.travelledDistance.toFixed(1)} km`,
  },
  { key: 'flight', label: 'Flight Time', value: formatDuration(c.flightTime) },
];

const stats = new Stats();
stats.showPanel(0);
// stats.js sets position:fixed/top-left inline; let the CSS wrapper place it
stats.dom.style.cssText = 'position:relative;cursor:pointer;opacity:0.9;';

// Keep in sync with $mobile_breakpoint in OrbitalVelocity.module.scss
const isMobileViewport = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(max-width: 640px)').matches;

const updateTriggers: {
  [key: string]: any;
  update: (deltaTime?: number) => void;
}[] = [stats];

const OrbitalVelocity = () => {
  const launchPadListenersRef = useRef({
    onCalculateTrajectory: () => {},
    onLaunchRocket: () => {},
    focusOnEarth: () => {},
    onCancelSelectionClick: () => {},
    setTimeMultiplier: (_value: number) => {},
    toggleTime: () => {},
    setMuted: (_muted: boolean) => {},
  });
  const [timeMultiplier, setTimeMultiplier] = useState(1);
  const [isTimeRunning, setIsTimeRunning] = useState(true);
  const [isMuted, setIsMuted] = useState(isAudioMuted);
  // Updated imperatively every frame to avoid re-rendering React
  const timePassedTextRef = useRef(WorldGui.formatTimePassed(0));
  const timePassedElRef = useRef<HTMLDivElement | null>(null);
  const [calcWasReset, setCalcWasReset] = useState(true);
  const [rocketCount, setRocketCount] = useState(0);
  const launchPadStatesRef = useRef({
    startPositionSetIsActive: false,
    targetPositionSetIsActive: false,
  });
  const [isMiniWindowOpen, setIsMiniWindowOpen] = useState(false);
  const [isMiniWindowFolded, setIsMiniWindowFolded] =
    useState(isMobileViewport);
  const cameraManagerRef = useRef<CameraManager | null>(null);

  const [startPositionActive, setStartPositionActive] = useState(
    launchPadStatesRef.current.startPositionSetIsActive
  );
  const [targetPositionActive, setTargetPositionActive] = useState(
    launchPadStatesRef.current.targetPositionSetIsActive
  );
  const [calculationProgress, setCalculationProgress] = useState<null | number>(
    null
  );

  const [isLaunchDisabled, setIsLaunchDisabled] = useState(true);
  const [isCalculateTrajectoryDisabled, setIsCalculateTrajectoryDisabled] =
    useState(true);

  const [startPositionGeo, setStartPositionGeo] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [targetPositionGeo, setTargetPositionGeo] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [activePositionGeo, setActivePositionGeo] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const [isFocusedOnEarth, setIsFocusedOnEarth] = useState(true);
  const [instructionsPage, setInstructionsPage] =
    useState<InstructionsPage | null>(getInstructionsPageFromHash);
  const isInstructionsOpen = instructionsPage !== null;

  // Keep the modal in sync with the URL hash (back/forward, manual edits)
  useEffect(() => {
    const syncFromHash = () =>
      setInstructionsPage(getInstructionsPageFromHash());
    window.addEventListener('popstate', syncFromHash);
    window.addEventListener('hashchange', syncFromHash);
    return () => {
      window.removeEventListener('popstate', syncFromHash);
      window.removeEventListener('hashchange', syncFromHash);
    };
  }, []);

  // Launch queue state
  const [launchQueue, setLaunchQueue] = useState<
    Array<{
      id: number;
      startPosition: THREE.Vector3;
      targetPosition: THREE.Vector3;
      startGeo: { latitude: number; longitude: number };
      targetGeo: { latitude: number; longitude: number };
      trajectoryParams: {
        startInclineAfterDistance: number;
        thrustInclineMaxDuration: number;
        thrustInclineVelocity: number;
        fuelMass: number;
        exhaustVelocity: number;
        massFlowRate: number;
      };
      candidate: BestCandidate | null;
    }>
  >([]);
  const [queueIdCounter, setQueueIdCounter] = useState(0);
  const [isQueueCollapsed, setIsQueueCollapsed] = useState(true);
  const [selectedQueueItemId, setSelectedQueueItemId] = useState<number | null>(
    null
  );
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);

  const sceneContainerId = useId();
  const mainGuiContainerId = useId();
  const rocketGuiContainerId = useId();
  const mouseFollowerId = useId();
  const miniWindowId = useId();

  const queueMarkersRef = useRef<(THREE.Mesh | THREE.Group)[]>([]);

  useEffect(() => {
    if (cameraManagerRef.current) {
      cameraManagerRef.current.miniWindowEnabled = !isMiniWindowFolded;
    }
  }, [isMiniWindowFolded]);

  const handleFocusOnEarthClick = () => {
    setIsFocusedOnEarth(true);
    launchPadListenersRef.current.focusOnEarth();
  };

  useEffect(() => {
    const sceneContainer = document.getElementById(sceneContainerId);
    const mainGuiContainer = document.getElementById(mainGuiContainerId);
    const rocketGuiContainer = document.getElementById(rocketGuiContainerId);
    const mouseFollower = document.getElementById(mouseFollowerId);
    const miniWindow = document.getElementById(miniWindowId);
    const { current: launchPadListeners } = launchPadListenersRef;

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
    cameraManagerRef.current = cameraManager;
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

    launchPadListenersRef.current.focusOnEarth = () => {
      cameraManager.setEarthCamera(earth);

      setIsMiniWindowOpen(false);
      setIsFocusedOnEarth(true);
    };

    earthGui.onFocusCameraClick = () => {
      cameraManager.setEarthCamera(earth);
      setIsMiniWindowOpen(false);

      setIsFocusedOnEarth(true);
    };

    // const rocketInitialPosition = Earth.geoCoordinatesToPosition(0, 90);
    // const rocketTargetPosition = Earth.geoCoordinatesToPosition(180, 0);
    // const targetInclineVector = rocketInitialPosition
    //   .clone()
    //   .sub(rocketTargetPosition)
    //   .normalize();

    // const _rocket = new Rocket(
    //   earth,
    //   rocketInitialPosition,
    //   targetInclineVector
    // );

    // cameraManager.setRocketCamera(earthView, _rocketView);

    // setTimeout(() => {
    //   _rocket.position.copy(rocketTargetPosition);
    // }, 1000); // Wait for the camera to focus

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

    starField.setVisible(worldGui.showStars);
    worldGui.onShowStarsChange = (show) => starField.setVisible(show);
    worldGui.onMutedChange = (muted) => setIsMuted(muted);
    launchPadListeners.setMuted = (muted) => worldGui.setMuted(muted);
    worldGui.onTimeMultiplierChange = (value) => setTimeMultiplier(value);
    launchPadListeners.setTimeMultiplier = (value) =>
      worldGui.setTimeMultiplier(value);
    worldGui.onTimeRunningChange = (isRunning) => setIsTimeRunning(isRunning);
    worldGui.onTimePassedUpdate = (text) => {
      if (text === timePassedTextRef.current) return;
      timePassedTextRef.current = text;
      if (timePassedElRef.current) {
        timePassedElRef.current.textContent = `⏱ ${text}`;
      }
    };
    launchPadListeners.toggleTime = () => worldGui.toggleTime();

    ///

    // const _rocketView = new RocketView(_rocket, scene, earthView);
    // _rocketView.setSize(launcherGui.rocketSizeMultiplier);
    // _rocketView.init();
    // _rocketView.updatePrevFromRocket();

    // const _rocketGui = new RocketGui(
    //   rocketGuiPane,
    //   rocketGuiContainer!,
    //   _rocket,
    //   _rocketView
    // );
    // updateTriggers.push(_rocketGui);

    // const _frameTimeManager = new FrameTimeManager(
    //   _rocket,
    //   _rocketView,
    //   worldGui
    // );
    // updateTriggers.push(_frameTimeManager);

    // cameraManager.setRocketCamera(earthView, _rocketView);
    ///

    const mouseTrackedGui = new MouseTrackerGui(worldGui.folder, mouseTracker);
    updateTriggers.push(mouseTrackedGui);

    launchPadListeners.onCalculateTrajectory = () => {
      if (!launcher.rocketStartPosition || !launcher.rocketTargetPosition) {
        console.error('Start or target position is not set.');
        return;
      }

      setCalcWasReset(false);

      setIsLaunchDisabled(true);

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
        setCalculationProgress(progress);
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
        // Add to queue after calculation
        setQueueIdCounter((prevCounter) => {
          setLaunchQueue((prev) => [
            ...prev,
            {
              id: prevCounter,
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
            },
          ]);
          return prevCounter + 1;
        });
        setIsLaunchDisabled(false);
        setCalculationProgress(null);
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

    launchPadListeners.onLaunchRocket = () => {
      // Launch from queue
      setLaunchQueue((prevQueue) => {
        if (prevQueue.length === 0) {
          console.error('No launches in queue.');
          return prevQueue;
        }

        const [nextLaunch, ...remainingQueue] = prevQueue;

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
          console.error(
            'Rocket could not be created. Check launcher settings.'
          );
          return prevQueue;
        }
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

        setRocketCount(launcher.rocketCount);

        // Same number as the "Missile N" label in the GUI
        announceLaunch(rocket.id);

        const setActiveRocketGui = () => {
          if (activeRocketGui) {
            activeRocketGui.remove();
            updateTriggers.splice(updateTriggers.indexOf(activeRocketGui), 1);
          }

          activeRocketGui = new RocketGui(
            rocketGuiPane,
            rocketGuiContainer!,
            rocket,
            rocketView,
            scene
          );

          activeRocketGui.onFocusCameraClick = () => {
            cameraManager.setRocketCamera(earthView, rocketView);
            setIsMiniWindowOpen(true);
            setIsFocusedOnEarth(false);
          };

          updateTriggers.push(activeRocketGui);
          activeRocketId = rocket.id;
        };

        missileActivators.set(rocket.id, setActiveRocketGui);

        // Physics/view must update before the GUI so the tracking camera
        // renders the current frame's missile position.
        updateTriggers.push(frameTimeManager);

        setActiveRocketGui();
        updateMissileSelector(rocket.id);
        // activeRocketGui?.scrollToEnd();

        // Return remaining queue (removing the launched item)
        return remainingQueue;
      });
    };

    // const garbageCollector = () => {
    //   updateTriggers.forEach((trigger) => {

    //   });
    // };

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

      if (launchPadStatesRef.current.startPositionSetIsActive) {
        launcherView.setStartPosition(earthIntersection);
        launcher.setStartPosition(earthIntersection);

        setStartPositionGeo(geoCords);

        launchPadStatesRef.current.startPositionSetIsActive = false;
        setStartPositionActive(false);

        setCalcWasReset(true);

        launcherView.activePositionWasSet();
      }

      if (launchPadStatesRef.current.targetPositionSetIsActive) {
        launcherView.setTargetPosition(earthIntersection);
        launcher.setTargetPosition(earthIntersection);

        setTargetPositionGeo(geoCords);

        launchPadStatesRef.current.targetPositionSetIsActive = false;
        setTargetPositionActive(false);

        setCalcWasReset(true);

        launcherView.activePositionWasSet();
      }

      setIsCalculateTrajectoryDisabled(
        !(launcher.rocketStartPosition && launcher.rocketTargetPosition)
      );
    };

    // Pointer position for the selection preview, taken only from pointers
    // over the 3D canvas. The global mouse tracker also receives the emulated
    // mousemove of a tap on a UI button (e.g. "Set Start" on mobile), which
    // would put the preview on the Earth behind the panel.
    const previewPointer = { x: 0, y: 0, valid: false };

    const onMove = () => {
      if (
        !launchPadStatesRef.current.startPositionSetIsActive &&
        !launchPadStatesRef.current.targetPositionSetIsActive
      ) {
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

      if (launchPadStatesRef.current.startPositionSetIsActive) {
        launcherView.setActivePosition(earthIntersection, 'start');
        setActivePositionGeo(geoCords);
      }

      if (launchPadStatesRef.current.targetPositionSetIsActive) {
        launcherView.setActivePosition(earthIntersection, 'target');
        setActivePositionGeo(geoCords);
      }
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

    const resetActivePosition = () => {
      launchPadStatesRef.current.startPositionSetIsActive = false;
      launchPadStatesRef.current.targetPositionSetIsActive = false;
      setStartPositionActive(false);
      setTargetPositionActive(false);
      launcherView.activePositionWasSet();
    };

    launchPadListenersRef.current.onCancelSelectionClick = () => {
      resetActivePosition();
    };

    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        resetActivePosition();
      }
    });

    const animateLoop = () => {
      const deltaTime = clock.getDelta();

      // rockets.forEach((rocket) => {
      //   for (let i = 0; i < worldGui.timeMultiplier; i++) {
      //     rocket.update();
      //   }
      // });

      mouseTracker.update(deltaTime);
      onMove();

      updateTriggers.forEach((trigger) => {
        trigger.update(deltaTime);
      });
    };

    fullScreenRenderer.setAnimationLoop(animateLoop);

    return () => {
      sceneContainer.removeChild(fullScreenRenderer.domElement);
      fullScreenRenderer.setAnimationLoop(null);
      starField.dispose();

      fullScreenRenderer.dispose();
      miniWindowRenderer.dispose();
    };
  }, []);

  // Update queue markers when queue changes
  useEffect(() => {
    // Clear existing markers
    queueMarkersRef.current.forEach((marker) => {
      scene.remove(marker);
    });
    queueMarkersRef.current = [];

    // Add markers for each queued launch
    launchQueue.forEach((item, index) => {
      const startMarker = createQueueMarker(
        item.startPosition,
        0x00ffff,
        index + 1,
        'start'
      );
      const targetMarker = createQueueMarker(
        item.targetPosition,
        0xffff00,
        index + 1,
        'target'
      );

      scene.add(startMarker);
      scene.add(targetMarker);
      queueMarkersRef.current.push(startMarker, targetMarker);

      // Highlight rings around start and target of the selected item
      if (item.id === selectedQueueItemId) {
        const startRing = createHighlightRing(item.startPosition, 0x00ffff);
        const targetRing = createHighlightRing(item.targetPosition, 0xffff00);
        scene.add(startRing);
        scene.add(targetRing);
        queueMarkersRef.current.push(startRing, targetRing);
      }
    });
  }, [launchQueue, selectedQueueItemId]);

  // Drop the selection when its item leaves the queue
  useEffect(() => {
    if (
      selectedQueueItemId !== null &&
      !launchQueue.some((item) => item.id === selectedQueueItemId)
    ) {
      setSelectedQueueItemId(null);
    }
  }, [launchQueue, selectedQueueItemId]);

  const createHighlightRing = (position: THREE.Vector3, color: number) => {
    const geometry = new THREE.TorusGeometry(150, 14, 16, 100);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
    });
    const ring = new THREE.Mesh(geometry, material);
    ring.position.copy(position);
    const normal = position.clone().normalize();
    ring.lookAt(position.clone().add(normal));
    return ring;
  };

  const createQueueMarker = (
    position: THREE.Vector3,
    color: number,
    number: number,
    type: 'start' | 'target'
  ) => {
    let marker: THREE.Mesh | THREE.Group;

    if (type === 'start') {
      // Create a sphere (point) for start position
      const radius = 50;
      const geometry = new THREE.SphereGeometry(radius, 16, 16);
      const material = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.7,
      });
      marker = new THREE.Mesh(geometry, material);
    } else {
      // Create a cross (two intersecting planes) for target position
      const size = 100;
      const thickness = 10;

      const group = new THREE.Group();

      // Horizontal plane
      const planeGeometry1 = new THREE.PlaneGeometry(size, thickness);
      const material = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
      });
      const plane1 = new THREE.Mesh(planeGeometry1, material);

      // Vertical plane
      const planeGeometry2 = new THREE.PlaneGeometry(thickness, size);
      const plane2 = new THREE.Mesh(planeGeometry2, material.clone());

      group.add(plane1);
      group.add(plane2);

      marker = group;
    }

    marker.position.copy(position);

    const normal = position.clone().normalize();
    marker.lookAt(position.clone().add(normal));

    return marker;
  };

  const handleStartPositionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setStartPositionActive((prev) => !prev);
    launchPadStatesRef.current.startPositionSetIsActive =
      !launchPadStatesRef.current.startPositionSetIsActive;
  };

  const handleTargetPositionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTargetPositionActive((prev) => !prev);
    launchPadStatesRef.current.targetPositionSetIsActive =
      !launchPadStatesRef.current.targetPositionSetIsActive;
  };

  const handleCalculateTrajectoryClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const isLoading = calculationProgress !== null;

    if (isLoading) {
      return;
    }

    launchPadListenersRef.current.onCalculateTrajectory();
  };

  const handleLaunchRocketClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    launchPadListenersRef.current.onLaunchRocket();
  };

  const handleClearQueueClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isConfirmingClear) {
      setIsConfirmingClear(true);
      return;
    }
    setIsConfirmingClear(false);
    setLaunchQueue([]);
  };

  // Auto-cancel the pending "Confirm" state after a few seconds
  useEffect(() => {
    if (!isConfirmingClear) return;
    const timeout = setTimeout(() => setIsConfirmingClear(false), 3000);
    return () => clearTimeout(timeout);
  }, [isConfirmingClear]);

  const handleRemoveFromQueue = (id: number) => {
    setLaunchQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const handleInfoButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    openInstructionsPage(INSTRUCTIONS_MENU, 'push');
  };

  const handleBackToMenu = () => {
    // If we came from the menu, step back in history; otherwise (deep link) swap to it
    if (window.history.state?.fromMenu) {
      window.history.back();
    } else {
      openInstructionsPage(INSTRUCTIONS_MENU, 'replace');
    }
  };

  const openInstructionsPage = (
    page: InstructionsPage,
    mode: 'push' | 'replace',
    state: { fromMenu?: boolean } | null = null
  ) => {
    const url = `${window.location.pathname}${window.location.search}#${page}`;
    if (mode === 'push') {
      window.history.pushState(state, '', url);
    } else {
      window.history.replaceState(null, '', url);
    }
    setInstructionsPage(page);
  };

  const handleCloseInstructions = () => {
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.search}`
    );
    setInstructionsPage(null);
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    launchPadListenersRef.current.setMuted(!isMuted);
  };
  const muteTitle = isMuted ? 'Unmute all sounds' : 'Mute all sounds';
  const muteIcon = isMuted ? '🔇' : '🔊';

  const isPositionSelectionActive = startPositionActive || targetPositionActive;

  // Parameters of the selected queue item; hidden while calculating
  const panelCandidate = (() => {
    if (calculationProgress !== null) return null;
    const index = launchQueue.findIndex(
      (item) => item.id === selectedQueueItemId
    );
    const candidate = index >= 0 ? launchQueue[index].candidate : null;
    if (!candidate) return null;
    return {
      title: `Launch #${index + 1}`,
      subtitle: `${candidate.generation} gens`,
      data: candidate,
    };
  })();

  // Side panels sit to the right of the launch pad; when they'd overflow the
  // viewport, stack them above it instead. Measured from the children's own
  // (max-content) widths, which don't depend on the mode, so it can't flap.
  const launchPadRef = useRef<HTMLDivElement | null>(null);
  const sidePanelsRef = useRef<HTMLDivElement | null>(null);
  const [areSidePanelsStacked, setAreSidePanelsStacked] = useState(false);
  useLayoutEffect(() => {
    const check = () => {
      const pad = launchPadRef.current;
      const panels = sidePanelsRef.current;
      if (!pad || !panels) return;
      const SIDE_OFFSET = 12; // .sidePanels left: calc(100% + 12px)
      const EDGE_MARGIN = 8;
      const gap = parseFloat(getComputedStyle(panels).columnGap) || 0;
      const children = Array.from(panels.children) as HTMLElement[];
      const required =
        children.reduce((sum, el) => sum + el.offsetWidth, 0) +
        gap * Math.max(0, children.length - 1);
      const fits =
        pad.getBoundingClientRect().right + SIDE_OFFSET + required <=
        window.innerWidth - EDGE_MARGIN;
      setAreSidePanelsStacked((prev) => (prev === !fits ? prev : !fits));
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  });

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

        {/* <div className={s.timeManager}>
          <div>FPS*Sec</div>
        </div> */}

        <div
          className={s.timePassed}
          title="Simulated time passed"
          ref={(el) => {
            timePassedElRef.current = el;
            if (el) el.textContent = `⏱ ${timePassedTextRef.current}`;
          }}
        />

        {(() => {
          const timeControls = (
            <div className={s.timeMultiplier}>
              <button
                className={s.timeMultiplierButton}
                title={isTimeRunning ? 'Pause time' : 'Resume time'}
                onClick={(e) => {
                  e.stopPropagation();
                  launchPadListenersRef.current.toggleTime();
                }}
              >
                {isTimeRunning ? '⏸️' : '▶️'}
              </button>
              <button
                className={s.timeMultiplierButton}
                title="Click to change time multiplier"
                onClick={(e) => {
                  e.stopPropagation();
                  const next =
                    TIME_MULTIPLIER_PRESETS.find((v) => v > timeMultiplier) ??
                    TIME_MULTIPLIER_PRESETS[0];
                  launchPadListenersRef.current.setTimeMultiplier(next);
                }}
              >
                ⏩ {timeMultiplier}x
              </button>
            </div>
          );

          if (!isFocusedOnEarth) {
            return (
              <div className={s.clearLaunchPad}>
                {timeControls}
                <div className={s.returnRow}>
                  <button
                    className={s.button}
                    onClick={handleFocusOnEarthClick}
                  >
                    Return to Earth
                  </button>
                  <button
                    className={s.inlineMuteButton}
                    onClick={toggleMute}
                    title={muteTitle}
                    aria-pressed={isMuted}
                  >
                    {muteIcon}
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div className={s.launchPad} ref={launchPadRef}>
              <button
                className={s.infoButton}
                onClick={handleInfoButtonClick}
                title="How to launch a rocket"
              >
                ℹ️
              </button>
              <button
                className={clsx(s.infoButton, s.muteButton)}
                onClick={toggleMute}
                title={muteTitle}
                aria-pressed={isMuted}
              >
                {muteIcon}
              </button>

              <div className={s.infoPanel}>
                {startPositionActive && (
                  <div className={s.infoText}>
                    Click on Earth to set Start Position
                  </div>
                )}
                {targetPositionActive && (
                  <div className={s.infoText}>
                    Click on Earth to set Target Position
                  </div>
                )}
              </div>

              {timeControls}

              <div className={s.controls}>
                <div className={s.positionBlock}>
                  <button
                    className={s.button}
                    onClick={handleStartPositionClick}
                  >
                    Set Start
                  </button>
                  {startPositionGeo?.longitude != null && (
                    <div className={s.coordinates}>
                      Lon: {startPositionGeo.longitude.toFixed(1)} <br />
                      Lat: {startPositionGeo.latitude.toFixed(1)}
                    </div>
                  )}
                </div>

                <div className={s.trajectoryBlock}>
                  <button
                    className={clsx(s.calculateButton, {
                      [s.calcWasReset]: calcWasReset,
                    })}
                    onClick={handleCalculateTrajectoryClick}
                    disabled={isCalculateTrajectoryDisabled}
                  >
                    {calculationProgress !== null ? (
                      <div className={s.progressWrapper}>
                        <div
                          className={s.progressBar}
                          style={{
                            width: `${Math.round(calculationProgress)}%`,
                          }}
                        ></div>
                        <span className={s.progressText}>
                          {Math.round(calculationProgress)}%
                        </span>
                      </div>
                    ) : (
                      'Calculate'
                    )}
                  </button>
                  <button
                    className={s.launchButton}
                    disabled={launchQueue.length === 0}
                    onClick={handleLaunchRocketClick}
                  >
                    Launch 🚀{' '}
                    {launchQueue.length > 0 && `(${launchQueue.length})`}
                  </button>
                </div>

                <div className={s.positionBlock}>
                  <button
                    className={s.button}
                    onClick={handleTargetPositionClick}
                  >
                    Set Target
                  </button>
                  {targetPositionGeo?.longitude != null && (
                    <div className={s.coordinates}>
                      Lon: {targetPositionGeo.longitude.toFixed(1)} <br />
                      Lat: {targetPositionGeo.latitude.toFixed(1)}
                    </div>
                  )}
                </div>
              </div>

              {/* Side panels pinned to the right of the launch pad:
                  launch queue first, then the live best candidate */}
              <div
                ref={sidePanelsRef}
                className={clsx(s.sidePanels, {
                  [s.stacked]: areSidePanelsStacked,
                })}
              >
                {launchQueue.length > 0 && (
                  <div
                    className={clsx(s.queueWrapper, {
                      [s.collapsed]: isQueueCollapsed,
                    })}
                  >
                    <div
                      className={s.queuePanel}
                      title={isQueueCollapsed ? 'Expand queue' : undefined}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isQueueCollapsed) setIsQueueCollapsed(false);
                      }}
                    >
                      <div className={s.queueHeader}>
                        <h3>Launch Queue ({launchQueue.length})</h3>
                        <button
                          className={clsx(s.clearButton, {
                            [s.confirming]: isConfirmingClear,
                          })}
                          onClick={handleClearQueueClick}
                        >
                          {isConfirmingClear ? 'Confirm' : 'Clear All'}
                        </button>
                      </div>
                      {!isQueueCollapsed && (
                        <div className={s.queueList}>
                          {launchQueue.map((item, index) => (
                            <div
                              key={item.id}
                              className={clsx(s.queueItem, {
                                [s.selected]: item.id === selectedQueueItemId,
                              })}
                              title="Show start and target on the map"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedQueueItemId((prev) =>
                                  prev === item.id ? null : item.id
                                );
                              }}
                            >
                              <div className={s.queueItemInfo}>
                                <span className={s.queueItemNumber}>
                                  #{index + 1}
                                </span>
                                <div className={s.queueItemCoords}>
                                  <div className={s.coordPair}>
                                    <span className={s.coordLabel}>Start</span>
                                    <span>
                                      {item.startGeo.latitude.toFixed(1)},
                                      {item.startGeo.longitude.toFixed(1)}
                                    </span>
                                  </div>
                                  <div className={s.coordPair}>
                                    <span className={s.coordLabel}>Target</span>
                                    <span>
                                      {item.targetGeo.latitude.toFixed(1)},
                                      {item.targetGeo.longitude.toFixed(1)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <button
                                className={s.removeButton}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveFromQueue(item.id);
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className={s.collapseToggle}
                      onClick={() => setIsQueueCollapsed((prev) => !prev)}
                      aria-expanded={!isQueueCollapsed}
                      title={
                        isQueueCollapsed ? 'Expand queue' : 'Collapse queue'
                      }
                    >
                      <span className={s.collapseIcon}>▾</span>
                    </button>
                  </div>
                )}

                {panelCandidate !== null && (
                  <div className={s.candidatePanel}>
                    <div className={s.candidateHeader}>
                      <h3>{panelCandidate.title}</h3>
                      <span className={s.candidateGeneration}>
                        {panelCandidate.subtitle}
                      </span>
                      <button
                        type="button"
                        className={s.candidateClose}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedQueueItemId(null);
                        }}
                        title="Close launch data"
                        aria-label="Close launch data"
                      >
                        ✕
                      </button>
                    </div>
                    <dl className={s.candidateList}>
                      {getCandidateRows(panelCandidate.data).map((row) =>
                        row.label === null ? (
                          <hr key={row.key} className={s.candidateDivider} />
                        ) : (
                          <div
                            key={row.key}
                            className={clsx(s.candidateRow, {
                              [s.highlight]: row.highlight,
                            })}
                          >
                            <dt>{row.label}</dt>
                            <dd>{row.value}</dd>
                          </div>
                        )
                      )}
                    </dl>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        <div className={s.versionBadge}>v{__VERSION__}</div>
      </div>

      {isPositionSelectionActive && (
        <div className={s.clearLaunchPad}>
          <button
            className={s.button}
            onClick={(e) => {
              e.stopPropagation();
              launchPadListenersRef?.current?.onCancelSelectionClick?.();
            }}
          >
            Cancel
          </button>
        </div>
      )}

      <div
        id={mouseFollowerId}
        className={clsx(s.mouseFollower, {
          [s.hide]: !isPositionSelectionActive,
        })}
      >
        <div className={s.coordBox}>
          {(startPositionActive || targetPositionActive) && (
            <>
              <span className={s.coordItem}>
                ↔ {activePositionGeo?.longitude.toFixed(1)}
              </span>
              <span className={s.coordItem}>
                ↕ {activePositionGeo?.latitude.toFixed(1)}
              </span>
            </>
          )}
        </div>
      </div>

      <div
        className={`${s.miniWindowContainer} ${
          isMiniWindowFolded ? s.miniWindowFolded : ''
        }`}
        style={{
          visibility: isMiniWindowOpen ? 'visible' : 'hidden',
        }}
      >
        <button
          className={s.miniWindowToggle}
          onClick={() => setIsMiniWindowFolded((folded) => !folded)}
          aria-expanded={!isMiniWindowFolded}
          title={isMiniWindowFolded ? 'Expand minimap' : 'Fold minimap'}
        >
          {isMiniWindowFolded ? '▴ Minimap' : '▾'}
        </button>
        <div
          id={miniWindowId}
          style={{
            position: 'absolute',
            display: isMiniWindowFolded ? 'none' : undefined,
          }}
        ></div>
      </div>

      {isInstructionsOpen && (
        <div className={s.modalOverlay} onClick={handleCloseInstructions}>
          <div className={s.modalWrapper} onClick={(e) => e.stopPropagation()}>
            <button
              className={s.closeButton}
              onClick={handleCloseInstructions}
              aria-label="Close"
            >
              ✕
            </button>
            {instructionsPage !== INSTRUCTIONS_MENU && (
              <button className={s.backButton} onClick={handleBackToMenu}>
                ← Back
              </button>
            )}
            <div className={s.modalContent}>
              {instructionsPage === INSTRUCTIONS_MENU && (
                <>
                  <h2 className={s.modalTitle}>Help</h2>
                  <nav className={s.pageMenu}>
                    {INSTRUCTIONS_PAGES.map((page) => (
                      <button
                        key={page.id}
                        className={s.pageMenuItem}
                        onClick={() =>
                          openInstructionsPage(page.id, 'push', {
                            fromMenu: true,
                          })
                        }
                      >
                        <span className={s.pageMenuText}>
                          <span className={s.pageMenuLabel}>{page.label}</span>
                          <span className={s.pageMenuDescription}>
                            {page.description}
                          </span>
                        </span>
                      </button>
                    ))}
                  </nav>
                </>
              )}

              {instructionsPage === INSTRUCTIONS_MENU && (
                <a
                  className={s.sourceLink}
                  href="https://github.com/rally08/icbm-missile-simulator"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg
                    width="20"
                    height="20"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 98 96"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"
                      fill="currentColor"
                    />
                  </svg>
                  Source code
                </a>
              )}

              {instructionsPage === 'how-it-works' && (
                <>
                  <h2 className={s.modalTitle}>How does it work?</h2>
                  <div className={s.instructions}>
                    <div className={s.step}>
                      <div className={s.stepContent}>
                        <h3>Rocket Equation &amp; Thrust</h3>
                        <p>
                          Rocket motion during fuel burn is described by the{' '}
                          <a
                            className={s.modalLink}
                            href="https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/ideal-rocket-equation/"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Ideal Rocket Equation
                          </a>
                          . At every time step the simulation uses the{' '}
                          <a
                            className={s.modalLink}
                            href="https://www.grc.nasa.gov/www/k-12/airplane/rockth.html"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Rocket Thrust Equation
                          </a>{' '}
                          <strong>F = ṁ · vₑ</strong> to compute the
                          instantaneous force from the exhaust velocity{' '}
                          <strong>vₑ</strong> and the mass flow rate{' '}
                          <strong>ṁ</strong>.
                        </p>
                      </div>
                    </div>

                    <div className={s.step}>
                      <div className={s.stepContent}>
                        <h3>Thrust vs. Gravity</h3>
                        <p>
                          The rocket's movement is shaped by two forces: the
                          thrust from burning fuel and Earth's gravity. As fuel
                          burns the rocket gets lighter, so it accelerates
                          faster until burnout, then coasts on gravity alone.
                        </p>
                      </div>
                    </div>

                    <div className={s.step}>
                      <div className={s.stepContent}>
                        <h3>Gravity Turn</h3>
                        <p>
                          To steer the rocket toward its target, the simulator
                          performs a gravity turn: once a set altitude is
                          reached, the angle of attack changes by{' '}
                          <strong>X rad/s</strong> for{' '}
                          <strong>N seconds</strong>. In real rockets this is
                          done with mechanisms like gimbaled nozzles.
                        </p>
                      </div>
                    </div>

                    <div className={s.step}>
                      <div className={s.stepContent}>
                        <h3>Six Launch Parameters</h3>
                        <p>The whole trajectory is governed by:</p>
                        <ol className={s.paramList}>
                          <li>Altitude at which the gravity turn begins</li>
                          <li>Duration of the gravity turn (s)</li>
                          <li>Rate of turn during the gravity turn (rad/s)</li>
                          <li>Payload and fuel mass</li>
                          <li>
                            Mass flow rate <strong>ṁ</strong> (kg/s): how much
                            fuel burns per unit of time
                          </li>
                          <li>
                            Exhaust velocity <strong>vₑ</strong>: the speed of
                            the exhaust gases
                          </li>
                        </ol>
                      </div>
                    </div>

                    <div className={s.step}>
                      <div className={s.stepContent}>
                        <h3>Solving the Inverse Problem</h3>
                        <p>
                          The challenge is finding the combination of these six
                          parameters that takes the missile from the launch
                          point to the target. When you press{' '}
                          <strong>"Calculate"</strong>, a heuristic{' '}
                          <a
                            className={s.modalLink}
                            href="https://en.wikipedia.org/wiki/Differential_evolution"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <strong>Differential Evolution</strong>
                          </a>{' '}
                          algorithm runs the simulation over and over, searching
                          for the parameter set that minimizes the distance
                          between the rocket's final position and the target.
                        </p>
                      </div>
                    </div>

                    <div className={s.tip}>
                      <strong>💡 Note:</strong> To keep things simple,
                      atmospheric drag, heat and other external perturbations
                      are not included.
                    </div>
                  </div>
                </>
              )}

              {instructionsPage === 'how-to-launch' && (
                <>
                  <h2 className={s.modalTitle}>How to Launch a Rocket</h2>
                  <div className={s.instructions}>
                    <div className={s.step}>
                      <div className={s.stepNumber}>1</div>
                      <div className={s.stepContent}>
                        <h3>Set Start Position</h3>
                        <p>
                          Click the <strong>"Set Start"</strong> button, then
                          click anywhere on Earth to select your launch
                          location.
                        </p>
                      </div>
                    </div>

                    <div className={s.step}>
                      <div className={s.stepNumber}>2</div>
                      <div className={s.stepContent}>
                        <h3>Set Target Position</h3>
                        <p>
                          Click the <strong>"Set Target"</strong> button, then
                          click on Earth to select your target location.
                        </p>
                      </div>
                    </div>

                    <div className={s.step}>
                      <div className={s.stepNumber}>3</div>
                      <div className={s.stepContent}>
                        <h3>Calculate Trajectory</h3>
                        <p>
                          Click the <strong>"Calculate"</strong> button to
                          compute the optimal flight path. The trajectory will
                          be automatically added to your launch queue when
                          complete.
                        </p>
                      </div>
                    </div>

                    <div className={s.step}>
                      <div className={s.stepNumber}>4</div>
                      <div className={s.stepContent}>
                        <h3>Queue Multiple Launches</h3>
                        <p>
                          You can repeat steps 1-3 to add multiple launches to
                          your queue. All queued launches will appear in the{' '}
                          <strong>Launch Queue</strong> panel at the
                          bottom-left, with cyan (start) and yellow (target)
                          markers on Earth.
                        </p>
                      </div>
                    </div>

                    <div className={s.step}>
                      <div className={s.stepNumber}>5</div>
                      <div className={s.stepContent}>
                        <h3>Launch!</h3>
                        <p>
                          Click the <strong>"Launch 🚀"</strong> button to fire
                          the next rocket in your queue. Each click launches one
                          rocket and removes it from the queue. You can launch
                          them one by one, even while time is running!
                        </p>
                      </div>
                    </div>

                    <div className={s.tip}>
                      <strong>⏸️ Tip:</strong> Stop time using the{' '}
                      <strong>"Stop Time"</strong> button in Main Controls to
                      set up multiple launches, then resume and fire them
                      sequentially!
                    </div>

                    <div className={s.tip}>
                      <strong>⚡ Tip:</strong> Increase the{' '}
                      <strong>Time Multiplier</strong> in the Main Controls
                      panel to speed up the simulation.
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default OrbitalVelocity;
