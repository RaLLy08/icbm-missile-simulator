import Earth from 'app/earth/Earth';
import EarthView from 'app/earth/EarthView';
import Rocket from 'app/rocket/Rocket';
import { normalizeBetween, toExponentGrowth } from 'app/utils';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

const WIDTH = window.innerWidth;
const HEIGHT = window.innerHeight;

export default class CameraManager {
  readonly camera = new THREE.PerspectiveCamera(50, WIDTH / HEIGHT);
  readonly controls = new OrbitControls(this.camera, this.renderer.domElement);

  constructor(
    private scene: THREE.Scene,
    private renderer: THREE.WebGLRenderer
  ) {}

  focusOnRocket(rocketView: Rocket) {
    if (!this.controls) {
      return;
    }

    this.controls.minDistance = 50;
    this.controls.maxDistance = Earth.RADIUS * 4;

    this.camera.updateProjectionMatrix();
  }

  focusOnEarth(earthView: EarthView) {
    if (!this.controls) {
      return;
    }

    this.camera.near = Earth.RADIUS * 0.001;
    this.camera.far = Earth.RADIUS * 100;

    this.controls.minDistance = Earth.RADIUS + 50;
    this.controls.maxDistance = Earth.RADIUS * 6;

    // check this
    this.camera.position.z = this.controls.maxDistance / 2;
    this.camera.position.y = 0;
    this.camera.position.x = 0;

    this.camera.updateProjectionMatrix();
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

    this.camera.updateProjectionMatrix();
    this.controls.update();
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
  };

  update() {
    this.updateControlSpeed();
    this.updateCameraRotation();

    this.renderer.render(this.scene, this.camera);
  }
}
