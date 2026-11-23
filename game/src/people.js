// Everyone who lives in Solara Bay: the player, traffic cars, pedestrians,
// the police who chase a wanted player, rival gang members, the bullets they
// fire — and Air One, the SBPD helicopter that watches from above at high
// wanted levels. No drawing here — update functions only; paint.js draws
// the results.
import { DRIVE, MAP, ON_FOOT, RIDES } from './settings.js';

export function gap(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function headingTo(a, b) { return Math.atan2(b.y - a.y, b.x - a.x); }
function clampAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function makePlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, health: ON_FOOT.hp, money: 0,
    inCar: null, aimAngle: -Math.PI / 2, aimX: x, aimY: y - 100,
    ammo: ON_FOOT.clip, reloading: 0,
    fireTimer: 0, punchTimer: 0, walkPhase: 0, moving: false, bustTimer: 0,
    // Garage upgrades bought with cash: +15% top speed each, up to 3.
    tunes: 0, weaponTier: 0,
  };
}

export function makeCar(x, y, angle, model, kind) {
  return {
    x, y, angle, speed: 0, model, color: model.color, kind, // 'parked' | 'traffic' | 'police' | 'player' | 'roadblock' | 'patrol'
    health: DRIVE.hp, axis: 'x', dir: 1, lane: 0, cruise: 150, stuck: 0,
    sirenPhase: Math.random() * 6, dead: false, bumpTimer: 0, ramTimer: 0,
  };
}

// Air One: a helicopter that spawns at 4+ stars, hovers above the player at
// an offset and keeps a searchlight on them. It never lands and never shoots;
// it is the eye that makes 5 stars feel different from 3.
export function makeHeli(x, y) {
  return { x, y, angle: 0, rotor: 0, spotlight: 0, dead: false, kind: 'heli' };
}

export function moveHeli(heli, player, dt) {
  if (!heli) return;
  heli.rotor += dt * 28;
  const tx = player.x + 90;
  const ty = player.y - 110;
  heli.x += (tx - heli.x) * Math.min(1, dt * 0.9);
  heli.y += (ty - heli.y) * Math.min(1, dt * 0.9);
  heli.angle = Math.atan2(player.y - heli.y, player.x - heli.x);
  heli.spotlight = 1;
}

// SBPD patrol cars: they cruise the city like traffic even when nobody is
// wanted, so the streets always feel policed. They look like police cars
// and drive like traffic; only a wanted level turns them into pursuers.
export function spawnPatrols(town, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const p = town.randomRoadPoint();
    const road = town.nearestRoad(p.x, p.y);
    const car = makeCar(p.x, p.y, road.axis === 'x' ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI), { name: 'Interceptor', color: '#1c2733', pace: 1.05, kind: 'police' }, 'patrol');
    car.axis = road.axis;
    car.line = road.line;
    car.dir = rng.chance(0.5) ? 1 : -1;
    car.lane = rng.chance(0.5) ? 18 : -18;
    car.cruise = rng.range(130, 170);
    cars.push(car);
  }
  return cars;
}

export function spawnTraffic(town, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const p = town.randomRoadPoint();
    const road = town.nearestRoad(p.x, p.y);
    const model = rng.pick(RIDES);
    // axis 'x' is a vertical road (travel north/south), 'y' a horizontal one.
    const car = makeCar(p.x, p.y, road.axis === 'x' ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI), model, 'traffic');
    car.axis = road.axis;
    car.line = road.line;
    car.dir = rng.chance(0.5) ? 1 : -1;
    car.lane = rng.chance(0.5) ? 18 : -18;
    car.cruise = rng.range(120, 190);
    cars.push(car);
  }
  return cars;
}

export function spawnParked(town, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const p = town.randomRoadPoint();
    const road = town.nearestRoad(p.x, p.y);
    const model = rng.pick(RIDES);
    const along = road.axis === 'x' ? p.y : p.x;
    const off = (road.axis === 'x' ? 38 : -38);
    const car = makeCar(
      road.axis === 'x' ? road.line + off : along,
      road.axis === 'x' ? along : road.line + off,
      // Parked along the road, not across it: vertical road faces north/south.
      road.axis === 'x' ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI),
      model, 'parked',
    );
    car.axis = road.axis;
    cars.push(car);
  }
  return cars;
}

export function spawnWalkers(town, rng, count) {
  const walkers = [];
  const shirts = ['#e8e84a', '#4ad8d8', '#d84ad8', '#f2f2f2', '#8a5a3a', '#3a5a8a', '#c94a6a', '#ff9a3a'];
  for (let i = 0; i < count; i += 1) {
    const p = town.randomRoadPoint();
    walkers.push({
      x: p.x + rng.range(-60, 60), y: p.y + rng.range(-60, 60),
      tx: p.x, ty: p.y, speed: rng.range(35, 70), shirt: rng.pick(shirts),
      fleeing: false, dead: false, walkPhase: rng.range(0, 6), panic: 0,
    });
  }
  return walkers;
}

