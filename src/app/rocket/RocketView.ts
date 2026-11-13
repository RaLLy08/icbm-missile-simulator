import EarthView from 'app/earth/EarthView';
import Rocket from './Rocket';
import StageDebris from './StageDebris';
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

const TARGET_REACHED_ANNOUNCE_DELAY_MS = 1000;
/** "Target reached" is only announced if the impact is within this distance (km). */
const TARGET_HIT_MAX_MISS_KM = 5;

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
 * Volume fades with camera distance to the rocket (silent when too far).
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
      const ringGeometry = new THREE.RingGeometry(1, 2, 32);
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

export class TrailView {
  private line: THREE.Line | null = null;
  private geometry = new THREE.BufferGeometry();
  private positions: Float32Array = new Float32Array();
  private colors: Float32Array = new Float32Array();

  /**
   * @param positions - Position (x,y,z) based of which the trail will be drawn.
   * @param positionsCount - Number of positions in the trail. (x,y,z) - is one position.
   */
  constructor(
    private readonly scene: THREE.Scene,
    private readonly initialVectorPositions: THREE.Vector3[] = [],
    private readonly initialColors: THREE.Color[] = [],
    private readonly vectorsLimit: number = 5000
  ) {
    this.init();
  }

  extendFromVectors(
    vectors: THREE.Vector3[] | THREE.Vector3,
    colors: THREE.Color[] | THREE.Color = []
  ) {
    if (!Array.isArray(vectors)) {
      vectors = [vectors];
    }

    if (!Array.isArray(colors)) {
      colors = [colors];
    }

    if (vectors.length === 0) return;

    const newPositions = this.vectorPositionsToFloatArray(vectors);

    this.extendPositions(newPositions);

    if (colors.length > 0) {
      const newColors = this.colorToFloatArray(colors);

      this.extendColors(newColors);
    }
  }

  private extendPositions(newPositions: Float32Array) {
    this.positions = this.getExtendedFloatArray(this.positions, newPositions);

    this.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.positions, 3)
    );
    this.geometry.attributes.position.needsUpdate = true;
  }

  getLastVectorPosition(): THREE.Vector3 | null {
    if (this.positions.length === 0) return null;

    const lastIndex = this.positions.length - 3;
    return new THREE.Vector3(
      this.positions[lastIndex],
      this.positions[lastIndex + 1],
      this.positions[lastIndex + 2]
    );
  }

  private extendColors(newColors: Float32Array) {
    this.colors = this.getExtendedFloatArray(this.colors, newColors);

    this.geometry.setAttribute(
      'color',
      new THREE.BufferAttribute(this.colors, 3)
    );
    this.geometry.attributes.color.needsUpdate = true;
  }

  private vectorPositionsToFloatArray(vectors: THREE.Vector3[]): Float32Array {
    const array = new Float32Array(vectors.length * 3);

    for (let i = 0; i < vectors.length; i++) {
      array[i * 3] = vectors[i].x;
      array[i * 3 + 1] = vectors[i].y;
      array[i * 3 + 2] = vectors[i].z;
    }
    return array;
  }

  private colorToFloatArray(colors: THREE.Color[]): Float32Array {
    const array = new Float32Array(colors.length * 3);
    for (let i = 0; i < colors.length; i++) {
      array[i * 3] = colors[i].r;
      array[i * 3 + 1] = colors[i].g;
      array[i * 3 + 2] = colors[i].b;
    }
    return array;
  }

  private getExtendedFloatArray(origin: Float32Array, add: Float32Array) {
    if (origin.length === 0) return add;
    const totalLength = origin.length + add.length;
    const limit = this.vectorsLimit * 3;

    const newPositions = new Float32Array(Math.min(totalLength, limit));

    if (totalLength > limit) {
      const excess = totalLength - limit;

      newPositions.set(origin.subarray(excess), 0);

      newPositions.set(add, origin.length - excess);
    } else {
      newPositions.set(origin);
      newPositions.set(add, origin.length);
    }

    return newPositions;
  }

  private init() {
    this.geometry = new THREE.BufferGeometry();

    if (this.initialVectorPositions.length > 0) {
      this.positions = this.vectorPositionsToFloatArray(
        this.initialVectorPositions
      );
    }

    if (this.initialColors.length > 0) {
      this.colors = this.colorToFloatArray(this.initialColors);
    }

    this.geometry.setAttribute(
      'color',
      new THREE.BufferAttribute(this.colors, 3)
    );

    this.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.positions, 3)
    );

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
    });
    this.line = new THREE.Line(this.geometry, material);

    this.line.frustumCulled = false;
    this.line.name = 'TRAIL-LINE';

    this.scene.add(this.line);
  }

  remove() {
    if (!this.line) return;

    this.scene.remove(this.line);
    this.line.geometry.dispose();
    this.line = null;
  }
}

