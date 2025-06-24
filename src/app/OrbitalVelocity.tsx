import * as THREE from 'three';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';
import { useEffect, useId } from 'react';
import { Pane } from 'tweakpane';
import Stats from 'three/examples/jsm/libs/stats.module';

import Earth from './Earth';
import Rocket from './Rocket';

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

const EARTH_RADIUS_KM = 6378; // in km

function createAtmosphereLayer(radius: number, color: number, opacity: number) {
  const geometry = new THREE.SphereGeometry(radius, 128, 128);
  const material = new THREE.MeshPhongMaterial({
    color: color,
    transparent: true,
    opacity: opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  return new THREE.Mesh(geometry, material);
}

const atmosphereLayers = [
  // Troposphere (~0–12 km)
  createAtmosphereLayer(EARTH_RADIUS_KM + 12, 0x87ceeb, 0.25), // Sky blue, fairly visible

  // Stratosphere (~12–50 km)
  createAtmosphereLayer(EARTH_RADIUS_KM + 50, 0x4682b4, 0.15), // Steel blue, thinner

  // Mesosphere (~50–85 km)
  createAtmosphereLayer(EARTH_RADIUS_KM + 85, 0x1e90ff, 0.1), // Dodger blue, very faint

  // Thermosphere (~85–600 km)
  createAtmosphereLayer(EARTH_RADIUS_KM + 600, 0x4169e1, 0.05), // Royal blue, extremely faint

  // Exosphere (~600–10,000 km)
  createAtmosphereLayer(EARTH_RADIUS_KM + 10000, 0x191970, 0.02), // Midnight blue, barely visible
];

// atmosphereLayers.forEach((layer, i) => {
//   layer.renderOrder = 1 + i; // Ensure atmosphere is rendered after the Earth
//   scene.add(layer);
// });

function createAtmosphereBorder(radius: number, color: number) {
  const geo = new THREE.EdgesGeometry(
    new THREE.SphereGeometry(radius, 128, 128)
  );
  const mat = new THREE.LineBasicMaterial({ color: color, linewidth: 1 });
  return new THREE.LineSegments(geo, mat);
}

const atmosphereBorders = {
  troposphere: createAtmosphereBorder(EARTH_RADIUS_KM + 12, 0x87ceeb), // Troposphere
  stratosphere: createAtmosphereBorder(EARTH_RADIUS_KM + 50, 0x4682b4), // Stratosphere
  mesosphere: createAtmosphereBorder(EARTH_RADIUS_KM + 85, 0x1e90ff), // Mesosphere
  thermosphere: createAtmosphereBorder(EARTH_RADIUS_KM + 600, 0x4169e1), // Thermosphere
  exosphere: createAtmosphereBorder(EARTH_RADIUS_KM + 10000, 0x191970), // Exosphere
};

const createMarker = (position: THREE.Vector3, color: number) => {
  const geometry = new THREE.SphereGeometry(50, 4, 16);
  const material = new THREE.MeshBasicMaterial({ color: color });
  const marker = new THREE.Mesh(geometry, material);
  marker.position.copy(position);
  return marker;
};

const earth = new Earth(scene);

const rocketInitialPosition = earth.geoCoordinatesToPosition(0, 0);
const rocketTargetPosition = earth.geoCoordinatesToPosition(45, 0);

const rocket = new Rocket(
  earth,
  rocketInitialPosition,
  rocketTargetPosition.clone().sub(rocketInitialPosition).normalize() // consider the earth curvate later (draw the tragectory as well)
);

scene.add(createMarker(rocketInitialPosition, 0xff0000));
scene.add(createMarker(rocketTargetPosition, 0x00ff00));

const heigth = 2;

const rocketGeometry = new THREE.CylinderGeometry(2, 2, heigth * 2, 32);
// this.geometry.scale(this.scale.x, this.scale.y, this.scale.z);
const rocketMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const rocketMesh = new THREE.Mesh(rocketGeometry, rocketMaterial);
rocketMesh.position.copy(rocket.position);
// this.mesh.frustumCulled = false;
rocketMesh.name = 'Rocket';

scene.add(rocketMesh);

const maxPoints = 1000;
const trailPositions = new Float32Array(maxPoints * 3); // x, y, z for each point
const trailGeometry = new THREE.BufferGeometry();
trailGeometry.setAttribute(
  'position',
  new THREE.BufferAttribute(trailPositions, 3)
);
const trailMaterial = new THREE.LineBasicMaterial({ color: 0x00ffcc });
const trailLine = new THREE.Line(trailGeometry, trailMaterial);
scene.add(trailLine);

// for (let i = 0; i < maxPoints; i++) {
//   trailPositions[i * 3] = satellite.position.x;
//   trailPositions[i * 3 + 1] = satellite.position.y;
//   trailPositions[i * 3 + 2] = satellite.position.z;
// }

trailLine.frustumCulled = false;

scene.add(trailLine);

trailLine.name = 'TRAIL';

const pane = new Pane({
  container: document.getElementById('guiControls')!,
});

const EARTH_MASS_KG = 5.972e24; // kg (mass of the Earth)
const EARTH_G = 6.6743e-11; // Gravitational constant with a small random variation

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
  max: 2000,
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
    format: (v) => (v != null ? v.toFixed(3) : 'N/A'),
  }
);

