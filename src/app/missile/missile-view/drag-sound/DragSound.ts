import * as THREE from 'three';
import atmosphericDragAudio from 'public/audio/atmospheric_drag_effect.mp3';
import {
  ENGINE_FALLOFF,
  createAudio,
  getDistanceVolume,
  releaseAudio,
} from 'app/helpers/SpatialAudio';

/** Below this volume the loop is paused instead of playing silently. */
const DRAG_SOUND_MIN_VOLUME = 0.005;
/** Per-frame smoothing of the volume, so it never jumps or clicks. */
const DRAG_SOUND_SMOOTHING = 0.15;

/**
 * Air rushing past the body: a looped sound whose volume follows the same
 * aerodynamic intensity (0..1) as the nose glow / plasma animation, so sound
 * and visual start, peak and fade together. Times the camera distance falloff.
 * Silent in vacuum and after impact.
 */
export default class DragSound {
  private audio: HTMLAudioElement;
  private volume = 0;

  constructor(private readonly baseVolume = 0.6) {
    this.audio = createAudio(atmosphericDragAudio);
    this.audio.loop = true;
    this.audio.volume = 0;
  }

  /** @param intensity Aerodynamic effect strength, 0..1 (same as the animation). */
  update(intensity: number, position: THREE.Vector3) {
    const target =
      this.baseVolume *
      THREE.MathUtils.clamp(intensity, 0, 1) *
      getDistanceVolume(position, ENGINE_FALLOFF);

    this.volume += (target - this.volume) * DRAG_SOUND_SMOOTHING;
    if (target === 0 && this.volume < DRAG_SOUND_MIN_VOLUME) this.volume = 0;
    this.audio.volume = THREE.MathUtils.clamp(this.volume, 0, 1);

    if (this.volume >= DRAG_SOUND_MIN_VOLUME) {
      if (this.audio.paused) {
        this.audio.play().catch((error) => {
          console.warn('Failed to play drag sound:', error);
        });
      }
    } else if (!this.audio.paused) {
      this.audio.pause();
    }
  }

  remove() {
    this.audio.pause();
    this.audio.currentTime = 0;
    releaseAudio(this.audio);
  }
}
