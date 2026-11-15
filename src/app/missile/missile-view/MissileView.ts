import EarthView from 'app/earth/EarthView';
import Missile from '../Missile';
import StageDebris from './StageDebris';
import ArrowLabel from './ArrowLabel';
import TrailView from './TrailView';
import * as THREE from 'three';
// import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
// import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import nukeVariant00 from 'public/audio/nuke_explosion_variants/explosion_00.mp3';
import nukeVariant01 from 'public/audio/nuke_explosion_variants/explosion_01.mp3';
import nukeVariant02 from 'public/audio/nuke_explosion_variants/explosion_02.mp3';
import nukeVariant03 from 'public/audio/nuke_explosion_variants/explosion_03.mp3';
import nukeVariant04 from 'public/audio/nuke_explosion_variants/explosion_04.mp3';
import nukeVariant05 from 'public/audio/nuke_explosion_variants/explosion_05.mp3';
import nukeVariant06 from 'public/audio/nuke_explosion_variants/explosion_06.mp3';
import nukeVariant07 from 'public/audio/nuke_explosion_variants/explosion_07.mp3';
import nukeVariant08 from 'public/audio/nuke_explosion_variants/explosion_08.mp3';
import nukeVariant09 from 'public/audio/nuke_explosion_variants/explosion_09.mp3';
import nukeVariant10 from 'public/audio/nuke_explosion_variants/explosion_10.mp3';
import distantVariant00 from 'public/audio/distant_explosion_variants/distant_explosion_00.mp3';
import distantVariant01 from 'public/audio/distant_explosion_variants/distant_explosion_01.mp3';
import distantVariant02 from 'public/audio/distant_explosion_variants/distant_explosion_02.mp3';
import distantVariant03 from 'public/audio/distant_explosion_variants/distant_explosion_03.mp3';
import distantVariant04 from 'public/audio/distant_explosion_variants/distant_explosion_04.mp3';
import distantVariant05 from 'public/audio/distant_explosion_variants/distant_explosion_05.mp3';
import distantVariant06 from 'public/audio/distant_explosion_variants/distant_explosion_06.mp3';
import distantVariant07 from 'public/audio/distant_explosion_variants/distant_explosion_07.mp3';
import distantVariant08 from 'public/audio/distant_explosion_variants/distant_explosion_08.mp3';
import distantVariant09 from 'public/audio/distant_explosion_variants/distant_explosion_09.mp3';
import distantVariant10 from 'public/audio/distant_explosion_variants/distant_explosion_10.mp3';
import distantVariant11 from 'public/audio/distant_explosion_variants/distant_explosion_11.mp3';
import distantVariant12 from 'public/audio/distant_explosion_variants/distant_explosion_12.mp3';
import engineStartAudio from 'public/audio/start.mp3';
import engineFlightAudio from 'public/audio/flight.mp3';
import engineEndAudio from 'public/audio/end.mp3';
import {
    ENGINE_FALLOFF,
    EXPLOSION_FALLOFF,
    createAudio,
    getDistanceVolume,
    getListenerDistance,
    releaseAudio,
} from 'app/helpers/SpatialAudio';
import { announceTargetReached } from 'app/helpers/Speech';
import { formatKmPerS } from 'app/utils';

const TARGET_REACHED_ANNOUNCE_DELAY_MS = 1000;
/** "Target reached" is only announced if the impact is within this distance (m). */
const TARGET_HIT_MAX_MISS_M = 20_000;

const NUKE_EXPLOSION_VARIANTS: string[] = [
  nukeVariant00,
  nukeVariant01,
  nukeVariant02,
  nukeVariant03,
  nukeVariant04,
  nukeVariant05,
  nukeVariant06,
  nukeVariant07,
  nukeVariant08,
  nukeVariant09,
  nukeVariant10,
];

const DISTANT_EXPLOSION_VARIANTS: string[] = [
  distantVariant00,
  distantVariant01,
  distantVariant02,
  distantVariant03,
  distantVariant04,
  distantVariant05,
  distantVariant06,
  distantVariant07,
  distantVariant08,
  distantVariant09,
  distantVariant10,
  distantVariant11,
  distantVariant12,
];

const pickRandom = <T>(items: T[]): T =>
  items[Math.floor(Math.random() * items.length)];

/**
 * Engine sounds: plays `start` on ignition, then loops `flight` while the
 * engines keep burning. On cutoff, start/flight stop immediately and `end` plays.
 * Volume fades with camera distance to the missile (silent when too far).
 */
export class EngineSound {
  private startAudio: HTMLAudioElement;
  private flightAudio: HTMLAudioElement;
  private endAudio: HTMLAudioElement;
  private state: 'idle' | 'running' | 'finished' = 'idle';

  constructor(private readonly baseVolume = 0.5) {
    this.startAudio = createAudio(engineStartAudio);
    this.flightAudio = createAudio(engineFlightAudio);
    this.endAudio = createAudio(engineEndAudio);

    this.flightAudio.loop = true;
    this.setVolume(0);

    // Flight loop kicks in once the ignition sound is over
    this.startAudio.addEventListener('ended', () => {
      if (this.state === 'running') {
        this.play(this.flightAudio);
      }
    });
  }

  private play(audio: HTMLAudioElement) {
    audio.currentTime = 0;
    audio.play().catch((error) => {
      console.warn('Failed to play engine sound:', error);
    });
  }

  private stop(audio: HTMLAudioElement) {
    audio.pause();
    audio.currentTime = 0;
  }

  private setVolume(multiplier: number) {
    const volume = this.baseVolume * multiplier;
    [this.startAudio, this.flightAudio, this.endAudio].forEach((a) => {
      a.volume = volume;
    });
  }

  update(enginesRunning: boolean, position: THREE.Vector3) {
    this.setVolume(getDistanceVolume(position, ENGINE_FALLOFF));

    if (this.state === 'idle' && enginesRunning) {
      this.state = 'running';
      this.play(this.startAudio);
      return;
    }

    if (this.state === 'running' && !enginesRunning) {
      this.state = 'finished';
      this.stop(this.startAudio);
      this.stop(this.flightAudio);
      this.play(this.endAudio);
    }
  }

