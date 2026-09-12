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
};

export function playNotifySound(level, alarmType = "beep") {
  if (typeof AudioContext === "undefined" || level === 0) return;
  const audioContext = new AudioContext();
  const peakGain = 0.16 * (level / 100);
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
  const peakGain = 0.16 * (level / 100);
  const pattern = ALARM_PATTERNS[alarmType] || ALARM_PATTERNS.beep;
  pattern(previewAudioContext, peakGain);
}

export function effectiveVolume(masterVolume, timerVolume) {
  return Math.round(masterVolume * (timerVolume / 100));
}

export function notifyDone(timer, getMasterVolume) {
  // Read timer.volume/alarmType and the master volume fresh on every beep,
  // not just once at start, so changing the volume while the alarm is
  // already repeating takes effect on the next beep instead of the next timer.
  const play = () => playNotifySound(effectiveVolume(getMasterVolume(), timer.volume), timer.alarmType);
  play();
  timer.alarmIntervalId = setInterval(play, 1000);
}

export function stopAlarm(timer) {
  clearInterval(timer.alarmIntervalId);
  timer.alarmIntervalId = null;
}
