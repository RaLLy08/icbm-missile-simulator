import * as THREE from 'three';
import { getCanvasTexture } from './canvasTexture';
import { getSmokePuffTexture } from './ExhaustSmoke';

const KM = 1000;

export type NuclearExplosionOptions = {
  /** Explosive yield. Unit: kilotons of TNT. Default 1000 (1 Mt). */
  yieldKt?: number;
  /**
   * Height of burst above the ground. 0 = surface burst (ground-hugging
   * fireball, heavy dust stem and base surge); an air burst well above the
   * fireball radius lifts no dust. Unit: m (real, not exaggerated)
   */
  burstHeight?: number;
  /** Extra size multiplier on top of the built-in exaggeration. Default 1. */
  visualScale?: number;
  /**
   * Whole effect length, until the cloud has dispersed. Default ≈ 25 min
   * at 1 Mt, slightly longer for bigger yields. Unit: s (simulation time)
   */
  durationS?: number;
};

/** Yield the built-in visual sizes below are tuned for. Unit: kt */
const REFERENCE_YIELD_KT = 1000;

// Sizes at the reference yield. They are exaggerated (like the missile
// model) so the blast reads from orbit. Other yields are scaled by the real
// scaling laws below, so proportions between yields stay realistic. Unit: m
/** Final height of the mushroom cap's center above ground. */
const CLOUD_HEIGHT = 55 * KM;
/** Final major radius of the toroidal cap. */
const CAP_RADIUS = 28 * KM;
const FIREBALL_RADIUS = 10 * KM;
/** Final radius of the ground shock / dust front. */
const SHOCK_RADIUS = 220 * KM;
/** Diameter of the initial flash. */
const FLASH_SIZE = 420 * KM;

const MINUTE = 60;
/** Cloud fully dispersed at the reference yield. Unit: s */
const BASE_DURATION_S = 25 * MINUTE;
/** Dispersal starts at this fraction of the duration. */
const FADE_START_FRACTION = 0.5;

/**
 * Real event timings (1 Mt surface burst, Glasstone & Dolan), all in
 * simulation seconds:
 * - thermal pulse peaks at t_max ≈ 0.0417 s · W^0.44 (≈ 0.9 s at 1 Mt);
 *   the fireball stays luminous for ~10–30 t_max
 * - the shock front reaches ~20 km in about a minute
 * - the cloud rises a few km per minute and stabilizes after ~10 min
 * - the cap keeps spreading for many minutes, then drifts and disperses
 */
export const nuclearTimeline = (kt: number) => {
  const tMax = 0.0417 * Math.pow(kt, 0.44);
  const r = kt / REFERENCE_YIELD_KT;
  return {
    /** Thermal pulse maximum. */
    tMax,
    /** Fireball cooling: white -> yellow -> orange -> dull red -> dark. */
    cooling: tMax / 0.87,
    /** Cloud rise time constant (≈ 86% of final height after 2τ). */
    rise: 120 * Math.pow(r, 0.1),
    /** Cap widening time constant. */
    spread: 200 * Math.pow(r, 0.1),
    /** Shock front time constant. */
    shock: 25 * Math.cbrt(r),
    /** How long the cloud stays lit from inside by the fireball. */
    innerGlow: 35 * tMax,
  };
};

/**
 * Real-world scaling with yield W (kt), after Glasstone & Dolan:
 * - max fireball radius ≈ 70 m · W^0.4
 * - blast overpressure radii ∝ W^(1/3) (cube-root scaling)
 * - stabilized cloud height ≈ 4.4 km · W^0.24 (≈ 7.6 km at 10 kt,
 *   23 km at 1 Mt, 40 km at 10 Mt); cap width grows a bit faster
 */
export const nuclearScaling = {
  fireballRadius: (kt: number) => 70 * Math.pow(kt, 0.4),
  shockRadius: (kt: number) => Math.cbrt(kt),
  cloudHeight: (kt: number) => 4400 * Math.pow(kt, 0.24),
  capRadius: (kt: number) => Math.pow(kt, 0.3),
  /** Bigger clouds take longer to rise and linger. */
  duration: (kt: number) => Math.pow(kt, 0.12),
};

