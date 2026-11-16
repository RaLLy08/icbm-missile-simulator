import EarthView from 'app/earth/EarthView';
import Missile from '../Missile';
import StageDebris from './StageDebris';
import Warhead from './Warhead';
import { getCanvasTexture } from './canvasTexture';
import ArrowLabel from './ArrowLabel';
import TrailView from './TrailView';
import ExhaustSmoke from './ExhaustSmoke';
import NuclearExplosion, {
  estimateYieldKt,
  type NuclearExplosionOptions,
} from './NuclearExplosion';
import Earth from '../../earth/Earth';
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
import detachVariant0 from 'public/audio/detach/detach_0.wav';
import detachVariant1 from 'public/audio/detach/detach_1.wav';
import detachVariant2 from 'public/audio/detach/detach_2.wav';
import detachVariant3 from 'public/audio/detach/detach_3.wav';
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

const DETACH_VARIANTS: string[] = [
  detachVariant0,
  detachVariant1,
  detachVariant2,
  detachVariant3,
];

const DETACH_BASE_VOLUME = 0.6;

const pickRandom = <T>(items: T[]): T =>
  items[Math.floor(Math.random() * items.length)];

/**
 * One-shot sound of a part separating (stage, shroud), a random variant.
 * Volume follows camera distance at the moment of separation.
 */
function playDetachSound(position: THREE.Vector3) {
  const volume = getDistanceVolume(position, ENGINE_FALLOFF);
  if (volume <= 0) return;

  const sound = createAudio(pickRandom(DETACH_VARIANTS));
  sound.volume = DETACH_BASE_VOLUME * volume;
  sound.addEventListener('ended', () => releaseAudio(sound), { once: true });
  sound.play().catch((error) => {
    releaseAudio(sound);
    console.warn('Failed to play detach sound:', error);
  });
}

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
  private visual: NuclearExplosion | null = null;
  /** Simulation time of the detonation. Unit: s */
  private startSimTime = 0;
  /** Real time of the detonation. Unit: ms */
  private startRealTime = 0;
  /** Unit: s (simulation time) */
  private duration = 0;
  private isActive: boolean = false;
  /** Close-range blast; volume follows camera distance while playing. */
  private audio: HTMLAudioElement | null = null;
  private readonly baseVolume = 0.5;
  private position: THREE.Vector3 | null = null;

  constructor(
    private readonly scene: THREE.Scene,
    /** Yield, burst height, size and length of the detonation. */
    public options: NuclearExplosionOptions = {}
  ) {}

  private updateVolume() {
    if (!this.position || !this.audio) return;
    this.audio.volume =
      this.baseVolume * getDistanceVolume(this.position, EXPLOSION_FALLOFF);
  }

  /**
   * @param simTime Current simulation time. Unit: s
   * @param options Overrides the effect's `options` for this detonation.
   */
  start(
    position: THREE.Vector3,
    normal: THREE.Vector3,
    simTime: number,
    options: NuclearExplosionOptions = this.options
  ) {
    this.startSimTime = simTime;
    this.startRealTime = performance.now();
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

    this.visual?.remove();
    this.visual = new NuclearExplosion(this.scene, options);
    this.duration = this.visual.durationS;
    this.visual.start(position, normal);
  }

  /**
   * Advance the effect. It runs on simulation time, so it follows the time
   * multiplier and freezes while paused.
   * @param simTime Current simulation time. Unit: s
   */
  update(simTime: number) {
    // Keep adjusting while the sound plays (it may outlast the visual effect)
    if (this.audio && !this.audio.paused) this.updateVolume();

    if (!this.isActive) return;

    const elapsed = Math.max(0, simTime - this.startSimTime);
    if (elapsed >= this.duration) {
      this.remove();
      return;
    }

    const realElapsed = (performance.now() - this.startRealTime) / 1000;
    this.visual?.update(elapsed, realElapsed);
  }

  remove() {
    this.isActive = false;
    this.visual?.remove();
    this.visual = null;
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
 * Main (sea-level) exhaust plume: yellow-white at the nozzle exit, burning
 * through orange into a ragged, fading red tail, with turbulent streaks.
 * Canvas top = flame top (attached to the nozzle).
 */
const getFireTexture = () =>
  getCanvasTexture('burning-fire', 128, 512, (ctx, w, h) => {
    const plume = ctx.createLinearGradient(0, 0, 0, h);
    plume.addColorStop(0, 'rgba(255, 250, 225, 1)');
    plume.addColorStop(0.1, 'rgba(255, 228, 150, 0.95)');
    plume.addColorStop(0.32, 'rgba(255, 170, 60, 0.8)');
    plume.addColorStop(0.6, 'rgba(255, 105, 25, 0.45)');
    plume.addColorStop(0.85, 'rgba(210, 50, 10, 0.15)');
    plume.addColorStop(1, 'rgba(160, 20, 0, 0)');
    ctx.fillStyle = plume;
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = 'lighter';

    // Turbulent streaks of hotter gas
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * w;
      const start = Math.random() * h * 0.25;
      const length = h * (0.25 + Math.random() * 0.65);
      const streak = ctx.createLinearGradient(0, start, 0, start + length);
      const alpha = 0.04 + Math.random() * 0.14;
      streak.addColorStop(0, `rgba(255, 225, 160, ${alpha})`);
      streak.addColorStop(1, 'rgba(255, 110, 30, 0)');
      ctx.fillStyle = streak;
      ctx.fillRect(x, start, 1 + Math.random() * 4, length);
    }

    // Ragged tail: dark gaps eat into the fading end of the flame
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * w;
      const y = h * (0.55 + Math.random() * 0.45);
      const r = 4 + Math.random() * 14;
      const hole = ctx.createRadialGradient(x, y, 0, x, y, r);
      hole.addColorStop(0, 'rgba(0, 0, 0, 0.6)');
      hole.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = hole;
      ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    }

    ctx.globalCompositeOperation = 'source-over';
  });

