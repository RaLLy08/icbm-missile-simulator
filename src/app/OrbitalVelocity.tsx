import * as THREE from 'three';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';
import { useEffect, useId } from 'react';
import { Pane } from 'tweakpane';
import Stats from 'three/examples/jsm/libs/stats.module';
import s from './OrbitalVelocity.module.scss';

import Earth from './earth/Earth';
import EarthView from './earth/EarthView';
import RocketView from './rocket/RocketView';
import EarthGui from './earth/EarthGui';
import WorldGui from './WorldGui';
import Launcher from './launcher/Launcher';
import LauncherView from './launcher/LauncherView';
import LauncherGui from './launcher/LauncherGui';
import RocketGui from './rocket/RocketGui';

const WIDTH = window.innerWidth;
const HEIGHT = window.innerHeight;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, WIDTH / HEIGHT, 0.1, 1000000);

const mouse = new THREE.Vector2();

camera.position.z = 12200;
camera.position.y = 0;
camera.position.x = 0;

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
  update: () => void;
}[] = [stats];


const OrbitalVelocity = () => {
  const sceneContainerId = useId();
  const mainGuiContainerId = useId();
  const rocketGuiContainerId = useId();

  useEffect(() => {
    const sceneContainer = document.getElementById(sceneContainerId);
    const mainGuiContainer = document.getElementById(mainGuiContainerId);
    const rocketGuiContainer = document.getElementById(rocketGuiContainerId);

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

    const controls = new TrackballControls(camera, renderer.domElement);

    updateTriggers.push(controls);

    const earth = new Earth();
    updateTriggers.push(earth);

    const earthGui = new EarthGui(mainPane, earth);
    const earthView = new EarthView(earth, scene, earthGui);

    const worldGui = new WorldGui(mainPane, clock);
    // const rocketGui = new RocketGui(pane, rocket, rocketView, camera, controls);

    updateTriggers.push(worldGui);

    const launcherGui = new LauncherGui(mainPane);
    const launcherView = new LauncherView(earth, scene);
    const launcher = new Launcher(launcherView, launcherGui, earth);


    launcherGui.onLaunchRocket = () => {
      const rocket = launcher.createRocket();

      if (!rocket) {
        console.error('Rocket could not be created. Check launcher settings.');
        return;
      }

      const rocketView = new RocketView(rocket, scene, camera);

      updateTriggers.push(rocket);
      updateTriggers.push(rocketView);

      const rocketGui = new RocketGui(
        rocketGuiPane,
        rocketGuiContainer!,
        rocket,
        rocketView,
        camera,
        controls
      );

      updateTriggers.push(rocketGui);
    };

    const onClick = (event: MouseEvent) => {
      // Convert mouse to normalized device coordinates
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      const earthIntersection = earthView.clickToGeoCoordinates(mouse, camera);

      if (earthIntersection == null) {
        return;
      }

      launcher.handleEarthClick(earthIntersection);
    };
    window.addEventListener('click', onClick, false);

    const animateLoop = () => {
      // rocketGui.update();
      // controls.update();
      renderer.render(scene, camera);

      const deltaTime = clock.getDelta();

      // const tick = deltaTime * worldGui.timeMultiplier;
      // fix tick more 1 second

      for (const trigger of updateTriggers) {
        // for (let i = 0; i < worldGui.timeMultiplier; i++) {

        // }
        trigger.update();
      }
    };

    renderer.setAnimationLoop(animateLoop);

    return () => {
      sceneContainer.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [sceneContainerId]);

  return (
    <div id={sceneContainerId} className={s.container}>
      <div id={rocketGuiContainerId} className={s.rocketGui}></div>
      <div id={mainGuiContainerId} className={s.mainGui}></div>
      <div
        className={s.stats}
        ref={(el) => el && el.appendChild(stats.dom)}
      ></div>
    </div>
  );
};

export default OrbitalVelocity;
