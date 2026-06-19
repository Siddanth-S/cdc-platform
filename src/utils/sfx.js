let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(e => console.warn('AudioContext resume failed:', e));
  }
  return audioCtx;
}

export function playSFX(type) {
  // SFX is enabled by default if not set
  const sfxEnabled = localStorage.getItem('sfx_enabled') !== 'false';
  if (!sfxEnabled) return;

  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    if (type === 'click') {
      // Futuristic mechanical click sound
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(900, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.04);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.04);
    } else if (type === 'sent') {
      // Pleasant upward neon chime
      const playNote = (freq, start, duration, volume = 0.08) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.05, start + duration);
        gain.gain.setValueAtTime(volume, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + duration);
      };
      playNote(523.25, now, 0.12, 0.08); // C5
      playNote(659.25, now + 0.06, 0.15, 0.06); // E5
      playNote(783.99, now + 0.12, 0.22, 0.05); // G5
    } else if (type === 'received') {
      // Gentle downward alert chime
      const playNote = (freq, start, duration, volume = 0.08) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(volume, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + duration);
      };
      playNote(783.99, now, 0.1, 0.06); // G5
      playNote(659.25, now + 0.06, 0.1, 0.05); // E5
      playNote(523.25, now + 0.12, 0.22, 0.08); // C5
    } else if (type === 'hover') {
      // Extremely subtle low-volume click/tick
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, now);
      gain.gain.setValueAtTime(0.008, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.015);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.015);
    }
  } catch (e) {
    console.warn('Play SFX failed:', e);
  }
}
