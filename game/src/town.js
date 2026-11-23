// Solara Bay itself: a road grid, city blocks full of buildings, a park, a
// beach and the docks. Generation is seeded, so the same seed always builds
// the same city. Collision is circle-vs-building-rectangle, with sliding
// along walls. Landmark buildings carry names the jobs point at.
import { AREAS, MAP, SPOTS } from './settings.js';

export const GRID = 400;
export const STREET_W = 96;

function centers(limit) {
  const out = [];
  for (let c = 200; c < limit; c += GRID) out.push(c);
  return out;
}
export const LANES_X = centers(MAP.w);
export const LANES_Y = centers(MAP.h);

export function onStreet(x, y) {
  for (const rx of LANES_X) if (Math.abs(x - rx) < STREET_W / 2) return true;
  for (const ry of LANES_Y) if (Math.abs(y - ry) < STREET_W / 2) return true;
  return false;
}

export function areaAt(x, y) {
  for (const a of AREAS) {
    if (x >= a.x && x < a.x + a.w && y >= a.y && y < a.y + a.h) return a;
  }
  return AREAS[0];
}

export function buildTown(rng) {
  const blocks = [];
  const trees = [];
  const palms = [];
  const pickups = [];
  const parks = [];
  const signs = [];
  const paint = ['#d08a5a', '#c97e6b', '#a8b8a0', '#7e8a99', '#e8b04b', '#b5654a', '#6d8a7a', '#c9a227', '#e89a8a', '#8aa8c9'];

  // City blocks are the squares between roads. Each gets buildings, a park,
  // or beach treatment, depending on its neighbourhood.
  for (let bx = 0; bx < LANES_X.length - 1; bx += 1) {
    for (let by = 0; by < LANES_Y.length - 1; by += 1) {
      const x0 = LANES_X[bx] + STREET_W / 2 + 8;
      const y0 = LANES_Y[by] + STREET_W / 2 + 8;
      const x1 = LANES_X[bx + 1] - STREET_W / 2 - 8;
      const y1 = LANES_Y[by + 1] - STREET_W / 2 - 8;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const area = areaAt(cx, cy);
      // Beach strip: sand and palms, no buildings.
      if (cx > 2850) {
        for (let i = 0; i < 5; i += 1) palms.push({ x: rng.range(x0, x1), y: rng.range(y0, y1) });
        continue;
      }
      // Verde Park blocks: grass, trees, a pond.
      if (area.name === 'Verde Park' && rng.chance(0.55)) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        for (let i = 0; i < 7; i += 1) trees.push({ x: rng.range(x0 + 20, x1 - 20), y: rng.range(y0 + 20, y1 - 20), r: rng.range(10, 16) });
        continue;
      }
      // Docks: wide low warehouses.
      if (area.name === 'Marina Docks' && rng.chance(0.5)) {
        blocks.push({
          x: x0 + 20, y: y0 + 40, w: x1 - x0 - 40, h: 110,
          color: '#8a99a8', floors: rng.int(1, 2), label: 'WAREHOUSE', neon: '',
        });
        continue;
      }
      // Normal block: one tall building, or a pair of smaller ones.
      const downtown = area.name === 'Downtown';
      const neonWords = ['HOTEL SOL', 'NEON', 'CAFÉ LUNA', 'TACOS', 'CINEMA', 'BAR MAR'];
      if (rng.chance(0.6)) {
        const w = rng.range(120, x1 - x0 - 30);
        const h = rng.range(110, y1 - y0 - 30);
        const label = downtown && rng.chance(0.4) ? rng.pick(['HOTEL', 'BANK', 'TOWER', 'PLAZA']) : '';
        const neon = downtown && rng.chance(0.5) ? rng.pick(neonWords) : '';
        blocks.push({
          x: cx - w / 2, y: cy - h / 2, w, h,
          color: rng.pick(paint), floors: downtown ? rng.int(3, 6) : rng.int(1, 3),
          label, neon,
        });
        if (neon) signs.push({ x: cx, y: cy - h / 2 - 6, text: neon });
      } else {
        blocks.push({
          x: x0 + 10, y: y0 + 10, w: (x1 - x0) / 2 - 20, h: (y1 - y0) / 2 - 20,
          color: rng.pick(paint), floors: rng.int(1, 3), label: '', neon: '',
        });
        blocks.push({
          x: cx + 10, y: cy + 10, w: (x1 - x0) / 2 - 20, h: (y1 - y0) / 2 - 20,
          color: rng.pick(paint), floors: rng.int(1, 2), label: '', neon: '',
        });
      }
      // A tree or two on the block's corners.
      if (rng.chance(0.5)) trees.push({ x: x0 + 14, y: y1 - 14, r: 11 });
      if (rng.chance(0.3)) trees.push({ x: x1 - 14, y: y0 + 14, r: 11 });
    }
  }

  // Landmark buildings the story names: the bank, the garage, the safehouse.
  function landmark(place, label, color) {
    // Find the block the place sits in and plant a labelled building beside it.
    let bx = 0; let by = 0;
    for (let i = 0; i < LANES_X.length - 1; i += 1) {
      if (place.x >= LANES_X[i] + STREET_W / 2 && place.x < LANES_X[i + 1] - STREET_W / 2) bx = i;
    }
    for (let i = 0; i < LANES_Y.length - 1; i += 1) {
      if (place.y >= LANES_Y[i] + STREET_W / 2 && place.y < LANES_Y[i + 1] - STREET_W / 2) by = i;
    }
    const x0 = LANES_X[bx] + STREET_W / 2 + 8;
    const y0 = LANES_Y[by] + STREET_W / 2 + 8;
    const x1 = LANES_X[bx + 1] - STREET_W / 2 - 8;
    const y1 = LANES_Y[by + 1] - STREET_W / 2 - 8;
    blocks.push({
      x: x0 + 30, y: y0 + 30, w: Math.min(220, x1 - x0 - 60), h: Math.min(150, y1 - y0 - 60),
      color, floors: 2, label, neon: '',
    });
  }
  landmark(SPOTS.bank, 'BANK', '#c9a227');
  landmark(SPOTS.garage, 'GARAGE', '#c96a4a');
  landmark(SPOTS.safehouse, 'SAFEHOUSE', '#5d8a46');

  // Cash pickups scattered on sidewalks and in the park.
  for (let i = 0; i < 18; i += 1) {
    const rx = LANES_X[rng.int(0, LANES_X.length - 1)];
    const ry = LANES_Y[rng.int(0, LANES_Y.length - 1)];
    pickups.push({ x: rx + rng.range(-160, 160), y: ry + rng.range(-160, 160), taken: false, value: 50, kind: 'cash' });
  }
  // Health pickups near the hospital and the beach and the docks.
  pickups.push({ x: 1400, y: 1400, taken: false, value: 50, kind: 'health' });
  pickups.push({ x: 2900, y: 900, taken: false, value: 50, kind: 'health' });
  pickups.push({ x: 600, y: 2100, taken: false, value: 50, kind: 'health' });

  function hitsBlock(x, y, r) {
    for (const b of blocks) {
      const nx = Math.max(b.x, Math.min(x, b.x + b.w));
      const ny = Math.max(b.y, Math.min(y, b.y + b.h));
      const dx = x - nx; const dy = y - ny;
      if (dx * dx + dy * dy < r * r) return b;
    }
    return null;
  }

  // Move a circle, sliding along building walls; returns the corrected position.
  // The full diagonal step is checked first: moving x-then-y alone lets a
  // diagonal step cut the corner of a building and end up inside it.
  function slideCircle(x, y, dx, dy, r) {
    const nx = x + dx;
    const ny = y + dy;
    let rx = x; let ry = y;
    if (!hitsBlock(nx, ny, r)) { rx = nx; ry = ny; }
    else if (!hitsBlock(nx, y, r)) rx = nx;
    else if (!hitsBlock(x, ny, r)) ry = ny;
    // Keep inside the world; the sea is a wall on the east edge.
    rx = Math.max(20, Math.min(MAP.w - 140, rx));
    ry = Math.max(20, Math.min(MAP.h - 20, ry));
    return { x: rx, y: ry };
  }

  function randomStreetPoint() {
    if (rng.chance(0.5)) {
      return { x: LANES_X[rng.int(0, LANES_X.length - 1)] + rng.range(-24, 24), y: rng.range(100, MAP.h - 100) };
    }
    return { x: rng.range(100, MAP.w - 200), y: LANES_Y[rng.int(0, LANES_Y.length - 1)] + rng.range(-24, 24) };
  }

  function nearestStreet(x, y) {
    let best = null; let bestD = Infinity;
    for (const rx of LANES_X) { const d = Math.abs(x - rx); if (d < bestD) { bestD = d; best = { axis: 'x', line: rx, along: y }; } }
    for (const ry of LANES_Y) { const d = Math.abs(y - ry); if (d < bestD) { bestD = d; best = { axis: 'y', line: ry, along: x }; } }
    return best;
  }

  return {
    buildings: blocks, trees, palms, pickups, parks, signs,
    hitsBuilding: hitsBlock, moveCircle: slideCircle,
    randomRoadPoint: randomStreetPoint, nearestRoad: nearestStreet,
  };
}
