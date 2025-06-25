import * as THREE from 'three';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';
import { useEffect, useId } from 'react';
import { Pane } from 'tweakpane';
import Stats from 'three/examples/jsm/libs/stats.module';

import Earth from './earth/Earth';
import Rocket from './rocket/Rocket';
import EarthView from './earth/EarthView';
import RocketView from './rocket/RocketView';
import EarthGui from './earth/EarthGui';
import RocketGui from './rocket/RocketGui';
import { formatSeconds } from './utils';

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

const createMarker = (position: THREE.Vector3, color: number) => {
  const geometry = new THREE.SphereGeometry(50, 4, 16);
  const material = new THREE.MeshBasicMaterial({ color: color });
  const marker = new THREE.Mesh(geometry, material);
  marker.position.copy(position);
  return marker;
};

const earth = new Earth();
const earthView = new EarthView(earth, scene);

const rocketInitialPosition = earth.geoCoordinatesToPosition(60, 0);
const rocketTargetPosition = earth.geoCoordinatesToPosition(120, 0);
const rocket2Target = rocketTargetPosition
  .clone()
  .sub(rocketInitialPosition)
  .normalize();

const gravityDir = earth.gravityForce(rocketInitialPosition);
const gravityNorm = gravityDir.clone().normalize();

// 3. Project toTarget onto the plane perpendicular to gravity
const thrustDirectionToIncline = rocket2Target
  .clone()
  .projectOnPlane(gravityNorm)
  .normalize();

// draw arrow
// scene.add(
//   new THREE.ArrowHelper(
//     thrustDirectionToIncline,
//     rocketInitialPosition,
//     rocketInitialPosition.distanceTo(rocketTargetPosition),
//     0xff0000,
//     50,
//     20
//   )
// );

const rocket = new Rocket(
  earth,
  rocketInitialPosition,
  thrustDirectionToIncline
);

const rocketView = new RocketView(rocket, scene, camera);



scene.add(createMarker(rocketInitialPosition, 0xff0000));
scene.add(createMarker(rocketTargetPosition, 0x00ff00));

const pane = new Pane({
  container: document.getElementById('guiControls')!,
});

const globalParams: {
  timeMultiplier: number;
  timeDeltaTimeMs: number | null;
  timePassedSeconds: number;
} = {
  timeMultiplier: 1,
  timeDeltaTimeMs: 0,
  timePassedSeconds: 0,
};

pane
  .addButton({
    title: 'Stop Time',
  })
  .on('click', (ev) => {
    const isRunning = globalParams.timeMultiplier !== 0;

    globalParams.timeMultiplier = isRunning ? 0 : 1;
    ev.target.title = isRunning ? 'Start Time' : 'Stop Time';
  });

const guiTimeMultiplier = pane.addBinding(globalParams, 'timeMultiplier', {
  label: 'Time Multiplier',
  min: 1,
  max: 500,
  step: 1,
});

const guiDeltaTime = pane.addBinding(globalParams, 'timeDeltaTimeMs', {
  label: 'Delta Time Between Frames (ms)',
  readonly: true,
  format: (v) => (v != null ? v.toFixed(3) : 'N/A'),
});

const guiTimePassedSeconds = pane.addBinding(
  globalParams,
  'timePassedSeconds',
  {
    label: 'Time Passed (s)',
    readonly: true,
    format: (v) => {
      const formatted = formatSeconds(v);

      return `${formatted.value.toFixed(1)} ${formatted.unit}`;
    },
  }
);

const earthGui = new EarthGui(pane, earth, earthView);

// let i = 0;
// export function focusOnObject(
//   object3D: THREE.Object3D,
//   controls: TrackballControls,
//   fitOffset: number = 1.2
// ) {
//   // Get the object's world position
//   const objectWorldPosition = new THREE.Vector3();
//   object3D.getWorldPosition(objectWorldPosition);

//   // Calculate direction from sphere center to object (surface normal)
//   const normalDirection = new THREE.Vector3()
//     .subVectors(objectWorldPosition, earth.position)
//     .normalize();
//   i += 10;
//   normalDirection.applyAxisAngle(
//     new THREE.Vector3(0, 0, 1),
//     THREE.MathUtils.degToRad(80)
//   );

//   // normalDirection.applyAxisAngle(
//   //   new THREE.Vector3(0, 1, 0),
//   //   THREE.MathUtils.degToRad(90)
//   // );

//   // Position the camera just above the object in the normal direction
//   const cameraPosition = new THREE.Vector3()
//     .copy(objectWorldPosition)
//     .addScaledVector(normalDirection, 10);

//   camera.position.copy(cameraPosition);

//   // Aim the camera to look at the object
//   controls.target.copy(objectWorldPosition);

//   // Update camera projection matrix (in case you move far from center)
//   camera.updateProjectionMatrix();

//   // Update controls
//   controls.update();
// }

function animate(deltaTimeMs: number | null) {
  // controls.update();
  renderer.render(scene, camera);
  guiDeltaTime.refresh();
  guiTimePassedSeconds.refresh();

  stats.update();

  globalParams.timeDeltaTimeMs = deltaTimeMs;

  if (deltaTimeMs == null) {
    return;
  }

  const deltaTimeS = deltaTimeMs / 1000;
  const tick = deltaTimeS * globalParams.timeMultiplier;

  rocket.update(tick);
  earth.update(tick);

  rocketView.update();

  globalParams.timePassedSeconds += tick;
}

const OrbitalVelocity = () => {
  const sceneContainerId = useId();

  useEffect(() => {
    const sceneContainer = document.getElementById(sceneContainerId);
    if (!sceneContainer) return;

    sceneContainer.appendChild(renderer.domElement);

    const controls = new TrackballControls(camera, renderer.domElement);
    const rocketGui = new RocketGui(pane, rocket, rocketView, camera, controls);

    controls.noRotate = false;
    controls.noPan = false;
    controls.noZoom = false;

    let lastFrameTime: number;
    let animationId: number;

    const animateLoop = () => {
      animationId = requestAnimationFrame(animateLoop);
      const currentTime = performance.now();

      rocketGui.update();

      if (lastFrameTime != null) {
        controls.update(); // Move this inside the loop
        animate(currentTime - lastFrameTime);
      } else {
        animate(null);
      }

      lastFrameTime = currentTime;
    };
    animateLoop();

    return () => {
      sceneContainer.removeChild(renderer.domElement);
      renderer.dispose();
      cancelAnimationFrame(animationId);
    };
  }, [sceneContainerId]);

  return <div id={sceneContainerId}></div>;
};

export default OrbitalVelocity;
