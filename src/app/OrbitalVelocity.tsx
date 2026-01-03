import * as THREE from 'three';
import { useEffect, useId, useRef, useState } from 'react';
import { Pane } from 'tweakpane';
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
import FrameTimeManager from './helpers/FrameTimeManager';
import MouseTracker from './helpers/MouseTracker';
import MouseTrackerGui from './helpers/MouseTracker.gui';
import CameraManager from './helpers/CameraManager';

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
  });
  const [calcWasReset, setCalcWasReset] = useState(true);
  const [rocketCount, setRocketCount] = useState(0);
  const launchPadStatesRef = useRef({
    startPositionSetIsActive: false,
    targetPositionSetIsActive: false,
  });
  const [isMiniWindowOpen, setIsMiniWindowOpen] = useState(false);

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
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);

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
    }>
  >([]);
  const [queueIdCounter, setQueueIdCounter] = useState(0);

  const sceneContainerId = useId();
  const mainGuiContainerId = useId();
  const rocketGuiContainerId = useId();
  const mouseFollowerId = useId();
  const miniWindowId = useId();

  const queueMarkersRef = useRef<(THREE.Mesh | THREE.Group)[]>([]);

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
    const { current: launcherPadListeners } = launchPadListenersRef;

    if (!sceneContainer) return;

    const mainPane = new Pane({
      title: 'Main Controls',
      container: mainGuiContainer!,
    });
    const rocketGuiPane = new Pane({
      title: 'Missile Controls',
      container: rocketGuiContainer!,
    });

    const createMiniWindowRenderer = () => {
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        logarithmicDepthBuffer: true,
      });
      renderer.setClearColor(0x000000, 1);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      miniWindow!.style.width = '300px';
      miniWindow!.style.height = '300px';

      const { width, height } = miniWindow!.getBoundingClientRect();

      const aspect = width / height;

      renderer.setPixelRatio(aspect);
      renderer.setSize(width, height);
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

    const earth = new Earth();
    updateTriggers.push(earth);

    const cameraManager = new CameraManager(
      scene,
      fullScreenRenderer,
      miniWindowRenderer,
      mouseTracker
    );
    updateTriggers.push(cameraManager);

    const earthGui = new EarthGui(mainPane);
    const earthView = new EarthView(earth, scene, earthGui);
    updateTriggers.push(earthView);
    cameraManager.setEarthCamera(earth);

    // Set camera for atmospheric glow updates
    const camera = cameraManager.getCamera();
    if (camera) {
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

    const worldGui = new WorldGui(mainPane, clock);
    updateTriggers.push(worldGui);

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

    launcherPadListeners.onCalculateTrajectory = () => {
      if (!launcher.rocketStartPosition || !launcher.rocketTargetPosition) {
        console.error('Start or target position is not set.');
        return;
      }

      setCalcWasReset(false);

      const onProgress = (bestGenome: any, progress: number) => {
        setCalculationProgress(progress);
      };

      setIsLaunchDisabled(true);

      const startPos = launcher.rocketStartPosition.clone();
      const targetPos = launcher.rocketTargetPosition.clone();
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
            },
          ]);
          return prevCounter + 1;
        });
        setIsLaunchDisabled(false);
        setCalculationProgress(null);
      });
    };

    let activeRocketGui: RocketGui | null = null;

    launcherPadListeners.onLaunchRocket = () => {
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
          console.error('Rocket could not be created. Check launcher settings.');
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

        const setActiveRocketGui = () => {
          if (activeRocketGui) {
            activeRocketGui.remove();
            updateTriggers.splice(updateTriggers.indexOf(activeRocketGui), 1);
          }

          activeRocketGui = new RocketGui(
            rocketGuiPane,
            rocketGuiContainer!,
            rocket,
            rocketView
          );

          activeRocketGui.onFocusCameraClick = () => {
            cameraManager.setRocketCamera(earthView, rocketView);
            setIsMiniWindowOpen(true);
            setIsFocusedOnEarth(false);
          };

          updateTriggers.push(activeRocketGui);
        };

        rocketGuiPane
          .addButton({
            title: `Focus on Missile ${rocket.id}`,
          })
          .on('click', () => {
            cameraManager.setRocketCamera(earthView, rocketView);

            setIsMiniWindowOpen(true);
            setIsFocusedOnEarth(false);
            setActiveRocketGui();
          });

        setActiveRocketGui();
        activeRocketGui?.scrollToEnd();

        updateTriggers.push(frameTimeManager);

        // Return remaining queue (removing the launched item)
        return remainingQueue;
      });
    };

    // const garbageCollector = () => {
    //   updateTriggers.forEach((trigger) => {

    //   });
    // };

    const onMouseDown = () => {
      const earthIntersection = cameraManager.getMeshIntersectionPoint(
        earthView.mesh
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

    const onMove = () => {
      if (
        !launchPadStatesRef.current.startPositionSetIsActive &&
        !launchPadStatesRef.current.targetPositionSetIsActive
      ) {
        return;
      }

      if (mouseFollower) {
        mouseFollower.style.left = `${mouseTracker.position.x}px`;
        mouseFollower.style.top = `${mouseTracker.position.y}px`;
      }

      const earthIntersection = cameraManager.getMeshIntersectionPoint(
        earthView.mesh
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

    window.addEventListener('mousedown', onMouseDown, false);

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
    });
  }, [launchQueue]);

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
    setLaunchQueue([]);
  };

  const handleRemoveFromQueue = (id: number) => {
    setLaunchQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const handleInfoButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsInstructionsOpen(true);
  };

  const handleCloseInstructions = () => {
    setIsInstructionsOpen(false);
  };

  const isPositionSelectionActive = startPositionActive || targetPositionActive;

  return (
    <>
      <div id={sceneContainerId} className={s.sceneContainer}></div>
      <div
        className={clsx(s.container, { [s.hide]: isPositionSelectionActive })}
      >
        <div id={rocketGuiContainerId} className={s.rocketGui}></div>
        <div id={mainGuiContainerId} className={s.mainGui}></div>
        <div
          className={s.stats}
          ref={(el) => el && el.appendChild(stats.dom)}
        ></div>

        {/* <div className={s.timeManager}>
          <div>FPS*Sec</div>
        </div> */}

        {(() => {
          if (!isFocusedOnEarth) {
            return (
              <div className={s.clearLaunchPad}>
                <button className={s.button} onClick={handleFocusOnEarthClick}>
                  Return to Earth
                </button>
              </div>
            );
          }

          return (
            <div className={s.launchPad}>
              <button
                className={s.infoButton}
                onClick={handleInfoButtonClick}
                title="How to launch a rocket"
              >
                ℹ️
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
            </div>
          );
        })()}

        <div className={s.githubLink}>
          <a
            href="https://github.com/rally08/icbm-missile-simulator"
            target="_blank"
            rel="noopener noreferrer"
            title="GitHub Repository"
          >
            <svg
              width="32"
              height="32"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 98 96"
            >
              <path
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"
                fill="#fff"
              />
            </svg>
          </a>
        </div>

        {/* Launch Queue Panel */}
        {launchQueue.length > 0 && isFocusedOnEarth && (
          <div className={s.queuePanel}>
            <div className={s.queueHeader}>
              <h3>Launch Queue ({launchQueue.length})</h3>
              <button className={s.clearButton} onClick={handleClearQueueClick}>
                Clear All
              </button>
            </div>
            <div className={s.queueList}>
              {launchQueue.map((item, index) => (
                <div key={item.id} className={s.queueItem}>
                  <div className={s.queueItemInfo}>
                    <span className={s.queueItemNumber}>#{index + 1}</span>
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
                    onClick={() => handleRemoveFromQueue(item.id)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
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
        className={s.miniWindowContainer}
        style={{
          visibility: isMiniWindowOpen ? 'visible' : 'hidden',
        }}
      >
        <div
          id={miniWindowId}
          style={{
            position: 'absolute',
          }}
        ></div>
      </div>

      {isInstructionsOpen && (
        <div className={s.modalOverlay} onClick={handleCloseInstructions}>
          <div className={s.modalContent} onClick={(e) => e.stopPropagation()}>
            <button className={s.closeButton} onClick={handleCloseInstructions}>
              ✕
            </button>
            <h2 className={s.modalTitle}>How to Launch a Rocket</h2>
            <div className={s.instructions}>
              <div className={s.step}>
                <div className={s.stepNumber}>1</div>
                <div className={s.stepContent}>
                  <h3>Set Start Position</h3>
                  <p>
                    Click the <strong>"Set Start"</strong> button, then click
                    anywhere on Earth to select your launch location.
                  </p>
                </div>
              </div>

              <div className={s.step}>
                <div className={s.stepNumber}>2</div>
                <div className={s.stepContent}>
                  <h3>Set Target Position</h3>
                  <p>
                    Click the <strong>"Set Target"</strong> button, then click
                    on Earth to select your target location.
                  </p>
                </div>
              </div>

              <div className={s.step}>
                <div className={s.stepNumber}>3</div>
                <div className={s.stepContent}>
                  <h3>Calculate Trajectory</h3>
                  <p>
                    Click the <strong>"Calculate"</strong> button to compute the
                    optimal flight path. The trajectory will be automatically
                    added to your launch queue when complete.
                  </p>
                </div>
              </div>

              <div className={s.step}>
                <div className={s.stepNumber}>4</div>
                <div className={s.stepContent}>
                  <h3>Queue Multiple Launches</h3>
                  <p>
                    You can repeat steps 1-3 to add multiple launches to your
                    queue. All queued launches will appear in the{' '}
                    <strong>Launch Queue</strong> panel at the bottom-left, with
                    cyan (start) and yellow (target) markers on Earth.
                  </p>
                </div>
              </div>

              <div className={s.step}>
                <div className={s.stepNumber}>5</div>
                <div className={s.stepContent}>
                  <h3>Launch!</h3>
                  <p>
                    Click the <strong>"Launch 🚀"</strong> button to fire the
                    next rocket in your queue. Each click launches one rocket
                    and removes it from the queue. You can launch them one by
                    one, even while time is running!
                  </p>
                </div>
              </div>

              <div className={s.tip}>
                <strong>⏸️ Tip:</strong> Stop time using the{' '}
                <strong>"Stop Time"</strong> button in Main Controls to set up
                multiple launches, then resume and fire them sequentially!
              </div>

              <div className={s.tip}>
                <strong>⚡ Tip:</strong> Increase the{' '}
                <strong>Time Multiplier</strong> in the Main Controls panel to
                speed up the simulation.
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default OrbitalVelocity;
