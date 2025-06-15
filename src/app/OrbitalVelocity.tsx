import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useEffect, useId } from 'react';
import { Pane } from 'tweakpane';

import earth8kTextureJpg from 'public/textures/8k_earth_daymap.jpg';

const earthTexture = new THREE.TextureLoader().load(earth8kTextureJpg);

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

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.update();

const axesHelper = new THREE.AxesHelper(3);
axesHelper.position.set(3, -3, 0);
scene.add(axesHelper);

const ambientLight = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

const EARTH_RADIUS_KM = 6378; // in km

const earth = new THREE.Mesh(
  new THREE.SphereGeometry(EARTH_RADIUS_KM, 128, 128),
  new THREE.MeshPhongMaterial({
    map: earthTexture,
  })
);
earth.position.set(0, 0, 0);
earth.name = 'EARTH';
earth.castShadow = true;
earth.receiveShadow = true;
earth.renderOrder = 0; // Ensure Earth is rendered first

scene.add(earth);

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

atmosphereLayers.forEach((layer, i) => {
  layer.renderOrder = 1 + i; // Ensure atmosphere is rendered after the Earth
  scene.add(layer);
});

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

const satteliteHeigth = 0.2;
const satilliteGeometry = new THREE.ConeGeometry(
  satteliteHeigth,
  satteliteHeigth * 2,
  32,
  1
);

const satilliteMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const satellite = new THREE.Mesh(satilliteGeometry, satilliteMaterial);
satellite.name = 'SATELLITE';
const SATELLITE_ALTITUDE = satteliteHeigth / 2; // in km

satellite.rotateZ(-Math.PI / 2); // Rotate to align with the Earth's equator

const satteliteInitialPosition = new THREE.Vector3(
  EARTH_RADIUS_KM + SATELLITE_ALTITUDE,
  0,
  0
);
satellite.position.copy(satteliteInitialPosition); // Initial position of the satellite
scene.add(satellite);

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

for (let i = 0; i < maxPoints; i++) {
  trailPositions[i * 3] = satellite.position.x;
  trailPositions[i * 3 + 1] = satellite.position.y;
  trailPositions[i * 3 + 2] = satellite.position.z;
}

trailLine.frustumCulled = false;

scene.add(trailLine);

trailLine.name = 'TRAIL';

const gravityLine = new THREE.Line(
  new THREE.BufferGeometry(),
  new THREE.LineBasicMaterial({ color: 0x00ff00 })
);
scene.add(gravityLine);

const tangentLine = new THREE.Line(
  new THREE.BufferGeometry(),
  new THREE.LineBasicMaterial({ color: 0xffff00 })
);
scene.add(tangentLine);
tangentLine.frustumCulled = false;
const satelliteInitialVelocity = new THREE.Vector3(0, 0, 0);
const satelliteVelocity = new THREE.Vector3(0, 0, 0).add(
  satelliteInitialVelocity
);
const satelliteAcceleration = new THREE.Vector3(0, 0, 0);

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
// save launch time, create rocket, missle class

function updateSatellitePosition(deltaTimeMs: number | null) {
  if (deltaTimeMs == null) {
    return;
  }
  const deltaTimeS = deltaTimeMs / 1000;
  const tick = deltaTimeS * globalParams.timeMultiplier;

  globalParams.timePassedSeconds += tick;

  const maxAcceleration = 30 / 1000; // km/s²
  const burnTimeS = 535; // Time in seconds for the burn

  let xAcceleration = 0;

  if (burnTimeS > globalParams.timePassedSeconds) {
    xAcceleration =
      maxAcceleration *
      Math.sin((globalParams.timePassedSeconds * Math.PI) / burnTimeS);
  } else {
    xAcceleration = 0;
  }

  satelliteAcceleration.set(xAcceleration, 0, 0);

  let thrustAngleIncline = 0;


  if (guiSatelliteParams.altitudeKm < 1) {
    thrustAngleIncline = THREE.MathUtils.degToRad(0);
  } else if (guiSatelliteParams.altitudeKm < 10) {
    thrustAngleIncline = THREE.MathUtils.degToRad(5);
  } else if (guiSatelliteParams.altitudeKm < 30) {
    thrustAngleIncline = THREE.MathUtils.degToRad(20);
  } else if (guiSatelliteParams.altitudeKm < 80) {
    thrustAngleIncline = THREE.MathUtils.degToRad(45);
  } else if (guiSatelliteParams.altitudeKm < 150) {
    thrustAngleIncline = THREE.MathUtils.degToRad(70);
  } else {
    thrustAngleIncline = THREE.MathUtils.degToRad(85);
  }

  satelliteAcceleration.applyAxisAngle(
    new THREE.Vector3(0, 0, 1),
    thrustAngleIncline
  ); // Rotate to align with the Earth's equator

  const earthGravityVector = new THREE.Vector3()
    .subVectors(earth.position, satellite.position) // Earth - Satellite
    .normalize();
  const distanceMeters = earth.position.distanceTo(satellite.position) * 1000; // Convert km to meters

  const distanceToSurface = distanceMeters - EARTH_RADIUS_KM * 1000;

  guiSatelliteParams.altitudeKm = distanceToSurface / 1000;

  for (let i = maxPoints - 1; i > 0; i--) {
    trailPositions[i * 3] = trailPositions[(i - 1) * 3];
    trailPositions[i * 3 + 1] = trailPositions[(i - 1) * 3 + 1];
    trailPositions[i * 3 + 2] = trailPositions[(i - 1) * 3 + 2];
  }

  trailPositions[0] = satellite.position.x;
  trailPositions[1] = satellite.position.y;
  trailPositions[2] = satellite.position.z;

  trailGeometry.attributes.position.needsUpdate = true;

  if (distanceToSurface < 0) {
    // If the satellite is below the Earth's surface, reset its position
    satellite.position.copy(satteliteInitialPosition);
    satelliteVelocity.copy(satelliteInitialVelocity);
    satelliteAcceleration.set(0, 0, 0); // Reset acceleration
    return; // Exit the function to avoid further calculations
  }

  const gravityForceMagnitude = (EARTH_G * EARTH_MASS_KG) / distanceMeters ** 2;

  const gravityForce = earthGravityVector.multiplyScalar(
    gravityForceMagnitude * 0.001
  ); // Convert to km/s^2

  guiSatelliteParams.gravitiAcceleration = gravityForce.length();

  tangentLine.geometry.setFromPoints([satellite.position, earth.position]);

  satelliteVelocity
    .add(gravityForce.clone().multiplyScalar(tick))
    .add(satelliteAcceleration.clone().multiplyScalar(tick));

  satellite.rotateZ(
    satellite.position
      .clone()
      .angleTo(satellite.position.clone().add(satelliteVelocity.clone())) * tick
  );

  guiSatelliteParams.pitch = THREE.MathUtils.radToDeg(
    Math.PI / 2 -
      satelliteVelocity.clone().angleTo(earthGravityVector.clone())
  );

  satellite.position.add(satelliteVelocity.clone().multiplyScalar(tick));
}

