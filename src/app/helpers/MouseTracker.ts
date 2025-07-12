import * as THREE from 'three';

/**
 * Tracks mouse position, velocity and acceleration between frames.
 *
 * ── Usage ───────────────────────────────────────────
 * const tracker = new MouseTracker();        // auto-attaches to window
 * function animate() {
 *   requestAnimationFrame(animate);
 *   tracker.update();                        // call once per frame
 *   console.log(tracker.velocity, tracker.acceleration);
 *   renderer.render(scene, camera);
 * }
 * animate();
 */
export default class MouseTracker {
  /** current mouse position (screen-normalized −1 … +1 by default) */
  readonly position = new THREE.Vector2();
  readonly normalizedPosition = new THREE.Vector2();
  /** velocity in units / second */
  readonly velocity = new THREE.Vector2();
  /** acceleration in units / second² */
  readonly acceleration = new THREE.Vector2();

  private _lastPosition = new THREE.Vector2();
  private _lastVelocity = new THREE.Vector2();
  private readonly _listener: (ev: MouseEvent) => void;

  /**
   * @param target   element on which to listen for `mousemove` (defaults to `window`)
   * @param normalize convert to –1…+1 space (default `true`). Pass `false` for raw pixels.
   */
  constructor(
    target: (Window & typeof globalThis) | HTMLElement = window,
  ) {

    this._listener = (e: MouseEvent) => {
      const { innerWidth: w, innerHeight: h } = window;

      this.position.set(e.clientX, e.clientY);
      this.normalizedPosition.set(
        (e.clientX / w) * 2 - 1,
        -(e.clientY / h) * 2 + 1
      );
    };

    target.addEventListener('mousemove', this._listener, { passive: true });
  }


  /**
   * Call exactly once every animation frame (e.g. inside your render loop).
   */
  update(dt: number): void {

    if (dt > 0) {
      // v = dx / dt
      this.velocity
        .copy(this.position)
        .sub(this._lastPosition)
        .divideScalar(dt);

      // a = dv / dt
      this.acceleration
        .copy(this.velocity)
        .sub(this._lastVelocity)
        .divideScalar(dt);

      // prepare for next frame
      this._lastPosition.copy(this.position);
      this._lastVelocity.copy(this.velocity);
    }
  }

  /**
   * Detach the internal mouse listener (call when disposing the tracker).
   */
  dispose(target: (Window & typeof globalThis) | HTMLElement = window): void {
    target.removeEventListener('mousemove', this._listener);
  }
}
