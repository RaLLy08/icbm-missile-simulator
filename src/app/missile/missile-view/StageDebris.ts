import * as THREE from 'three';
import Earth from '../../earth/Earth';

/** Earth's gravitational parameter. Unit: km³/s² */
const EARTH_MU = Earth.G * Earth.MASS * 1e-9;
/** Longest integration step, so fast time multipliers stay stable. Unit: s */
const MAX_STEP_S = 1;

/**
 * A spent stage that separated from the missile. It keeps the missile's
 * velocity plus a small backward push, tumbles, and falls under gravity
 * until it hits the ground, then fades out.
 *
 * All times are simulation seconds.
 */
export default class StageDebris {
  readonly object: THREE.Object3D;
  private readonly velocity: THREE.Vector3;
  private readonly angularAxis: THREE.Vector3;
  private readonly angularSpeed: number;
  private readonly materials: THREE.Material[] = [];

  private landed = false;
  private fadeElapsed = 0;
  private age = 0;
  finished = false;

  /** Fade duration after impact (or after `maxLifetime`). Unit: s */
  static FADE_DURATION_S = 8;
  /** Debris is faded out after this long even without impact. Unit: s */
  static MAX_LIFETIME_S = 1200;

  /**
   * @param source The stage group to copy (its world transform is used).
   * @param velocity Missile velocity at separation. Unit: km/s
   * @param forward Missile forward direction (world space).
   * @param separationSpeed Backward push relative to the missile. Unit: km/s
   */
  constructor(
    private readonly scene: THREE.Scene,
    source: THREE.Object3D,
    velocity: THREE.Vector3,
    forward: THREE.Vector3,
    separationSpeed: number
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

    this.velocity = velocity
      .clone()
      .addScaledVector(forward.clone().normalize(), -separationSpeed);

    // Slow random tumble, mostly end over end
    const side = new THREE.Vector3()
      .randomDirection()
      .cross(forward)
      .normalize();
    this.angularAxis = side.lengthSq() > 0 ? side : new THREE.Vector3(1, 0, 0);
    this.angularSpeed = THREE.MathUtils.randFloat(0.15, 0.4); // rad/s

    this.object.name = `${source.name}-debris`;
    this.scene.add(this.object);
  }

  update(dt: number) {
    if (this.finished || dt <= 0) return;

    this.age += dt;

    if (!this.landed) {
      let remaining = dt;
      while (remaining > 0 && !this.landed) {
        const step = Math.min(remaining, MAX_STEP_S);
        this.integrate(step);
        remaining -= step;
      }
    }

    if (this.landed || this.age > StageDebris.MAX_LIFETIME_S) {
      this.fadeElapsed += dt;
      const opacity =
        1 - Math.min(this.fadeElapsed / StageDebris.FADE_DURATION_S, 1);
      this.materials.forEach((m) => (m.opacity = opacity));
      if (opacity <= 0) this.remove();
    }
  }

  private integrate(step: number) {
    const position = this.object.position;
    const r = position.length();

    // Gravity towards the Earth's center (semi-implicit Euler)
    const g = -EARTH_MU / (r * r * r);
    this.velocity.addScaledVector(position, g * step);
    position.addScaledVector(this.velocity, step);

    this.object.rotateOnWorldAxis(this.angularAxis, this.angularSpeed * step);

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
    // Geometry is shared with the missile's own stage meshes, which
    // dispose it in MissileView.remove(); only the cloned materials are ours.
    this.materials.forEach((m) => m.dispose());
  }
}