/** Number of Mach diamonds drawn in the flame core. */
const SHOCK_DIAMOND_COUNT = 6;

/**
 * Flame core: white-hot supersonic jet with a train of Mach diamonds
 * (bright shock disks separated by darker expansion regions), dimming
 * further from the nozzle. Canvas top = nozzle exit.
 */
const getFlameCoreTexture = () =>
  getCanvasTexture('flame-core', 64, 512, (ctx, w, h) => {
    const base = ctx.createLinearGradient(0, 0, 0, h);
    base.addColorStop(0, 'rgba(255, 255, 250, 0.95)');
    base.addColorStop(0.5, 'rgba(255, 235, 185, 0.55)');
    base.addColorStop(1, 'rgba(255, 190, 110, 0)');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);

    const cell = h / (SHOCK_DIAMOND_COUNT + 0.5);
    for (let i = 0; i < SHOCK_DIAMOND_COUNT; i++) {
      const fade = 1 - i / SHOCK_DIAMOND_COUNT;
      const top = i * cell;

      // Expansion region right after the nozzle / each disk: darker
      ctx.globalCompositeOperation = 'destination-out';
      const gap = ctx.createLinearGradient(0, top, 0, top + cell * 0.7);
      gap.addColorStop(0, 'rgba(0, 0, 0, 0)');
      gap.addColorStop(0.5, `rgba(0, 0, 0, ${0.55 * fade + 0.15})`);
      gap.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gap;
      ctx.fillRect(0, top, w, cell * 0.7);

      // Mach disk: sharp bright band at the end of each cell
      ctx.globalCompositeOperation = 'lighter';
      const y = top + cell * 0.82;
      const half = cell * 0.16;
      const disk = ctx.createLinearGradient(0, y - half, 0, y + half);
      disk.addColorStop(0, 'rgba(255, 255, 255, 0)');
      disk.addColorStop(0.45, `rgba(255, 255, 245, ${0.9 * fade})`);
      disk.addColorStop(0.6, `rgba(255, 240, 200, ${0.6 * fade})`);
      disk.addColorStop(1, 'rgba(255, 220, 160, 0)');
      ctx.fillStyle = disk;
      ctx.fillRect(0, y - half, w, 2 * half);
    }
    ctx.globalCompositeOperation = 'source-over';
  });

/**
 * High-altitude plume: in thin air the under-expanded exhaust balloons into
 * a huge, faint, translucent bell. Canvas top = nozzle exit.
 */
const getVacuumPlumeTexture = () =>
  getCanvasTexture('vacuum-plume', 64, 256, (ctx, w, h) => {
    const plume = ctx.createLinearGradient(0, 0, 0, h);
    plume.addColorStop(0, 'rgba(255, 240, 215, 0.9)');
    plume.addColorStop(0.15, 'rgba(255, 200, 150, 0.55)');
    plume.addColorStop(0.5, 'rgba(255, 150, 110, 0.22)');
    plume.addColorStop(1, 'rgba(200, 120, 160, 0)');
    ctx.fillStyle = plume;
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 30; i++) {
      const length = h * (0.3 + Math.random() * 0.6);
      const streak = ctx.createLinearGradient(0, 0, 0, length);
      streak.addColorStop(0, `rgba(255, 230, 200, ${0.03 + Math.random() * 0.07})`);
      streak.addColorStop(1, 'rgba(255, 180, 150, 0)');
      ctx.fillStyle = streak;
      ctx.fillRect(Math.random() * w, 0, 1 + Math.random() * 3, length);
    }
    ctx.globalCompositeOperation = 'source-over';
  });

/**
 * LatheGeometry profile hanging down from y = 0 (nozzle exit) to
 * y = -length. `radiusAt(t)` gives the radius at t = 0 (exit) .. 1 (tail).
 * Points are listed tail first, so texture v = 1 is at the nozzle, matching
 * canvas textures drawn with the nozzle at the top.
 */
function createPlumeProfile(
  length: number,
  radiusAt: (t: number) => number,
  segments = 32
): THREE.Vector2[] {
  const points: THREE.Vector2[] = [];
  for (let s = 0; s <= segments; s++) {
    const t = 1 - s / segments;
    points.push(new THREE.Vector2(Math.max(0, radiusAt(t)), -t * length));
  }
  return points;
}

const smoothstep = (edge0: number, edge1: number, x: number) =>
  THREE.MathUtils.smoothstep(x, edge0, edge1);

/** Sea-level air density. Unit: kg/m³ */
const SEA_LEVEL_DENSITY = 1.225;
/**
 * Decades of air-density drop over which the plume goes from sea-level
 * (tight column) to vacuum (fully expanded bell). 1e-4.5 of sea level is
 * reached at ~65 km.
 */
const PLUME_EXPANSION_DECADES = 4.5;

/**
 * How far the plume has expanded (0 = sea level, 1 = near vacuum). Ambient
 * pressure squeezes the exhaust into a narrow column near the ground; as it
 * drops, the plume widens and grows into a faint bell.
 * @param density Air density. Unit: kg/m³
 */
export function plumeExpansion(density: number) {
  if (!(density > 0)) return 1;
  return THREE.MathUtils.clamp(
    Math.log10(SEA_LEVEL_DENSITY / density) / PLUME_EXPANSION_DECADES,
    0,
    1
  );
}

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