// class VectorHistory {
//   prev = new THREE.Vector3();
//   next = new THREE.Vector3();
// }

export type CylinderDimensions = { height: number; radius: number };

export type RocketDimensions = {
  /** One cylinder per stage, ordered bottom (first stage) to top. */
  stages: CylinderDimensions[];
  /** Nose cone */
  head: { height: number; radius: number };
  /** Exhaust flame (truncated cone) */
  fire: { height: number; topRadius: number; bottomRadius: number };
};

export default class RocketView {
  group: THREE.Group;
  private arrows: THREE.ArrowHelper[] = [];
  /** Force arrows are hidden by default; enabled from Missile Controls. */
  private arrowsEnabled = false;
  // private arrowsLabels: THREE.Mesh[] = []; //TODO: add on small screen only
  private trailView: TrailView | null = null;
  private burningFireMesh: THREE.Mesh | null = null;
  private thrustDirectionFireMesh: THREE.Mesh | null = null;
  private explosionEffect: ExplosionEffect | null = null;
  private hasTriggeredExplosion: boolean = false;
  private engineSound: EngineSound | null = new EngineSound();

  prevPosition = new THREE.Vector3();
  prevVelocity = new THREE.Vector3();
  prevThrust = new THREE.Vector3();

  /**
   * Default rocket geometry in km (at size multiplier = 1). The body is
   * split between `stageCount` cylinders, each upper stage shorter and
   * thinner than the one below; the total body height stays 1 km.
   */
  static baseDimensions(stageCount = 1): RocketDimensions {
    const n = Math.max(1, Math.floor(stageCount));
    // Height weights n, n-1, ..., 1 -> lower stages are taller
    const weightSum = (n * (n + 1)) / 2;
    const stages = Array.from({ length: n }, (_, i) => ({
      height: (n - i) / weightSum,
      radius: 0.1 * Math.pow(0.85, i),
    }));
    const topRadius = stages[n - 1].radius;
    return {
      stages,
      head: { height: 0.3, radius: topRadius },
      fire: { height: 1, topRadius: 0.06, bottomRadius: 0.14 },
    };
  }

  dimensions: RocketDimensions = RocketView.baseDimensions();

  /** Total height of all stage cylinders. */
  get bodyHeight() {
    return this.dimensions.stages.reduce((sum, s) => sum + s.height, 0);
  }

  /** Reference length of the rocket (body height), used for camera distances. */
  get size() {
    return this.bodyHeight;
  }

