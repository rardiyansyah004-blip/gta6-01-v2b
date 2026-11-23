// The car radio: three switchable stations, Q to change. Each station is
// just a name, a bass line and a lead pattern — the synth in sound.js plays
// them, and the HUD shows which one is on. No audio files, no network.
import { STATIONS } from './settings.js';

export function makeStations() {
  let index = 0;
  let on = true;

  function current() { return STATIONS[index]; }

  function next() {
    index = (index + 1) % STATIONS.length;
    return current();
  }

  function toggle() {
    on = !on;
    return on;
  }

  return {
    get index() { return index; },
    set index(v) { index = v % STATIONS.length; },
    get on() { return on; },
    current, next, toggle,
    label() { return on ? `${current().name} — ${current().tag}` : 'RADIO OFF'; },
  };
}