  remove() {
    this.state = 'finished';
    this.stop(this.startAudio);
    this.stop(this.flightAudio);
    this.stop(this.endAudio);
    [this.startAudio, this.flightAudio, this.endAudio].forEach(releaseAudio);
  }
}

export class ExplosionEffect {
  private rings: THREE.Mesh[] = [];
  private startTime: number = 0;
  private duration: number = 2000; // 2 seconds
  private isActive: boolean = false;
  /** Close-range blast; volume follows camera distance while playing. */
  private audio: HTMLAudioElement | null = null;
  private readonly baseVolume = 0.5;
  private position: THREE.Vector3 | null = null;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly ringCount: number = 3
  ) {}

  private updateVolume() {
    if (!this.position || !this.audio) return;
    this.audio.volume =
      this.baseVolume * getDistanceVolume(this.position, EXPLOSION_FALLOFF);
  }

  start(position: THREE.Vector3, normal: THREE.Vector3) {
    this.startTime = Date.now();
    this.isActive = true;
    this.position = position.clone();

    // Close by: full blast with distance falloff.
    // Beyond the falloff range: always play the distant rumble instead.
    const isDistant =
      getListenerDistance(this.position) >= EXPLOSION_FALLOFF.maxDistance;
    // Each explosion gets a random variant
    const sound = createAudio(
      pickRandom(
        isDistant ? DISTANT_EXPLOSION_VARIANTS : NUKE_EXPLOSION_VARIANTS
      )
    );
    sound.addEventListener('ended', () => releaseAudio(sound), { once: true });

    if (isDistant) {
      sound.volume = this.baseVolume;
    } else {
      this.audio = sound;
      this.updateVolume();
    }
    sound.play().catch((error) => {
      releaseAudio(sound);
      console.warn('Failed to play explosion sound:', error);
    });

    // Create expanding rings
    for (let i = 0; i < this.ringCount; i++) {
      const ringGeometry = new THREE.RingGeometry(1000, 2000, 32);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0xff4500,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);

      // Position ring at explosion point
      ring.position.copy(position);

      // Align ring perpendicular to the surface normal
      ring.lookAt(position.clone().add(normal));

      this.rings.push(ring);
      this.scene.add(ring);
    }
  }

  update() {
    // Keep adjusting while the sound plays (it may outlast the visual effect)
    if (this.audio && !this.audio.paused) this.updateVolume();

    if (!this.isActive) return;

    const elapsed = Date.now() - this.startTime;
    const progress = Math.min(elapsed / this.duration, 1);

    if (progress >= 1) {
      this.remove();
      return;
    }

    this.rings.forEach((ring, index) => {
      // Stagger the start of each ring
      const ringDelay = (index / this.ringCount) * 0.3;
      const ringProgress = Math.max(
        0,
        (progress - ringDelay) / (1 - ringDelay)
      );

      // Expand the ring
      const maxScale = 100 + index * 10;
      const scale = 1 + ringProgress * maxScale;
      ring.scale.set(scale, scale, 1);

      // Fade out with damping
      const opacity = (1 - ringProgress) * 0.8 * Math.exp(-ringProgress * 2);
      (ring.material as THREE.MeshBasicMaterial).opacity = opacity;

      // Change color from orange to red to dark
      const r = 1;
      const g = Math.max(0, 0.5 - ringProgress * 0.5);
      const b = 0;
      (ring.material as THREE.MeshBasicMaterial).color.setRGB(r, g, b);
    });
  }

  remove() {
    this.isActive = false;
    this.rings.forEach((ring) => {
      this.scene.remove(ring);
      ring.geometry.dispose();
      (ring.material as THREE.MeshBasicMaterial).dispose();
    });
    this.rings = [];
  }

  get active(): boolean {
    return this.isActive;
  }
}

// class VectorHistory {
//   prev = new THREE.Vector3();
//   next = new THREE.Vector3();
// }

// ----------------------------------------------------------------------------
// Procedural textures (canvas-generated, shared by every missile)

const textureCache = new Map<string, THREE.CanvasTexture | null>();

/**
 * Draw a texture once on a canvas and cache it. Returns null outside the
 * browser (e.g. in jest), so the meshes fall back to plain colors.
 */
function getCanvasTexture(
  key: string,
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
): THREE.CanvasTexture | null {
  if (textureCache.has(key)) return textureCache.get(key)!;

  let texture: THREE.CanvasTexture | null = null;
  const canvas =
    typeof document !== 'undefined' ? document.createElement('canvas') : null;
  const ctx = canvas?.getContext('2d');
  if (canvas && ctx) {
    canvas.width = width;
    canvas.height = height;
    draw(ctx, width, height);
    texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
  }
  textureCache.set(key, texture);
  return texture;
}

/**
 * Nozzle skin: dark metal with cooling tubes and stiffener rings.
 * Canvas top = nozzle exit, canvas bottom = throat (LatheGeometry v runs
 * from the first profile point to the last).
 */
const getNozzleTexture = () =>
  getCanvasTexture('nozzle-color', 128, 256, (ctx, w, h) => {
    const base = ctx.createLinearGradient(0, 0, 0, h);
    base.addColorStop(0, '#6b7079');
    base.addColorStop(0.6, '#43464c');
    base.addColorStop(1, '#2b2b2f');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);

    // Regenerative cooling tubes running along the bell
    for (let x = 0; x < w; x += 4) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(x, 0, 1, h);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.fillRect(x + 2, 0, 1, h);
    }

    // Stiffener rings
    ctx.fillStyle = 'rgba(20, 20, 24, 0.8)';
    [0.22, 0.48, 0.74].forEach((f) => ctx.fillRect(0, f * h, w, 3));

    // Bright exit lip
    ctx.fillStyle = '#9aa1ab';
    ctx.fillRect(0, 0, w, 5);
  });

/** Heat glow near the throat; used as the nozzle's emissive map. */
const getNozzleGlowTexture = () =>
  getCanvasTexture('nozzle-glow', 16, 256, (ctx, w, h) => {
    const glow = ctx.createLinearGradient(0, h, 0, 0);
    glow.addColorStop(0, '#ff6a1a');
    glow.addColorStop(0.35, '#a02800');
    glow.addColorStop(0.65, '#000000');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  });