/**
 * Yield delivered per kg of throw-weight (payload). The payload is more
 * than the bomb: re-entry vehicles, heat shields, the post-boost bus and
 * decoys. Real ICBMs carry roughly 0.6–0.9 kt per kg of throw-weight:
 * - Minuteman III: 1150 kg, 3 × 335 kt ≈ 1 Mt  (0.87 kt/kg)
 * - Topol-M: 1200 kg, 1 × 800 kt             (0.67 kt/kg)
 * - R-36M2 Voevoda: 8800 kg, 10 × 750 kt     (0.85 kt/kg)
 * Unit: kt/kg
 */
export const YIELD_PER_PAYLOAD_KG = 0.75;

/**
 * Estimated total yield of a missile's warheads from its payload mass.
 * @param payloadMass Throw-weight. Unit: kg
 * @returns Unit: kt
 */
export function estimateYieldKt(payloadMass: number) {
  return payloadMass * YIELD_PER_PAYLOAD_KG;
}

/** Effect length for the given options. Unit: s (simulation time) */
export function nuclearExplosionDuration(options: NuclearExplosionOptions = {}) {
  if (options.durationS && options.durationS > 0) return options.durationS;
  const kt = Math.max(0.001, options.yieldKt ?? REFERENCE_YIELD_KT);
  return (
    BASE_DURATION_S *
    (nuclearScaling.duration(kt) / nuclearScaling.duration(REFERENCE_YIELD_KT))
  );
}

const CAP_PARTICLES = 650;
const DOME_PARTICLES = 220;
const STEM_PARTICLES = 280;
const SKIRT_PARTICLES = 320;

enum Kind {
  Cap,
  Dome,
  Stem,
  Skirt,
}

const smoothstep = (edge0: number, edge1: number, x: number) =>
  THREE.MathUtils.smoothstep(x, edge0, edge1);

/** Blotchy, turbulent fireball surface. */
const getFireballTexture = () =>
  getCanvasTexture('fireball', 256, 128, (ctx, w, h) => {
    ctx.fillStyle = 'rgb(200, 200, 200)';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 220; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = 4 + Math.random() * 18;
      const bright = Math.random() < 0.5;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(
        0,
        bright ? 'rgba(255, 255, 255, 0.7)' : 'rgba(60, 60, 60, 0.45)'
      );
      g.addColorStop(1, 'rgba(128, 128, 128, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
  });

/** Soft round glow. */
const getGlowTexture = () =>
  getCanvasTexture('nuke-glow', 128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255, 255, 255, 1)');
    g.addColorStop(0.12, 'rgba(255, 255, 255, 0.85)');
    g.addColorStop(0.35, 'rgba(255, 255, 255, 0.25)');
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });

/** Ground shock front: bright thin edge with a faint dusty interior. */
const getShockRingTexture = () =>
  getCanvasTexture('nuke-shock-ring', 256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255, 255, 255, 0.0)');
    g.addColorStop(0.6, 'rgba(255, 255, 255, 0.08)');
    g.addColorStop(0.86, 'rgba(255, 255, 255, 0.35)');
    g.addColorStop(0.95, 'rgba(255, 255, 255, 1)');
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });

const cloudVertexShader = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>

  attribute vec3 aCenter;
  attribute float aSize;
  attribute float aAlpha;
  attribute float aHeat;
  attribute float aShade;
  attribute float aSeed;

  varying vec2 vUv;
  varying float vAlpha;
  varying float vHeat;
  varying float vShade;

  void main() {
    vUv = uv;
    vAlpha = aAlpha;
    vHeat = aHeat;
    vShade = aShade;
    if (aAlpha <= 0.0) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      #include <logdepthbuf_vertex>
      return;
    }
    float c = cos(aSeed * 6.2831853);
    float s = sin(aSeed * 6.2831853);
    vec4 mvPosition = modelViewMatrix * vec4(aCenter, 1.0);
    mvPosition.xy += mat2(c, s, -s, c) * position.xy * aSize;
    gl_Position = projectionMatrix * mvPosition;
    #include <logdepthbuf_vertex>
  }