export function spawnCrew(rng, cx, cy, count) {
  // Gang members hold the streets: each one spawns on a road near the centre,
  // never inside a building.
  const roadsX = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
  const roadsY = [200, 600, 1000, 1400, 1800, 2200];
  const nearX = roadsX.reduce((a, b) => (Math.abs(b - cx) < Math.abs(a - cx) ? b : a));
  const nearY = roadsY.reduce((a, b) => (Math.abs(b - cy) < Math.abs(a - cy) ? b : a));
  const crew = [];
  for (let i = 0; i < count; i += 1) {
    let x; let y;
    if (rng.chance(0.5)) { y = nearY + rng.range(-16, 16); x = cx + rng.range(-150, 150); }
    else { x = nearX + rng.range(-16, 16); y = cy + rng.range(-150, 150); }
    crew.push({
      x, y, tx: cx, ty: cy, health: 100, fireTimer: rng.range(0.5, 1.5),
      shirt: '#2b2b2b', dead: false, walkPhase: 0, speed: 80,
    });
  }
  return crew;
}

function carAhead(cars, self, ahead) {
  for (const other of cars) {
    if (other === self || other.dead) continue;
    const dx = other.x - self.x; const dy = other.y - self.y;
    const forward = Math.cos(self.angle) * dx + Math.sin(self.angle) * dy;
    const side = Math.abs(-Math.sin(self.angle) * dx + Math.cos(self.angle) * dy);
    if (forward > 0 && forward < ahead && side < 30) return true;
  }
  return false;
}

