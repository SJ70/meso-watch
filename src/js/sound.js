export function playNotifySound(level) {
  if (typeof AudioContext === "undefined" || level === 0) return;
  const audioContext = new AudioContext();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.frequency.value = 660;
  const peakGain = 0.16 * (level / 100);
  gain.gain.setValueAtTime(peakGain, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.5);
}

export function effectiveVolume(masterVolume, timerVolume) {
  return Math.round(masterVolume * (timerVolume / 100));
}

export function notifyDone(timer, masterVolume) {
  const level = effectiveVolume(masterVolume, timer.volume);
  playNotifySound(level);
  timer.alarmIntervalId = setInterval(() => playNotifySound(level), 1000);
}

export function stopAlarm(timer) {
  clearInterval(timer.alarmIntervalId);
  timer.alarmIntervalId = null;
}
