import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useEffect, useId } from 'react';
import { Pane } from 'tweakpane';

// import earth2kTextureJpg from 'public/textures/2k_earth_daymap.jpg';
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

const renderer = new THREE.WebGLRenderer({ antialias: true });
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
  new THREE.SphereGeometry(EARTH_RADIUS_KM, 32, 32),
  new THREE.MeshStandardMaterial({
    map: earthTexture,
  })
);
earth.position.set(0, 0, 0);
earth.name = 'EARTH';
earth.castShadow = true;
earth.receiveShadow = true;

const box = new THREE.BoxHelper(earth, 0xffff00);
scene.add(box);

scene.add(earth);

const satilliteGeometry = new THREE.CylinderGeometry(
  10,
  10,
  20,
  32, // Height segments
  32
);

const satilliteMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
const satellite = new THREE.Mesh(satilliteGeometry, satilliteMaterial);
satellite.name = 'SATELLITE';
const SATELLITE_ALTITUDE = 408; // in km

satellite.rotateZ(Math.PI / 2); // Rotate to align with the Earth's equator

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
const satelliteInitialVelocity = new THREE.Vector3(0, 7.67, 0);
const satelliteVelocity = new THREE.Vector3(0, 0, 0).add(
  satelliteInitialVelocity
);
const satelliteAcceleration = new THREE.Vector3(0, 0, 0);

const TIME_MULTIPLAYER = 1000;

const pane = new Pane();

const satelliteFolder = pane.addFolder({
  title: 'Satellite Controls',
  expanded: true,
});

const params = {
  altitudeKm: 0,
};

let guiAltitudeKm = satelliteFolder.addBinding(params, 'altitudeKm', {
  label: 'Altitude (km)',
});


function updateSatellitePosition(deltaTime: number | null) {
  if (deltaTime == null) {
    return;
  }
  const earthMass = 5.972e24; // kg (mass of the Earth)
  const G = 6.6743e-11; // Gravitational constant with a small random variation
  const earthGravityVector = new THREE.Vector3()
    .subVectors(earth.position, satellite.position) // Earth - Satellite
    .normalize();
  const distanceMeters = earth.position.distanceTo(satellite.position) * 1000; // Convert km to meters

  const distanceToSurface = distanceMeters - EARTH_RADIUS_KM * 1000;

  params.altitudeKm = distanceToSurface / 1000;
  guiAltitudeKm.refresh();

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


  const gravityForceMagnitude = (G * earthMass) / distanceMeters ** 2;

  const gravityForce = earthGravityVector.multiplyScalar(
    gravityForceMagnitude * 0.001
  ); // Convert to km/s^2

  tangentLine.geometry.setFromPoints([
    satellite.position,
    earth.position,
  ]);

  satelliteAcceleration.copy(gravityForce);

  satelliteVelocity.add(
    satelliteAcceleration.clone().multiplyScalar(deltaTime * TIME_MULTIPLAYER)
  );

  satellite.rotateZ(
    satellite.position
      .clone()
      .angleTo(satellite.position.clone().add(satelliteVelocity.clone())) *
      deltaTime *
      TIME_MULTIPLAYER
  );

  satellite.position.add(
    satelliteVelocity.clone().multiplyScalar(deltaTime * TIME_MULTIPLAYER)
  );
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


satelliteFolder.addButton({
  title: 'Focus on Satellite',
}).on('click', () => {
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

const velocityControls = [
  satelliteFolder.addBinding(satelliteVelocity, 'x', {
    label: 'vel. x',
    readonly: true,
  }),
  satelliteFolder.addBinding(satelliteVelocity, 'y', {
    label: 'vel. y',
    readonly: true,
  }),
  satelliteFolder.addBinding(satelliteVelocity, 'z', {
    label: 'vel. z',
    readonly: true,
  }),
  satelliteFolder.addBinding(
    {
      length: satelliteVelocity.length(),
    },
    'length',
    {
      label: 'Orbital Velocity',
      readonly: true,
    },
  ),
];



// const velocityControls = [
//   satelliteFolder.add(satelliteVelocity, 'x', -1000, 1000).name('Velocity X'),
//   satelliteFolder.add(satelliteVelocity, 'y', -1000, 1000).name('Velocity Y'),
//   satelliteFolder.add(satelliteVelocity, 'z', -1000, 1000).name('Velocity Z'),
// ];

// // focus on the satellite
// satelliteFolder
//   .add({ focus: () => focusOnObject(satellite) }, 'focus')
//   .name('Focus on Satellite');

// satelliteFolder.add(satelliteAcceleration, 'x', -1, 1).name('Acceleration X');
// satelliteFolder.add(satelliteAcceleration, 'y', -1, 1).name('Acceleration Y');
// satelliteFolder.add(satelliteAcceleration, 'z', -1, 1).name('Acceleration Z');





function animate(deltaTime: number | null) {
  controls.update();
  renderer.render(scene, camera);

  // const [xPosControl, yPosControl, zPosControl] = positionControls;
  // const [xVelControl, yVelControl, zVelControl] = velocityControls;

  // xPosControl.setValue(satellite.position.x);
  // yPosControl.setValue(satellite.position.y);
  // zPosControl.setValue(satellite.position.z);

  // xVelControl.setValue(satelliteVelocity.x);
  // yVelControl.setValue(satelliteVelocity.y);
  // zVelControl.setValue(satelliteVelocity.z);

  // focusOnObject(satellite);

  updateSatellitePosition(deltaTime);
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
        animate((currentTime - lastFrameTime) / 1000);
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