`;

const cloudFragmentShader = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>

  uniform sampler2D uMap;
  uniform vec3 uSmokeColor;
  uniform vec3 uDustColor;
  uniform vec3 uFireColor;

  varying vec2 vUv;
  varying float vAlpha;
  varying float vHeat;
  varying float vShade;

  void main() {
    #include <logdepthbuf_fragment>
    float a = texture2D(uMap, vUv).a * vAlpha;
    if (a < 0.003) discard;
    // Shade < 0.65 marks dust (browner), above it the cloud is lighter
    vec3 smoke = mix(uDustColor, uSmokeColor, smoothstep(0.5, 0.8, vShade)) * vShade;
    float heat = clamp(vHeat, 0.0, 1.0);
    // Fire-lit gas glows: brighter than the smoke and more opaque
    vec3 color = mix(smoke, uFireColor * (1.0 + 1.5 * heat), heat);
    gl_FragColor = vec4(color, min(a * (1.0 + heat), 0.97));
    #include <colorspace_fragment>
  }
`;

/**
 * Temperature color of the fireball (white -> dull red -> dark), at 1 Mt.
 * Unit: s (scaled by `nuclearTimeline().cooling` for other yields)
 */
const FIREBALL_COLORS: [number, THREE.Color][] = [
  [0, new THREE.Color(1, 1, 1)],
  [1, new THREE.Color(1, 0.95, 0.75)],
  [3, new THREE.Color(1, 0.72, 0.3)],
  [10, new THREE.Color(1, 0.42, 0.1)],
  [25, new THREE.Color(0.55, 0.12, 0.03)],
  [60, new THREE.Color(0.15, 0.03, 0.01)],
];

function fireballColor(t: number, target: THREE.Color) {
  for (let i = 1; i < FIREBALL_COLORS.length; i++) {
    const [t1, c1] = FIREBALL_COLORS[i];
    if (t <= t1) {
      const [t0, c0] = FIREBALL_COLORS[i - 1];
      return target.copy(c0).lerp(c1, (t - t0) / (t1 - t0));
    }
  }
  return target.copy(FIREBALL_COLORS[FIREBALL_COLORS.length - 1][1]);
}

/**
 * Surface nuclear detonation: blinding flash, hemispherical fireball that
 * cools from white to dull red while it rises, a condensation (Wilson)
 * dome, a ground shock front with a dust base surge, and a mushroom cloud
 * whose toroidal cap rolls over a rising stem, lit from inside by the
 * fireball before it dissipates.
 *
 * Local frame: +Y is the surface normal at ground zero.
 */
export default class NuclearExplosion {
  private readonly group = new THREE.Group();
  private readonly flash: THREE.Sprite;
  private readonly glow: THREE.Sprite;
  private readonly fireball: THREE.Mesh;
  private readonly wilsonDome: THREE.Mesh;
  private readonly shockRing: THREE.Mesh;
  private readonly cloud: THREE.Mesh;
  private readonly cloudGeometry = new THREE.InstancedBufferGeometry();
  private readonly cloudMaterial: THREE.ShaderMaterial;

  private readonly count =
    CAP_PARTICLES + DOME_PARTICLES + STEM_PARTICLES + SKIRT_PARTICLES;
  private readonly kind: Kind[] = [];
  /** Per-particle random parameters. */
  private readonly ra: Float32Array;
  private readonly rb: Float32Array;
  private readonly rc: Float32Array;
  private readonly rSize: Float32Array;

  private readonly center: Float32Array;
  private readonly size: Float32Array;
  private readonly alpha: Float32Array;
  private readonly heat: Float32Array;
  private readonly shade: Float32Array;
  private readonly attrs: THREE.InstancedBufferAttribute[] = [];

  // Visual sizes for this explosion. Unit: m
  private readonly cloudHeight: number;
  private readonly capRadiusMax: number;
  private readonly fireballRadius: number;
  private readonly shockRadius: number;
  private readonly flashSize: number;
  /** Burst height in the exaggerated visual scale. Unit: m */
  private readonly burstY: number;
  /** 1 = surface burst (fireball touches the ground), 0 = high air burst. */
  private readonly groundContact: number;
  /** Shock front reaches the ground this late. Unit: s */
  private readonly shockDelay: number;
  /** Event time constants for this yield. Unit: s */
  private readonly timeline: ReturnType<typeof nuclearTimeline>;
  /** Whole effect length. Unit: s (simulation time) */
  readonly durationS: number;