/**
 * Aerodynamic heating glow of the nose skin (emissive map): dark at the
 * base, hottest at the stagnation point on the tip.
 * Canvas top = tip (v = 1), canvas bottom = base (v = 0).
 */
const getNoseHeatTexture = () =>
  getCanvasTexture('nose-heat', 16, 256, (ctx, w, h) => {
    const heat = ctx.createLinearGradient(0, h, 0, 0);
    heat.addColorStop(0, '#000000');
    heat.addColorStop(0.45, '#2a0800');
    heat.addColorStop(NOSE_TIP_V - 0.1, '#b33a00');
    heat.addColorStop(1, '#ffffff');
    ctx.fillStyle = heat;
    ctx.fillRect(0, 0, w, h);
  });

/**
 * Shock layer / plasma sheath around the nose (white, tinted by the
 * material color): opaque at the tip, thinning out towards the base.
 * Canvas top = tip (v = 1).
 */
const getPlasmaShellTexture = () =>
  getCanvasTexture('plasma-shell', 64, 256, (ctx, w, h) => {
    const shell = ctx.createLinearGradient(0, 0, 0, h);
    shell.addColorStop(0, 'rgba(255, 255, 255, 1)');
    shell.addColorStop(0.2, 'rgba(255, 255, 255, 0.75)');
    shell.addColorStop(0.6, 'rgba(255, 255, 255, 0.3)');
    shell.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
    ctx.fillStyle = shell;
    ctx.fillRect(0, 0, w, h);
  });

/**
 * Hot wake flowing back from the nose along the body: bright at the top,
 * fading out with streaks. Canvas top = top of the wake (at the nose).
 */
const getPlasmaWakeTexture = () =>
  getCanvasTexture('plasma-wake', 128, 256, (ctx, w, h) => {
    const wake = ctx.createLinearGradient(0, 0, 0, h);
    wake.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
    wake.addColorStop(0.3, 'rgba(255, 255, 255, 0.35)');
    wake.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = wake;
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 40; i++) {
      const length = h * (0.3 + Math.random() * 0.7);
      const streak = ctx.createLinearGradient(0, 0, 0, length);
      streak.addColorStop(0, `rgba(255, 255, 255, ${0.05 + Math.random() * 0.15})`);
      streak.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = streak;
      ctx.fillRect(Math.random() * w, 0, 1 + Math.random() * 2, length);
    }
    ctx.globalCompositeOperation = 'source-over';
  });

/** Sutton–Graves constant for Earth's air. Unit: kg^0.5 / m */
const SUTTON_GRAVES_K = 1.7415e-4;
/** Real (not drawn) nose tip radius used for the heating estimate. Unit: m */
const REAL_NOSE_RADIUS_M = 0.5;
/**
 * Heat flux at which the effect starts. ~10 kW/m² is reached at ~120 km at
 * re-entry speed (the "entry interface", where the plasma glow begins).
 * Unit: W/m²
 */
const HEAT_FLUX_VISIBLE = 1e4;
/** Heat flux at which the effect is at full strength. Unit: W/m² */
const HEAT_FLUX_FULL = 1e7;

/** Faint shock layer (weak heating) -> orange plasma (strong heating). */
const SHOCK_COLOR = new THREE.Color(0xbfd8ff);
const PLASMA_COLOR = new THREE.Color(0xff6a2a);
/** White-hot gas right behind the bow shock at the stagnation point. */
const PLASMA_CORE_COLOR = new THREE.Color(0xfff1c8);

/** Bow shock size relative to the nose (it stands well off the body). */
const BOW_SHOCK_RADIUS_SCALE = 2.2;
const BOW_SHOCK_HEIGHT_SCALE = 1.5;
/** Full plasma trail length as a multiple of the missile body height. */
const PLASMA_WAKE_LENGTH_SCALE = 4;
/** Tip halo diameter at full heating, relative to the nose radius. */
const PLASMA_HALO_SIZE_SCALE = 14;

