import * as THREE from 'three';

export type AudioFalloff = {
  /** Distance (km) up to which the sound plays at full volume. */
  refDistance: number;
  /** Distance (km) at and beyond which the sound is completely silent. */
  maxDistance: number;
};

/** Rocket engines: loud up close, inaudible after a few tens of km. */
export const ENGINE_FALLOFF: AudioFalloff = {
  refDistance: 5,
  maxDistance: 50,
};

/** Nuclear detonation: heard much farther than engines. */
export const EXPLOSION_FALLOFF: AudioFalloff = {
  refDistance: 400,
  maxDistance: 2000,
};

const MUTED_STORAGE_KEY = 'audioMuted';

const readStoredMuted = (): boolean => {
  try {
    return localStorage.getItem(MUTED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

let isMuted = readStoredMuted();
const activeAudio = new Set<HTMLAudioElement>();

/** Creates an audio element that follows the global mute switch. */
export function createAudio(src: string): HTMLAudioElement {
  const audio = new Audio(src);
  audio.muted = isMuted;
  activeAudio.add(audio);
  return audio;
}

/** Stops tracking an audio element (call once it will never play again). */
export function releaseAudio(audio: HTMLAudioElement) {
  activeAudio.delete(audio);
}

export function isAudioMuted(): boolean {
  return isMuted;
}

/** Mutes/unmutes every sound, including ones currently playing. */
export function setAudioMuted(muted: boolean) {
  isMuted = muted;
  activeAudio.forEach((audio) => {
    audio.muted = muted;
  });
  try {
    localStorage.setItem(MUTED_STORAGE_KEY, muted ? '1' : '0');
  } catch {
    // storage unavailable — mute still works for this session
  }
}

let getListener: () => THREE.Object3D | null = () => null;

/** Registers a getter for the current "ears" of the scene (the active camera). */
export function setAudioListener(getter: () => THREE.Object3D | null) {
  getListener = getter;
}

/** Distance (km) from the active camera to `position`, or Infinity if none. */
export function getListenerDistance(position: THREE.Vector3): number {
  const listener = getListener();
  if (!listener) return Infinity;
  return listener.position.distanceTo(position);
}

/**
 * Volume multiplier (0..1) for a sound source at `position`, based on its
 * distance to the active camera.
 *
 * Uses the inverse distance law (-6 dB per doubling of distance, like real
 * sound in open air), with a smooth fade to silence over the last third of
 * the range so it never cuts off abruptly.
 */
export function getDistanceVolume(
  position: THREE.Vector3,
  { refDistance, maxDistance }: AudioFalloff
): number {
  const listener = getListener();
  if (!listener) return 0;

  const distance = listener.position.distanceTo(position);

  if (distance >= maxDistance) return 0;

  const inverse = refDistance / Math.max(distance, refDistance);

  const fadeStart = maxDistance * (2 / 3);
  const fadeT = THREE.MathUtils.clamp(
    (distance - fadeStart) / (maxDistance - fadeStart),
    0,
    1
  );
  const fade = 1 - THREE.MathUtils.smoothstep(fadeT, 0, 1);

  return inverse * fade;
}
