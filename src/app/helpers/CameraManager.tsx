import Earth from 'app/earth/Earth';
import EarthView from 'app/earth/EarthView';
import { normalizeBetween, toExponentGrowth } from 'app/utils';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import MouseTracker from './MouseTracker';
import RocketView from 'app/rocket/RocketView';

const WIDTH = window.innerWidth;
const HEIGHT = window.innerHeight;

export default class CameraManager {
  private createCamera() {
    return new THREE.PerspectiveCamera(
      50,
      WIDTH / HEIGHT,
      0.1,
      Earth.RADIUS * 100
    );
  }

  cameraController: EarthCamera | RocketCamera | null = null;

  getCamera() {
    if (!this.cameraController) {
      return null;
    }
    return this.cameraController.camera;
  }

  constructor(
    private scene: THREE.Scene,
    private renderer: THREE.WebGLRenderer,
    private mouseTracker: MouseTracker
  ) {}

  setEarthCamera(earth: Earth) {
    if (this.cameraController) {
      this.cameraController.remove();
    }

    this.cameraController = new EarthCamera(
      earth.position.clone(),
      this.createCamera(),
      this.renderer.domElement
    );
  }

  setRocketCamera(earthView: EarthView, rocketView: RocketView) {
    if (this.cameraController) {
      this.cameraController.remove();
    }

    const camera = this.createCamera();
    const earthCenter = earthView.mesh.position.clone();
    this.cameraController = new RocketCamera(
      camera,
      rocketView,
      earthCenter,
      window.document.body
    );
  }

  update() {
    if (!this.cameraController) return;

    this.cameraController.update();
    this.renderer.render(this.scene, this.cameraController.camera);
  }

  getMeshIntersectionPoint(mesh: THREE.Mesh | THREE.Group): THREE.Vector3 | null {
    if (!this.cameraController) {
      return null;
    }

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(
      this.mouseTracker.normalizedPosition,
      this.cameraController.camera
    );

    const intersects = raycaster.intersectObject(mesh);

    if (intersects.length > 0) {
      return intersects[0].point;
    }

    return null;
  }
}

class EarthCamera {
  constructor(
    private readonly earthCenter: THREE.Vector3,
    public camera: THREE.PerspectiveCamera,
    private domElement: HTMLElement | null,
    private controls = new OrbitControls(camera, domElement)
  ) {
    const { x, y, z } = this.earthCenter;

    this.controls.minDistance = Earth.RADIUS + 50;
    this.controls.maxDistance = Earth.RADIUS * 6;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.8;
    this.controls.enablePan = false;

    this.camera.position.z = z + this.controls.maxDistance / 2;
    this.camera.position.y = y;
    this.camera.position.x = x;

    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  private updateControlSpeed = () => {
    const distance = this.camera.position.length(); // Assuming planet center at (0, 0, 0)

    const percentageOfDistanceToSurface = normalizeBetween(
      distance,
      this.controls.minDistance,
      this.controls.maxDistance
    );

    const rotateExponentBase = 5;
    const maxRotateSpeed = 2;
    const minRotateSpeed = 0.005;

    const expFactor = THREE.MathUtils.mapLinear(
      toExponentGrowth(percentageOfDistanceToSurface, rotateExponentBase),
      0,
      1,
      minRotateSpeed,
      maxRotateSpeed
    );

    this.controls.rotateSpeed = expFactor;

    const minZoomSpeed = 0.01;
    const maxZoomSpeed = 4;

    const zoomExponentBase = 2;
    const zoomFactor = THREE.MathUtils.mapLinear(
      toExponentGrowth(percentageOfDistanceToSurface, zoomExponentBase),
      0,
      1,
      minZoomSpeed,
      maxZoomSpeed
    );
    this.controls.zoomSpeed = zoomFactor;

    this.controls.update();
    // this.camera.updateProjectionMatrix();
  };

  private updateCameraRotation = () => {
    const distance = this.camera.position.length();

    const rotationEffectStartFromSurfaceKm = 6000;
    const approachingToSurface =
      this.controls.minDistance + rotationEffectStartFromSurfaceKm - distance;

    if (approachingToSurface > 0) {
      const effectPercentage =
        approachingToSurface / rotationEffectStartFromSurfaceKm;
      const effectPercentageExp = toExponentGrowth(effectPercentage, 4);
      const maxAngle = THREE.MathUtils.degToRad(80);

      this.camera.rotateOnAxis(
        new THREE.Vector3(1, 0, 0),
        maxAngle * effectPercentageExp
      );
    }

    this.camera.updateProjectionMatrix();
  };

  update() {
    this.updateControlSpeed();
    this.updateCameraRotation();
  }

  remove() {
    this.controls.dispose();
  }
}

class RocketCamera {
  camera: THREE.PerspectiveCamera;
  earthCenter: THREE.Vector3;

