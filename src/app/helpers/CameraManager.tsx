import Earth from 'app/earth/Earth';
import EarthView from 'app/earth/EarthView';
import RocketView from 'app/rocket/RocketView';
import { normalizeBetween, toExponentGrowth } from 'app/utils';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import MouseTracker from './MouseTracker';

const WIDTH = window.innerWidth;
const HEIGHT = window.innerHeight;

export default class CameraManager {
  controls: OrbitControls | null = null;
  focusObject: RocketView | EarthView | null = null;

  private createCamera() {
    return new THREE.PerspectiveCamera(
      50,
      WIDTH / HEIGHT,
      0.1,
      Earth.RADIUS * 100
    );
  }

  constructor(
    private scene: THREE.Scene,
    private renderer: THREE.WebGLRenderer,
    private mouseTracker: MouseTracker,
    public camera = this.createCamera()
  ) {}

  private updateControlsPosition(position: THREE.Vector3) {
    if (!this.controls) {
      return;
    }

    // if (this.focusObject instanceof RocketView) {
    // fixed focus
    //   this.camera.position
    //     .copy(this.focusObject.group.position.clone())
    //     .add(new THREE.Vector3(0, 100, 100));
    // }

    this.controls.target.copy(position);

    this.controls.update();
  }

  focusOnRocket(earthView: EarthView, rocketView: RocketView) {
    this.focusObject = rocketView;

    this.camera = this.createCamera();

    this.camera.position
      .copy(rocketView.group.position.clone())
      .add(new THREE.Vector3(0, 100, 100));

    const surfaceNormal = new THREE.Vector3()
      .subVectors(rocketView.group.position, earthView.mesh.position)
      .normalize();

    this.camera.up.copy(surfaceNormal);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    this.camera.updateProjectionMatrix();

    this.updateControlsPosition(rocketView.group.position);
  }

  focusOnEarth(earthView: EarthView) {
    this.focusObject = earthView;

    this.camera = this.createCamera();
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    this.controls.minDistance = Earth.RADIUS + 50;
    this.controls.maxDistance = Earth.RADIUS * 6;

    this.camera.position.z = this.controls.maxDistance / 2;
    this.camera.position.y = 0;
    this.camera.position.x = 0;

    this.camera.updateProjectionMatrix();

    this.controls.update();
  }

  private updateControlSpeed = () => {
    if (!this.controls) {
      return;
    }

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
    this.camera.updateProjectionMatrix();
  };

  private updateCameraRotation = () => {
    if (!this.controls) {
      return;
    }

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
    if (this.focusObject instanceof EarthView) {
      this.updateControlSpeed();
      this.updateCameraRotation();
    }

    if (this.focusObject instanceof RocketView) {
      this.updateControlsPosition(this.focusObject.group.position);
    }

    this.renderer.render(this.scene, this.camera);
  }

  getMeshIntersectionPoint(mesh: THREE.Mesh): THREE.Vector3 | null {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(this.mouseTracker.normalizedPosition, this.camera);

    const intersects = raycaster.intersectObject(mesh);

    if (intersects.length > 0) {
      return intersects[0].point;
    }

    return null;
  }
}
