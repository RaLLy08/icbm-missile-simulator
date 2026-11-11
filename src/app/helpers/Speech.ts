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
import tenClip from 'public/audio/speech/digits/ten.wav';
import twentyClip from 'public/audio/speech/digits/twenty.wav';
import thirtyClip from 'public/audio/speech/digits/thirty.wav';
import fortyClip from 'public/audio/speech/digits/fourty.wav';
import fiftyClip from 'public/audio/speech/digits/fifty.wav';
import sixtyClip from 'public/audio/speech/digits/sixty.wav';
import seventyClip from 'public/audio/speech/digits/seventy.wav';
import eightyClip from 'public/audio/speech/digits/eighty.wav';
import hundredClip from 'public/audio/speech/digits/hundred.wav';
import minuteClip from 'public/audio/speech/time/minute.wav';
import minutesClip from 'public/audio/speech/time/minutes.wav';
import secondClip from 'public/audio/speech/time/second.wav';
import secondsClip from 'public/audio/speech/time/seconds.wav';
import launchedClip from 'public/audio/speech/launch/has_been_launched_at_its_target.wav';
import estimatedTimeOfFlightClip from 'public/audio/speech/launch/estimated_time_of_flight.wav';
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

/** Clips for 10, 20 … 80, indexed by the tens digit. No clip for 90. */
const TENS: (string | undefined)[] = [
  undefined,
  tenClip,
  twentyClip,
  thirtyClip,
  fortyClip,
  fiftyClip,
  sixtyClip,
  seventyClip,
  eightyClip,
];

const SPEECH_VOLUME = 0.8;

/** Playback speeds up by this much per announcement waiting in the queue. */
const RATE_STEP_PER_QUEUED = 0.15;
const MAX_PLAYBACK_RATE = 5;

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

/**
 * Clips that read a non-negative integer as words where recordings allow
 * (42 -> "forty", "two"; 305 -> "three", "hundred", "five"). There are no
 * clips for 11–19 or 90–99, so those (and numbers >= 1000) are read
 * digit by digit instead.
 */
const spokenNumberClips = (value: number): string[] => {
  const n = Math.max(0, Math.floor(value));

  if (n < 10) return [DIGITS[n]];

  if (n < 100) {
    const tens = TENS[Math.floor(n / 10)];
    const ones = n % 10;
    if (!tens || (n > 10 && n < 20)) return numberClips(n);
    return ones ? [tens, DIGITS[ones]] : [tens];
  }

  if (n < 1000) {
    const rest = n % 100;
    const hundreds = [DIGITS[Math.floor(n / 100)], hundredClip];
    return rest ? [...hundreds, ...spokenNumberClips(rest)] : hundreds;
  }

  return numberClips(n);
};

/**
 * "N minute(s) M second(s)". There are no hour/day clips, so long flights
 * are read in minutes; zero parts are skipped. Seconds are rounded to the
 * nearest ten (10, 20 … 50) so they are always voiced with a single clip;
 * 55+ seconds carries over into the next minute.
 */
const durationClips = (seconds: number): string[] => {
  // At least 10 so a very short flight still says "ten seconds".
  const total = Math.max(10, Math.round(seconds / 10) * 10);
  const minutes = Math.floor(total / 60);
  const secs = total % 60;

  const clips: string[] = [];
  if (minutes) {
    clips.push(
      ...spokenNumberClips(minutes),
      minutes === 1 ? minuteClip : minutesClip
    );
  }
  if (secs || !minutes) {
    clips.push(
      ...spokenNumberClips(secs),
      secs === 1 ? secondClip : secondsClip
    );
  }
  return clips;
};

export function announceCalculatingTrajectory() {
  speak([calculatingTrajectoryClip]);
}

/** "Missile N has been launched at its target" */
export function announceLaunch(missileNumber: number) {
  speak([...numberClips(missileNumber), launchedClip]);
}

/** "Estimated time of flight X minutes Y seconds"; skipped if the time is unknown. */
export function announceEstimatedFlightTime(seconds: number | undefined) {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) {
    return;
  }
  speak([estimatedTimeOfFlightClip, ...durationClips(seconds)]);
}

/** "Missile N successfully reached its target" */
export function announceTargetReached(missileNumber: number) {
  speak([...numberClips(missileNumber), reachedTargetClip]);
}