  /** Full length of the rocket, from the body bottom to the head tip. */
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
   * Null = use the rocket's current mass flow rate (flame always 100%).
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
    readonly rocket: Rocket,
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
      RocketView.scaleDimensions(
        RocketView.baseDimensions(stageCount),
        multiplier
      )
    );
  }

  /** Set explicit stage / head / fire dimensions (km). Call before `init()`. */
  setDimensions(dimensions: RocketDimensions) {
    if (dimensions.stages.length === 0) {
      throw new Error('RocketView requires at least one stage cylinder.');
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

  /** Backward push of a separating stage relative to the rocket. Unit: km/s */
  static STAGE_SEPARATION_SPEED = 0.01;

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
        RocketView.STAGE_SEPARATION_SPEED
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

  /** Y of the bottom of stage `index` in the rocket's local space. */
  private stageBaseY(index: number) {
    let y = 0;
    for (let k = 0; k < index; k++) y += this.dimensions.stages[k].height;
    return y;
  }

  private static scaleDimensions(
    d: RocketDimensions,
    k: number
  ): RocketDimensions {
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
    this.buildRocketMesh();
    this.initArrows();
    this.update();
  }

  private buildRocketMesh() {
    const coneColor = 0xff0000;
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
    // === Rocket Nose Cone (on top of the last stage) ===
    const coneHeight = head.height;
    const coneRadius = head.radius;
    const coneGeometry = new THREE.ConeGeometry(coneRadius, coneHeight, 16);
    const coneMaterial = new THREE.MeshStandardMaterial({ color: coneColor });
    const coneMesh = new THREE.Mesh(coneGeometry, coneMaterial);
    coneMesh.position.y = bodyHeight + coneHeight / 2; // sits on top of the body
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

    // Main burning fire (follows rocket/velocity direction)
    const burningFireMaterial = new THREE.MeshBasicMaterial({
      color: 0xffa500,
      transparent: true,
      opacity: 0.6,
    });
    const burningFireGeometry = new THREE.CylinderGeometry(
      fire.topRadius,
      fire.bottomRadius,
      fire.height,
      16
    );
    const burningFireMesh = new THREE.Mesh(
      burningFireGeometry,
      burningFireMaterial
    );

    // Top of the flame touches the bottom of the body (y = 0)
    burningFireMesh.position.y = -fire.height / 2;

    this.burningFireMesh = burningFireMesh;
    this.fireGroup.add(this.burningFireMesh);

    // Thrust direction fire (small, follows actual thrust direction)
    const thrustFireMaterial = new THREE.MeshBasicMaterial({
      color: 0xff4500, // Orange-red to distinguish from main fire
      transparent: true,
      opacity: 0.7,
    });
    const thrustFireSize = 0.4 * firstStage.height; // Smaller fixed size
    const thrustFireGeometry = new THREE.CylinderGeometry(
      0.04 * thrustFireSize,
      0.1 * thrustFireSize,
      thrustFireSize,
      16
    );
    const thrustDirectionFireMesh = new THREE.Mesh(
      thrustFireGeometry,
      thrustFireMaterial
    );

    thrustDirectionFireMesh.position.y = -0.5 * thrustFireSize;

    this.thrustDirectionFireMesh = thrustDirectionFireMesh;
    this.fireGroup.add(this.thrustDirectionFireMesh);

    this.applyActiveStage();

    // ------------------------------------------------------------------------
    this.group.name = RocketView.name;
    this.scene.add(this.group);
  }

  private initArrows() {
    this.addArrow(
      'velocity',
      0xff0000,
      this.group.position,
      this.rocket.velocity
    );
    this.addArrow('thrust', 0x00ff00, this.group.position, this.rocket.thrust);
    this.addArrow(
      'gravity',
      0x0000ff,
      this.group.position,
      this.rocket.gravityForce
    );

    this.addArrow(
      'targetIncline',
      0xcc00cc,
      this.group.position,
      this.rocket.calcThrustDirectionToIncline()
    );
  }

  private updateArrows() {
    const velocity = this.getVelocity();
    const thrust = this.getThrust();

    this.updateArrow(
      'gravity',
      this.group.position,
      this.rocket.gravityForce.clone().normalize(),
      this.rocket.gravityForce.length()
    );

    this.updateArrow(
      'velocity',
      this.group.position,
      velocity.clone().normalize(),
      velocity.length()
    );

    this.updateArrow(
      'thrust',
      this.group.position,
      thrust.clone().normalize(),
      thrust.length()
    );

    this.updateArrow(
      'targetIncline',
      this.group.position,
      this.rocket.calcThrustDirectionToIncline().clone().normalize(),
      this.rocket.calcThrustDirectionToIncline().length()
    );
  }

  private updateArrow(
    name: string,
    position: THREE.Vector3,
    direction: THREE.Vector3,
    magnitude: number = 1
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
      Math.min(length * 0.05, 10),
      Math.min(length * 0.03, 5)
    );
    arrow.position.copy(position);

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
    name: string,
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
    arrow.visible = this.arrowsEnabled;
    this.scene.add(arrow);
    this.arrows.push(arrow);

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

  private extendTrail() {
    if (!this.trailView) return;

    const thrustPercentage =
      this.rocket.thrust.length() / this.rocket.maxAcceleration;

    this.trailView.extendFromVectors(
      this.prevPosition.clone(),
      new THREE.Color(1, thrustPercentage, 1 - thrustPercentage)
    );
  }

  private alignRotation() {
    if (this.rocket.hasLanded) {
      return;
    }

    if (this.rocket.velocity.length() === 0) {
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
    this.updateThrustDirectionFire();

    this.updateArrows();

    this.alignRotation();

    this.engineSound?.update(
      !this.rocket.hasLanded && this.rocket.thrust.lengthSq() > 0,
      this.group.position
    );

    if (!this.rocket.hasLanded) {
      this.extendTrail();
    }

    if (this.rocket.hasLanded && this.endPositionSkyMarker == null) {
      this.endPositionSkyMarker = this.earthView.createLineToSkyMarker(
        this.rocket.position,
        0x00ff00,
        this.rocket.maxAltitude
      );

      this.scene.add(this.endPositionSkyMarker);
    }

    // Trigger explosion effect when rocket lands
    if (
      this.rocket.hasLanded &&
      !this.hasTriggeredExplosion &&
      this.explosionEffect
    ) {
      const normal = this.rocket.position.clone().normalize();
      this.explosionEffect.start(this.rocket.position.clone(), normal);
      this.hasTriggeredExplosion = true;

      const missDistance = this.targetPosition
        ? this.rocket.position.distanceTo(this.targetPosition)
        : Infinity;
      if (missDistance <= TARGET_HIT_MAX_MISS_KM) {
        // Same number as the "Missile N" label in the GUI
        const missileId = this.rocket.id;
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
    const rate = this.rocket.massFlowRate;
    const max = this.maxBurnRate ?? rate;
    if (!(max > 0)) return 0;
    return THREE.MathUtils.clamp(rate / max, 0, 1);
  }

  private updateBurningFireScale() {
    if (!this.burningFireMesh) return;

    // Hide the exhaust flame once all fuel is burnt (or the rocket landed)
    const burning = !this.rocket.isEngineCutoff && !this.rocket.hasLanded;
    const ratio = burning ? this.burnRatio : 0;
    this.burningFireMesh.visible = ratio > 0;
    if (ratio === 0) return;

    // 100% size at the maximum burn rate, proportionally smaller below it.
    // Keep the top of the flame attached to the bottom of the stage.
    this.burningFireMesh.scale.setScalar(ratio);
    this.burningFireMesh.position.y =
      (-this.dimensions.fire.height * ratio) / 2;
  }

  private updateThrustDirectionFire() {
    if (
      !this.thrustDirectionFireMesh ||
      this.rocket.thrust.length() === 0 ||
      !this.rocket.isGravityTurnActive
    ) {
      // Hide when no thrust or outside the gravity turn
      if (this.thrustDirectionFireMesh) {
        this.thrustDirectionFireMesh.visible = false;
      }
      return;
    }

    this.thrustDirectionFireMesh.visible = true;

    const velocity = this.getVelocity();
    const thrust = this.getThrust();

    // Fixed small size for thrust direction indicator
    const thrustFireSize = 0.4 * this.dimensions.stages[0].height;

    // If there's velocity, calculate the angle between velocity and thrust
    if (velocity.length() > 0) {
      const velocityDir = velocity.clone().normalize();
      const thrustDir = thrust.clone().normalize();

      // Calculate rotation axis (perpendicular to both vectors)
      const rotationAxis = new THREE.Vector3()
        .crossVectors(velocityDir, thrustDir)
        .normalize();

      // Calculate angle between velocity and thrust
      const angle = velocityDir.angleTo(thrustDir);

      // Only apply rotation if there's a significant angle and valid rotation axis
      if (angle > 0.001 && rotationAxis.length() > 0.001) {
        // Transform rotation axis to local space of the group
        const localRotationAxis = rotationAxis
          .clone()
          .applyQuaternion(this.group.quaternion.clone().invert());

        this.thrustDirectionFireMesh.quaternion.setFromAxisAngle(
          localRotationAxis,
          angle
        );
      } else {
        this.thrustDirectionFireMesh.quaternion.identity();
      }
    } else {
      // No velocity yet, keep aligned with rocket
      this.thrustDirectionFireMesh.quaternion.identity();
    }

    // Update position after rotation so it stays aligned
    const localOffset = new THREE.Vector3(0, -thrustFireSize / 2, 0);
    localOffset.applyQuaternion(this.thrustDirectionFireMesh.quaternion);
    this.thrustDirectionFireMesh.position.copy(localOffset);
  }

  private updatePosition() {
    const position = new THREE.Vector3().lerpVectors(
      this.prevPosition,
      this.rocket.position,
      this.lerpAlpha
    );

    this.group.position.copy(position);
  }

  private getVelocity() {
    return new THREE.Vector3().lerpVectors(
      this.prevVelocity,
      this.rocket.velocity,
      this.lerpAlpha
    );
  }

  private getThrust() {
    return new THREE.Vector3().lerpVectors(
      this.prevThrust,
      this.rocket.thrust,
      this.lerpAlpha
    );
  }

  updatePrevFromRocket() {
    this.prevPosition.copy(this.rocket.position.clone());
    this.prevVelocity.copy(this.rocket.velocity.clone());
    this.prevThrust.copy(this.rocket.thrust.clone());
  }

  /** Toggle force arrows on/off (user setting). */
  setArrowsEnabled(enabled: boolean) {
    this.arrowsEnabled = enabled;
    this.setArrowsVisible(enabled);
  }

  /** Temporarily show/hide arrows; never shows them while disabled. */
  setArrowsVisible(visible: boolean) {
    this.arrows.forEach((arrow) => {
      arrow.visible = visible && this.arrowsEnabled;
    });
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