  // Camera settings
  mouseSensitivity: number = 0.005;

  minDistance: number = 10; // Minimum distance from the target
  maxDistance: number = Earth.RADIUS; // Maximum distance from the target
  distance: number = this.minDistance;
  currentOffset: THREE.Vector3 = new THREE.Vector3(0, 0, 0); // Default offset

  // Rotation state
  phi: number = THREE.MathUtils.degToRad(45); // Vertical angle
  theta: number = THREE.MathUtils.degToRad(0); // Horizontal angle

  // DOM element for mouse events
  domElement: HTMLElement;
  isMouseDown: boolean = false;
  prevMouseX: number = 0;
  prevMouseY: number = 0;

  constructor(
    camera: THREE.PerspectiveCamera,
    private rocketView: RocketView,
    earthCenter: THREE.Vector3,
    domElement: HTMLElement
  ) {
    this.camera = camera;

    this.earthCenter = earthCenter;
    this.domElement = domElement;

    this.minDistance = this.rocketView.size;
    this.distance = this.rocketView.size * 3; 

    // Set up mouse controls
    this.domElement.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.domElement.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.domElement.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.domElement.addEventListener('wheel', this.onMouseWheel.bind(this), {
      passive: false,
    });
  }

  private getRocketPosition() {
    const rocketPosition = this.rocketView.group.position.clone();

    const earthNormal = this.earthCenter
      .clone()
      .sub(this.rocketView.group.position)
      .normalize();

    const offset = -this.rocketView.size * 0.5;

    return rocketPosition
      .add(earthNormal.clone().multiplyScalar(offset))
  }

  onMouseDown(event: MouseEvent) {
    this.isMouseDown = true;
    this.prevMouseX = event.clientX;
    this.prevMouseY = event.clientY;
  }

  onMouseUp() {
    this.isMouseDown = false;
  }

  onMouseMove(event: MouseEvent) {
    if (!this.isMouseDown) return;

    const deltaX = event.clientX - this.prevMouseX;
    const deltaY = event.clientY - this.prevMouseY;

    // Update angles based on mouse movement
    this.theta -= deltaX * this.mouseSensitivity; // Horizontal rotation
    this.phi = Math.max(
      0.1,
      Math.min(Math.PI - 0.1, this.phi - deltaY * this.mouseSensitivity)
    ); // Vertical rotation (clamped)

    this.prevMouseX = event.clientX;
    this.prevMouseY = event.clientY;
  }

  onMouseWheel(event: WheelEvent) {
    // Zoom in/out
    const minStep = 0.001;
    const maxStep = 1;

    const percentageOfApproach = normalizeBetween(
      this.distance,
      this.minDistance,
      this.maxDistance
    );

    // const step = maxStep;
    const step = THREE.MathUtils.mapLinear(
      1 - Math.pow(1 - percentageOfApproach, 8),
      0,
      1,
      minStep,
      maxStep
    );

    const wheelStep = event.deltaY * step;

    this.distance = Math.max(
      this.minDistance,
      Math.min(this.maxDistance, this.distance + wheelStep)
    );

    event.preventDefault();
  }

  update() {
    const targetPos = this.getRocketPosition();
    const surfaceNormal = new THREE.Vector3()
      .subVectors(targetPos, this.earthCenter)
      .normalize();

    // Calculate camera position in spherical coordinates
    const sphericalPos = new THREE.Spherical(
      this.distance,
      this.phi,
      this.theta
    );

    // Convert spherical to Cartesian coordinates
    this.currentOffset.setFromSpherical(sphericalPos);

    // Align offset with surface normal (so "up" is away from Earth)
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0), // Default "up"
      surfaceNormal
    );
    this.currentOffset.applyQuaternion(quaternion);

    // Set camera position and look at target
    this.camera.position.copy(targetPos).add(this.currentOffset);
    this.camera.lookAt(targetPos);
    this.camera.up.copy(surfaceNormal); // Ensure camera respects surface normal
  }

  remove() {
    // Clean up event listeners
    this.domElement.removeEventListener('mousedown', this.onMouseDown);
    this.domElement.removeEventListener('mouseup', this.onMouseUp);
    this.domElement.removeEventListener('mousemove', this.onMouseMove);
    this.domElement.removeEventListener('wheel', this.onMouseWheel);
  }
}
