import * as THREE from 'three';
import { getCanvasTexture } from './canvasTexture';

/**
 * Soft, lumpy smoke puff: several overlapping blobs inside a round falloff,
 * so neighbouring puffs merge into a billowing column.
 */
export const getSmokePuffTexture = () =>
  getCanvasTexture('smoke-puff', 128, 128, (ctx, w, h) => {
    const blob = (x: number, y: number, r: number, a: number) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255, 255, 255, ${a})`);
      g.addColorStop(0.5, `rgba(255, 255, 255, ${a * 0.55})`);
      g.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    };
    blob(w / 2, h / 2, w / 2, 0.75);
    for (let i = 0; i < 9; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * w * 0.2;
      blob(
        w / 2 + Math.cos(angle) * dist,
        h / 2 + Math.sin(angle) * dist,
        w * (0.15 + Math.random() * 0.15),
        0.25 + Math.random() * 0.25
      );
    }
  });

const vertexShader = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>

  attribute vec3 aCenter;
  attribute float aBirth;
  attribute float aSize;
  attribute float aGrowth;
  attribute float aStrength;
  attribute float aSeed;

  uniform float uTime;
  uniform float uLifetime;
  uniform float uFlameTime;

  varying vec2 vUv;
  varying float vAlpha;
  varying float vHeat;
  varying float vShade;

  void main() {
    float age = uTime - aBirth;
    float t = age / uLifetime;
    vUv = uv;

    if (age < 0.0 || t > 1.0 || aStrength <= 0.0) {
      // Dead / unused slot: collapse off-screen
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      vAlpha = 0.0;
      vHeat = 0.0;
      vShade = 0.0;
      #include <logdepthbuf_vertex>
      return;
    }

    // Puffs keep diffusing outwards: quickly at first, then slowly
    float size = aSize * (1.0 + aGrowth * sqrt(t));

    // Fade in right behind the nozzle, then thin out over the lifetime
    vAlpha = aStrength * smoothstep(0.0, 0.015, t) * pow(1.0 - t, 1.6);
    // Freshly emitted gas still glows from the flame
    vHeat = 1.0 - smoothstep(0.0, uFlameTime, age);
    // Per-puff brightness variation
    vShade = 0.82 + 0.18 * fract(aSeed * 7.31);

    float angle = aSeed * 6.2831853 + t * (fract(aSeed * 3.7) - 0.5);
    float c = cos(angle);
    float s = sin(angle);
    vec2 corner = mat2(c, s, -s, c) * position.xy * size;

    vec4 mvPosition = modelViewMatrix * vec4(aCenter, 1.0);
    mvPosition.xy += corner;
    gl_Position = projectionMatrix * mvPosition;
    #include <logdepthbuf_vertex>
  }
`;

const fragmentShader = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>

  uniform sampler2D uMap;
  uniform vec3 uSmokeColor;
  uniform vec3 uHeatColor;
  uniform float uOpacity;

  varying vec2 vUv;
  varying float vAlpha;
  varying float vHeat;
  varying float vShade;

  void main() {
    #include <logdepthbuf_fragment>
    float texAlpha = texture2D(uMap, vUv).a;
    float alpha = min(texAlpha * vAlpha * uOpacity, 0.97);
    if (alpha < 0.003) discard;
    vec3 color = mix(uSmokeColor * vShade, uHeatColor, vHeat * vHeat);
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`;

export type SmokeEmitOptions = {
  /** Puff radius at emission. Unit: m */
  size: number;
  /** How many times the puff grows over its lifetime. */
  growth: number;
  /** Puff density (0..~2); thin air leaves a fainter trail. */
  strength: number;
  /**
   * Also emit at least one puff per this many simulation seconds, even when
   * the missile barely moved (billowing cloud right after liftoff).
   */
  interval?: number;
};

/**
 * Solid-rocket smoke column left behind in world space: thousands of
 * camera-facing puffs drawn in a single instanced draw call. Puffs spawn at
 * the nozzle, glow orange for a moment, then turn into white smoke that
 * slowly swells and thins out. Ages run on simulation time.
 */
export default class ExhaustSmoke {
  /** Puff lifetime. Unit: simulation s */
  static LIFETIME_S = 240;
  /** How long freshly emitted smoke keeps the flame's glow. Unit: s */
  static FLAME_GLOW_S = 2;

  private readonly mesh: THREE.Mesh;
  private readonly geometry = new THREE.InstancedBufferGeometry();
  private readonly material: THREE.ShaderMaterial;
  private readonly capacity: number;

  private readonly center: Float32Array;
  private readonly birth: Float32Array;
  private readonly size: Float32Array;
  private readonly growth: Float32Array;
  private readonly strength: Float32Array;
  private readonly seed: Float32Array;
  private readonly attrs: THREE.InstancedBufferAttribute[];

  /** Next ring-buffer slot (oldest puffs are overwritten). */
  private next = 0;
  private used = 0;
  /** Puff positions are stored relative to this, for float32 precision. */
  private origin: THREE.Vector3 | null = null;
  /** Last emitted puff (world space); new puffs fill the path from here. */
  private lastEmit: THREE.Vector3 | null = null;
  private readonly scratch = new THREE.Vector3();
  private dirtyFrom = Infinity;
  private dirtyTo = -1;

  constructor(private readonly scene: THREE.Scene, capacity = 6000) {
    this.capacity = capacity;

    const quad = new THREE.PlaneGeometry(1, 1);
    this.geometry.index = quad.index;
    this.geometry.setAttribute('position', quad.getAttribute('position'));
    this.geometry.setAttribute('uv', quad.getAttribute('uv'));

    this.center = new Float32Array(capacity * 3);
    this.birth = new Float32Array(capacity).fill(-1e9);
    this.size = new Float32Array(capacity);
    this.growth = new Float32Array(capacity);
    this.strength = new Float32Array(capacity);
    this.seed = new Float32Array(capacity);

    const add = (name: string, array: Float32Array, itemSize: number) => {
      const attr = new THREE.InstancedBufferAttribute(array, itemSize);
      attr.setUsage(THREE.DynamicDrawUsage);
      this.geometry.setAttribute(name, attr);
      return attr;
    };
    this.attrs = [
      add('aCenter', this.center, 3),
      add('aBirth', this.birth, 1),
      add('aSize', this.size, 1),
      add('aGrowth', this.growth, 1),
      add('aStrength', this.strength, 1),
      add('aSeed', this.seed, 1),
    ];
    this.geometry.instanceCount = 0;

    const map = getSmokePuffTexture();
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uMap: { value: map },
        uTime: { value: 0 },
        uLifetime: { value: ExhaustSmoke.LIFETIME_S },
        uFlameTime: { value: ExhaustSmoke.FLAME_GLOW_S },
        uSmokeColor: { value: new THREE.Color(0xe9e6e1) },
        uHeatColor: { value: new THREE.Color(0xffa040) },
        uOpacity: { value: 0.8 },
      },
      transparent: true,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = 'exhaust-smoke';
    this.mesh.frustumCulled = false;
    // Drawn before the (additive) flames, so the fire shines through it
    this.mesh.renderOrder = -1;
    // No texture outside the browser (tests): nothing to draw
    this.mesh.visible = !!map;
    this.scene.add(this.mesh);
  }

  /**
   * Lay puffs along the path from the previous emission to `position`,
   * spaced by a fraction of the puff size, so the column has no gaps even
   * when the missile moves far between frames.
   * @param time Current simulation time. Unit: s
   */
  emit(position: THREE.Vector3, time: number, options: SmokeEmitOptions) {
    if (options.strength <= 0 || options.size <= 0) {
      this.lastEmit = null;
      return;
    }
    if (!this.origin) this.origin = position.clone();
    if (!this.lastEmit) {
      this.lastEmit = position.clone();
      this.spawn(position, time, options);
      return;
    }

    const spacing = options.size * 0.45;
    const distance = this.lastEmit.distanceTo(position);
    // Bound the work per frame (e.g. after a huge time jump)
    const count = Math.min(Math.floor(distance / spacing), 400);
    for (let i = 1; i <= count; i++) {
      this.scratch.lerpVectors(this.lastEmit, position, i / count);
      this.spawn(this.scratch, time, options);
    }
    if (count > 0) {
      this.lastEmit.copy(position);
      this.lastSpawnTime = time;
    } else if (
      options.interval !== undefined &&
      time - this.lastSpawnTime >= options.interval
    ) {
      // Barely moving: keep pumping smoke in place, spread out wider
      this.spawn(position, time, options, 1.2);
      this.lastSpawnTime = time;
    }
  }

  /** Simulation time of the last puff. Unit: s */
  private lastSpawnTime = -Infinity;

  /** Stop the current column (next emit starts a new one). */
  cut() {
    this.lastEmit = null;
  }

  private spawn(
    world: THREE.Vector3,
    time: number,
    options: SmokeEmitOptions,
    spread = 0.25
  ) {
    const i = this.next;
    const o = this.origin!;
    // Slight jitter so the column is not a perfect tube
    const j = options.size * spread;
    this.center[i * 3] = world.x - o.x + (Math.random() - 0.5) * j;
    this.center[i * 3 + 1] = world.y - o.y + (Math.random() - 0.5) * j;
    this.center[i * 3 + 2] = world.z - o.z + (Math.random() - 0.5) * j;
    this.birth[i] = time;
    this.size[i] = options.size * (0.8 + Math.random() * 0.4);
    this.growth[i] = options.growth * (0.8 + Math.random() * 0.4);
    this.strength[i] = options.strength;
    this.seed[i] = Math.random();

    this.dirtyFrom = Math.min(this.dirtyFrom, i);
    this.dirtyTo = Math.max(this.dirtyTo, i);
    this.next = (i + 1) % this.capacity;
    if (this.used < this.capacity) this.used++;
    // Wrapped around: everything may have changed
    if (this.next === 0) {
      this.dirtyFrom = 0;
      this.dirtyTo = this.capacity - 1;
    }
  }

  /** @param time Current simulation time. Unit: s */
  update(time: number) {
    this.material.uniforms.uTime.value = time;
    this.geometry.instanceCount = this.used;
    if (this.origin) this.mesh.position.copy(this.origin);

    if (this.dirtyTo >= this.dirtyFrom) {
      const from = this.dirtyFrom;
      const count = this.dirtyTo - from + 1;
      // Ranges accumulate until the next render; three.js clears them after upload
      this.attrs.forEach((attr) => {
        attr.addUpdateRange(from * attr.itemSize, count * attr.itemSize);
        attr.needsUpdate = true;
      });
      this.dirtyFrom = Infinity;
      this.dirtyTo = -1;
    }
  }

  setVisible(visible: boolean) {
    this.mesh.visible = visible && !!this.material.uniforms.uMap.value;
  }

  remove() {
    this.scene.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
  }
}