/**
 * Exhaust plume: white-hot core at the nozzle exit fading through orange to
 * transparent red, with streaks and shock diamonds.
 * Canvas top = flame top (attached to the nozzle).
 */
const getFireTexture = () =>
  getCanvasTexture('burning-fire', 128, 512, (ctx, w, h) => {
    const plume = ctx.createLinearGradient(0, 0, 0, h);
    plume.addColorStop(0, 'rgba(255, 255, 235, 1)');
    plume.addColorStop(0.12, 'rgba(255, 235, 140, 0.95)');
    plume.addColorStop(0.4, 'rgba(255, 160, 45, 0.75)');
    plume.addColorStop(0.75, 'rgba(255, 80, 15, 0.35)');
    plume.addColorStop(1, 'rgba(200, 30, 0, 0)');
    ctx.fillStyle = plume;
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = 'lighter';

    // Turbulent streaks
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * w;
      const length = h * (0.3 + Math.random() * 0.6);
      const streak = ctx.createLinearGradient(0, 0, 0, length);
      const alpha = 0.04 + Math.random() * 0.12;
      streak.addColorStop(0, `rgba(255, 220, 150, ${alpha})`);
      streak.addColorStop(1, 'rgba(255, 120, 30, 0)');
      ctx.fillStyle = streak;
      ctx.fillRect(x, 0, 1 + Math.random() * 3, length);
    }

    // Shock diamonds (bright bands close to the nozzle)
    for (let i = 0; i < 4; i++) {
      const y = h * (0.06 + i * 0.09);
      const band = ctx.createLinearGradient(0, y - 6, 0, y + 6);
      const alpha = 0.35 * (1 - i / 4);
      band.addColorStop(0, 'rgba(255, 255, 255, 0)');
      band.addColorStop(0.5, `rgba(255, 255, 255, ${alpha})`);
      band.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = band;
      ctx.fillRect(0, y - 6, w, 12);
    }

    ctx.globalCompositeOperation = 'source-over';
  });

/** Nose profile sampling: ogive body points + blunt-tip arc points. */
const NOSE_OGIVE_SEGMENTS = 40;
const NOSE_TIP_SEGMENTS = 8;
/** Spherical tip radius as a fraction of the nose base radius. */
const NOSE_TIP_RADIUS_RATIO = 0.14;
/** Texture v where the ogive meets the blunt tip (LatheGeometry v = point index). */
const NOSE_TIP_V =
  NOSE_OGIVE_SEGMENTS / (NOSE_OGIVE_SEGMENTS + NOSE_TIP_SEGMENTS);

/**
 * Spherically blunted tangent ogive (the classic ICBM shroud / RV shape),
 * as LatheGeometry profile points from the base (y = 0, r = radius) up to
 * the tip (y = height, r = 0).
 */
function createNoseProfile(radius: number, height: number): THREE.Vector2[] {
  const R = radius;
  const L = height;
  // Ogive radius; x is measured from the (sharp) tip along the axis
  const rho = (R * R + L * L) / (2 * R);
  const rn = R * NOSE_TIP_RADIUS_RATIO;
  // Tip sphere center, tangency point and apex
  const x0 = L - Math.sqrt((rho - rn) ** 2 - (rho - R) ** 2);
  const yt = (rn * (rho - R)) / (rho - rn);
  const xt = x0 - Math.sqrt(rn * rn - yt * yt);
  const xa = x0 - rn;
  // Blunting shortens the nose; stretch it back to the requested height
  const stretch = L / (L - xa);
  const toPoint = (x: number, r: number) =>
    new THREE.Vector2(Math.max(0, r), (L - x) * stretch);

  const profile: THREE.Vector2[] = [];
  for (let s = 0; s <= NOSE_OGIVE_SEGMENTS; s++) {
    const x = L - ((L - xt) * s) / NOSE_OGIVE_SEGMENTS;
    profile.push(toPoint(x, Math.sqrt(rho * rho - (L - x) ** 2) + R - rho));
  }
  const thetaT = Math.atan2(yt, xt - x0);
  for (let s = 1; s <= NOSE_TIP_SEGMENTS; s++) {
    const theta = thetaT + ((Math.PI - thetaT) * s) / NOSE_TIP_SEGMENTS;
    const r = s === NOSE_TIP_SEGMENTS ? 0 : rn * Math.sin(theta);
    profile.push(toPoint(x0 + rn * Math.cos(theta), r));
  }
  return profile;
}

/**
 * Nose shroud skin: off-white panels with seams, a dark separation joint at
 * the base and a charred ablative heat shield on the blunt tip.
 * Canvas top = tip (v = 1), canvas bottom = base (v = 0).
 */
