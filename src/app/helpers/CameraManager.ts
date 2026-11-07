import Earth from 'app/earth/Earth';
import EarthView from 'app/earth/EarthView';
import { normalizeBetween, toExponentGrowth } from 'app/utils';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import MouseTracker from './MouseTracker';
import RocketView from 'app/rocket/RocketView';

const WIDTH = window.innerWidth;
const HEIGHT = window.innerHeight;

// Pinch zoom = (finger spread ratio) ^ PINCH_SENSITIVITY.
// 1 = zoom follows fingers 1:1, lower = slower.
const PINCH_SENSITIVITY = 0.5;

export default class CameraManager {
  private createCamera(aspectRatio = WIDTH / HEIGHT) {
    return new THREE.PerspectiveCamera(
      50,
      aspectRatio,
      0.1,
      Earth.RADIUS * 100
    );
  }

  cameraController: EarthCamera | RocketCamera | null = null;
  rocketCameraController: RocketCamera | null = null;
  earthCameraController: EarthCamera | null = null;

  getCamera() {
    if (!this.cameraController) {
      return null;
    }
    return this.cameraController.camera;
  }

  constructor(
    private scene: THREE.Scene,
    private fullScreenRenderer: THREE.WebGLRenderer,
    private miniWindowRenderer: THREE.WebGLRenderer,
    private mouseTracker: MouseTracker
  ) {}

  /** When false, the mini window is folded and is not rendered. */
  miniWindowEnabled = true;

  setEarthCamera(earth: Earth) {
    if (this.rocketCameraController) {
      this.rocketCameraController.disable();
    }

    if (this.earthCameraController == null) {
      this.earthCameraController = new EarthCamera(
        earth.position.clone(),
        this.createCamera(),
        this.fullScreenRenderer.domElement
      );
    } else {
      this.earthCameraController.camera.aspect =
        window.innerWidth / window.innerHeight;
      this.earthCameraController.camera.updateProjectionMatrix();

      this.earthCameraController.enable();
    }

    this.cameraController = this.earthCameraController;
  }

  setRocketCamera(earthView: EarthView, rocketView: RocketView) {
    if (this.earthCameraController) {
      this.earthCameraController.disable();
      // Use the drawing size, not clientWidth/Height: those are 0 while the
      // minimap is folded (display: none) and would give a NaN aspect.
      const miniSize = this.miniWindowRenderer.getSize(new THREE.Vector2());
      this.earthCameraController.camera.aspect = miniSize.x / miniSize.y;
      this.earthCameraController.camera.updateProjectionMatrix();
    }

    const camera = this.createCamera();
    const earthCenter = earthView.mesh.position.clone();

    if (this.rocketCameraController == null) {
      this.rocketCameraController = new RocketCamera(
        camera,
        rocketView,
        earthCenter,
        this.fullScreenRenderer.domElement
      );
    } else {
      this.rocketCameraController.enable();
      this.rocketCameraController.setRocketView(rocketView);
    }

    this.cameraController = this.rocketCameraController;
  }

  update(delta: number) {
    if (!this.cameraController) return;

    this.cameraController.update(delta);
    this.fullScreenRenderer.render(this.scene, this.cameraController.camera);

    if (
      this.miniWindowEnabled &&
      this.earthCameraController &&
      this.cameraController === this.rocketCameraController
    ) {
      this.miniWindowRenderer.render(
        this.scene,
        this.earthCameraController.camera
      );
    }
  }

  /**
   * @param ndc pointer in normalized device coords (-1..1). Defaults to the
   * last tracked mouse position; pass it explicitly for touch, where there is
   * no hover `mousemove` before the tap.
   */
  getMeshIntersectionPoint(
    mesh: THREE.Mesh,
    ndc: THREE.Vector2 = this.mouseTracker.normalizedPosition
  ): THREE.Vector3 | null {
    if (!this.cameraController) {
      return null;
    }

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, this.cameraController.camera);

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
    // Zoom is handled manually for smooth easing (wheel + pinch below)
    this.controls.enableZoom = false;
    // Default TWO = DOLLY_PAN bails out when zoom & pan are both disabled and
    // leaves the controls in one-finger rotate state; the next move is then
    // measured from the first finger to the two-finger midpoint -> the globe
    // jumps. DOLLY_ROTATE re-anchors rotation at the midpoint instead.
    this.controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;

    this.camera.position.z = z + this.controls.maxDistance / 2;
    this.camera.position.y = y;
    this.camera.position.x = x;

    this.targetDistance = this.controls.maxDistance / 2;

    this.camera.updateProjectionMatrix();
    this.controls.update();