const earthFolder = pane.addFolder({
  title: 'Earth',
  expanded: true,
});

const satelliteFolder = pane.addFolder({
  title: 'Satellite',
  expanded: true,
});

const guiEarthParams = {
  massKg: EARTH_MASS_KG,
  gravityConst: EARTH_G,
};

const guiEarthMassKg = earthFolder.addBinding(guiEarthParams, 'massKg', {
  label: 'Mass (kg)',
  readonly: true,
});

const guiEarthGravityConst = earthFolder.addBinding(
  guiEarthParams,
  'gravityConst',
  {
    label: 'Grav. Const.',
    format: (v) => v,
    readonly: true,
  }
);

const guiEarthAtmosphereBordersParams = {
  troposphere: false,
  stratosphere: false,
  mesosphere: false,
  thermosphere: false,
  exosphere: false,
};

const earthAtmosphereBordersFolder = earthFolder.addFolder({
  title: 'Atmosphere Borders',
  expanded: true,
});

(
  [
    'troposphere',
    'stratosphere',
    'mesosphere',
    'thermosphere',
    'exosphere',
  ] as const
).forEach((label) => {
  earthAtmosphereBordersFolder
    .addBinding(guiEarthAtmosphereBordersParams, label, {
      label,
    })
    .on('change', (ev) => {
      const border = atmosphereBorders[label];
      if (ev.value) {
        scene.add(border);
      } else {
        scene.remove(border);
      }
    });
});

const guiSatelliteParams = {
  altitudeKm: 0,
  gravitiAcceleration: 0,
  pitch: 0,
};

const guiAltitudeKm = satelliteFolder.addBinding(
  guiSatelliteParams,
  'altitudeKm',
  {
    label: 'Altitude (km)',
  }
);

const guiPitch = satelliteFolder.addBinding(guiSatelliteParams, 'pitch', {
  label: 'Pitch (deqrees)',
  readonly: true,
});

const guiGravitiAcceleration = satelliteFolder.addBinding(
  guiSatelliteParams,
  'gravitiAcceleration',
  {
    label: 'Grav. Acceleration (km/s²)',
    readonly: true,
    format: (v) => v.toExponential(5),
  }
);

const arrows: THREE.ArrowHelper[] = [];

function updateArrow(
  name: string,
  position: THREE.Vector3,
  direction: THREE.Vector3,
  magnitude: number = 1
) {
  const arrow = arrows.find((a) => a.name === name);

  if (!arrow) return;
  const scale = 100;
  const length = magnitude * scale;

  arrow.setDirection(direction);
  arrow.setLength(length, length * 0.1, length * 0.1);
  arrow.position.copy(position);
}

function addArrow(
  name: string,
  color = 0x00ff00,
  position = new THREE.Vector3(0, 0, 0),
  direction = new THREE.Vector3(0, 0, 0)
) {
  const scale = 100;
  const length = direction.length() * scale;
  const arrow = new THREE.ArrowHelper(direction, position, length, color);
  arrow.name = name;
  arrow.frustumCulled = false;
  arrow.setLength(length, length * 0.1, length * 0.1);
  arrow.setDirection(direction);
  arrow.setColor(color);
  scene.add(arrow);
  arrows.push(arrow);
}

addArrow('velocity', 0xff0000);
addArrow('gravity', 0x0000ff);
addArrow('thrust', 0x00ff00);

// save launch time, create rocket, missle class