const getNoseTexture = () =>
  getCanvasTexture('nose-color', 256, 512, (ctx, w, h) => {
    const yAt = (v: number) => (1 - v) * h;

    const base = ctx.createLinearGradient(0, h, 0, 0);
    base.addColorStop(0, '#d9dad5');
    base.addColorStop(0.7, '#ecece7');
    base.addColorStop(1, '#f4f4f0');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);

    // Subtle panel tone variation (4 shroud panels)
    for (let p = 0; p < 4; p++) {
      ctx.fillStyle = `rgba(0, 0, 0, ${0.015 + 0.02 * (p % 2)})`;
      ctx.fillRect((p * w) / 4, 0, w / 4, h);
    }

    // Longitudinal panel seams
    ctx.fillStyle = 'rgba(40, 42, 46, 0.45)';
    for (let p = 0; p < 4; p++) ctx.fillRect((p * w) / 4, 0, 2, h);

    // Circumferential seams with rivet rows
    [0.3, 0.6].forEach((v) => {
      const y = yAt(v);
      ctx.fillStyle = 'rgba(40, 42, 46, 0.4)';
      ctx.fillRect(0, y, w, 2);
      ctx.fillStyle = 'rgba(60, 62, 66, 0.35)';
      for (let x = 3; x < w; x += 8) ctx.fillRect(x, y + 4, 2, 2);
    });

    // Separation joint band at the base
    ctx.fillStyle = '#55585e';
    ctx.fillRect(0, yAt(0.035), w, yAt(0) - yAt(0.035));
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillRect(0, yAt(0.035), w, 2);

    // Ablative heat shield: dark tip blending into the shroud
    const shieldStart = NOSE_TIP_V - 0.12;
    const shield = ctx.createLinearGradient(0, yAt(shieldStart), 0, yAt(1));
    shield.addColorStop(0, 'rgba(38, 32, 28, 0)');
    shield.addColorStop(0.35, 'rgba(38, 32, 28, 0.85)');
    shield.addColorStop(1, 'rgba(24, 20, 18, 1)');
    ctx.fillStyle = shield;
    ctx.fillRect(0, 0, w, yAt(shieldStart));

    // Char speckles on the heat shield
    for (let i = 0; i < 400; i++) {
      const v = shieldStart + 0.06 + Math.random() * (1 - shieldStart - 0.06);
      ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '0, 0, 0' : '90, 70, 55'}, ${
        0.15 + Math.random() * 0.25
      })`;
      ctx.fillRect(Math.random() * w, yAt(v), 1 + Math.random() * 2, 1);
    }
  });

export type CylinderDimensions = { height: number; radius: number };

export type MissileDimensions = {
  /** One cylinder per stage, ordered bottom (first stage) to top. */
  stages: CylinderDimensions[];
  /** Nose cone */
  head: { height: number; radius: number };
  /** Exhaust flame (truncated cone) */
  fire: { height: number; topRadius: number; bottomRadius: number };
};

/** Force / motion vectors that can be drawn as arrows on the missile. */
export type ForceArrowKey =
  | 'velocity'
  | 'acceleration'
  | 'thrust'
  | 'gravity'
  | 'gravityPerpendicular';

export const FORCE_ARROW_COLORS: Record<ForceArrowKey, number> = {
  velocity: 0xff0000,
  acceleration: 0xffff00,
  thrust: 0x00ff00,
  gravity: 0x0000ff,
  gravityPerpendicular: 0xcc00cc,
};

export default class MissileView {
  group: THREE.Group;
  private arrows: THREE.ArrowHelper[] = [];
  /** Value labels shown under each arrow's tip. */
  private arrowLabels = new Map<ForceArrowKey, ArrowLabel>();
  /** Arrows the user switched on; all hidden by default (Missile Controls). */
  private enabledArrows = new Set<ForceArrowKey>();
  /** Temporary hide (e.g. while rendering the tracking camera). */
  private arrowsTemporarilyHidden = false;
  // private arrowsLabels: THREE.Mesh[] = []; //TODO: add on small screen only
  private trailView: TrailView | null = null;
  private burningFireMesh: THREE.Mesh | null = null;
  /** Pivot at the top of the nozzle; rotates the nozzle + flame with thrust. */
  private nozzleGimbal: THREE.Group | null = null;
  private nozzleMaterial: THREE.MeshStandardMaterial | null = null;
  /** Nozzle length in fire-group space (fire dimensions of the first stage). */
  private nozzleHeight = 0;
  private explosionEffect: ExplosionEffect | null = null;
  private hasTriggeredExplosion: boolean = false;
  private engineSound: EngineSound | null = new EngineSound();

  prevPosition = new THREE.Vector3();
  prevVelocity = new THREE.Vector3();
  prevThrust = new THREE.Vector3();

  /**
   * Default missile geometry in m (at size multiplier = 1). The body is
   * split between `stageCount` cylinders, each upper stage shorter and
   * thinner than the one below; the total body height stays 1000 m.
   */
  static baseDimensions(stageCount = 1): MissileDimensions {
    const n = Math.max(1, Math.floor(stageCount));
    // Height weights n, n-1, ..., 1 -> lower stages are taller
    const weightSum = (n * (n + 1)) / 2;
    const stages = Array.from({ length: n }, (_, i) => ({
      height: (1000 * (n - i)) / weightSum,
      radius: 100 * Math.pow(0.85, i),
    }));
    const topRadius = stages[n - 1].radius;
    return {
      stages,
      head: { height: 300, radius: topRadius },
      fire: { height: 1500, topRadius: 60, bottomRadius: 140 },
    };
  }

  /**
   * Real missile length (m) drawn at the default model size. The model is
   * exaggerated far beyond real scale to be visible from orbit, so real
   * heights are applied relative to this: a 34 m missile is drawn ~1.7x
   * longer than a 20 m one.
   */
  static REFERENCE_MISSILE_HEIGHT = 20;

  /** Size factor for a missile of `height` m; 1 when unknown (Custom). */
  static heightScale(height: number | null | undefined) {
    return height && height > 0
      ? height / MissileView.REFERENCE_MISSILE_HEIGHT
      : 1;
  }

  dimensions: MissileDimensions = MissileView.baseDimensions();

  /** Total height of all stage cylinders. */
  get bodyHeight() {
    return this.dimensions.stages.reduce((sum, s) => sum + s.height, 0);
  }

  /** Reference length of the missile (body height), used for camera distances. */
  get size() {
    return this.bodyHeight;
  }

  /** Full length of the missile, from the body bottom to the head tip. */
  get length() {
    return this.bodyHeight + this.dimensions.head.height;
  }

  private arrowLength = 2 * this.bodyHeight;

  /** One group per stage (cylinder + its parts), bottom to top. */
  private stageGroups: THREE.Group[] = [];
  /** Holds the exhaust flames; moves up to the bottom of the active stage. */
  private fireGroup = new THREE.Group();
  private activeStageIndex = 0;

  /**
   * Burn rate at which the flame has its full `fire` size. Unit: kg/s.
   * Null = use the missile's current mass flow rate (flame always 100%).
   */
  private maxBurnRate: number | null = null;

  /** Set the burn rate (kg/s) that maps to a 100% flame size. */
  setMaxBurnRate(rate: number) {
    this.maxBurnRate = rate > 0 ? rate : null;
  }

  private lerpAlpha = 1;

  setLerpAlpha(alpha: number) {
    this.lerpAlpha = alpha;
  }

  constructor(
    readonly missile: Missile,
    private readonly scene: THREE.Scene,
    readonly earthView: EarthView,
    /** Intended impact point; the "target reached" announcement needs it. */
    private readonly targetPosition: THREE.Vector3 | null = null
  ) {
    this.group = new THREE.Group();
    this.trailView = new TrailView(this.scene);
    this.explosionEffect = new ExplosionEffect(this.scene, 5);
  }

  /**
   * Use the default geometry for `stageCount` stages, scaled by
   * `multiplier`. Call before `init()`.
   */
  setSize(multiplier: number, stageCount = 1) {
    this.setDimensions(
      MissileView.scaleDimensions(
        MissileView.baseDimensions(stageCount),
        multiplier
      )
    );
  }

  /** Set explicit stage / head / fire dimensions (m). Call before `init()`. */
  setDimensions(dimensions: MissileDimensions) {
    if (dimensions.stages.length === 0) {
      throw new Error('MissileView requires at least one stage cylinder.');
    }
    this.dimensions = dimensions;
    this.arrowLength = 2 * this.bodyHeight;
  }

  /**
   * Show only stages from `index` upwards (spent stages are dropped) and
   * move the flame to the bottom of the active stage.
   */
  setActiveStage(index: number) {
    const last = this.dimensions.stages.length - 1;
    const i = THREE.MathUtils.clamp(Math.floor(index), 0, last);
    if (i === this.activeStageIndex && this.stageGroups.length > 0) return;

    // Stages that just burnt out separate and fall away
    for (let k = this.activeStageIndex; k < i; k++) {
      this.separateStage(k);
    }

    this.activeStageIndex = i;
    this.applyActiveStage();
  }

  /** Backward push of a separating stage relative to the missile. Unit: m/s */
  static STAGE_SEPARATION_SPEED = 10;

  private debris: StageDebris[] = [];

  private separateStage(index: number) {
    const stageGroup = this.stageGroups[index];
    if (!stageGroup || !stageGroup.visible) return;

    const forward = new THREE.Vector3(0, 1, 0).applyQuaternion(
      this.group.quaternion
    );
    this.debris.push(
      new StageDebris(
        this.scene,
        stageGroup,
        this.getVelocity(),
        forward,
        MissileView.STAGE_SEPARATION_SPEED
      )
    );
  }

  private updateDebris(dt: number) {
    if (this.debris.length === 0) return;
    this.debris.forEach((d) => d.update(dt));
    this.debris = this.debris.filter((d) => !d.finished);
  }

  private applyActiveStage() {
    const i = this.activeStageIndex;
    this.stageGroups.forEach((g, k) => (g.visible = k >= i));

    const stage = this.dimensions.stages[i];
    this.fireGroup.position.y = this.stageBaseY(i);
    // Fire dimensions are given for the first stage; fit them to the active one
    const k = stage.radius / this.dimensions.stages[0].radius;
    this.fireGroup.scale.setScalar(k);
  }

  /** Y of the bottom of stage `index` in the missile's local space. */
  private stageBaseY(index: number) {
    let y = 0;
    for (let k = 0; k < index; k++) y += this.dimensions.stages[k].height;
    return y;
  }

  private static scaleDimensions(
    d: MissileDimensions,
    k: number
  ): MissileDimensions {
    return {
      stages: d.stages.map((s) => ({
        height: s.height * k,
        radius: s.radius * k,
      })),
      head: { height: d.head.height * k, radius: d.head.radius * k },
      fire: {
        height: d.fire.height * k,
        topRadius: d.fire.topRadius * k,
        bottomRadius: d.fire.bottomRadius * k,
      },
    };
  }

  init() {
    this.buildMissileMesh();
    this.initArrows();
    this.update();
  }

  private buildMissileMesh() {
    const bodyColor = 0xcccccc;
    const legColor = 0x888888;

    // ------------------------------------------------------------------------
    // === Stages (one cylinder each, stacked bottom to top) ===
    const { stages, head, fire } = this.dimensions;
    // Alternate shades so stage boundaries are visible
    const stageColors = [bodyColor, 0xeeeeee];

    this.stageGroups = [];
    let stageBaseY = 0;
    stages.forEach((stage, i) => {
      const stageGroup = new THREE.Group();
      stageGroup.name = `stage-${i + 1}`;
      stageGroup.position.y = stageBaseY;

      const geometry = new THREE.CylinderGeometry(
        stage.radius,
        stage.radius,
        stage.height,
        16
      );
      const material = new THREE.MeshStandardMaterial({
        color: stageColors[i % stageColors.length],
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = stage.height / 2; // bottom touches the stage base
      stageGroup.add(mesh);

      this.group.add(stageGroup);
      this.stageGroups.push(stageGroup);
      stageBaseY += stage.height;
    });
    const bodyHeight = stageBaseY;

    // ------------------------------------------------------------------------
    // === Missile Nose Cone (on top of the last stage) ===
    // Blunted tangent ogive shroud with an ablative tip
    const noseTexture = getNoseTexture();
    const coneMaterial = new THREE.MeshStandardMaterial({
      color: noseTexture ? 0xffffff : 0xe6e6e1,
      map: noseTexture,
      metalness: 0.25,
      roughness: 0.55,
    });
    const coneMesh = new THREE.Mesh(
      new THREE.LatheGeometry(createNoseProfile(head.radius, head.height), 32),
      coneMaterial
    );
    coneMesh.name = 'nose';
    coneMesh.position.y = bodyHeight; // base sits on top of the body
    this.group.add(coneMesh);

    // ------------------------------------------------------------------------
    // === Landing Legs (4), attached to the first stage ===
    const firstStage = stages[0];
    const bodyRadius = firstStage.radius;
    const legWidth = bodyRadius * 0.4; // thickness left-right
    const legDepth = bodyRadius * 0.1; // thickness front-back
    const legHeight = firstStage.height * 0.3; // how tall the leg is

    // Same geometry for all four legs
    const legGeometry = new THREE.BoxGeometry(
      legWidth,
      legHeight,
      legDepth,
      1,
      1,
      1
    );
    const legMaterial = new THREE.MeshStandardMaterial({ color: legColor });

    // Place each leg 90° apart around the body’s circumference
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2; // 0, 90, 180, 270 degrees
      const x = Math.cos(angle) * (bodyRadius + legWidth / 2);
      const z = Math.sin(angle) * (bodyRadius + legDepth / 2);

      const legMesh = new THREE.Mesh(legGeometry, legMaterial);
      legMesh.rotateOnAxis(new THREE.Vector3(0, 1, 0), angle);

      legMesh.position.set(x, legHeight / 2, z); // bottom just touches y = 0
      this.stageGroups[0].add(legMesh);
    }

    this.fireGroup = new THREE.Group();
    this.fireGroup.name = 'fire';
    this.group.add(this.fireGroup);

    // ------------------------------------------------------------------------
    // === Gimbaled nozzle (pivots at the bottom of the active stage) ===
    this.nozzleGimbal = new THREE.Group();
    this.nozzleGimbal.name = 'nozzle-gimbal';
    this.fireGroup.add(this.nozzleGimbal);

    const exitRadius = fire.topRadius * 1.1;
    const nozzleHeight = fire.topRadius * 1.8;
    this.nozzleHeight = nozzleHeight;

    // Bell profile from the combustion chamber (top) down to the exit
    const profile: THREE.Vector2[] = [];
    const chamberRadius = exitRadius * 0.55;
    const throatRadius = exitRadius * 0.35;
    const throatY = -nozzleHeight * 0.18;
    profile.push(new THREE.Vector2(chamberRadius, 0));
    profile.push(new THREE.Vector2(throatRadius, throatY));
    const bellSegments = 10;
    for (let s = 1; s <= bellSegments; s++) {
      const t = s / bellSegments;
      // sqrt curve -> flares quickly after the throat, straighter near exit
      const r = throatRadius + (exitRadius - throatRadius) * Math.sqrt(t);
      const y = throatY + (-nozzleHeight - throatY) * t;
      profile.push(new THREE.Vector2(r, y));
    }

    this.nozzleMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: getNozzleTexture(),
      emissive: 0xffffff,
      emissiveMap: getNozzleGlowTexture(),
      emissiveIntensity: 0,
      metalness: 0.7,
      roughness: 0.45,
      side: THREE.DoubleSide,
    });
    if (!this.nozzleMaterial.map) this.nozzleMaterial.color.set(0x555a60);
    if (!this.nozzleMaterial.emissiveMap) this.nozzleMaterial.emissive.set(0);

    const nozzleMesh = new THREE.Mesh(
      new THREE.LatheGeometry(profile, 24),
      this.nozzleMaterial
    );
    nozzleMesh.name = 'nozzle';
    this.nozzleGimbal.add(nozzleMesh);

    // ------------------------------------------------------------------------
    // === Burning fire (hangs from the nozzle exit, gimbals with it) ===
    const fireTexture = getFireTexture();
    const burningFireMaterial = new THREE.MeshBasicMaterial({
      color: fireTexture ? 0xffffff : 0xffa500,
      map: fireTexture,
      transparent: true,
      opacity: fireTexture ? 0.95 : 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const burningFireGeometry = new THREE.CylinderGeometry(
      fire.topRadius,
      fire.bottomRadius,
      fire.height,
      24,
      1,
      true
    );
    const burningFireMesh = new THREE.Mesh(
      burningFireGeometry,
      burningFireMaterial
    );

    // Top of the flame touches the nozzle exit
    burningFireMesh.position.y = -nozzleHeight - fire.height / 2;

    this.burningFireMesh = burningFireMesh;
    this.nozzleGimbal.add(this.burningFireMesh);

    this.applyActiveStage();

    // ------------------------------------------------------------------------
    this.group.name = MissileView.name;
    this.scene.add(this.group);
  }

  private initArrows() {
    const initial: Record<ForceArrowKey, THREE.Vector3> = {
      velocity: this.missile.velocity,
      acceleration: this.missile.thrust
        .clone()
        .add(this.missile.gravityForce),
      thrust: this.missile.thrust,
      gravity: this.missile.gravityForce,
      gravityPerpendicular: this.missile.calcThrustDirectionToIncline(),
    };

    (Object.keys(initial) as ForceArrowKey[]).forEach((key) => {
      this.addArrow(
        key,
        FORCE_ARROW_COLORS[key],
        this.group.position,
        initial[key]
      );
    });
  }

  /** Standard gravity, for showing accelerations in g. Unit: m/s² */
  private static readonly G0 = 9.80665;

  /** m/s² -> "12.34 m/s² (1.26 g)" */
  private static formatAcceleration(ms2: number) {
    return `${ms2.toFixed(2)} m/s² (${(ms2 / MissileView.G0).toFixed(2)} g)`;
  }

  /** Angle between `v` and gravity, e.g. " · 45.2°" (empty if undefined). */
  private angleToGravityText(v: THREE.Vector3) {
    const g = this.missile.gravityForce;
    if (v.lengthSq() === 0 || g.lengthSq() === 0) return '';
    return ` · ${THREE.MathUtils.radToDeg(v.angleTo(g)).toFixed(1)}°`;
  }

  private updateArrows() {
    const velocity = this.getVelocity();
    const thrust = this.getThrust();
    const gravity = this.missile.gravityForce;
    // Total acceleration acting on the missile (thrust is already per unit mass)
    const acceleration = thrust.clone().add(gravity);
    const perpendicular = this.missile.calcThrustDirectionToIncline();

    this.updateArrow(
      'acceleration',
      this.group.position,
      acceleration.clone().normalize(),
      acceleration.length(),
      MissileView.formatAcceleration(acceleration.length()) +
        this.angleToGravityText(acceleration)
    );

    this.updateArrow(
      'gravity',
      this.group.position,
      gravity.clone().normalize(),
      gravity.length(),
      MissileView.formatAcceleration(gravity.length())
    );

    this.updateArrow(
      'velocity',
      this.group.position,
      velocity.clone().normalize(),
      velocity.length(),
      formatKmPerS(velocity.length()) + this.angleToGravityText(velocity)
    );

    this.updateArrow(
      'thrust',
      this.group.position,
      thrust.clone().normalize(),
      thrust.length(),
      MissileView.formatAcceleration(thrust.length()) +
        this.angleToGravityText(thrust)
    );

    this.updateArrow(
      'gravityPerpendicular',
      this.group.position,
      perpendicular.clone().normalize(),
      perpendicular.length()
    );
  }

  private updateArrow(
    name: ForceArrowKey,
    position: THREE.Vector3,
    direction: THREE.Vector3,
    magnitude: number = 1,
    labelText?: string
  ) {
    const arrow = this.arrows.find((a) => a.name === `${name}-arrow`);

    if (!arrow) return;
    let length = this.arrowLength;

    if (magnitude === 0) {
      length = 0;
    }

    arrow.setDirection(direction);
    arrow.setLength(
      length,
      Math.min(length * 0.05, 10_000),
      Math.min(length * 0.03, 5_000)
    );
    arrow.position.copy(position);

    // Label is a child of the arrow: local +Y is the arrow direction, and
    // setLength() only scales the line/cone, not the arrow object itself.
    const label = this.arrowLabels.get(name);
    if (label) {
      label.sprite.position.set(0, length, 0);
      if (labelText !== undefined && arrow.visible) label.setText(labelText);
    }

    // const label = this.arrowsLabels.find((l) => l.name === `${name}-label`);
    // if (label) {
    //   const midpoint = new THREE.Vector3().addVectors(
    //     position,
    //     direction.clone().multiplyScalar(length)
    //   );
    //   label.position.copy(midpoint);
    //   label.position.y += 0.2; // slightly above the arrow
    //   label.lookAt(this.camera.position); // make it face the arrow
    // }
  }

  private addArrow(
    name: ForceArrowKey,
    color = 0x00ff00,
    position = new THREE.Vector3(0, 0, 0),
    direction = new THREE.Vector3(0, 0, 0)
  ) {
    const length = direction.length() * this.arrowLength;
    const arrow = new THREE.ArrowHelper(direction, position, length, color);
    arrow.name = `${name}-arrow`;
    arrow.frustumCulled = false;
    arrow.setLength(length, length * 0.1, length * 0.1);
    arrow.setDirection(direction);
    arrow.setColor(color);
    arrow.visible = this.isArrowShown(name);
    this.scene.add(arrow);
    this.arrows.push(arrow);

    // Value label at the arrow tip; hidden together with the arrow.
    // Gravity Perpendicular is a pure direction -> no number.
    if (name !== 'gravityPerpendicular') {
      const label = new ArrowLabel(color);
      arrow.add(label.sprite);
      this.arrowLabels.set(name, label);
    }

    // const loader = new FontLoader();
    // loader.load(
    //   'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json',
    //   (font) => {
    //     const textGeometry = new TextGeometry('Middle', {
    //       font: font,
    //       size: 10,
    //     });
    //     const textMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    //     const textMesh = new THREE.Mesh(textGeometry, textMaterial);

    //     const midpoint = new THREE.Vector3().addVectors(
    //       position,
    //       direction.clone().multiplyScalar(length / 2)
    //     );

    //     textMesh.position.copy(midpoint);
    //     textMesh.position.y += 0.2; // slightly above the arrow
    //     textMesh.lookAt(this.camera.position); // make it face the camera
    //     textMesh.name = `${name}-label`;
    //     this.arrowsLabels.push(textMesh);

    //     this.scene.add(textMesh);
    //   }
    // );
  }

  setTrailVisible(visible: boolean) {
    this.trailView?.setVisible(visible);
  }

  private readonly trailLastPoint = new THREE.Vector3();
  private readonly trailColor = new THREE.Color();

  private extendTrail() {
    if (!this.trailView) return;

    // update() runs every render frame, including while the simulation is
    // paused. Appending the same point repeatedly would fill the trail's
    // vertex limit with duplicates and push the real path out.
    const last = this.trailView.getLastVectorPosition(this.trailLastPoint);
    if (last && last.equals(this.prevPosition)) return;

    const thrustPercentage =
      this.missile.thrust.length() / this.missile.maxAcceleration;

    // TrailView copies the values, so scratch objects can be reused
    this.trailColor.setRGB(1, thrustPercentage, 1 - thrustPercentage);
    this.trailView.extendFromVectors(this.prevPosition, this.trailColor);
  }

  private alignRotation() {
    if (this.missile.hasLanded) {
      return;
    }

    if (this.missile.velocity.length() === 0) {
      this.rotateTowards(this.group, this.group.position);
    } else {
      this.rotateTowards(this.group, this.getVelocity().normalize());
    }
  }

  private rotateTowards(
    object: THREE.Object3D | THREE.Mesh,
    normal: THREE.Vector3
  ) {
    // const normal = this.mesh.position.clone().sub(to).normalize();
    object.lookAt(object.position.clone().add(normal));

    object.rotateOnAxis(
      new THREE.Vector3(1, 0, 0),
      THREE.MathUtils.degToRad(90)
    );
  }

  endPositionSkyMarker: null | THREE.Line = null;

  /** @param simDelta Simulation seconds since the last call (animates debris). */
  update(simDelta = 0): void {
    this.updateDebris(simDelta);
    this.updatePosition();
    this.updateBurningFireScale();

    this.updateArrows();

    this.alignRotation();
    this.updateNozzleGimbal();

    this.engineSound?.update(
      !this.missile.hasLanded && this.missile.thrust.lengthSq() > 0,
      this.group.position
    );

    if (!this.missile.hasLanded) {
      this.extendTrail();
    }

    if (this.missile.hasLanded && this.endPositionSkyMarker == null) {
      this.endPositionSkyMarker = this.earthView.createLineToSkyMarker(
        this.missile.position,
        0x00ff00,
        this.missile.maxAltitude
      );

      this.scene.add(this.endPositionSkyMarker);
    }

    // Trigger explosion effect when missile lands
    if (
      this.missile.hasLanded &&
      !this.hasTriggeredExplosion &&
      this.explosionEffect
    ) {
      const normal = this.missile.position.clone().normalize();
      this.explosionEffect.start(this.missile.position.clone(), normal);
      this.hasTriggeredExplosion = true;

      const missDistance = this.targetPosition
        ? this.missile.position.distanceTo(this.targetPosition)
        : Infinity;
      if (missDistance <= TARGET_HIT_MAX_MISS_M) {
        // Same number as the "Missile N" label in the GUI
        const missileId = this.missile.id;
        setTimeout(
          () => announceTargetReached(missileId),
          TARGET_REACHED_ANNOUNCE_DELAY_MS
        );
      }
    }

    // Update explosion effect animation
    if (this.explosionEffect) {
      this.explosionEffect.update();
    }
  }

  /** Current burn rate as a fraction of `maxBurnRate` (0..1). */
  private get burnRatio() {
    const rate = this.missile.massFlowRate;
    const max = this.maxBurnRate ?? rate;
    if (!(max > 0)) return 0;
    return THREE.MathUtils.clamp(rate / max, 0, 1);
  }

  private updateBurningFireScale() {
    if (!this.burningFireMesh) return;

    // Hide the exhaust flame once all fuel is burnt (or the missile landed)
    const burning = !this.missile.isEngineCutoff && !this.missile.hasLanded;
    const ratio = burning ? this.burnRatio : 0;
    this.burningFireMesh.visible = ratio > 0;

    // Nozzle glows while firing and cools down after cutoff
    if (this.nozzleMaterial) {
      const glow = this.nozzleMaterial.emissiveIntensity;
      this.nozzleMaterial.emissiveIntensity =
        ratio > 0 ? 0.4 + 0.6 * ratio : glow * 0.97;
    }

    if (ratio === 0) return;

    // 100% size at the maximum burn rate, proportionally smaller below it,
    // with a slight flicker. The top of the flame stays on the nozzle exit.
    const flicker = 1 + (Math.random() - 0.5) * 0.08;
    const width = ratio * (1 + (Math.random() - 0.5) * 0.05);
    const length = ratio * flicker;
    this.burningFireMesh.scale.set(width, length, width);
    this.burningFireMesh.position.y =
      -this.nozzleHeight - (this.dimensions.fire.height * length) / 2;
  }



  private readonly gimbalTarget = new THREE.Quaternion();

  /**
   * During the gravity turn the thrust rotates at `thrustInclineVelocity`
   * rad/s; the nozzle tilts proportionally to that rate to steer it, with
   * the exhaust swinging away from the target side. Neutral outside the turn
   * or without thrust.
   */
  private updateNozzleGimbal() {
    if (!this.nozzleGimbal) return;

    const missile = this.missile;
    const steering =
      missile.isGravityTurnActive &&
      !missile.isEngineCutoff &&
      !missile.hasLanded &&
      missile.thrustInclineVelocity !== 0;

    this.gimbalTarget.identity();

    if (steering) {
      const angle = Math.abs(missile.thrustInclineVelocity);

      // Exhaust swings away from the target (turn direction inversed),
      // expressed in the missile's local space
      const lateral = missile
        .calcThrustDirectionToIncline()
        .clone()
        .applyQuaternion(this.group.quaternion.clone().invert())
        .negate();
      if (missile.thrustInclineVelocity < 0) lateral.negate();

      // Tilt axis = exhaust axis (-Y) x lateral; the cross product ignores
      // the component along the missile height, so no projection is needed
      const axis = new THREE.Vector3(0, -1, 0).cross(lateral);
      if (axis.lengthSq() > 1e-12) {
        this.gimbalTarget.setFromAxisAngle(axis.normalize(), angle);
      }
    }

    // Smooth the actuator movement
    this.nozzleGimbal.quaternion.slerp(this.gimbalTarget, 0.1);
  }

  private updatePosition() {
    const position = new THREE.Vector3().lerpVectors(
      this.prevPosition,
      this.missile.position,
      this.lerpAlpha
    );

    this.group.position.copy(position);
  }

  private getVelocity() {
    return new THREE.Vector3().lerpVectors(
      this.prevVelocity,
      this.missile.velocity,
      this.lerpAlpha
    );
  }

  private getThrust() {
    return new THREE.Vector3().lerpVectors(
      this.prevThrust,
      this.missile.thrust,
      this.lerpAlpha
    );
  }

  updatePrevFromMissile() {
    this.prevPosition.copy(this.missile.position.clone());
    this.prevVelocity.copy(this.missile.velocity.clone());
    this.prevThrust.copy(this.missile.thrust.clone());
  }

  private isArrowShown(key: ForceArrowKey) {
    return !this.arrowsTemporarilyHidden && this.enabledArrows.has(key);
  }

  private refreshArrowsVisibility() {
    this.arrows.forEach((arrow) => {
      const key = arrow.name.replace(/-arrow$/, '') as ForceArrowKey;
      arrow.visible = this.isArrowShown(key);
    });
  }

  /** Show/hide the missile model itself (trail and arrows are unaffected). */
  setMissileVisible(visible: boolean) {
    this.group.visible = visible;
  }

  /** Toggle a single force arrow on/off (user setting). */
  setArrowEnabled(key: ForceArrowKey, enabled: boolean) {
    if (enabled) this.enabledArrows.add(key);
    else this.enabledArrows.delete(key);
    this.refreshArrowsVisibility();
  }

  /** Temporarily show/hide arrows; never shows ones the user disabled. */
  setArrowsVisible(visible: boolean) {
    this.arrowsTemporarilyHidden = !visible;
    this.refreshArrowsVisibility();
  }

  applyScaleToArrows(scale: number) {
    this.arrowLength = scale;
  }

  remove() {
    this.scene.remove(this.group);

    this.debris.forEach((d) => d.remove());
    this.debris = [];

    if (this.endPositionSkyMarker) {
      this.scene.remove(this.endPositionSkyMarker);
      this.endPositionSkyMarker.geometry.dispose();
      this.endPositionSkyMarker = null;
    }

    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        child.material.dispose();
      }
    });
    this.group.clear();

    this.arrowLabels.forEach((label) => label.dispose());
    this.arrowLabels.clear();

    this.arrows.forEach((arrow) => {
      arrow.dispose();
      this.scene.remove(arrow);
    });
    this.arrows = [];

    if (this.trailView) {
      this.trailView.remove();
      this.trailView = null;
    }

    if (this.explosionEffect) {
      this.explosionEffect.remove();
      this.explosionEffect = null;
    }

    if (this.engineSound) {
      this.engineSound.remove();
      this.engineSound = null;
    }
  }
}