  constructor(
    private readonly scene: THREE.Scene,
    options: NuclearExplosionOptions = {}
  ) {
    const kt = Math.max(0.001, options.yieldKt ?? REFERENCE_YIELD_KT);
    const ref = REFERENCE_YIELD_KT;
    const k = Math.max(0.01, options.visualScale ?? 1);
    const s = nuclearScaling;
    this.fireballRadius =
      FIREBALL_RADIUS * (s.fireballRadius(kt) / s.fireballRadius(ref)) * k;
    this.shockRadius =
      SHOCK_RADIUS * (s.shockRadius(kt) / s.shockRadius(ref)) * k;
    this.cloudHeight =
      CLOUD_HEIGHT * (s.cloudHeight(kt) / s.cloudHeight(ref)) * k;
    this.capRadiusMax = CAP_RADIUS * (s.capRadius(kt) / s.capRadius(ref)) * k;
    this.flashSize = FLASH_SIZE * (s.fireballRadius(kt) / s.fireballRadius(ref)) * k;

    // Burst height relative to the real fireball, kept in the visual scale
    const realFireball = s.fireballRadius(kt);
    const burstHeight = Math.max(0, options.burstHeight ?? 0);
    const hob = burstHeight / realFireball;
    this.burstY = hob * this.fireballRadius;
    this.groundContact = 1 - smoothstep(0.6, 2.5, hob);
    // The blast wave travels down from the burst point (~1 km/s early on)
    this.shockDelay = Math.min(10, burstHeight / 1000);

    this.timeline = nuclearTimeline(kt);
    this.durationS = nuclearExplosionDuration(options);

    const additive = (
      map: THREE.Texture | null,
      color: number
    ): THREE.SpriteMaterial =>
      new THREE.SpriteMaterial({
        map,
        color,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

    // --- Flash and glow
    this.flash = new THREE.Sprite(additive(getGlowTexture(), 0xeef4ff));
    this.flash.renderOrder = 4;
    this.glow = new THREE.Sprite(additive(getGlowTexture(), 0xff9a40));
    this.glow.renderOrder = 3;

    // --- Fireball
    const fireballMap = getFireballTexture();
    this.fireball = new THREE.Mesh(
      new THREE.SphereGeometry(1, 48, 24),
      new THREE.MeshBasicMaterial({
        map: fireballMap,
        color: 0xffffff,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.fireball.renderOrder = 2;

    // --- Condensation dome (brief white shell riding the shock wave)
    this.wilsonDome = new THREE.Mesh(
      new THREE.SphereGeometry(1, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: 0xf4f6f8,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    this.wilsonDome.renderOrder = 1;

    // --- Ground shock front (lies flat on the surface)
    this.shockRing = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial({
        map: getShockRingTexture(),
        color: 0xf2ece4,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    this.shockRing.rotation.x = -Math.PI / 2;
    this.shockRing.position.y = 200; // avoid z-fighting with the ground

    // --- Mushroom cloud particles
    const n = this.count;
    this.ra = new Float32Array(n);
    this.rb = new Float32Array(n);
    this.rc = new Float32Array(n);
    this.rSize = new Float32Array(n);
    this.center = new Float32Array(n * 3);
    this.size = new Float32Array(n);
    this.alpha = new Float32Array(n);
    this.heat = new Float32Array(n);
    this.shade = new Float32Array(n);
    const seed = new Float32Array(n);

    const kinds: [Kind, number][] = [
      [Kind.Cap, CAP_PARTICLES],
      [Kind.Dome, DOME_PARTICLES],
      [Kind.Stem, STEM_PARTICLES],
      [Kind.Skirt, SKIRT_PARTICLES],
    ];
    kinds.forEach(([kind, k]) => {
      for (let i = 0; i < k; i++) this.kind.push(kind);
    });
    for (let i = 0; i < n; i++) {
      this.ra[i] = Math.random();
      this.rb[i] = Math.random();
      this.rc[i] = Math.random();
      this.rSize[i] = 0.7 + Math.random() * 0.6;
      seed[i] = Math.random();
    }

    const quad = new THREE.PlaneGeometry(1, 1);
    this.cloudGeometry.index = quad.index;
    this.cloudGeometry.setAttribute('position', quad.getAttribute('position'));
    this.cloudGeometry.setAttribute('uv', quad.getAttribute('uv'));
    const add = (name: string, array: Float32Array, itemSize: number) => {
      const attr = new THREE.InstancedBufferAttribute(array, itemSize);
      attr.setUsage(THREE.DynamicDrawUsage);
      this.cloudGeometry.setAttribute(name, attr);
      return attr;
    };
    this.attrs.push(
      add('aCenter', this.center, 3),
      add('aSize', this.size, 1),
      add('aAlpha', this.alpha, 1),
      add('aHeat', this.heat, 1),
      add('aShade', this.shade, 1)
    );
    add('aSeed', seed, 1);
    this.cloudGeometry.instanceCount = n;

    const smokeMap = getSmokePuffTexture();
    this.cloudMaterial = new THREE.ShaderMaterial({
      vertexShader: cloudVertexShader,
      fragmentShader: cloudFragmentShader,
      uniforms: {
        uMap: { value: smokeMap },
        uSmokeColor: { value: new THREE.Color(0xe6ded4) },
        uDustColor: { value: new THREE.Color(0xa08a72) },
        uFireColor: { value: new THREE.Color(0xff6a1c) },
      },
      transparent: true,
      depthWrite: false,
    });
    this.cloud = new THREE.Mesh(this.cloudGeometry, this.cloudMaterial);
    this.cloud.frustumCulled = false;
    this.cloud.renderOrder = 1;
    // No canvas outside the browser (tests)
    this.cloud.visible = !!smokeMap;

    this.group.add(
      this.shockRing,
      this.wilsonDome,
      this.cloud,
      this.fireball,
      this.glow,
      this.flash
    );
    this.group.name = 'nuclear-explosion';
    this.group.visible = false;
  }

  start(position: THREE.Vector3, normal: THREE.Vector3) {
    this.group.position.copy(position);
    this.group.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      normal.clone().normalize()
    );
    this.group.visible = true;
    this.scene.add(this.group);
    this.update(0, 0);
  }

  /**
   * @param t Seconds since detonation (simulation time): drives the
   *   physical timeline, so the time multiplier speeds it up and pause
   *   freezes it.
   * @param realT Seconds since detonation (real time). Only the split-second
   *   events (flash, condensation dome) use min(t, realT), so they stay
   *   visible at high time multipliers instead of falling between frames.
   */
  update(t: number, realT: number = t) {
    const tl = this.timeline;
    const tFast = Math.min(t, realT);
    this.flash.position.y = this.burstY;

    const fadeStart = this.durationS * FADE_START_FRACTION;
    const fade = 1 - smoothstep(fadeStart, this.durationS, t);

    // Cloud rise: a few km per minute, decelerating as it reaches the
    // altitude where it is as buoyant as the surrounding air (~10 min).
    // An air burst starts higher up
    const capHeight =
      this.burstY +
      (this.cloudHeight - this.burstY * 0.5) * (1 - Math.exp(-t / tl.rise));
    // The cap keeps spreading, and flattens out further while dispersing
    const capRadius =
      this.capRadiusMax *
      (0.2 + 0.8 * (1 - Math.exp(-t / tl.spread))) *
      (1 + 0.6 * smoothstep(fadeStart * 0.5, this.durationS, t));
    const capMinor =
      capRadius * (0.48 - 0.15 * smoothstep(fadeStart * 0.5, this.durationS, t));

    // --- Flash: blinding for a split second, then gone
    const flashOpacity = tFast < 0.08 ? 1 : Math.exp(-(tFast - 0.08) / 0.35);
    const flashSize =
      this.flashSize * (0.35 + 0.65 * Math.min(tFast / 0.08, 1));
    this.flash.visible = flashOpacity > 0.005;
    this.flash.scale.set(flashSize, flashSize, 1);
    (this.flash.material as THREE.SpriteMaterial).opacity = flashOpacity;

    // --- Fireball: reaches full size around the thermal maximum, keeps
    // swelling a little while it rises and cools over about a minute
    const fireballR =
      this.fireballRadius *
      (1 - Math.exp(-t / (0.4 * tl.tMax))) *
      (1 + 0.5 * Math.min(t / (20 * tl.cooling), 1));
    // Surface burst: starts as a hemisphere, lifts off as it rises
    const fireballY = Math.max(
      this.burstY,
      Math.min(capHeight, capHeight * 0.9 + fireballR * 0.1)
    );
    const fireballOpacity =
      1 - smoothstep(10 * tl.cooling, 60 * tl.cooling, t);
    this.fireball.visible = fireballOpacity > 0.005 && fireballR > 0;
    this.fireball.scale.set(fireballR, fireballR * 0.85, fireballR);
    this.fireball.position.y = fireballY;
    // Slow internal churning
    this.fireball.rotation.y = t * 0.02;
    const fireballMaterial = this.fireball.material as THREE.MeshBasicMaterial;
    fireballColor(t / tl.cooling, fireballMaterial.color).multiplyScalar(
      fireballOpacity * (1 + 0.06 * Math.sin(realT * 23))
    );

    // --- Thermal pulse glow around the fireball (~10 t_max)
    const glowOpacity = 0.95 * Math.exp(-t / (8 * tl.tMax));
    const glowSize = fireballR * 7 + this.fireballRadius * 2;
    this.glow.visible = glowOpacity > 0.005;
    this.glow.position.y = fireballY;
    this.glow.scale.set(glowSize, glowSize, 1);
    const glowMaterial = this.glow.material as THREE.SpriteMaterial;
    glowMaterial.opacity = glowOpacity;
    fireballColor(t / tl.cooling + 1, glowMaterial.color);

    // --- Wilson condensation dome: a short-lived white shell (~2 s)
    const domeT = (tFast - 0.15) / 2.2;
    const domeOn = domeT > 0 && domeT < 1;
    this.wilsonDome.visible = domeOn;
    if (domeOn) {
      const r = this.capRadiusMax * 2.6 * Math.sqrt(domeT);
      this.wilsonDome.scale.set(r, r * 0.75, r);
      (this.wilsonDome.material as THREE.MeshBasicMaterial).opacity =
        0.32 * Math.sin(Math.PI * domeT);
    }

    // --- Ground shock front, decelerating as it spreads. From an air
    // burst it reaches the ground a moment later
    const shockT = Math.max(0, t - this.shockDelay);
    const shockR = this.shockRadius * (1 - Math.exp(-shockT / tl.shock));
    this.shockRing.visible = shockR > 0;
    this.shockRing.scale.set(shockR, shockR, 1);
    (this.shockRing.material as THREE.MeshBasicMaterial).opacity =
      0.75 * (1 - smoothstep(0.2 * tl.shock, 4 * tl.shock, shockT));

    // --- Mushroom cloud
    this.updateCloud(t, fade, capHeight, capRadius, capMinor);
  }

  private updateCloud(
    t: number,
    fade: number,
    capHeight: number,
    capRadius: number,
    capMinor: number
  ) {
    const tl = this.timeline;
    // 1 at 1 Mt; bigger clouds evolve a bit slower
    const pace = tl.rise / 120;
    const ground = this.groundContact;
    // The cap forms from the rising, cooling fireball
    const capAlpha = smoothstep(2 * tl.cooling, 15 * tl.cooling, t) * fade;
    // Air bursts suck up less debris: thinner stem, no base surge
    const stemAlpha =
      smoothstep(10 * pace, 45 * pace, t) * fade * (0.35 + 0.65 * ground);
    const skirtAlpha =
      smoothstep(this.shockDelay + 3, this.shockDelay + 30, t) * fade * ground;
    const glowFromFireball = Math.exp(-t / tl.innerGlow);
    const skirtMax = this.capRadiusMax * 3.4;
    const skirtRadius =
      skirtMax *
      (1 - Math.exp(-Math.max(0, t - this.shockDelay) / (150 * pace)));
    // Toroidal circulation: one roll every few minutes
    const rollRate = 0.035 / pace;

    for (let i = 0; i < this.count; i++) {
      const a = this.ra[i];
      const b = this.rb[i];
      const c = this.rc[i];
      let x = 0;
      let y = 0;
      let z = 0;
      let size = 0;
      let alpha = 0;
      let heat = 0;
      let shade = 0.8;

      switch (this.kind[i]) {
        case Kind.Cap: {
          // Toroidal vortex: gas rolls up the outside and back down inside
          const theta = a * Math.PI * 2 + t * rollRate * 0.05;
          const phi = b * Math.PI * 2 - t * rollRate;
          const rr = Math.sqrt(c);
          const ring = capRadius + capMinor * rr * Math.cos(phi);
          x = ring * Math.cos(theta);
          z = ring * Math.sin(theta);
          y = capHeight + capMinor * 0.75 * rr * Math.sin(phi);
          size = capMinor * 0.95 * this.rSize[i];
          alpha = capAlpha * 0.85;
          // Underside stays lit by the fireball longer
          const under = Math.max(0, -Math.sin(phi));
          heat =
            glowFromFireball * (1 - 0.5 * rr) +
            0.45 * Math.exp(-t / (2.5 * tl.innerGlow)) * under * (1 - rr * 0.5);
          shade = 0.74 + 0.26 * Math.sin(phi) * rr;
          break;
        }
        case Kind.Dome: {
          // Covers the hole of the torus: a rounded top
          const theta = a * Math.PI * 2 + t * rollRate * 0.05;
          const r = capRadius * Math.sqrt(b) * 0.9;
          x = r * Math.cos(theta);
          z = r * Math.sin(theta);
          y =
            capHeight +
            capMinor * (0.55 + 0.25 * (1 - (r / capRadius) ** 2)) * (0.8 + 0.4 * c);
          size = capMinor * 0.9 * this.rSize[i];
          alpha = capAlpha * 0.8;
          heat = glowFromFireball * 0.8;
          shade = 0.9 + 0.1 * c;
          break;
        }
        case Kind.Stem: {
          // Debris sucked up the column into the cap; loops upwards
          // Updraft: debris takes a few minutes to climb the column
          const u = (a + t / (240 * pace)) % 1;
          const stemTop = Math.max(0, capHeight - capMinor * 0.4);
          y = u * stemTop;
          const base = 1 + 2.2 * Math.pow(1 - u, 5);
          const rs = capRadius * (0.3 - 0.13 * u) * base;
          const theta = b * Math.PI * 2 + t * rollRate * 0.3;
          const r = rs * Math.sqrt(c);
          x = r * Math.cos(theta);
          z = r * Math.sin(theta);
          size = rs * 1.25 * this.rSize[i];
          alpha =
            stemAlpha * 0.75 * smoothstep(0, 0.06, u) * (1 - smoothstep(0.92, 1, u));
          heat = glowFromFireball * 0.7 * u * u;
          // Dusty at the bottom, lighter higher up (cleaner for air bursts)
          shade = 0.55 + 0.3 * u + 0.2 * (1 - ground) * (1 - u);
          break;
        }
        case Kind.Skirt: {
          // Base surge: dust rolling outwards along the ground
          const theta = a * Math.PI * 2;
          const r = skirtRadius * (0.45 + 0.55 * Math.sqrt(b));
          x = r * Math.cos(theta);
          z = r * Math.sin(theta);
          size =
            this.capRadiusMax * (0.35 + 0.35 * (r / skirtMax)) * this.rSize[i];
          y = size * 0.35 * (0.3 + c);
          alpha = skirtAlpha * 0.6 * (1 - 0.5 * Math.sqrt(b));
          heat = 0;
          shade = 0.5 + 0.12 * c;
          break;
        }
      }

      this.center[i * 3] = x;
      this.center[i * 3 + 1] = y;
      this.center[i * 3 + 2] = z;
      this.size[i] = size;
      this.alpha[i] = alpha;
      this.heat[i] = heat;
      this.shade[i] = shade;
    }

    this.attrs.forEach((attr) => (attr.needsUpdate = true));
  }

  remove() {
    this.scene.remove(this.group);
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      } else if (child instanceof THREE.Sprite) {
        child.material.dispose();
      }
    });
  }
}