const focusOnObject = (object3D: THREE.Object3D) => {
  const boundingBox = new THREE.Box3().setFromObject(object3D);
  const center = boundingBox.getCenter(new THREE.Vector3());
  const size = boundingBox.getSize(new THREE.Vector3());

  // Calculate an appropriate distance (zoom out enough to see the object)
  const maxDim = Math.max(size.x, size.y, size.z);
  const fov = camera.fov * (Math.PI / 180); // convert vertical FOV to radians
  let distance = maxDim / (2 * Math.tan(fov / 2));

  // Optional: add a buffer
  distance *= 6;

  // Set camera position (here along Z axis; adjust as needed)
  const direction = new THREE.Vector3(0, 0, 1); // camera looks from positive Z
  const newPosition = center.clone().add(direction.multiplyScalar(distance));
  camera.position.copy(newPosition);

  // Focus and render
  controls.target.copy(center);
  controls.update();
  camera.lookAt(center);
  renderer.render(scene, camera);
};
function onClick(event) {
  // Convert mouse to normalized device coordinates (-1 to +1)
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  // Update the picking ray with the camera and mouse position
  raycaster.setFromCamera(mouse, camera);

  // Calculate objects intersecting the ray
  const intersects = raycaster.intersectObjects(scene.children, true);

  if (intersects.length > 0) {
    // focus on the first intersected object
    if (intersects[0].object.name === 'SATELLITE') {
      const intersectedObject = intersects[0].object;
      focusOnObject(intersectedObject);
    }
  }
}

window.addEventListener('click', onClick, false);

satelliteFolder
  .addButton({
    title: 'Focus on Satellite',
  })
  .on('click', () => {
    focusOnObject(satellite);
  });

satelliteFolder.addBlade({
  view: 'separator',
});

(['x', 'y', 'z'] as const).forEach((label) => {
  satelliteFolder.addBinding(satellite.position, label, {
    label,
    readonly: true,
  });
});

const satVelocityFolder = satelliteFolder.addFolder({
  title: 'Velocity (km/s)',
  expanded: true,
});

(['x', 'y', 'z'] as const).forEach((label) => {
  satVelocityFolder.addBinding(satelliteVelocity, label, {
    label,
    readonly: true,
    format: (v) => v.toExponential(5),
  });
});

satVelocityFolder.addBinding(
  {
    length: satelliteVelocity.length(),
  },
  'length',
  {
    label: 'Magnitude',
    readonly: true,
  }
);

const satAccelerationFolder = satelliteFolder.addFolder({
  title: 'Acceleration (km/s²)',
  expanded: true,
});

(['x', 'y', 'z'] as const).forEach((label) => {
  satAccelerationFolder.addBinding(satelliteAcceleration, label, {
    label,
    readonly: true,
    format: (v) => v.toExponential(5),
  });
});

satAccelerationFolder.addBinding(
  {
    length: satelliteAcceleration.length(),
  },
  'length',
  {
    label: 'Magnitude (km/s²)',
    format: (v) => v,
    readonly: true,
  }
);

function animate(deltaTimeMs: number | null) {
  controls.update();
  renderer.render(scene, camera);
  pane.refresh();

  globalParams.timeDeltaTimeMs = deltaTimeMs;

  updateSatellitePosition(deltaTimeMs);
}

const OrbitalVelocity = () => {
  const sceneContainerId = useId();

  useEffect(() => {
    const sceneContainer = document.getElementById(sceneContainerId);
    if (!sceneContainer) return;

    sceneContainer.appendChild(renderer.domElement);

    let lastFrameTime: number;
    let animationId: number;

    const animateLoop = () => {
      animationId = requestAnimationFrame(animateLoop);
      const currentTime = performance.now();

      if (lastFrameTime != null) {
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