function updateSatellitePosition(deltaTimeMs: number | null) {
  if (deltaTimeMs == null) {
    return;
  }
  const deltaTimeS = deltaTimeMs / 1000;
  const tick = deltaTimeS * globalParams.timeMultiplier;

  rocket.update(tick);
  earth.update(tick);

  rocketMesh.position.copy(rocket.position);

  updateArrow(
    'gravity',
    rocket.position,
    rocket.gravityForce.clone().normalize(),
    rocket.gravityForce.length() * 10
  );

  updateArrow(
    'velocity',
    rocket.position,
    rocket.velocity.clone().normalize(),
    rocket.velocity.length()
  );

  updateArrow(
    'thrust',
    rocket.position,
    rocket.thrust.clone().normalize(),
    rocket.thrust.length() * 10
  );

  globalParams.timePassedSeconds += tick;

  // for (let i = maxPoints - 1; i > 0; i--) {
  //   trailPositions[i * 3] = trailPositions[(i - 1) * 3];
  //   trailPositions[i * 3 + 1] = trailPositions[(i - 1) * 3 + 1];
  //   trailPositions[i * 3 + 2] = trailPositions[(i - 1) * 3 + 2];
  // }

  // trailPositions[0] = satellite.position.x;
  // trailPositions[1] = satellite.position.y;
  // trailPositions[2] = satellite.position.z;

  // trailGeometry.attributes.position.needsUpdate = true;
}
let i = 0;
export function focusOnObject(
  object3D: THREE.Object3D,
  controls: TrackballControls,
  fitOffset: number = 1.2
) {
  // Get the object's world position
  const objectWorldPosition = new THREE.Vector3();
  object3D.getWorldPosition(objectWorldPosition);

  // Calculate direction from sphere center to object (surface normal)
  const normalDirection = new THREE.Vector3()
    .subVectors(objectWorldPosition, earth.mesh.position)
    .normalize();
  i += 10;
  normalDirection.applyAxisAngle(
    new THREE.Vector3(0, 0, 1),
    THREE.MathUtils.degToRad(80)
  );

  // normalDirection.applyAxisAngle(
  //   new THREE.Vector3(0, 1, 0),
  //   THREE.MathUtils.degToRad(90)
  // );

  // Position the camera just above the object in the normal direction
  const cameraPosition = new THREE.Vector3()
    .copy(objectWorldPosition)
    .addScaledVector(normalDirection, 10);

  camera.position.copy(cameraPosition);

  // Aim the camera to look at the object
  controls.target.copy(objectWorldPosition);

  // Update camera projection matrix (in case you move far from center)
  camera.updateProjectionMatrix();

  // Update controls
  controls.update();
}

// function onClick(event) {
//   // Convert mouse to normalized device coordinates (-1 to +1)
//   mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
//   mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

//   // Update the picking ray with the camera and mouse position
//   raycaster.setFromCamera(mouse, camera);

//   // Calculate objects intersecting the ray
//   const intersects = raycaster.intersectObjects(scene.children, true);

//   if (intersects.length > 0) {
//     // focus on the first intersected object
//     if (intersects[0].object.name === 'SATELLITE') {
//       const intersectedObject = intersects[0].object;
//       focusOnObject(intersectedObject);
//     }
//   }
// }

// window.addEventListener('click', onClick, false);

// (['x', 'y', 'z'] as const).forEach((label) => {
//   satelliteFolder.addBinding(satellite.position, label, {
//     label,
//     readonly: true,
//   });
// });

// const satVelocityFolder = satelliteFolder.addFolder({
//   title: 'Velocity (km/s)',
//   expanded: true,
// });

// (['x', 'y', 'z'] as const).forEach((label) => {
//   satVelocityFolder.addBinding(satelliteVelocity, label, {
//     label,
//     readonly: true,
//     format: (v) => v.toExponential(5),
//   });
// });

// satVelocityFolder.addBinding(
//   {
//     length: satelliteVelocity.length(),
//   },
//   'length',
//   {
//     label: 'Magnitude',
//     readonly: true,
//   }
// );

const satAccelerationFolder = satelliteFolder.addFolder({
  title: 'Acceleration (km/s²)',
  expanded: true,
});

// (['x', 'y', 'z'] as const).forEach((label) => {
//   satAccelerationFolder.addBinding(satelliteAcceleration, label, {
//     label,
//     readonly: true,
//     format: (v) => v.toExponential(5),
//   });
// });

// satAccelerationFolder.addBinding(
//   {
//     length: satelliteAcceleration.length(),
//   },
//   'length',
//   {
//     label: 'Magnitude (km/s²)',
//     format: (v) => v,
//     readonly: true,
//   }
// );

function animate(deltaTimeMs: number | null) {
  // controls.update();
  renderer.render(scene, camera);
  pane.refresh();

  stats.update();

  globalParams.timeDeltaTimeMs = deltaTimeMs;

  updateSatellitePosition(deltaTimeMs);
}

const OrbitalVelocity = () => {
  const sceneContainerId = useId();

  useEffect(() => {
    const sceneContainer = document.getElementById(sceneContainerId);
    if (!sceneContainer) return;

    sceneContainer.appendChild(renderer.domElement);

    const controls = new TrackballControls(camera, renderer.domElement);
    controls.noRotate = false;
    controls.noPan = false;
    controls.noZoom = false;

    satelliteFolder
      .addButton({
        title: 'Focus on Satellite',
      })
      .on('click', () => {
        focusOnObject(rocketMesh, controls);
      });

    satelliteFolder.addBlade({
      view: 'separator',
    });

    let lastFrameTime: number;
    let animationId: number;

    const animateLoop = () => {
      animationId = requestAnimationFrame(animateLoop);
      const currentTime = performance.now();

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
