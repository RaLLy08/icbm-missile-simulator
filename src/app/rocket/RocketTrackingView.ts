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

  // One WebGL context shared by every tracking view. Creating a renderer per
  // missile means a fresh context that has to re-upload every texture and
  // recompile every shader on its first frame -> big hitch on launch.
  private static sharedRenderer: THREE.WebGLRenderer | null = null;

  private static getRenderer() {
    if (!RocketTrackingView.sharedRenderer) {
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        logarithmicDepthBuffer: true,
      });
      renderer.setClearColor(0x000000, 1);
      // Small viewport: full devicePixelRatio is wasted fill-rate here
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      Object.assign(renderer.domElement.style, {
        position: 'absolute',
        inset: '0',
        width: '100%',
        height: '100%',
        display: 'block',
      });
      RocketTrackingView.sharedRenderer = renderer;
    }
    return RocketTrackingView.sharedRenderer;
  }

  /**
   * Creates the shared context ahead of time and uploads the scene's
   * textures / compiles its shaders, so the first launch doesn't stall.
   * Re-runs once all pending loader requests (e.g. Earth textures) finish.
   */
  static prewarm(scene: THREE.Scene, camera: THREE.Camera) {
    const renderer = RocketTrackingView.getRenderer();
    const warm = () => {
      renderer.setSize(1, 1, false);
      renderer.render(scene, camera);
    };
    warm();

    const manager = THREE.DefaultLoadingManager;
    const prevOnLoad = manager.onLoad;
    manager.onLoad = () => {
      prevOnLoad?.();
      warm();
    };
  }

  readonly element: HTMLDivElement;
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private label: HTMLDivElement;
  private _mode: TrackingCameraMode = RocketTrackingView.lastMode;

  get mode() {
    return this._mode;
  }

  set mode(mode: TrackingCameraMode) {
    if (mode === this._mode) return;
    this._mode = mode;
    RocketTrackingView.lastMode = mode;
    // Snap instead of easing when re-entering chase mode
    this.initialized = false;
    this.fpvHeadingValid = false;
    this.resetRotation();
    this.updateLabel();
  }

  // --- User rotation (drag on the viewport) --------------------------------
  // Radians, relative to the default camera direction of the current mode
  private yaw = 0;
  private pitch = 0;
  rotateSensitivity = 0.008;

  private pointerId: number | null = null;
  private pointerPrevX = 0;
  private pointerPrevY = 0;

  resetRotation() {
    this.yaw = 0;
    this.pitch = 0;
  }

  /**
   * Rotate the view by a pointer drag of (dx, dy) pixels. Shared by the
   * embedded viewport and the main view while it is chasing this missile.
   */
  rotateBy(dx: number, dy: number, sensitivity = this.rotateSensitivity) {
    // FPV pitch is an offset from the flight elevation (which can be ±90°);
    // the final look elevation is clamped in updateFirstPerson.
    const maxPitch = THREE.MathUtils.degToRad(this._mode === 'fpv' ? 178 : 65);

    this.yaw -= dx * sensitivity;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch + dy * sensitivity,
      -maxPitch,
      maxPitch
    );
  }

  /** Multiply the chase distance by `scale` (> 1 = further away). */
  zoomBy(scale: number) {
    if (this._mode === 'fpv' || !Number.isFinite(scale) || scale <= 0) return;
    const maxMultiplier = Math.max(
      RocketTrackingView.MIN_DISTANCE_MULTIPLIER,
      Earth.RADIUS / this.rocketView.size
    );
    this.distanceMultiplier = THREE.MathUtils.clamp(
      this.distanceMultiplier * scale,
      RocketTrackingView.MIN_DISTANCE_MULTIPLIER,
      maxMultiplier
    );
  }

  /** Wheel delta -> zoom scale, same feel on every screen. */
  static wheelToZoomScale(deltaY: number) {
    return Math.pow(1.15, THREE.MathUtils.clamp(deltaY / 100, -1, 1));
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    this.zoomBy(RocketTrackingView.wheelToZoomScale(e.deltaY));
  };

  private onPointerDown = (e: PointerEvent) => {
    if (this.pointerId !== null) return;
    e.stopPropagation();
    this.pointerId = e.pointerId;
    this.element.setPointerCapture(e.pointerId);
    this.pointerPrevX = e.clientX;
    this.pointerPrevY = e.clientY;
    this.element.style.cursor = 'grabbing';
  };

  private onPointerMove = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;

    const dx = e.clientX - this.pointerPrevX;
    const dy = e.clientY - this.pointerPrevY;
    this.pointerPrevX = e.clientX;
    this.pointerPrevY = e.clientY;

    this.rotateBy(dx, dy);
  };

  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerId !== this.pointerId) return;
    if (this.element.hasPointerCapture(e.pointerId)) {
      this.element.releasePointerCapture(e.pointerId);
    }
    this.pointerId = null;
    this.element.style.cursor = 'grab';
  };

  private updateLabel() {
    this.label.textContent = `● LIVE`;
  }

  private readonly target = new THREE.Vector3();
  private readonly desiredOffset = new THREE.Vector3();
  private readonly offset = new THREE.Vector3();
  private initialized = false;
  // First-person heading, carried between frames for vertical flight
  private readonly fpvHeading = new THREE.Vector3();
  private fpvHeadingValid = false;

  // How far the camera sits from the missile, in missile sizes
  private static readonly MIN_DISTANCE_MULTIPLIER = 1.5;
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
      cursor: 'grab',
      // Handle touch drags ourselves instead of the browser scrolling the panel
      touchAction: 'none',
      userSelect: 'none',
    });
    this.element.title =
      'Drag to rotate view · Scroll to zoom · Double-click to reset';
    this.element.addEventListener('wheel', this.onWheel, { passive: false });
    // Don't let clicks in the viewport reach the global Earth-picking handler
    this.element.addEventListener('mousedown', (e) => e.stopPropagation());
    this.element.addEventListener('pointerdown', this.onPointerDown);
    this.element.addEventListener('pointermove', this.onPointerMove);
    this.element.addEventListener('pointerup', this.onPointerUp);
    this.element.addEventListener('pointercancel', this.onPointerUp);
    this.element.addEventListener('dblclick', () => this.resetRotation());

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

    this.renderer = RocketTrackingView.getRenderer();
    // Moves the shared canvas out of the previous view (if any)
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

    // User orbit: yaw around the surface normal, pitch around the horizontal
    // axis perpendicular to the offset (positive pitch raises the camera).
    if (this.pitch !== 0) {
      const pitchAxis = new THREE.Vector3()
        .crossVectors(up, this.desiredOffset)
        .normalize();
      if (pitchAxis.lengthSq() > 0) {
        this.desiredOffset.applyAxisAngle(pitchAxis, -this.pitch);
      }
    }
    if (this.yaw !== 0) {
      this.desiredOffset.applyAxisAngle(up, this.yaw);
    }

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

    // Head-look relative to the local horizon, like a pilot turning their
    // head: drag left/right turns around the local vertical, drag up/down
    // inclines the view up/down against the horizon. The default view looks
    // along the flight direction, so it pitches over with the gravity turn.
    const surfaceUp = group.position.clone().sub(earthCenter).normalize();

    // Flight direction split into heading (horizontal) and elevation
    const horizontal = forward
      .clone()
      .addScaledVector(surfaceUp, -forward.dot(surfaceUp));

    if (horizontal.lengthSq() > 1e-6) {
      this.fpvHeading.copy(horizontal.normalize());
      this.fpvHeadingValid = true;
    } else {
      // Flying straight up/down (launch): heading undefined, keep the last
      // one (projected onto the current horizon) so the view stays stable.
      if (this.fpvHeadingValid) {
        this.fpvHeading.addScaledVector(
          surfaceUp,
          -this.fpvHeading.dot(surfaceUp)
        );
      }
      if (!this.fpvHeadingValid || this.fpvHeading.lengthSq() < 1e-6) {
        this.fpvHeading.set(1, 0, 0).cross(surfaceUp);
        if (this.fpvHeading.lengthSq() < 1e-6) {
          this.fpvHeading.set(0, 0, 1).cross(surfaceUp);
        }
      }
      this.fpvHeading.normalize();
      this.fpvHeadingValid = true;
    }

    const flightElevation = Math.asin(
      THREE.MathUtils.clamp(forward.dot(surfaceUp), -1, 1)
    );

    // Positive pitch (drag down) looks down. Keep the total just short of
    // straight up/down so the horizon never flips, and absorb over-drag so
    // dragging back responds immediately.
    const maxElevation = THREE.MathUtils.degToRad(89);
    const elevation = THREE.MathUtils.clamp(
      flightElevation - this.pitch,
      -maxElevation,
      maxElevation
    );
    this.pitch = flightElevation - elevation;

    const heading = this.fpvHeading.clone().applyAxisAngle(surfaceUp, this.yaw);
    const lookDir = heading
      .multiplyScalar(Math.cos(elevation))
      .addScaledVector(surfaceUp, Math.sin(elevation));

    this.camera.up.copy(surfaceUp);
    this.camera.lookAt(this.camera.position.clone().add(lookDir));
  }

  /** The tracking camera; the main view copies its pose while chasing. */
  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  /** Render the scene with this view's settings (e.g. arrows hidden in FPV). */
  renderTo(renderer: THREE.WebGLRenderer, camera: THREE.Camera = this.camera) {
    // Force arrows start at the tail and pass through the nose – hide them
    // so they don't block the first-person view.
    const hideArrows = this._mode === 'fpv';
    if (hideArrows) this.rocketView.setArrowsVisible(false);
    renderer.render(this.scene, camera);
    if (hideArrows) this.rocketView.setArrowsVisible(true);
  }

  update(deltaTime = 0) {
    // The pose is updated even when the viewport is hidden (collapsed pane):
    // the main view may be copying it.
    this.updatePose(deltaTime);

    if (!this.element.isConnected || !this.syncSize()) return;
    this.renderTo(this.renderer);
  }

  private updatePose(deltaTime: number) {
    if (this._mode === 'fpv') {
      this.updateFirstPerson();
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
  }

  dispose() {
    // The renderer is shared and stays alive; only detach its canvas if it
    // still belongs to this view.
    if (this.renderer.domElement.parentElement === this.element) {
      this.element.removeChild(this.renderer.domElement);
    }
    this.element.remove();
  }
}