    this.domElement?.addEventListener('wheel', this.onMouseWheel, {
      passive: false,
    });
    this.domElement?.addEventListener('pointerdown', this.onPinchPointerDown);
    window.addEventListener('pointermove', this.onPinchPointerMove);
    window.addEventListener('pointerup', this.onPinchPointerUp);
    window.addEventListener('pointercancel', this.onPinchPointerUp);
  }

  // --- Pinch zoom (touch) ---------------------------------------------------
  private touches = new Map<number, { x: number; y: number }>();
  private prevPinchDistance = 0;

  private getPinchDistance() {
    const [a, b] = Array.from(this.touches.values());
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private onPinchPointerDown = (event: PointerEvent) => {
    if (event.pointerType !== 'touch') return;
    this.touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.touches.size === 2)
      this.prevPinchDistance = this.getPinchDistance();
  };

  private onPinchPointerMove = (event: PointerEvent) => {
    const touch = this.touches.get(event.pointerId);
    if (!touch) return;
    touch.x = event.clientX;
    touch.y = event.clientY;

    if (this.touches.size !== 2 || !this.controls.enabled) return;

    const pinchDistance = this.getPinchDistance();
    if (this.prevPinchDistance > 0 && pinchDistance > 0) {
      // Fingers apart -> closer to the surface. Scale the altitude above the
      // surface (not the distance from Earth's center), so zoom slows down
      // near the ground instead of racing through the last few hundred km.
      const altitude = this.targetDistance - Earth.RADIUS;
      const newAltitude =
        altitude *
        Math.pow(this.prevPinchDistance / pinchDistance, PINCH_SENSITIVITY);
      this.targetDistance = THREE.MathUtils.clamp(
        Earth.RADIUS + newAltitude,
        this.controls.minDistance,
        this.controls.maxDistance
      );
    }
    this.prevPinchDistance = pinchDistance;
  };

  private onPinchPointerUp = (event: PointerEvent) => {
    this.touches.delete(event.pointerId);
    if (this.touches.size === 2)
      this.prevPinchDistance = this.getPinchDistance();
  };

  private targetDistance: number;
  // Higher = snappier zoom, lower = smoother
  private zoomSmoothness = 14;

  private onMouseWheel = (event: WheelEvent) => {
    if (!this.controls.enabled) return;
    event.preventDefault();

    // Normalize wheel delta (mouse notch ~100, trackpads send many small deltas)
    const wheelDelta = THREE.MathUtils.clamp(event.deltaY / 100, -1, 1);
    const scale = Math.pow(
      0.95,
      this.controls.zoomSpeed * Math.abs(wheelDelta)
    );

    this.targetDistance = THREE.MathUtils.clamp(
      wheelDelta > 0
        ? this.targetDistance / scale
        : this.targetDistance * scale,
      this.controls.minDistance,
      this.controls.maxDistance
    );
  };

  private updateZoom(delta: number) {
    const offset = this.camera.position.clone().sub(this.earthCenter);
    const distance = offset.length();

    if (Math.abs(distance - this.targetDistance) < 0.01) return;

    // Frame-rate independent exponential easing
    const alpha = 1 - Math.exp(-this.zoomSmoothness * delta);
    const newDistance = THREE.MathUtils.lerp(
      distance,
      this.targetDistance,
      alpha
    );

    this.camera.position.copy(
      this.earthCenter.clone().add(offset.setLength(newDistance))
    );
  }

  private updateControlSpeed = () => {
    // Base speeds on the zoom target so consecutive wheel ticks scale consistently
    const distance = this.targetDistance;

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

    const minZoomSpeed = 0.1;
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

  disable() {
    this.controls.enabled = false;
  }

  enable() {
    this.controls.enabled = true;
  }

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

  update(delta: number) {
    this.updateZoom(delta);
    this.updateControlSpeed();
    this.updateCameraRotation();
  }

  remove() {
    this.domElement?.removeEventListener('wheel', this.onMouseWheel);
    this.domElement?.removeEventListener(
      'pointerdown',
      this.onPinchPointerDown
    );
    window.removeEventListener('pointermove', this.onPinchPointerMove);
    window.removeEventListener('pointerup', this.onPinchPointerUp);
    window.removeEventListener('pointercancel', this.onPinchPointerUp);
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

  // DOM element for pointer events (mouse + touch)
  domElement: HTMLElement;
  // Active pointers by id -> last position. 1 = rotate, 2 = pinch zoom.
  private pointers = new Map<number, { x: number; y: number }>();
  private prevPinchDistance = 0;

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

    // Pointer events cover mouse and touch. Up/cancel are on window so a drag
    // that ends outside the canvas still releases.
    this.domElement.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    this.domElement.addEventListener('wheel', this.onMouseWheel, {
      passive: false,
    });
  }

  disabled = false;
  transitioningToRocketView: RocketView | null = null;

  setRocketView(newRocketView: RocketView) {
    this.rocketView = newRocketView;
  }

  disable() {
    this.disabled = true;
  }

  enable() {
    this.disabled = false;
  }

  private getRocketPosition() {
    const rocketPosition = this.rocketView.group.position.clone();

    const earthNormal = this.earthCenter
      .clone()
      .sub(this.rocketView.group.position)
      .normalize();

    const offset = -this.rocketView.size * 0.5;

    return rocketPosition.add(earthNormal.clone().multiplyScalar(offset));
  }

  private getPinchDistance() {
    const [a, b] = Array.from(this.pointers.values());
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private onPointerDown = (event: PointerEvent) => {
    if (this.disabled) return;
    // Left mouse button only; any touch/pen contact
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.pointers.size === 2) {
      this.prevPinchDistance = this.getPinchDistance();
    }
  };

  private onPointerUp = (event: PointerEvent) => {
    this.pointers.delete(event.pointerId);
    if (this.pointers.size === 2) {
      this.prevPinchDistance = this.getPinchDistance();
    }
  };

  private onPointerMove = (event: PointerEvent) => {
    const prev = this.pointers.get(event.pointerId);
    if (!prev) return;
    if (this.disabled) {
      this.pointers.clear();
      return;
    }

    const deltaX = event.clientX - prev.x;
    const deltaY = event.clientY - prev.y;
    prev.x = event.clientX;
    prev.y = event.clientY;

    if (this.pointers.size >= 2) {
      // Pinch: fingers apart -> zoom in, proportional to the spread
      const pinchDistance = this.getPinchDistance();
      if (this.prevPinchDistance > 0 && pinchDistance > 0) {
        this.distance = THREE.MathUtils.clamp(
          this.distance *
            Math.pow(this.prevPinchDistance / pinchDistance, PINCH_SENSITIVITY),
          this.minDistance,
          this.maxDistance
        );
      }
      this.prevPinchDistance = pinchDistance;
      return;
    }

    // Single pointer: orbit around the missile
    this.theta -= deltaX * this.mouseSensitivity; // Horizontal rotation
    this.phi = Math.max(
      0.1,
      Math.min(Math.PI - 0.1, this.phi - deltaY * this.mouseSensitivity)
    ); // Vertical rotation (clamped)
  };

  /** Positive = zoom out. `amount` is in wheel-deltaY units. */
  private zoomBy(amount: number) {
    // Zoom in/out
    const minStep = 0.001;
    const maxStep = 1;

    const percentageOfApproach = normalizeBetween(
      this.distance,
      this.minDistance,
      this.maxDistance
    );

    const step = THREE.MathUtils.mapLinear(
      1 - Math.pow(1 - percentageOfApproach, 8),
      0,
      1,
      minStep,
      maxStep
    );

    this.distance = Math.max(
      this.minDistance,
      Math.min(this.maxDistance, this.distance + amount * step)
    );
  }

  private onMouseWheel = (event: WheelEvent) => {
    if (this.disabled) return;
    if (this.transitioningToRocketView != null) return;

    this.zoomBy(event.deltaY);
    event.preventDefault();
  };

  private getCameraPosition(targetPos: THREE.Vector3) {
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
    // this.camera.position.copy(targetPos).add(this.currentOffset);
    // this.camera.lookAt(targetPos);
    // this.camera.up.copy(surfaceNormal); // Ensure camera respects surface normal

    return {
      position: targetPos.clone().add(this.currentOffset),
      lookAt: targetPos,
      up: surfaceNormal,
    };
  }

  passedTimeAfterTransition = 0;

  update(delta: number) {
    // if (this.transitioningToRocketView != null) {
    //   this.passedTimeAfterTransition += delta;

    //   const percentOfPassedTime = Math.min(
    //     this.passedTimeAfterTransition / 1, // Transition duration
    //     1
    //   );

    //   const lerpAlpha = THREE.MathUtils.smoothstep(percentOfPassedTime, 0, 1);

    //   const { position, lookAt, up } = this.getCameraPosition(
    //     this.transitioningToRocketView.group.position
    //   );

    //   const targetPos = position.clone();
    //   const currentPos = this.camera.position.clone();

    //   const targetLookAt = lookAt.clone();
    //   const currentLookAt = this.camera
    //     .getWorldDirection(new THREE.Vector3())
    //     .add(currentPos);

    //   const targetUp = up.clone();
    //   const currentUp = this.camera.up.clone();

    //   // Lerp position
    //   this.camera.position.lerp(targetPos, lerpAlpha);
    //   this.camera.up.lerp(currentUp.lerp(targetUp, lerpAlpha), lerpAlpha);
    //   // this.camera.lookAt(currentLookAt.lerp(targetLookAt, lerpAlpha));

    //   const dist = currentPos.distanceTo(targetPos);

    //   // If close enough, stop transitioning
    //   if (dist < 1) {
    //     this.rocketView = this.transitioningToRocketView;
    //     this.transitioningToRocketView = null;
    //     this.passedTimeAfterTransition = 0;
    //   }

    //   return;
    // }

    const { position, lookAt, up } = this.getCameraPosition(
      this.getRocketPosition()
    );

    this.camera.position.copy(position);
    this.camera.lookAt(lookAt);
    this.camera.up.copy(up);
  }

  remove() {
    // Clean up event listeners
    this.domElement.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    this.domElement.removeEventListener('wheel', this.onMouseWheel);
  }
}
