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
import Rocket from './rocket/Rocket';

const WIDTH = window.innerWidth;
const HEIGHT = window.innerHeight;

const scene = new THREE.Scene();

// const axisHelper = new THREE.AxesHelper(10000);
// scene.add(axisHelper);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  logarithmicDepthBuffer: true,
});
renderer.setSize(WIDTH, HEIGHT);

renderer.setClearColor(0x000000, 1); // Set background color to black

renderer.setPixelRatio(window.devicePixelRatio);

const ambientLight = new THREE.AmbientLight(0xffffff, 2);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(0, 0, 0);
scene.add(directionalLight);

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

  const sceneContainerId = useId();
  const mainGuiContainerId = useId();
  const rocketGuiContainerId = useId();
  const mouseFollowerId = useId();

  const handleFocusOnEarthClick = () => {
    setIsFocusedOnEarth(true);
    launchPadListenersRef.current.focusOnEarth();
  };

  useEffect(() => {
    const sceneContainer = document.getElementById(sceneContainerId);
    const mainGuiContainer = document.getElementById(mainGuiContainerId);
    const rocketGuiContainer = document.getElementById(rocketGuiContainerId);
    const mouseFollower = document.getElementById(mouseFollowerId);
    const { current: launcherPadListeners } = launchPadListenersRef;

    if (!sceneContainer) return;

    const mainPane = new Pane({
      title: 'Orbital Velocity Controls',
      container: mainGuiContainer!,
    });
    const rocketGuiPane = new Pane({
      title: 'Rocket Controls',
      container: rocketGuiContainer!,
    });

    sceneContainer.appendChild(renderer.domElement);

    const mouseTracker = new MouseTracker(window);

    const earth = new Earth();
    updateTriggers.push(earth);

    const cameraManager = new CameraManager(scene, renderer, mouseTracker);
    updateTriggers.push(cameraManager);

    const earthGui = new EarthGui(mainPane);
    const earthView = new EarthView(earth, scene, earthGui);
    cameraManager.setEarthCamera(earth);

    launchPadListenersRef.current.focusOnEarth = () => {
      cameraManager.setEarthCamera(earth);
      setIsFocusedOnEarth(true);
    };

    earthGui.onFocusCameraClick = () => {
      cameraManager.setEarthCamera(earth);
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

    // const _rocketView = new RocketView(_rocket, scene);

    // const _rocketGui = new RocketGui(
    //   rocketGuiPane,
    //   rocketGuiContainer!,
    //   _rocket,
    //   _rocketView,
    //   earthView,
    //   cameraManager
    // );

    // cameraManager.setRocketCamera(earthView, _rocketView);

    // setTimeout(() => {
    //   _rocket.position.copy(rocketTargetPosition);
    // }, 1000); // Wait for the camera to focus

    // const _frameTimeManager = new FrameTimeManager(
    //   _rocket,
    //   _rocketView,
    //   worldGui
    // );
    // updateTriggers.push(_frameTimeManager);

    const launcherGui = new LauncherGui(mainPane);
    const launcherView = new LauncherView(earth, scene);
    const launcher = new Launcher(launcherGui, earth);

    const worldGui = new WorldGui(mainPane, clock);
    updateTriggers.push(worldGui);

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

      launcher.calcTrajectory(onProgress).then(() => {
        setIsLaunchDisabled(false);
        setCalculationProgress(null);
      });
    };

    let activeRocketGui: RocketGui | null = null;

    launcherPadListeners.onLaunchRocket = () => {
      const rocket = launcher.createRocket();

      if (!rocket) {
        console.error('Rocket could not be created. Check launcher settings.');
        return;
      }
      const rocketView = new RocketView(rocket, scene, earthView);
      rocketView.setSize(
        launcherGui.rocketSizeMultiplier
      );
      rocketView.init();

      const frameTimeManager = new FrameTimeManager(
        rocket,
        rocketView,
        worldGui
      );

      earthView.addTorusMarker(launcher.rocketStartPosition!, 0x0000ff, 40, 4);
      earthView.addTorusMarker(launcher.rocketTargetPosition!, 0x00ff00, 40, 4);
      launcherView.remove();


      setRocketCount(launcher.rocketCount);

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
        setIsFocusedOnEarth(false);
      };

      updateTriggers.push(frameTimeManager);
      updateTriggers.push(activeRocketGui);
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

      setActivePositionGeo(geoCords);

      if (launchPadStatesRef.current.startPositionSetIsActive) {
        launcherView.setActivePosition(earthIntersection, 'start');
        setActivePositionGeo(geoCords);
      }

      if (launchPadStatesRef.current.targetPositionSetIsActive) {
        launcherView.setActivePosition(earthIntersection, 'target');
        setTargetPositionGeo(geoCords);
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

    renderer.setAnimationLoop(animateLoop);

    return () => {
      sceneContainer.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);

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

  const isPositionSelectionActive =
    startPositionActive || targetPositionActive;

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
                    disabled={isLaunchDisabled}
                    onClick={handleLaunchRocketClick}
                  >
                    Launch 🚀 {rocketCount}
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
    </>
  );
};

export default OrbitalVelocity;
