import * as THREE from 'three';
import { getCanvasTexture } from './canvasTexture';

export type WarheadDimensions = {
  /** Base radius. Unit: m */
  radius: number;
  /** Base to tip. Unit: m */
  height: number;
};

/** Warhead size relative to the nose shroud that encloses it. */
const RADIUS_TO_SHROUD = 0.6;
const HEIGHT_TO_SHROUD = 0.85;
/** Spherical nose radius as a fraction of the base radius. */
const NOSE_RADIUS_RATIO = 0.22;
const CONE_SEGMENTS = 24;
const NOSE_SEGMENTS = 10;
/** Texture v where the cone meets the spherical nose (approximate). */
const NOSE_V = (CONE_SEGMENTS + 1) / (CONE_SEGMENTS + NOSE_SEGMENTS + 1);

/** Aerodynamic heating glow color of the heat shield. */
const HEAT_COLOR = new THREE.Color(0xff6a2a);

/**
 * Sphere-cone re-entry vehicle profile as LatheGeometry points: closed base
 * (y = 0), straight cone flank, tangent spherical nose up to y = height.
 */
function createWarheadProfile(radius: number, height: number) {
  const R = radius;
  const rn = R * NOSE_RADIUS_RATIO;
  // Sharp cone with the same base radius and height; the blunt nose
  // shortens it, so y is stretched back to `height` at the end.
  const theta = Math.atan2(R, height); // cone half-angle
  const centerY = height - rn / Math.sin(theta);
  const apexY = centerY + rn;
  const stretch = height / apexY;
  const toPoint = (r: number, y: number) =>
    new THREE.Vector2(Math.max(0, r), y * stretch);

  // Tangency point of the cone flank and the nose sphere
  const tangentR = rn * Math.cos(theta);
  const tangentY = centerY + rn * Math.sin(theta);

  const profile: THREE.Vector2[] = [toPoint(0, 0)];
  for (let s = 0; s <= CONE_SEGMENTS; s++) {
    const t = s / CONE_SEGMENTS;
    profile.push(toPoint(R + (tangentR - R) * t, tangentY * t));
  }
  for (let s = 1; s <= NOSE_SEGMENTS; s++) {
    const beta = theta + ((Math.PI / 2 - theta) * s) / NOSE_SEGMENTS;
    const r = s === NOSE_SEGMENTS ? 0 : rn * Math.cos(beta);
    profile.push(toPoint(r, centerY + rn * Math.sin(beta)));
  }
  return profile;
}

/**
 * Ablative heat shield skin: dark carbon-phenolic with a metallic base ring,
 * heavier charring towards the nose. Canvas top = tip (v = 1).
 */
const getWarheadTexture = () =>
  getCanvasTexture('warhead-color', 128, 512, (ctx, w, h) => {
    const yAt = (v: number) => (1 - v) * h;

    const base = ctx.createLinearGradient(0, h, 0, 0);
    base.addColorStop(0, '#4a4540');
    base.addColorStop(0.6, '#2f2b28');
    base.addColorStop(1, '#151210');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);

    // Metallic aft ring
    ctx.fillStyle = '#8c9098';
    ctx.fillRect(0, yAt(0.07), w, yAt(0.03) - yAt(0.07));
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(0, yAt(0.07), w, 2);

    // Faint circumferential wrap lines of the ablator
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    for (let v = 0.12; v < NOSE_V; v += 0.06) ctx.fillRect(0, yAt(v), w, 1);

    // Char speckles, denser near the nose
    for (let i = 0; i < 700; i++) {
      const v = 0.08 + Math.sqrt(Math.random()) * 0.92;
      ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '0, 0, 0' : '110, 85, 60'}, ${
        0.15 + Math.random() * 0.3
      })`;
      ctx.fillRect(Math.random() * w, yAt(v), 1 + Math.random() * 2, 1);
    }
  });

/** Heating glow (emissive map): cold at the base, white-hot at the nose. */
const getWarheadHeatTexture = () =>
  getCanvasTexture('warhead-heat', 16, 256, (ctx, w, h) => {
    const heat = ctx.createLinearGradient(0, h, 0, 0);
    heat.addColorStop(0, '#000000');
    heat.addColorStop(0.4, '#3a0c00');
    heat.addColorStop(NOSE_V - 0.1, '#c24000');
    heat.addColorStop(1, '#ffffff');
    ctx.fillStyle = heat;
    ctx.fillRect(0, 0, w, h);
  });

/**
 * The re-entry vehicle carried under the nose shroud. Hidden until the last
 * stage burns out; then the shroud is jettisoned and the warhead continues
 * the ballistic flight on its own (the missile physics keeps driving it).
 *
 * `object` is added to the missile group; its geometry and material are
 * disposed together with the group in `MissileView.remove()`.
 */
export default class Warhead {
  readonly object = new THREE.Group();
  readonly dimensions: WarheadDimensions;
  private readonly material: THREE.MeshStandardMaterial;
  private isDeployed = false;

  /** Warhead that fits inside a nose shroud of the given size. */
  static fitShroud(shroud: { radius: number; height: number }): WarheadDimensions {
    return {
      radius: shroud.radius * RADIUS_TO_SHROUD,
      height: shroud.height * HEIGHT_TO_SHROUD,
    };
  }

  /** @param baseY Y of the warhead base in the missile's local space. */
  constructor(dimensions: WarheadDimensions, baseY: number) {
    this.dimensions = dimensions;

    const texture = getWarheadTexture();
    const heatTexture = getWarheadHeatTexture();
    this.material = new THREE.MeshStandardMaterial({
      color: texture ? 0xffffff : 0x2f2b28,
      map: texture,
      metalness: 0.15,
      roughness: 0.8,
      emissive: HEAT_COLOR,
      emissiveMap: heatTexture,
      emissiveIntensity: 0,
    });

    const mesh = new THREE.Mesh(
      new THREE.LatheGeometry(
        createWarheadProfile(dimensions.radius, dimensions.height),
        32
      ),
      this.material
    );
    mesh.name = 'warhead-body';

    this.object.name = 'warhead';
    this.object.add(mesh);
    this.object.position.y = baseY;
    this.object.visible = false;
  }

  get deployed() {
    return this.isDeployed;
  }

  /** Reveal the warhead once the shroud and the last stage are gone. */
  deploy() {
    this.isDeployed = true;
    this.object.visible = true;
  }

  /** Aerodynamic heating glow of the heat shield, intensity 0..1. */
  setHeating(intensity: number) {
    this.material.emissiveIntensity = 3 * intensity * intensity;
  }
}
