import digit0 from 'public/audio/speech/digits/0.wav';
import digit1 from 'public/audio/speech/digits/1.wav';
import digit2 from 'public/audio/speech/digits/2.wav';
import digit3 from 'public/audio/speech/digits/3.wav';
import digit4 from 'public/audio/speech/digits/4.wav';
import digit5 from 'public/audio/speech/digits/5.wav';
import digit6 from 'public/audio/speech/digits/6.wav';
import digit7 from 'public/audio/speech/digits/7.wav';
import digit8 from 'public/audio/speech/digits/8.wav';
import digit9 from 'public/audio/speech/digits/9.wav';
import calculatingTrajectoryClip from 'public/audio/speech/calculating_trajectory.wav';
import launchedClip from 'public/audio/speech/launch/has_been_launched_at_its_target.wav';
import reachedTargetClip from 'public/audio/speech/reached_target/successfully_reached_its_target_cut.wav';
import { createAudio, releaseAudio } from './SpatialAudio';

const DIGITS: string[] = [
  digit0,
  digit1,
  digit2,
  digit3,
  digit4,
  digit5,
  digit6,
  digit7,
  digit8,
  digit9,
];

const SPEECH_VOLUME = 0.8;

/** Playback speeds up by this much per announcement waiting in the queue. */
const RATE_STEP_PER_QUEUED = 0.15;
const MAX_PLAYBACK_RATE = 2;

const SPEECH_ENABLED_STORAGE_KEY = 'speechEnabled';

const readStoredEnabled = (): boolean => {
  try {
    return localStorage.getItem(SPEECH_ENABLED_STORAGE_KEY) !== '0';
  } catch {
    return true;
  }
};

let isEnabled = readStoredEnabled();

/** Pending announcements; each is a list of clips played back to back. */
const queue: string[][] = [];
let isSpeaking = false;
let currentClip: { audio: HTMLAudioElement; done: () => void } | null = null;

export function isSpeechEnabled(): boolean {
  return isEnabled;
}

/** Turns voice announcements on/off; turning off also stops the current one. */
export function setSpeechEnabled(enabled: boolean) {
  isEnabled = enabled;
  try {
    localStorage.setItem(SPEECH_ENABLED_STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // storage unavailable — setting still applies for this session
  }
  if (!enabled) {
    queue.length = 0;
    if (currentClip) {
      currentClip.audio.pause();
      currentClip.done();
    }
  }
}

/** Faster speech the more announcements are backed up behind the current one. */
const currentPlaybackRate = (): number =>
  Math.min(MAX_PLAYBACK_RATE, 1 + queue.length * RATE_STEP_PER_QUEUED);

const applyPlaybackRate = (audio: HTMLAudioElement) => {
  audio.preservesPitch = true;
  audio.playbackRate = currentPlaybackRate();
};

const playClip = (src: string): Promise<void> =>
  new Promise((resolve) => {
    const audio = createAudio(src);
    audio.volume = SPEECH_VOLUME;
    applyPlaybackRate(audio);
    const done = () => {
      if (currentClip?.audio === audio) currentClip = null;
      releaseAudio(audio);
      resolve();
    };
    currentClip = { audio, done };
    audio.addEventListener('ended', done, { once: true });
    audio.addEventListener('error', done, { once: true });
    audio.play().catch((error) => {
      console.warn('Failed to play speech:', error);
      done();
    });
  });

const drainQueue = async () => {
  if (isSpeaking) return;
  isSpeaking = true;
  while (queue.length > 0) {
    const clips = queue.shift()!;
    for (const clip of clips) {
      if (!isEnabled) break;
      await playClip(clip);
    }
  }
  isSpeaking = false;
};

/** Queues a sequence of clips; announcements never overlap each other. */
const speak = (clips: string[]) => {
  if (!isEnabled) return;
  queue.push(clips);
  // speed up the clip already playing too, so the backlog clears sooner
  if (currentClip) applyPlaybackRate(currentClip.audio);
  void drainQueue();
};

/** Clips that read a non-negative integer digit by digit (12 -> "1", "2"). */
const numberClips = (value: number): string[] =>
  String(Math.max(0, Math.floor(value)))
    .split('')
    .map((d) => DIGITS[Number(d)]);

export function announceCalculatingTrajectory() {
  speak([calculatingTrajectoryClip]);
}

/** "Missile N has been launched at its target" */
export function announceLaunch(missileNumber: number) {
  speak([...numberClips(missileNumber), launchedClip]);
}

/** "Missile N successfully reached its target" */
export function announceTargetReached(missileNumber: number) {
  speak([...numberClips(missileNumber), reachedTargetClip]);
}
