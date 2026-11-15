import * as THREE from 'three';
import Earth from '../../earth/Earth';

/** Earth's gravitational parameter. Unit: m³/s² */
const EARTH_MU = Earth.G * Earth.MASS;
/** Longest integration step, so fast time multipliers stay stable. Unit: s */
const MAX_STEP_S = 1;

export type StageDebrisOptions = {
  /** Added to the separation velocity (world space). Unit: m/s */
  extraVelocity?: THREE.Vector3;
  /** Tumble axis (world space); random when omitted. */
  angularAxis?: THREE.Vector3;
  /** Tumble rate. Unit: rad/s */
  angularSpeed?: number;
};

/**
 * Missile state the debris separates from. The missile is drawn by
 * interpolating between two physics steps; the debris copies that state so
 * it moves on exactly the same timeline (otherwise it jitters relative to
 * the missile, especially at high time multipliers).
 */
export type DebrisSeparationState = {
  /** Where the missile is drawn right now (world space). */
  drawnPosition: THREE.Vector3;
  /** Missile position at the previous physics step. */
  prevPosition: THREE.Vector3;
  /** Missile position at the latest physics step. */
  position: THREE.Vector3;
  /** Missile velocity at the latest physics step. Unit: m/s */
  velocity: THREE.Vector3;
};

/**
 * A spent stage (or shroud half) that separated from the missile. It keeps
 * the missile's velocity plus a small push, tumbles, and falls under
 * gravity until it hits the ground, then fades out.
 *
 * Like the missile, it advances in physics steps (`step`) and is drawn
 * interpolated between the last two steps (`render`). All times are
 * simulation seconds.
 */
export default class StageDebris {
  readonly object: THREE.Object3D;
  private readonly velocity: THREE.Vector3;
  private readonly angularAxis: THREE.Vector3;
  private readonly angularSpeed: number;
  private readonly materials: THREE.Material[] = [];
  /** Orientation at separation; the tumble is applied on top of it. */
  private readonly baseQuaternion = new THREE.Quaternion();
  private readonly tumble = new THREE.Quaternion();

  // State at the previous and the latest physics step
  private readonly prevPosition = new THREE.Vector3();
  private readonly position = new THREE.Vector3();
  private prevAngle = 0;
  private angle = 0;
  private prevFade = 0;
  private fade = 0;

  private landed = false;
  private age = 0;
  finished = false;

  /** Fade duration after impact (or after `maxLifetime`). Unit: s */
  static FADE_DURATION_S = 60;
  /** Debris is faded out after this long even without impact. Unit: s */
  static MAX_LIFETIME_S = 60 * 5;

  /**
   * @param source The object to copy (its world transform is used).
   * @param missile Missile state at separation.
   * @param forward Missile forward direction (world space).
   * @param separationSpeed Backward push relative to the missile. Unit: m/s
   * @param options Extra push (e.g. sideways for shroud halves) and a fixed
   *   tumble instead of the random one.
   */
  constructor(
    private readonly scene: THREE.Scene,
    source: THREE.Object3D,
    missile: DebrisSeparationState,
    forward: THREE.Vector3,
    separationSpeed: number,
    options: StageDebrisOptions = {}
  ) {
    source.updateWorldMatrix(true, false);

    // Clone with own materials, so fading does not touch the missile
    this.object = source.clone(true);
    this.object.visible = true;
    this.object.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const material = (child.material as THREE.Material).clone();
        material.transparent = true;
        child.material = material;
        this.materials.push(material);
      }
    });

    source.matrixWorld.decompose(
      this.object.position,
      this.object.quaternion,
      this.object.scale
    );
    this.baseQuaternion.copy(this.object.quaternion);

    // Rigidly attached to the missile at both physics steps, so the
    // interpolated position equals the drawn one right now
    const offset = this.object.position.clone().sub(missile.drawnPosition);
    this.prevPosition.copy(missile.prevPosition).add(offset);
    this.position.copy(missile.position).add(offset);

    this.velocity = missile.velocity
      .clone()
      .addScaledVector(forward.clone().normalize(), -separationSpeed);
    if (options.extraVelocity) this.velocity.add(options.extraVelocity);

    if (options.angularAxis && options.angularAxis.lengthSq() > 0) {
      this.angularAxis = options.angularAxis.clone().normalize();
    } else {
      // Slow random tumble, mostly end over end
      const side = new THREE.Vector3()
        .randomDirection()
        .cross(forward)
        .normalize();
      this.angularAxis =
        side.lengthSq() > 0 ? side : new THREE.Vector3(1, 0, 0);
    }
    this.angularSpeed =
      options.angularSpeed ?? THREE.MathUtils.randFloat(0.15, 0.4); // rad/s

    this.object.name = `${source.name}-debris`;
    this.scene.add(this.object);
  }

  /** Remember the latest step as the previous one (before stepping on). */
  savePrevious() {
    this.prevPosition.copy(this.position);
    this.prevAngle = this.angle;
    this.prevFade = this.fade;
  }

  /** Advance one physics step of `dt` simulation seconds. */
  step(dt: number) {
    if (this.finished || dt <= 0) return;

    // Fully faded at both steps -> nothing left to draw
    if (this.prevFade >= StageDebris.FADE_DURATION_S) {
      this.remove();
      return;
    }

    this.age += dt;

    let remaining = dt;
    while (remaining > 0 && !this.landed) {
      const step = Math.min(remaining, MAX_STEP_S);
      this.integrate(step);
      remaining -= step;
    }

    if (this.landed || this.age > StageDebris.MAX_LIFETIME_S) {
      this.fade += dt;
    }
  }

  /** Draw between the previous (alpha 0) and latest (alpha 1) step. */
  render(alpha: number) {
    if (this.finished) return;

    const position = this.object.position.lerpVectors(
      this.prevPosition,
      this.position,
      alpha
    );
    // Interpolation may overshoot the impact point; stay on the ground
    if (position.length() < Earth.RADIUS) position.setLength(Earth.RADIUS);

    const angle = THREE.MathUtils.lerp(this.prevAngle, this.angle, alpha);
    this.object.quaternion
      .copy(this.tumble.setFromAxisAngle(this.angularAxis, angle))
      .multiply(this.baseQuaternion);

    const fade = THREE.MathUtils.lerp(this.prevFade, this.fade, alpha);
    const opacity = 1 - THREE.MathUtils.clamp(
      fade / StageDebris.FADE_DURATION_S,
      0,
      1
    );
    this.materials.forEach((m) => (m.opacity = opacity));
  }

  private integrate(step: number) {
    const position = this.position;
    const r = position.length();

    // Gravity towards the Earth's center (semi-implicit Euler)
    const g = -EARTH_MU / (r * r * r);
    this.velocity.addScaledVector(position, g * step);
    position.addScaledVector(this.velocity, step);

    this.angle += this.angularSpeed * step;

    if (position.length() <= Earth.RADIUS) {
      position.setLength(Earth.RADIUS);
      this.velocity.set(0, 0, 0);
      this.landed = true;
    }
  }

  remove() {
    if (this.finished) return;
    this.finished = true;
    this.scene.remove(this.object);
    // Geometry is shared with the missile's own meshes, which dispose it
    // in MissileView.remove(); only the cloned materials are ours.
    this.materials.forEach((m) => m.dispose());
  }
}
