// All sound is synthesised with WebAudio oscillators — no audio files, no
// network. Short blips for shots and pickups, a two-tone siren, an engine
// hum whose pitch follows speed, a dispatch radio blip, and the car radio:
// three stations, each with its own bass line and lead pattern, scheduled a
// bar at a time. Q switches station, M toggles the music.
import { STATIONS } from './settings.js';

export function makeSound() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let musicTimer = null;
  let muted = false;
  let musicOn = true;
  let stationIndex = 0;
  let beat = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      ctx = new AudioCtx();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, lowpass) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass || 1200;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
  }

  // The radio: each station's bass line, one note per beat, with its lead
  // pattern chiming in every other bar. Switching stations resets the beat
  // so the new station starts on its first note.
  function startMusic() {
    if (!ensure() || musicTimer) return;
    musicTimer = window.setInterval(() => {
      if (muted || !musicOn) return;
      const station = STATIONS[stationIndex % STATIONS.length];
      const note = station.bass[beat % station.bass.length];
      beat += 1;
      if (note > 0) tone(note, 0.42, 'triangle', 0.16);
      if (beat % 8 === 0) {
        const lead = station.lead[Math.floor(beat / 8) % station.lead.length];
        tone(lead, 0.3, 'sine', 0.05, lead * 1.5);
      }
    }, 300);
  }

  return {
    unlock() { if (ensure() && ctx.state === 'suspended') ctx.resume(); startMusic(); },
    toggleMute() { muted = !muted; return muted; },
    toggleMusic() { musicOn = !musicOn; return musicOn; },
    setStation(i) { stationIndex = i % STATIONS.length; beat = 0; },
    dispatchBlip() { tone(1200, 0.06, 'square', 0.12); window.setTimeout(() => tone(900, 0.06, 'square', 0.12), 90); },
    shoot() { noise(0.12, 0.5, 2600); tone(180, 0.08, 'square', 0.18, 60); },
    punch() { noise(0.08, 0.35, 700); },
    hit() { tone(140, 0.12, 'sawtooth', 0.2, 70); },
    pickup() { tone(660, 0.09, 'sine', 0.25); window.setTimeout(() => tone(990, 0.14, 'sine', 0.25), 70); },
    cash() { tone(880, 0.1, 'sine', 0.25); window.setTimeout(() => tone(1320, 0.18, 'sine', 0.25), 80); },
    missionDone() { [523, 659, 784, 1046].forEach((f, i) => window.setTimeout(() => tone(f, 0.22, 'triangle', 0.3), i * 110)); },
    missionFail() { [330, 262, 196].forEach((f, i) => window.setTimeout(() => tone(f, 0.3, 'sawtooth', 0.18), i * 140)); },
    siren() { tone(750, 0.28, 'sine', 0.12, 950); window.setTimeout(() => tone(950, 0.28, 'sine', 0.12, 750), 280); },
    crash() { noise(0.25, 0.5, 500); tone(90, 0.2, 'sawtooth', 0.25, 40); },
    enterCar() { tone(220, 0.1, 'square', 0.15, 330); },
    reload() { tone(300, 0.06, 'square', 0.15); window.setTimeout(() => tone(420, 0.06, 'square', 0.15), 120); },
    busted() { [440, 440, 349].forEach((f, i) => window.setTimeout(() => tone(f, 0.25, 'square', 0.2), i * 180)); },
    engine(speed01, on) {
      if (!ensure() || muted) return;
      if (!on) {
        if (engineOsc) { try { engineOsc.stop(); } catch { /* already stopped */ } engineOsc = null; engineGain = null; }
        return;
      }
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineGain = ctx.createGain();
        engineOsc.type = 'sawtooth';
        engineGain.gain.value = 0.05;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 600;
        engineOsc.connect(filter);
        filter.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      }
      engineOsc.frequency.setTargetAtTime(60 + speed01 * 160, ctx.currentTime, 0.08);
      engineGain.gain.setTargetAtTime(0.03 + speed01 * 0.06, ctx.currentTime, 0.1);
    },
  };
}
