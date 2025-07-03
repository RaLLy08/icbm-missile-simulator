import * as THREE from 'three';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';
import { useEffect, useId } from 'react';
import { Pane } from 'tweakpane';
import Stats from 'three/examples/jsm/libs/stats.module';

import Earth from './earth/Earth';
import EarthView from './earth/EarthView';
import RocketView from './rocket/RocketView';
import EarthGui from './earth/EarthGui';
import WorldGui from './WorldGui';
import Launcher from './launcher/Launcher';
import LauncherView from './launcher/LauncherView';
import LauncherGui from './launcher/LauncherGui';
import RocketGui from './rocket/RocketGui';

const stats = new Stats();
document.body.appendChild(stats.dom);

const WIDTH = window.innerWidth;
const HEIGHT = window.innerHeight;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, WIDTH / HEIGHT, 0.1, 1000000);

const raycaster = new THREE.Raycaster();
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

const axesHelper = new THREE.AxesHelper(3);
axesHelper.position.set(3, -3, 0);
scene.add(axesHelper);

const ambientLight = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

const clock = new THREE.Clock();


const pane = new Pane({
  container: document.getElementById('guiControls')!,
  title: 'Orbital Velocity Controls',
});

const updateTriggers: {
  [key: string]: any;
  update: (tick?: number) => void;
}[] = [stats];

const OrbitalVelocity = () => {
  const sceneContainerId = useId();

  useEffect(() => {
    const sceneContainer = document.getElementById(sceneContainerId);
    if (!sceneContainer) return;

    sceneContainer.appendChild(renderer.domElement);

    const controls = new TrackballControls(camera, renderer.domElement);

    updateTriggers.push(controls);

    const earth = new Earth();
    updateTriggers.push(earth);

    const earthView = new EarthView(earth, scene);

    const worldGui = new WorldGui(pane, clock);
    const earthGui = new EarthGui(pane, earth, earthView);
    // const rocketGui = new RocketGui(pane, rocket, rocketView, camera, controls);

    updateTriggers.push(worldGui);

    const launcherGui = new LauncherGui(pane);

    const launcher = new Launcher(launcherGui, earth);

    const launcherView = new LauncherView(launcher, launcherGui, earth, scene);

    launcherGui.onLaunchRocket = () => {
      const rocket = launcher.createRocket();

      const rocketView = new RocketView(rocket, scene, camera);

      updateTriggers.push(rocket);
      updateTriggers.push(rocketView);

      const rocketGui = new RocketGui(
        pane,
        rocket,
        rocketView,
        camera,
        controls,
      )

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

      launcherView.handleEarthClick(earthIntersection);
    };
    window.addEventListener('click', onClick, false);

    const animateLoop = () => {
      // rocketGui.update();
      // controls.update();
      renderer.render(scene, camera);


      const deltaTime = clock.getDelta();

      const tick = deltaTime * worldGui.timeMultiplier;
      // fix tick more 1 second

      for (const trigger of updateTriggers) {
        trigger.update();
      }
    };

    renderer.setAnimationLoop(animateLoop);

    return () => {
      sceneContainer.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [sceneContainerId]);

  return <div id={sceneContainerId}></div>;
};

export default OrbitalVelocity;