// Traffic: cruise along its road, turn at intersections sometimes, queue
// behind the car ahead, and never drive through a building. axis 'x' is a
// vertical road (the car travels north/south, its line is an x-coordinate);
// 'y' is horizontal.
export function updateTraffic(cars, town, dt) {
  for (const car of cars) {
    if (car.kind !== 'traffic' && car.kind !== 'patrol' || car.dead) continue;
    if (car.bumpTimer > 0) car.bumpTimer -= dt;
    if (car.kind === 'patrol') car.sirenPhase += dt * 3;
    const along = car.axis === 'x' ? car.y : car.x;
    const crossings = car.axis === 'x' ? [200, 600, 1000, 1400, 1800, 2200] : [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
    let atCrossing = false;
    let crossLine = 0;
    for (const c of crossings) if (Math.abs(along - c) < 14) { atCrossing = true; crossLine = c; break; }
    if (atCrossing && Math.random() < 0.012) {
      // Turn onto the crossing road we are standing on.
      car.axis = car.axis === 'x' ? 'y' : 'x';
      car.line = crossLine;
      car.dir = Math.random() < 0.5 ? 1 : -1;
      car.lane = Math.random() < 0.5 ? 18 : -18;
    }
    const target = carAhead(cars, car, 85) ? 0 : car.cruise;
    car.speed += (target - car.speed) * Math.min(1, dt * 1.5);
    const wantAngle = car.axis === 'x' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
    car.angle += clampAngle(wantAngle - car.angle) * Math.min(1, dt * 6);
    // Stay in its lane: pull the car sideways onto the road line.
    const linePos = car.axis === 'x' ? car.x : car.y;
    const laneTarget = car.line + car.lane;
    const pull = (laneTarget - linePos) * dt * 2;
    const nx = car.x + Math.cos(car.angle) * car.speed * dt + (car.axis === 'x' ? pull : 0);
    const ny = car.y + Math.sin(car.angle) * car.speed * dt + (car.axis === 'x' ? 0 : pull);
    const moved = town.moveCircle(car.x, car.y, nx - car.x, ny - car.y, 20);
    car.x = moved.x; car.y = moved.y;
    // World edge: turn around instead of leaving town.
    if (car.x < 120 || car.x > MAP.w - 220 || car.y < 120 || car.y > MAP.h - 120) car.dir *= -1;
  }
}

// Pedestrians stroll to a nearby point, then pick another; gunfire sends them running.
export function updateWalkers(walkers, town, player, shooting, dt) {
  for (const ped of walkers) {
    if (ped.dead) continue;
    ped.walkPhase += dt * 6;
    if (shooting && gap(ped, player) < 420) { ped.fleeing = true; ped.panic = 3; }
    if (ped.panic > 0) ped.panic -= dt;
    else if (ped.fleeing && gap(ped, player) > 500) ped.fleeing = false;
    if (ped.fleeing) {
      const away = headingTo(player, ped);
      const moved = town.moveCircle(ped.x, ped.y, Math.cos(away) * 150 * dt, Math.sin(away) * 150 * dt, 10);
      ped.x = moved.x; ped.y = moved.y;
      continue;
    }
    const d = Math.hypot(ped.tx - ped.x, ped.ty - ped.y);
    if (d < 12) {
      ped.tx = Math.max(60, Math.min(MAP.w - 200, ped.x + (Math.random() - 0.5) * 500));
      ped.ty = Math.max(60, Math.min(MAP.h - 60, ped.y + (Math.random() - 0.5) * 500));
    } else {
      const a = Math.atan2(ped.ty - ped.y, ped.tx - ped.x);
      const moved = town.moveCircle(ped.x, ped.y, Math.cos(a) * ped.speed * dt, Math.sin(a) * ped.speed * dt, 10);
      ped.x = moved.x; ped.y = moved.y;
    }
  }
}

// Police cars chase on the roads, like traffic with a target: they cruise
// along their road, and at each intersection they turn onto the road that
// gets them closer to the player. They never cut across blocks, so they
// never end up driving through (or on top of) a building.
export function updateCops(cars, player, town, dt, wanted) {
  const ROADS_X = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
  const ROADS_Y = [200, 600, 1000, 1400, 1800, 2200];
  for (const car of cars) {
    if (car.kind !== 'police' || car.dead) continue;
    if (car.ramTimer > 0) car.ramTimer -= dt;
    car.sirenPhase += dt * 3;
    const target = player.inCar || player;
    const along = car.axis === 'x' ? car.y : car.x;
    const targetAlong = car.axis === 'x' ? target.y : target.x;
    // The player's coordinate across our current road: if it is far, the
    // player is not on our road and we should turn at the next intersection.
    const targetOffRoad = car.axis === 'x' ? target.x : target.y;
    car.dir = targetAlong >= along ? 1 : -1;
    // At an intersection, turn onto the crossing road when it leads closer.
    const crossings = car.axis === 'x' ? ROADS_Y : ROADS_X;
    let atCrossing = false;
    let crossLine = 0;
    for (const c of crossings) {
      if (Math.abs(along - c) < 16) { atCrossing = true; crossLine = c; break; }
    }
    if (atCrossing && Math.abs(targetOffRoad - car.line) > 60 && Math.random() < 0.9) {
      // Turn onto the crossing road we are standing on.
      car.axis = car.axis === 'x' ? 'y' : 'x';
      car.line = crossLine;
      car.lane = 0;
    }
    const d = gap(car, target);
    const wantSpeed = d > 90 ? 470 + wanted * 25 : 200;
    car.speed += (wantSpeed - car.speed) * Math.min(1, dt * 1.2);
    const wantAngle = car.axis === 'x' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
    car.angle += clampAngle(wantAngle - car.angle) * Math.min(1, dt * 6);
    const linePos = car.axis === 'x' ? car.x : car.y;
    const pull = (car.line - linePos) * dt * 3;
    const nx = car.x + Math.cos(car.angle) * car.speed * dt + (car.axis === 'x' ? pull : 0);
    const ny = car.y + Math.sin(car.angle) * car.speed * dt + (car.axis === 'x' ? 0 : pull);
    const moved = town.moveCircle(car.x, car.y, nx - car.x, ny - car.y, 20);
    car.x = moved.x; car.y = moved.y;
    if (car.x < 120 || car.x > MAP.w - 220 || car.y < 120 || car.y > MAP.h - 120) car.dir *= -1;
  }
}

// Player driving: arcade handling — accelerate, brake/reverse, steer by
// speed, handbrake loosens the grip for slides. Garage upgrades raise the
// top speed of the car being driven.
export function driveCar(car, input, dt, tunes) {
  const model = car.model;
  const forward = input.down('KeyW') || input.down('ArrowUp');
  const back = input.down('KeyS') || input.down('ArrowDown');
  const left = input.down('KeyA') || input.down('ArrowLeft');
  const right = input.down('KeyD') || input.down('ArrowRight');
  const brake = input.down('Space');
  if (forward) car.speed += DRIVE.accel * model.pace * dt;
  if (back) car.speed -= (car.speed > 10 ? DRIVE.accel * 1.4 : DRIVE.backAccel) * dt;
  if (!forward && !back) car.speed -= car.speed * 0.9 * dt;
  if (brake) car.speed -= car.speed * 2.6 * dt;
  const max = DRIVE.topSpeed * model.pace * (1 + 0.15 * (tunes || 0));
  car.speed = Math.max(-DRIVE.topReverse, Math.min(max, car.speed));
  const steer = (left ? -1 : 0) + (right ? 1 : 0);
  // Steering answers with speed but never spins: about 2.4 rad/s at full tilt,
  // less when crawling, a touch more with the handbrake for slides.
  const speedFactor = Math.min(1, Math.abs(car.speed) / 260);
  car.angle += steer * 2.4 * speedFactor * Math.sign(car.speed || 1) * dt * (brake ? 1.5 : 1);
  return { speed: car.speed };
}

export function updateShots(bullets, town, dt) {
  for (const b of bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (town.hitsBuilding(b.x, b.y, 2)) b.life = 0;
    if (b.x < 0 || b.y < 0 || b.x > MAP.w || b.y > MAP.h) b.life = 0;
  }
  return bullets.filter((b) => b.life > 0);
}

export { gap as dist, headingTo as angleTo, clampAngle as wrapAngle };