/** Soft round glow (halo around the stagnation point). */
const getPlasmaHaloTexture = () =>
  getCanvasTexture('plasma-halo', 128, 128, (ctx, w, h) => {
    const glow = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    glow.addColorStop(0, 'rgba(255, 255, 255, 1)');
    glow.addColorStop(0.15, 'rgba(255, 255, 255, 0.8)');
    glow.addColorStop(0.45, 'rgba(255, 255, 255, 0.2)');
    glow.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
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
  | 'drag'
  | 'gravityPerpendicular';

export const FORCE_ARROW_COLORS: Record<ForceArrowKey, number> = {
  velocity: 0xff0000,
  acceleration: 0xffff00,
  thrust: 0x00ff00,
  gravity: 0x0000ff,
  drag: 0xff8800,
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
  /** Main exhaust flame (tight column in dense air). */
  private burningFireMesh: THREE.Mesh | null = null;
  /** White-hot supersonic core with Mach diamonds. */
  private flameCoreMesh: THREE.Mesh | null = null;
  /** Wide translucent bell the exhaust balloons into at high altitude. */
  private vacuumPlumeMesh: THREE.Mesh | null = null;
  /** Bright glow at the nozzle exit (reads as bloom from far away). */
  private flameGlow: THREE.Sprite | null = null;
  /** Smoke column left in the lower atmosphere. */
  private exhaustSmoke: ExhaustSmoke | null = null;
  /** Simulation seconds elapsed (advanced by `stepDebris`). */
  private simTime = 0;
  /** Simulation time of the frame being drawn (between physics steps). Unit: s */
  private get renderSimTime() {
    return this.simTime + THREE.MathUtils.clamp(this.lerpAlpha, 0, 1);
  }
  /** Smoothed plume expansion (0 = sea level .. 1 = vacuum). */
  private plumeExpansion = 0;
  private readonly nozzleWorld = new THREE.Vector3();
  /** Pivot at the top of the nozzle; rotates the nozzle + flame with thrust. */
  private nozzleGimbal: THREE.Group | null = null;
  private nozzleMaterial: THREE.MeshStandardMaterial | null = null;
  /** Nose skin; its emissive glow shows aerodynamic heating. */
  private noseMaterial: THREE.MeshStandardMaterial | null = null;
  /** Nose shroud: two clamshell halves jettisoned after the last burnout. */
  private shroudGroup: THREE.Group | null = null;
  private shroudHalves: THREE.Group[] = [];
  /** Re-entry vehicle under the shroud; flies on alone after separation. */
  private warhead: Warhead | null = null;
  /** Bow shock / plasma sheath enveloping the nose. */
  private plasmaShellMesh: THREE.Mesh | null = null;
  /** White-hot layer hugging the nose tip, inside the bow shock. */
  private plasmaCoreMesh: THREE.Mesh | null = null;
  /** Bright glow around the stagnation point. */
  private plasmaHalo: THREE.Sprite | null = null;
  /** Hot wake streaming back from the nose along the body. */
  private plasmaWakeMesh: THREE.Mesh | null = null;
  /** Y of the wake top in the missile's local space. */
  private plasmaWakeTopY = 0;
  /** Unscaled wake length. Unit: m */
  private plasmaWakeHeight = 0;
  /** Smoothed aerodynamic heating intensity (0..1). */
  private heatingIntensity = 0;
  private readonly heatColor = new THREE.Color();
  /** Nozzle length in fire-group space (fire dimensions of the first stage). */
  private nozzleHeight = 0;
  private explosionEffect: ExplosionEffect | null = null;
  private hasTriggeredExplosion: boolean = false;
  private engineSound: EngineSound | null = new EngineSound();

  prevPosition = new THREE.Vector3();
  prevVelocity = new THREE.Vector3();
  prevThrust = new THREE.Vector3();
  prevGravity = new THREE.Vector3();
  prevDrag = new THREE.Vector3();

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

  /**
   * Detonation parameters (yield, burst height, size, length) used when
   * this missile reaches the ground. Without `yieldKt`, the yield is
   * estimated from the missile's payload mass.
   */
  setExplosionOptions(options: NuclearExplosionOptions) {
    if (this.explosionEffect) this.explosionEffect.options = { ...options };
  }

  /** Estimated warhead yield from the payload mass. Unit: kt */
  get estimatedYieldKt() {
    return estimateYieldKt(this.missile.payloadMass);
  }

  /** Options of the coming detonation; explicit ones override the estimate. */
  private get explosionOptions(): NuclearExplosionOptions {
    const options = this.explosionEffect?.options ?? {};
    return {
      ...options,
      yieldKt: options.yieldKt ?? this.estimatedYieldKt,
    };
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
    this.exhaustSmoke = new ExhaustSmoke(this.scene);
    this.explosionEffect = new ExplosionEffect(this.scene);
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
   * move the flame to the bottom of the active stage. `index` equal to the
   * stage count means all stages burnt out: the last stage separates, the
   * nose shroud flies off and the warhead continues alone.
   */
  setActiveStage(index: number) {
    const stageCount = this.dimensions.stages.length;
    const i = THREE.MathUtils.clamp(Math.floor(index), 0, stageCount);
    if (i === this.activeStageIndex && this.stageGroups.length > 0) return;

    // Stages that just burnt out separate and fall away
    for (let k = this.activeStageIndex; k < i; k++) {
      this.separateStage(k);
    }

    this.activeStageIndex = i;
    this.applyActiveStage();

    if (i >= stageCount) this.deployWarhead();
  }

  /** Backward push of a separating stage relative to the missile. Unit: m/s */
  static STAGE_SEPARATION_SPEED = 10;
  /** Sideways push of each shroud half, per m of shroud radius. Unit: 1/s */
  static SHROUD_LATERAL_SPEED_PER_RADIUS = 0.6;
  /** Tumble rate range of the jettisoned shroud halves. Unit: rad/s */
  static SHROUD_TUMBLE_SPEED: [number, number] = [0.5, 0.9];

  /** True once the shroud is jettisoned and only the warhead flies on. */
  get isWarheadDeployed() {
    return this.warhead?.deployed ?? false;
  }

  private deployWarhead() {
    if (!this.warhead || this.warhead.deployed) return;
    this.jettisonShroud();
    this.warhead.deploy();
  }

  /** The two shroud halves hinge outwards and drift away sideways. */
  private jettisonShroud() {
    const shroud = this.shroudGroup;
    if (!shroud || !shroud.visible) return;

    const quaternion = this.group.quaternion;
    const forward = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
    const state = this.separationState();
    const lateralSpeed =
      this.dimensions.head.radius *
      MissileView.SHROUD_LATERAL_SPEED_PER_RADIUS;

    this.shroudHalves.forEach((half) => {
      // Half i sits on the local ±X side; its hinge is the base rim there
      const side = Math.sign(half.position.x) || 1;
      const outward = new THREE.Vector3(side, 0, 0).applyQuaternion(quaternion);
      // Rotating about -Z (local) tips +Y towards +X: top peels outwards
      const hingeAxis = new THREE.Vector3(0, 0, -side).applyQuaternion(
        quaternion
      );

      this.debris.push(
        new StageDebris(
          this.scene,
          half,
          state,
          forward,
          MissileView.STAGE_SEPARATION_SPEED * 0.5,
          {
            extraVelocity: outward.multiplyScalar(lateralSpeed),
            angularAxis: hingeAxis,
            angularSpeed: THREE.MathUtils.randFloat(
              ...MissileView.SHROUD_TUMBLE_SPEED
            ),
          }
        )
      );
    });

    playDetachSound(this.group.position);

    shroud.visible = false;
    // The shroud no longer glows; the warhead takes over the heating
    this.noseMaterial = null;
  }

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
        this.separationState(),
        forward,
        MissileView.STAGE_SEPARATION_SPEED
      )
    );
    playDetachSound(this.group.position);
  }

  /** Missile state that separating debris starts from. */
  private separationState() {
    return {
      drawnPosition: this.group.position,
      prevPosition: this.prevPosition,
      position: this.missile.position,
      velocity: this.missile.velocity,
    };
  }

  /**
   * Advance the debris one physics step. Call right after each missile
   * physics step, so debris and missile stay on the same timeline.
   * @param dt Simulation seconds of the step.
   */
  stepDebris(dt: number) {
    this.simTime += dt;
    if (this.debris.length === 0) return;
    this.debris.forEach((d) => d.step(dt));
    this.debris = this.debris.filter((d) => !d.finished);
  }

  /** Draw the debris interpolated like the missile. */
  private renderDebris() {
    this.debris.forEach((d) => d.render(this.lerpAlpha));
  }

  private applyActiveStage() {
    const i = this.activeStageIndex;
    this.stageGroups.forEach((g, k) => (g.visible = k >= i));

    const stage = this.dimensions.stages[i];
    // All stages gone: no engine left (the warhead flies unpowered)
    this.fireGroup.visible = !!stage;
    if (!stage) return;

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
    const noseHeatTexture = getNoseHeatTexture();
    const coneMaterial = new THREE.MeshStandardMaterial({
      color: noseTexture ? 0xffffff : 0xe6e6e1,
      map: noseTexture,
      metalness: 0.25,
      roughness: 0.55,
      // Aerodynamic heating glow; intensity driven in updateAeroHeating()
      emissive: PLASMA_COLOR,
      emissiveMap: noseHeatTexture,
      emissiveIntensity: 0,
      // Inside of the clamshell halves shows once they open
      side: THREE.DoubleSide,
    });
    this.noseMaterial = coneMaterial;

    // Two clamshell halves (local +X / -X sides). Each half's origin is its
    // hinge on the base rim, so it peels outwards when jettisoned.
    const noseProfile = createNoseProfile(head.radius, head.height);
    this.shroudGroup = new THREE.Group();
    this.shroudGroup.name = 'nose';
    this.shroudGroup.position.y = bodyHeight; // base sits on top of the body
    this.shroudHalves = [0, 1].map((h) => {
      // LatheGeometry: x = r·sin(phi) -> phi in [0, π] is the +X half
      const side = h === 0 ? 1 : -1;
      const halfMesh = new THREE.Mesh(
        new THREE.LatheGeometry(noseProfile, 16, h * Math.PI, Math.PI),
        coneMaterial
      );
      halfMesh.position.x = -side * head.radius;

      const half = new THREE.Group();
      half.name = `shroud-half-${h + 1}`;
      half.position.x = side * head.radius;
      half.add(halfMesh);
      this.shroudGroup!.add(half);
      return half;
    });
    this.group.add(this.shroudGroup);

    // Re-entry vehicle hidden under the shroud, on top of the last stage
    this.warhead = new Warhead(Warhead.fitShroud(head), bodyHeight);
    this.group.add(this.warhead.object);

    // ------------------------------------------------------------------------
    // === Aerodynamic heating: plasma sheath + wake around the nose ===
    const plasmaShellTexture = getPlasmaShellTexture();
    const plasmaMaterial = (color: THREE.Color) =>
      new THREE.MeshBasicMaterial({
        color,
        map: plasmaShellTexture,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

    // Bow shock: much wider than the nose and standing off ahead of the tip
    const plasmaShellMesh = new THREE.Mesh(
      new THREE.LatheGeometry(
        createNoseProfile(
          head.radius * BOW_SHOCK_RADIUS_SCALE,
          head.height * BOW_SHOCK_HEIGHT_SCALE
        ),
        32
      ),
      plasmaMaterial(SHOCK_COLOR)
    );
    plasmaShellMesh.name = 'plasma-shell';
    plasmaShellMesh.position.y = bodyHeight - head.height * 0.3;
    plasmaShellMesh.visible = false;
    this.plasmaShellMesh = plasmaShellMesh;
    this.group.add(plasmaShellMesh);

    // White-hot shock layer hugging the nose
    const plasmaCoreMesh = new THREE.Mesh(
      new THREE.LatheGeometry(
        createNoseProfile(head.radius * 1.35, head.height * 1.18),
        32
      ),
      plasmaMaterial(PLASMA_CORE_COLOR)
    );
    plasmaCoreMesh.name = 'plasma-core';
    plasmaCoreMesh.position.y = bodyHeight - head.height * 0.05;
    plasmaCoreMesh.visible = false;
    this.plasmaCoreMesh = plasmaCoreMesh;
    this.group.add(plasmaCoreMesh);

    // Halo around the stagnation point (reads as bloom from far away)
    const plasmaHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        color: PLASMA_COLOR,
        map: getPlasmaHaloTexture(),
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    plasmaHalo.name = 'plasma-halo';
    plasmaHalo.position.y = bodyHeight + head.height * 1.1;
    plasmaHalo.visible = false;
    this.plasmaHalo = plasmaHalo;
    this.group.add(plasmaHalo);

    // Open cone widening backwards from the bow shock, several bodies long
    const wakeHeight = bodyHeight * PLASMA_WAKE_LENGTH_SCALE;
    this.plasmaWakeHeight = wakeHeight;
    const plasmaWakeMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(
        head.radius * BOW_SHOCK_RADIUS_SCALE * 0.9,
        head.radius * BOW_SHOCK_RADIUS_SCALE * 3,
        wakeHeight,
        32,
        1,
        true
      ),
      new THREE.MeshBasicMaterial({
        color: SHOCK_COLOR,
        map: getPlasmaWakeTexture(),
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    plasmaWakeMesh.name = 'plasma-wake';
    this.plasmaWakeTopY = bodyHeight;
    plasmaWakeMesh.position.y = this.plasmaWakeTopY - wakeHeight / 2;
    plasmaWakeMesh.visible = false;
    this.plasmaWakeMesh = plasmaWakeMesh;
    this.group.add(plasmaWakeMesh);

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
    // === Exhaust plume (hangs from the nozzle exit, gimbals with it) ===
    // Every plume layer's geometry starts at y = 0 and hangs downwards, so
    // scaling it keeps the top attached to the nozzle exit.
    const flameMaterial = (
      map: THREE.Texture | null,
      fallbackColor: number,
      opacity: number
    ) =>
      new THREE.MeshBasicMaterial({
        color: map ? 0xffffff : fallbackColor,
        map,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

    // Main flame: contracts slightly after the exit (ambient pressure
    // squeezes it), swells into a column, then tapers into a ragged tail
    const columnRadius = fire.bottomRadius * 0.72;
    const burningFireMesh = new THREE.Mesh(
      new THREE.LatheGeometry(
        createPlumeProfile(fire.height, (t) => {
          const neck = 1 - 0.12 * Math.sin(Math.PI * Math.min(t / 0.12, 1));
          const swell =
            exitRadius + (columnRadius - exitRadius) * smoothstep(0.06, 0.45, t);
          const taper = 1 - 0.75 * Math.pow(smoothstep(0.5, 1, t), 1.4);
          return swell * neck * taper;
        }),
        32
      ),
      flameMaterial(getFireTexture(), 0xffa500, 0.95)
    );
    burningFireMesh.name = 'flame';
    burningFireMesh.position.y = -nozzleHeight;
    this.burningFireMesh = burningFireMesh;
    this.nozzleGimbal.add(burningFireMesh);

    // White-hot core with Mach diamonds, inside the main flame
    const flameCoreMesh = new THREE.Mesh(
      new THREE.LatheGeometry(
        createPlumeProfile(
          fire.height * 0.38,
          (t) => exitRadius * 0.8 * Math.pow(1 - t, 0.55)
        ),
        24
      ),
      flameMaterial(getFlameCoreTexture(), 0xfff4d0, 0.9)
    );
    flameCoreMesh.name = 'flame-core';
    flameCoreMesh.position.y = -nozzleHeight;
    this.flameCoreMesh = flameCoreMesh;
    this.nozzleGimbal.add(flameCoreMesh);

    // High-altitude bell: flares out right after the exit, many times wider
    // than the missile, closing slightly at the end
    const bellRadius = fire.bottomRadius * 3.5;
    const vacuumPlumeMesh = new THREE.Mesh(
      new THREE.LatheGeometry(
        createPlumeProfile(fire.height * 1.4, (t) => {
          const flare = 1 - Math.pow(1 - t, 3);
          const close = 1 - 0.35 * smoothstep(0.75, 1, t);
          return (exitRadius + (bellRadius - exitRadius) * flare) * close;
        }),
        32
      ),
      flameMaterial(getVacuumPlumeTexture(), 0xffc8a0, 0)
    );
    vacuumPlumeMesh.name = 'vacuum-plume';
    vacuumPlumeMesh.position.y = -nozzleHeight;
    vacuumPlumeMesh.visible = false;
    this.vacuumPlumeMesh = vacuumPlumeMesh;
    this.nozzleGimbal.add(vacuumPlumeMesh);

    // Glare around the nozzle exit
    const flameGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        color: 0xffb060,
        map: getPlasmaHaloTexture(),
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    flameGlow.name = 'flame-glow';
    flameGlow.position.y = -nozzleHeight - fire.height * 0.08;
    flameGlow.visible = false;
    this.flameGlow = flameGlow;
    this.nozzleGimbal.add(flameGlow);

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
        .add(this.missile.gravityForce)
        .add(this.missile.dragForce),
      thrust: this.missile.thrust,
      gravity: this.missile.gravityForce,
      drag: this.missile.dragForce,
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
    const gravity = this.getGravity();
    const drag = this.getDrag();
    // Total acceleration acting on the missile (thrust is already per unit mass)
    const acceleration = thrust.clone().add(gravity).add(drag);
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
      'drag',
      this.group.position,
      drag.clone().normalize(),
      drag.length(),
      MissileView.formatAcceleration(drag.length())
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

  update(): void {
    this.updatePosition();
    this.renderDebris();
    this.updateBurningFireScale();
    this.updateAeroHeating();

    this.updateArrows();

    this.alignRotation();
    this.updateNozzleGimbal();
    this.updateExhaustSmoke();

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
      this.explosionEffect.start(
        this.missile.position.clone(),
        normal,
        this.renderSimTime,
        this.explosionOptions
      );
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
      this.explosionEffect.update(this.renderSimTime);
    }
  }

  /** Current burn rate as a fraction of `maxBurnRate` (0..1). */
  private get burnRatio() {
    const rate = this.missile.massFlowRate;
    const max = this.maxBurnRate ?? rate;
    if (!(max > 0)) return 0;
    return THREE.MathUtils.clamp(rate / max, 0, 1);
  }

  /** Burn ratio of the current frame (0 when the engine is off). */
  private currentBurnRatio = 0;

  /**
   * Exhaust plume driven by burn rate and ambient pressure. Near the
   * ground the exhaust is a tight, bright column with Mach diamonds; as the
   * air thins it grows longer and fainter and balloons into a wide bell.
   */
  private updateBurningFireScale() {
    if (!this.burningFireMesh) return;

    // Hide the exhaust flame once all fuel is burnt (or the missile landed)
    const burning = !this.missile.isEngineCutoff && !this.missile.hasLanded;
    const ratio = burning ? this.burnRatio : 0;
    this.currentBurnRatio = ratio;
    const on = ratio > 0;

    // Nozzle glows while firing and cools down after cutoff
    if (this.nozzleMaterial) {
      const glow = this.nozzleMaterial.emissiveIntensity;
      this.nozzleMaterial.emissiveIntensity = on
        ? 0.4 + 0.6 * ratio
        : glow * 0.97;
    }

    // Visual density ignores the "atmospheric drag" toggle on purpose
    const target = plumeExpansion(Earth.airDensity(this.missile.altitude));
    this.plumeExpansion += (target - this.plumeExpansion) * 0.1;
    const e = this.plumeExpansion;

    this.burningFireMesh.visible = on;
    if (this.flameCoreMesh) this.flameCoreMesh.visible = on;
    if (this.flameGlow) this.flameGlow.visible = on;
    if (this.vacuumPlumeMesh) this.vacuumPlumeMesh.visible = on && e > 0.02;
    if (!on) return;

    const jitter = (amount: number) => 1 + (Math.random() - 0.5) * amount;
    const flicker = jitter(0.1);

    // Main flame: 100% size at the max burn rate; grows longer and slightly
    // wider but dimmer as the ambient pressure drops
    const mainMaterial = this.burningFireMesh.material as THREE.MeshBasicMaterial;
    const length = ratio * (1 + 0.7 * e) * flicker;
    const width = ratio * (1 + 0.35 * e) * jitter(0.05);
    this.burningFireMesh.scale.set(width, length, width);
    this.burningFireMesh.rotation.y = Math.random() * Math.PI * 2;
    mainMaterial.opacity = 0.95 * (1 - 0.5 * e) * jitter(0.08);
    // Shift the turbulent streaks around the flame every frame
    if (mainMaterial.map) mainMaterial.map.offset.x = Math.random();

    // Core: Mach diamonds are sharp in dense air, spread out and fade higher up
    if (this.flameCoreMesh) {
      const core = this.flameCoreMesh;
      const coreLength = ratio * (1 + 1.2 * e) * jitter(0.04);
      core.scale.set(ratio, coreLength, ratio);
      (core.material as THREE.MeshBasicMaterial).opacity =
        0.9 * (1 - 0.75 * e) * jitter(0.06);
    }

    // High-altitude bell fades in as the plume expands
    if (this.vacuumPlumeMesh) {
      const bell = this.vacuumPlumeMesh;
      const spread = ratio * (0.3 + 0.7 * e);
      bell.scale.set(spread, ratio * (0.4 + 0.6 * e) * flicker, spread);
      bell.rotation.y = Math.random() * Math.PI * 2;
      (bell.material as THREE.MeshBasicMaterial).opacity =
        0.5 * Math.pow(e, 1.3) * jitter(0.1);
    }

    // Nozzle glare: big and hot in dense air (lit exhaust and smoke),
    // dimmer but wider in thin air
    if (this.flameGlow) {
      const size =
        this.dimensions.fire.bottomRadius * (6 + 4 * e) * ratio * flicker;
      this.flameGlow.scale.set(size, size, 1);
      (this.flameGlow.material as THREE.SpriteMaterial).opacity =
        (0.85 - 0.35 * e) * ratio * jitter(0.15);
    }
  }

  /** Air density ratio (expansion) above which no smoke trail is left. */
  private static SMOKE_FADE: [number, number] = [0.3, 0.7];

  /**
   * Leave a smoke column behind the nozzle while burning in the lower
   * atmosphere (solid motors leave thick white trails; in thin air the
   * exhaust disperses into nothing visible).
   */
  private updateExhaustSmoke() {
    const smoke = this.exhaustSmoke;
    if (!smoke) return;
    const time = this.renderSimTime;
    smoke.update(time);

    const ratio = this.currentBurnRatio;
    const stage = this.dimensions.stages[this.activeStageIndex];
    if (ratio <= 0 || !stage || !this.fireGroup.visible) {
      smoke.cut();
      return;
    }

    const e = this.plumeExpansion;
    const [fadeStart, fadeEnd] = MissileView.SMOKE_FADE;
    // Thickest right after liftoff: dense air keeps the exhaust from
    // dispersing, so the low part of the column is opaque and wide
    const groundBoost = 1 + 1.2 * (1 - smoothstep(0, 0.25, e));
    const strength =
      (1 - smoothstep(fadeStart, fadeEnd, e)) *
      Math.min(1, ratio * 1.5) *
      groundBoost;

    // Spawn just behind the bright part of the flame
    const k = this.fireGroup.scale.x;
    const fire = this.dimensions.fire;
    const offset =
      this.fireGroup.position.y -
      (this.nozzleHeight + fire.height * 0.3 * ratio) * k;
    this.nozzleWorld
      .set(0, offset, 0)
      .applyQuaternion(this.group.quaternion)
      .add(this.group.position);

    smoke.emit(this.nozzleWorld, time, {
      size:
        fire.bottomRadius * k * (0.9 + 1.5 * e) * (1 + 0.5 * (groundBoost - 1)),
      // Puffs swell more in thinner air
      growth: 3 + 8 * e,
      strength,
      // Near the ground, keep billowing even while the missile is still slow
      interval: e < 0.25 ? 0.12 : undefined,
    });
  }

  /**
   * Strength (0..1) of the aerodynamic heating effect at the nose, from the
   * Sutton–Graves stagnation-point heat flux q = k·√(ρ/Rn)·v³. It grows with
   * air density and steeply with speed: barely visible at max-Q on ascent,
   * strongest during re-entry. Mapped logarithmically between
   * HEAT_FLUX_VISIBLE and HEAT_FLUX_FULL.
   * @param density Air density. Unit: kg/m³
   * @param speed Unit: m/s
   */
  static aeroHeatingIntensity(density: number, speed: number) {
    if (!(density > 0) || !(speed > 0)) return 0;
    const heatFlux =
      SUTTON_GRAVES_K * Math.sqrt(density / REAL_NOSE_RADIUS_M) * speed ** 3;
    if (heatFlux <= HEAT_FLUX_VISIBLE) return 0;
    return THREE.MathUtils.clamp(
      Math.log(heatFlux / HEAT_FLUX_VISIBLE) /
        Math.log(HEAT_FLUX_FULL / HEAT_FLUX_VISIBLE),
      0,
      1
    );
  }

  /** Nose glow, plasma sheath and wake driven by aerodynamic heating. */
  private updateAeroHeating() {
    const target = this.missile.hasLanded
      ? 0
      : MissileView.aeroHeatingIntensity(
          this.missile.airDensity,
          this.getVelocity().length()
        );

    // Heats up quickly, cools down slowly
    const rate = target > this.heatingIntensity ? 0.15 : 0.03;
    this.heatingIntensity += (target - this.heatingIntensity) * rate;
    if (this.heatingIntensity < 1e-3) this.heatingIntensity = 0;

    const i = this.heatingIntensity;
    const flicker = 1 + (Math.random() - 0.5) * 0.15;
    // Faint bluish shock layer at low heating, orange plasma at high
    this.heatColor.copy(SHOCK_COLOR).lerp(PLASMA_COLOR, Math.min(1, i * 1.4));

    if (this.noseMaterial) {
      this.noseMaterial.emissiveIntensity = 3 * i * i;
    }
    if (this.warhead?.deployed) this.warhead.setHeating(i);

    const shell = this.plasmaShellMesh;
    if (shell) {
      shell.visible = i > 0;
      const material = shell.material as THREE.MeshBasicMaterial;
      material.color.copy(this.heatColor);
      material.opacity = Math.min(1, 0.75 * i * flicker);
      // The bow shock widens as heating grows (starts close to the nose)
      const s = 0.6 + 0.4 * i;
      shell.scale.set(s, 0.8 + 0.2 * i, s);
    }

    const core = this.plasmaCoreMesh;
    if (core) {
      // White-hot layer only appears under strong heating
      const c = THREE.MathUtils.clamp((i - 0.35) / 0.65, 0, 1);
      core.visible = c > 0;
      const material = core.material as THREE.MeshBasicMaterial;
      material.opacity = Math.min(1, c * flicker);
    }

    const halo = this.plasmaHalo;
    if (halo) {
      halo.visible = i > 0;
      const material = halo.material as THREE.SpriteMaterial;
      material.color.copy(this.heatColor);
      material.opacity = Math.min(1, i * flicker);
      const size =
        this.dimensions.head.radius * PLASMA_HALO_SIZE_SCALE * i * flicker;
      halo.scale.set(size, size, 1);
    }

    const wake = this.plasmaWakeMesh;
    if (wake) {
      // The wake only forms once heating is significant
      const w = THREE.MathUtils.clamp((i - 0.15) / 0.85, 0, 1);
      wake.visible = w > 0;
      const material = wake.material as THREE.MeshBasicMaterial;
      material.color.copy(this.heatColor);
      material.opacity = 0.85 * w * flicker;
      // Grows backwards from the nose; the top stays anchored
      const length = (0.15 + 0.85 * w * w) * flicker;
      const width = 0.6 + 0.6 * w;
      wake.scale.set(width, length, width);
      wake.position.y =
        this.plasmaWakeTopY - (this.plasmaWakeHeight * length) / 2;
    }
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

  private getGravity() {
    return new THREE.Vector3().lerpVectors(
      this.prevGravity,
      this.missile.gravityForce,
      this.lerpAlpha
    );
  }

  private getDrag() {
    return new THREE.Vector3().lerpVectors(
      this.prevDrag,
      this.missile.dragForce,
      this.lerpAlpha
    );
  }

  updatePrevFromMissile() {
    this.prevPosition.copy(this.missile.position);
    this.prevVelocity.copy(this.missile.velocity);
    this.prevThrust.copy(this.missile.thrust);
    this.prevGravity.copy(this.missile.gravityForce);
    this.prevDrag.copy(this.missile.dragForce);
    this.debris.forEach((d) => d.savePrevious());
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
    // Sprites are not Meshes; their geometry is shared, only the material is ours
    this.plasmaHalo?.material.dispose();
    this.plasmaHalo = null;
    this.flameGlow?.material.dispose();
    this.flameGlow = null;
    this.flameCoreMesh = null;
    this.vacuumPlumeMesh = null;
    this.exhaustSmoke?.remove();
    this.exhaustSmoke = null;
    // Shroud halves share one material; the traversal above disposed it
    this.shroudGroup = null;
    this.shroudHalves = [];
    this.noseMaterial = null;
    this.warhead = null;

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
