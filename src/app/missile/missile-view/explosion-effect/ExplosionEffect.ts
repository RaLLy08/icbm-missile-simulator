import * as THREE from 'three';
import NuclearExplosion, {
  type NuclearExplosionOptions,
} from '../NuclearExplosion';
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
import {
  EXPLOSION_FALLOFF,
  createAudio,
  getDistanceVolume,
  getListenerDistance,
  releaseAudio,
} from 'app/helpers/SpatialAudio';

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

export default class ExplosionEffect {
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
  private readonly baseVolume = 1;
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
