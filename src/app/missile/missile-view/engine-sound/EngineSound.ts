import * as THREE from 'three';
import engineStartAudio from 'public/audio/start.mp3';
import engineFlightAudio from 'public/audio/flight.mp3';
import engineEndAudio from 'public/audio/end.mp3';
import {
  ENGINE_FALLOFF,
  createAudio,
  getDistanceVolume,
  releaseAudio,
} from 'app/helpers/SpatialAudio';

/**
 * Engine sounds: plays `start` on ignition, then loops `flight` while the
 * engines keep burning. On cutoff, start/flight stop immediately and `end` plays.
 * Volume fades with camera distance to the missile (silent when too far).
 */
export default class EngineSound {
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
