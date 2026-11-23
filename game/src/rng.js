// A small seeded random source (mulberry32). One seed always builds the
// same city and the same traffic, which is what makes staged screenshots
// reproducible from one run to the next.
export function makeRng(seed) {
  let s = seed >>> 0;
  function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    int(lo, hi) { return lo + Math.floor(next() * (hi - lo + 1)); },
    range(lo, hi) { return lo + next() * (hi - lo); },
    pick(arr) { return arr[Math.floor(next() * arr.length)]; },
    chance(p) { return next() < p; },
  };
}
