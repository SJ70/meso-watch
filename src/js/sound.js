import { isCustomSoundId, getCustomSoundBuffer } from "./customSounds.js";

function scheduleTone(audioContext, { frequency, type = "sine", startTime, duration, peakGain }) {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(peakGain, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

function scheduleSweep(audioContext, { startFrequency, endFrequency, type = "sawtooth", startTime, duration, peakGain }) {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(startFrequency, startTime);
  oscillator.frequency.linearRampToValueAtTime(endFrequency, startTime + duration);
  gain.gain.setValueAtTime(peakGain, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

// Schedules [offsetSeconds, value] points on an AudioParam: jumps to the
// first value at startTime, then ramps linearly through the rest.
function automate(param, points, startTime) {
  const [[, firstValue], ...rest] = points;
  param.setValueAtTime(firstValue, startTime);
  rest.forEach(([offset, value]) => param.linearRampToValueAtTime(value, startTime + offset));
}

// A more expressive tone than scheduleTone: pitch curve, optional vibrato,
// and an attack/hold/release envelope instead of an instant-on exponential decay.
function scheduleVoice(audioContext, { type = "sawtooth", frequencies, startTime, duration, peakGain, attack = 0.01, release = duration - attack, vibrato }) {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  automate(oscillator.frequency, frequencies, startTime);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  const endTime = startTime + duration;
  gain.gain.setValueAtTime(0.001, startTime);
  gain.gain.exponentialRampToValueAtTime(peakGain, startTime + attack);
  gain.gain.setValueAtTime(peakGain, endTime - release);
  gain.gain.exponentialRampToValueAtTime(0.001, endTime);
  if (vibrato) {
    const lfo = audioContext.createOscillator();
    const lfoGain = audioContext.createGain();
    lfo.frequency.value = vibrato.rate;
    lfoGain.gain.value = vibrato.depth;
    lfo.connect(lfoGain);
    lfoGain.connect(oscillator.frequency);
    lfo.start(startTime);
    lfo.stop(endTime);
  }
  oscillator.start(startTime);
  oscillator.stop(endTime);
}

function scheduleNoise(audioContext, { startTime, duration, peakGain, filter }) {
  const buffer = audioContext.createBuffer(1, Math.ceil(audioContext.sampleRate * duration), audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  const biquad = audioContext.createBiquadFilter();
  biquad.type = filter.type;
  biquad.frequency.value = filter.frequency;
  biquad.Q.value = filter.Q ?? 1;
  const gain = audioContext.createGain();
  source.connect(biquad);
  biquad.connect(gain);
  gain.connect(audioContext.destination);
  gain.gain.setValueAtTime(peakGain, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  source.start(startTime);
  source.stop(startTime + duration);
}

// keys must match the ids in ALARM_TYPES in constants.js
const ALARM_PATTERNS = {
  beep(audioContext, peakGain) {
    scheduleTone(audioContext, { frequency: 660, type: "sine", startTime: audioContext.currentTime, duration: 0.5, peakGain });
  },
  chime(audioContext, peakGain) {
    const now = audioContext.currentTime;
    scheduleTone(audioContext, { frequency: 523.25, type: "sine", startTime: now, duration: 0.35, peakGain });
    scheduleTone(audioContext, { frequency: 784, type: "sine", startTime: now + 0.18, duration: 0.4, peakGain });
  },
  alert(audioContext, peakGain) {
    const now = audioContext.currentTime;
    [0, 0.18, 0.36].forEach((offset) => {
      scheduleTone(audioContext, { frequency: 880, type: "square", startTime: now + offset, duration: 0.12, peakGain: peakGain * 0.7 });
    });
  },
  bell(audioContext, peakGain) {
    scheduleTone(audioContext, { frequency: 988, type: "triangle", startTime: audioContext.currentTime, duration: 0.9, peakGain });
  },
  ping(audioContext, peakGain) {
    scheduleTone(audioContext, { frequency: 1200, type: "sine", startTime: audioContext.currentTime, duration: 0.15, peakGain });
  },
  double(audioContext, peakGain) {
    const now = audioContext.currentTime;
    scheduleTone(audioContext, { frequency: 660, type: "sine", startTime: now, duration: 0.15, peakGain });
    scheduleTone(audioContext, { frequency: 660, type: "sine", startTime: now + 0.22, duration: 0.15, peakGain });
  },
  arpeggio(audioContext, peakGain) {
    const now = audioContext.currentTime;
    [440, 554.37, 659.25].forEach((frequency, index) => {
      scheduleTone(audioContext, { frequency, type: "triangle", startTime: now + index * 0.12, duration: 0.2, peakGain });
    });
  },
  siren(audioContext, peakGain) {
    const now = audioContext.currentTime;
    scheduleSweep(audioContext, { startFrequency: 440, endFrequency: 880, type: "sawtooth", startTime: now, duration: 0.3, peakGain: peakGain * 0.6 });
    scheduleSweep(audioContext, { startFrequency: 880, endFrequency: 440, type: "sawtooth", startTime: now + 0.3, duration: 0.3, peakGain: peakGain * 0.6 });
  },
  whistle(audioContext, peakGain) {
    // Referee whistle "삐이익": one long blast of a high sine whose fast,
    // deep vibrato is the rattling pea inside the whistle, over a little
    // breathy noise.
    const now = audioContext.currentTime;
    const duration = 0.6;
    scheduleVoice(audioContext, {
      type: "sine",
      frequencies: [[0, 2600], [0.03, 2800]],
      startTime: now,
      duration,
      peakGain: peakGain * 0.6,
      attack: 0.01,
      release: 0.04,
      vibrato: { rate: 32, depth: 90 },
    });
    scheduleNoise(audioContext, { startTime: now, duration, peakGain: peakGain * 0.12, filter: { type: "bandpass", frequency: 2800, Q: 3 } });
  },
};

// A registered sound (see customSounds.js) plays its decoded file at the
// volume level as-is (100% = the file's own loudness), unlike the synthesized
// patterns, which are scaled down to a comfortable peak. Returns false if the
// sound isn't available (e.g. deleted), so the caller can fall back.
function playCustomSound(audioContext, alarmType, level) {
  const buffer = getCustomSoundBuffer(alarmType);
  if (!buffer) return false;
  const source = audioContext.createBufferSource();
  const gain = audioContext.createGain();
  source.buffer = buffer;
  gain.gain.value = level / 100;
  source.connect(gain);
  gain.connect(audioContext.destination);
  source.start();
  return true;
}

function playAlarmType(audioContext, level, alarmType) {
  if (isCustomSoundId(alarmType) && playCustomSound(audioContext, alarmType, level)) return;
  const pattern = ALARM_PATTERNS[alarmType] || ALARM_PATTERNS.beep;
  pattern(audioContext, 0.5 * (level / 100));
}

// The alarm repeats every second, but a registered sound can be longer than
// that - each new play of a registered sound cuts off its previous one
// (closing that play's context) instead of piling up on top of it.
const customSoundContexts = new Map(); // alarmType -> AudioContext

export function playNotifySound(level, alarmType = "beep") {
  if (typeof AudioContext === "undefined" || level === 0) return;
  const audioContext = new AudioContext();
  if (isCustomSoundId(alarmType)) {
    customSoundContexts.get(alarmType)?.close();
    customSoundContexts.set(alarmType, audioContext);
  }
  playAlarmType(audioContext, level, alarmType);
}

// Settings-modal sliders/selects call this to preview a sound as the user
// adjusts them; closing the previous preview's context first stops it
// immediately, so quick successive changes don't stack overlapping sounds.
let previewAudioContext = null;
export function previewAlarmSound(level, alarmType = "beep") {
  if (previewAudioContext) {
    previewAudioContext.close();
    previewAudioContext = null;
  }
  if (typeof AudioContext === "undefined" || level === 0) return;
  previewAudioContext = new AudioContext();
  playAlarmType(previewAudioContext, level, alarmType);
}

export function effectiveVolume(masterVolume, timerVolume) {
  return Math.round(masterVolume * (timerVolume / 100));
}

// onStateChange(restarted) fires whenever timer.remainingAlarmCount changes -
// the blink effect (CSS .is-alarming, driven off remainingAlarmCount > 0)
// tracks it, so it's consumed one per second right alongside the beeps
// instead of running on a separate isAlarming on/off flag. restarted is true
// only on the call that (re)seeds remainingAlarmCount to maxRepeats, so the
// caller knows to restart the blink animation from scratch (see
// restartAlarmBlink in app.js) rather than let it keep running toward its
// old, now-stale iteration count.
export function notifyDone(timer, getMasterVolume, onBeep, maxRepeats, onStateChange) {
  // Read timer.volume/alarmType and the master volume fresh on every beep,
  // not just once at start, so changing the volume while the alarm is
  // already repeating takes effect on the next beep instead of the next timer.
  const play = () => {
    playNotifySound(effectiveVolume(getMasterVolume(), timer.volume), timer.alarmType);
    onBeep?.();
  };
  // If a previous alarm cycle is still counting down (e.g. auto-restart
  // finished the timer again before the last alarm finished repeating),
  // just refresh the remaining count onto the existing interval instead of
  // starting a second one - two intervals both decrementing/playing would
  // double up beeps and desync the blink from the actual remaining count.
  const alreadyRunning = Boolean(timer.alarmIntervalId);
  timer.remainingAlarmCount = maxRepeats;
  onStateChange?.(true);
  play();
  if (alreadyRunning) return;
  timer.alarmIntervalId = setInterval(() => {
    timer.remainingAlarmCount -= 1;
    if (timer.remainingAlarmCount <= 0) {
      stopAlarm(timer);
      onStateChange?.(false);
      return;
    }
    play();
    onStateChange?.(false);
  }, 1000);
}

export function stopAlarm(timer) {
  clearInterval(timer.alarmIntervalId);
  timer.alarmIntervalId = null;
  timer.remainingAlarmCount = 0;
}
