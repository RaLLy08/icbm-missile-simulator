import * as THREE from 'three';
import Earth from 'app/earth/Earth';
import RocketView from './RocketView';

export type TrackingCameraMode = 'chase' | 'fpv';

/**
 * Small embedded viewport with its own camera that follows a missile in realtime.
 * Supports a third-person chase camera and a first-person (nose) camera.
 */
export default class RocketTrackingView {
  // Remembered across GUI re-creation (e.g. switching focused missile)
  private static lastMode: TrackingCameraMode = 'chase';

  readonly element: HTMLDivElement;
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private label: HTMLDivElement;
  private _mode: TrackingCameraMode = RocketTrackingView.lastMode;

  onModeChange: (mode: TrackingCameraMode) => void = () => {};

  get mode() {
    return this._mode;
  }

  set mode(mode: TrackingCameraMode) {
    if (mode === this._mode) return;
    this._mode = mode;
    RocketTrackingView.lastMode = mode;
    // Snap instead of easing when re-entering chase mode
    this.initialized = false;
    this.updateLabel();
    this.onModeChange(mode);
  }

  toggleMode() {
    this.mode = this._mode === 'chase' ? 'fpv' : 'chase';
  }

  private updateLabel() {
    this.label.textContent = `● LIVE · ${this._mode === 'fpv' ? 'FPV' : 'CHASE'}`;
  }

  private readonly target = new THREE.Vector3();
  private readonly desiredOffset = new THREE.Vector3();
  private readonly offset = new THREE.Vector3();
  private initialized = false;

  // How far the camera sits from the missile, in missile sizes
  distanceMultiplier = 5;
  // Higher = camera follows tighter, lower = smoother
  followSmoothness = 8;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly rocketView: RocketView,
    height = 160
  ) {
    this.element = document.createElement('div');
    Object.assign(this.element.style, {
      position: 'relative',
      width: '100%',
      height: `${height}px`,
      margin: '4px 0',
      borderRadius: '4px',
      overflow: 'hidden',
      border: '1px solid rgba(0, 255, 255, 0.5)',
      background: '#000',
      cursor: 'pointer',
    });
    this.element.title = 'Click to switch Chase / First-Person view';
    this.element.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMode();
    });
    // Don't let clicks in the viewport reach the global Earth-picking handler
    this.element.addEventListener('mousedown', (e) => e.stopPropagation());

    const label = document.createElement('div');
    this.label = label;
    this.updateLabel();
    Object.assign(label.style, {
      position: 'absolute',
      top: '4px',
      left: '6px',
      fontSize: '10px',
      fontFamily: 'monospace',
      color: '#f44',
      pointerEvents: 'none',
      zIndex: '1',
    });
    this.element.appendChild(label);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      logarithmicDepthBuffer: true,
    });
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    Object.assign(this.renderer.domElement.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      display: 'block',
    });
    this.element.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(
      50,
      1,
      Math.max(this.rocketView.size * 0.01, 0.001),
      Earth.RADIUS * 100
    );
  }

  private lastWidth = 0;
  private lastHeight = 0;

  /** Sync drawing buffer to the element size. Returns false if not visible. */
  private syncSize() {
    const { clientWidth: width, clientHeight: height } = this.element;
    if (width === 0 || height === 0) return false;

    if (width !== this.lastWidth || height !== this.lastHeight) {
      this.lastWidth = width;
      this.lastHeight = height;
      // `false` = don't touch CSS size, so layout never feeds back
      this.renderer.setSize(width, height, false);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }
    return true;
  }

  private computeDesiredPose() {
    const { group, size, earthView } = this.rocketView;
    const earthCenter = earthView.mesh.position;

    // Aim at the middle of the missile body (group origin is its tail)
    this.target.set(0, size * 0.6, 0);
    group.localToWorld(this.target);

    const up = group.position.clone().sub(earthCenter).normalize();

    // Use the rendered (interpolated) orientation of the missile instead of the
    // raw physics velocity, which only changes on discrete physics steps.
    // RocketView aligns the group's local +Y with the interpolated velocity.
    const forward = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(group.quaternion)
      .normalize();

    let side = new THREE.Vector3().crossVectors(forward, up);
    if (side.lengthSq() < 1e-6) {
      // Forward is parallel to up (vertical launch) – pick any perpendicular
      side = new THREE.Vector3(1, 0, 0).cross(up);
      if (side.lengthSq() < 1e-6) side = new THREE.Vector3(0, 0, 1).cross(up);
    }
    side.normalize();

    const d = size * this.distanceMultiplier;

    // Chase camera offset: behind, slightly to the side and above the missile
    this.desiredOffset
      .set(0, 0, 0)
      .addScaledVector(forward, -d * 0.7)
      .addScaledVector(side, d * 0.5)
      .addScaledVector(up, d * 0.35);

    return up;
  }

  private updateFirstPerson() {
    const { group, size, earthView } = this.rocketView;
    const earthCenter = earthView.mesh.position;

    // Just ahead of the nose cone tip (body = size, cone = 0.3 * size)
    this.camera.position.set(0, size * 1.35, 0);
    group.localToWorld(this.camera.position);

    const forward = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(group.quaternion)
      .normalize();

    // Keep the horizon level: "up" is the surface normal projected
    // perpendicular to the flight direction.
    const surfaceUp = group.position.clone().sub(earthCenter).normalize();
    let up = surfaceUp.clone().addScaledVector(forward, -surfaceUp.dot(forward));

    if (up.lengthSq() < 1e-6) {
      // Flying straight up/down – fall back to the missile's own local axis
      up = new THREE.Vector3(0, 0, -1).applyQuaternion(group.quaternion);
    }

    this.camera.up.copy(up.normalize());
    this.camera.lookAt(this.camera.position.clone().add(forward));
  }

  update(deltaTime = 0) {
    if (!this.element.isConnected || !this.syncSize()) return;

    if (this._mode === 'fpv') {
      this.updateFirstPerson();

      // Force arrows start at the tail and pass through the nose – hide them
      // so they don't block the first-person view.
      this.rocketView.setArrowsVisible(false);
      this.renderer.render(this.scene, this.camera);
      this.rocketView.setArrowsVisible(true);
      return;
    }

    const up = this.computeDesiredPose();

    // Smooth only the offset (orientation around the missile), then attach the
    // camera rigidly to the target. Smoothing the absolute position of a fast
    // moving object makes the follow distance depend on frame time -> jitter.
    if (!this.initialized) {
      this.offset.copy(this.desiredOffset);
      this.initialized = true;
    } else {
      const alpha = 1 - Math.exp(-this.followSmoothness * deltaTime);
      const length = this.desiredOffset.length();
      this.offset.lerp(this.desiredOffset, alpha).setLength(length);
    }

    this.camera.position.copy(this.target).add(this.offset);

    this.camera.up.copy(up);
    this.camera.lookAt(this.target);

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.element.remove();
  }
}
