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
};

export function playNotifySound(level, alarmType = "beep") {
  if (typeof AudioContext === "undefined" || level === 0) return;
  const audioContext = new AudioContext();
  const peakGain = 0.5 * (level / 100);
  const pattern = ALARM_PATTERNS[alarmType] || ALARM_PATTERNS.beep;
  pattern(audioContext, peakGain);
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
  const peakGain = 0.5 * (level / 100);
  const pattern = ALARM_PATTERNS[alarmType] || ALARM_PATTERNS.beep;
  pattern(previewAudioContext, peakGain);
}

export function effectiveVolume(masterVolume, timerVolume) {
  return Math.round(masterVolume * (timerVolume / 100));
}

// onStateChange fires whenever timer.remainingAlarmCount changes - the blink
// effect (CSS .is-alarming, driven off remainingAlarmCount > 0) tracks it, so
// it's consumed one per second right alongside the beeps instead of running
// on a separate isAlarming on/off flag.
export function notifyDone(timer, getMasterVolume, onBeep, maxRepeats, onStateChange) {
  // Read timer.volume/alarmType and the master volume fresh on every beep,
  // not just once at start, so changing the volume while the alarm is
  // already repeating takes effect on the next beep instead of the next timer.
  const play = () => {
    playNotifySound(effectiveVolume(getMasterVolume(), timer.volume), timer.alarmType);
    onBeep?.();
  };
  timer.remainingAlarmCount = maxRepeats;
  onStateChange?.();
  play();
  timer.alarmIntervalId = setInterval(() => {
    timer.remainingAlarmCount -= 1;
    if (timer.remainingAlarmCount <= 0) {
      stopAlarm(timer);
      onStateChange?.();
      return;
    }
    play();
    onStateChange?.();
  }, 1000);
}

export function stopAlarm(timer) {
  clearInterval(timer.alarmIntervalId);
  timer.alarmIntervalId = null;
  timer.remainingAlarmCount = 0;
}
