// The game itself: one state object, one fixed step, every system wired
// together. Player on foot and in cars, stealing, shooting, the wanted level
// and the SBPD dispatch that answers it — roadblocks, Air One overhead —
// nine jobs, street races, gang waves, pickups, busts and respawns, the
// car radio, respect ranks, garage upgrades and three save slots. No drawing
// here; paint.js draws this state.
import { DRIVE, HEAT, JOBS, MAP, ON_FOOT, SAVE_PREFIX, SLOT_COUNT } from './settings.js';
import { buildTown } from './town.js';
import { makeRng } from './rng.js';
import {
  dist, driveCar, makeCar, makePlayer, spawnCrew, spawnParked, spawnPatrols,
  spawnTraffic, spawnWalkers, updateCops, updateShots, updateTraffic, updateWalkers,
} from './people.js';
import { makeStory, rankFor } from './story.js';
import { makeDispatch } from './police.js';
import { makeStations } from './stations.js';

export const EV_SHOT = 1;
export const EV_PICKUP = 2;
export const EV_CRASH = 4;
export const EV_BUSTED = 8;
export const EV_WASTED = 16;
export const EV_JOB_DONE = 32;
export const EV_JOB_FAIL = 64;

const HOSPITAL = { x: 1400, y: 1000 };
const GARAGE_SPOT = { x: 560, y: 300 };
const TUNE_PRICE = 500;

export function makeGame(seed) {
  const rng = makeRng(seed);
  const town = buildTown(rng);
  const story = makeStory();
  const dispatch = makeDispatch(rng);
  const stations = makeStations();
  const state = {
    player: makePlayer(1600, 1200),
    cars: [],
    peds: [],
    gang: [],
    bullets: [],
    sparks: [],
    wanted: 0,
    wantedTimer: 0,
    elapsed: 0,
    clock: 8 * 3600,
    camera: { x: 1600, y: 1200 },
    message: '',
    messageTimer: 0,
    kills: 0,
    carsStolen: 0,
    jobsDone: 0,
    gameOver: false,
    heli: null,
    // Burning wrecks: set dressing with a smoke column, parked just out of
    // the traffic lanes so the streets look lived-in (and recently loud).
    wrecks: [
      { x: 1440, y: 1035, angle: 0.35, smokeTimer: 0 },
      { x: 2240, y: 1835, angle: -0.5, smokeTimer: 0.2 },
    ],
    slot: 1,
    garageHeld: false,
    storyTold: false,
  };

  function reset() {
    state.player = makePlayer(1600, 1000);
    // A denser city: more traffic, more parked cars to steal, more people
    // on the sidewalks, and two SBPD patrol cars always on the beat.
    state.cars = [...spawnTraffic(town, rng, 22), ...spawnParked(town, rng, 14), ...spawnPatrols(town, rng, 2)];
    state.peds = spawnWalkers(town, rng, 42);
    state.gang = [];
    state.bullets = [];
    state.sparks = [];
    state.wanted = 0;
    state.wantedTimer = 0;
    state.elapsed = 0;
    state.clock = 8 * 3600;
    state.kills = 0;
    state.carsStolen = 0;
    state.jobsDone = 0;
    state.gameOver = false;
    state.heli = null;
    state.message = '';
    state.messageTimer = 0;
    state.storyTold = false;
    story.index = 0;
    story.start();
  }

  function raiseHeat(n) {
    state.wanted = Math.min(HEAT.top, state.wanted + n);
    state.wantedTimer = HEAT.coolDelay;
  }

  function burst(x, y, color, n, speed) {
    for (let i = 0; i < n; i += 1) {
      const a = rng.next() * Math.PI * 2;
      const s = rng.range(speed * 0.3, speed);
      state.sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rng.range(0.3, 0.8), color, size: rng.range(2, 5) });
    }
  }

  function nearestCar(x, y, maxD) {
    let best = null; let bestD = maxD;
    for (const car of state.cars) {
      if (car.dead) continue;
      if (car.kind === 'roadblock') continue;
      const d = dist({ x, y }, car);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  function enterCar() {
    const p = state.player;
    if (p.inCar) {
      // Step out beside the car — try each side and pick the first spot that
      // is not inside a building, so the player never spawns stuck in a wall.
      const car = p.inCar;
      p.inCar = null;
      const sides = [Math.PI / 2, -Math.PI / 2, 0, Math.PI];
      for (const side of sides) {
        const ex = car.x + Math.cos(car.angle + side) * 36;
        const ey = car.y + Math.sin(car.angle + side) * 36;
        p.x = ex; p.y = ey;
        if (!town.hitsBuilding(ex, ey, ON_FOOT.radius)) break;
      }
      const moved = town.moveCircle(p.x, p.y, 0, 0, ON_FOOT.radius);
      p.x = moved.x; p.y = moved.y;
      return 'exit';
    }
    const car = nearestCar(p.x, p.y, 70);
    if (!car) return null;
    p.inCar = car;
    car.kind = 'player';
    if (car.stolen !== true) {
      car.stolen = true;
      state.carsStolen += 1;
      raiseHeat(HEAT.steal);
      state.message = `Stole a ${car.model.name}! The cops noticed.`;
      state.messageTimer = 3;
    }
    return 'enter';
  }

  function gunDamage() { return ON_FOOT.gunDamage + state.player.weaponTier * 10; }
  function gunGap() { return state.player.weaponTier >= 2 ? 0.16 : ON_FOOT.shotGap; }

  function shoot() {
    const p = state.player;
    if (p.reloading > 0 || p.fireTimer > 0 || p.ammo <= 0) return null;
    p.fireTimer = gunGap();
    p.ammo -= 1;
    const a = p.aimAngle;
    const bx = p.x + Math.cos(a) * 22;
    const by = p.y + Math.sin(a) * 22;
    state.bullets.push({ x: bx, y: by, vx: Math.cos(a) * 900, vy: Math.sin(a) * 900, life: ON_FOOT.gunRange / 900, from: 'player', damage: gunDamage() });
    burst(bx, by, '#ffd23f', 3, 120);
    return 'shot';
  }

  function punch() {
    const p = state.player;
    if (p.punchTimer > 0) return null;
    p.punchTimer = 0.45;
    const reach = 46;
    const tx = p.x + Math.cos(p.aimAngle) * reach;
    const ty = p.y + Math.sin(p.aimAngle) * reach;
    for (const ped of state.peds) {
      if (!ped.dead && dist({ x: tx, y: ty }, ped) < 26) { ped.dead = true; burst(ped.x, ped.y, '#c94a4a', 8, 160); raiseHeat(HEAT.killPed); state.kills += 1; return 'punch'; }
    }
    for (const g of state.gang) {
      if (!g.dead && dist({ x: tx, y: ty }, g) < 26) { g.health -= 40; if (g.health <= 0) { g.dead = true; story.onKill(); state.kills += 1; burst(g.x, g.y, '#c94a4a', 10, 180); } return 'punch'; }
    }
    return 'punch';
  }

  function hurtPlayer(amount, source) {
    const p = state.player;
    p.health -= amount;
    burst(p.x, p.y, '#e84a4a', 6, 140);
    if (p.health <= 0) {
      p.health = 0;
      return source === 'bust' ? 'busted' : 'wasted';
    }
    return null;
  }

  function respawn(reason) {
    const p = state.player;
    const lost = Math.min(p.money, reason === 'busted' ? 200 : Math.floor(p.money * 0.2));
    p.money -= lost;
    p.health = ON_FOOT.hp;
    p.inCar = null;
    p.x = HOSPITAL.x; p.y = HOSPITAL.y;
    p.ammo = ON_FOOT.clip;
    state.wanted = 0;
    state.wantedTimer = 0;
    state.bullets = [];
    state.heli = null;
    for (const car of state.cars) if (car.kind === 'police') car.dead = true;
    state.cars = state.cars.filter((c) => !c.dead && c.kind !== 'roadblock');
    state.message = reason === 'busted'
      ? `BUSTED — the Solara Bay PD took $${lost} in fines.`
      : `WASTED — patched up at St. Marina Hospital. Lost $${lost}.`;
    state.messageTimer = 4;
    return reason === 'busted' ? EV_BUSTED : EV_WASTED;
  }

  function syncCops() {
    const want = state.wanted > 0 ? Math.min(4, state.wanted) : 0;
    const cops = state.cars.filter((c) => c.kind === 'police' && !c.dead);
    if (cops.length < want) {
      const p = state.player;
      const a = rng.next() * Math.PI * 2;
      const sx = Math.max(120, Math.min(MAP.w - 220, p.x + Math.cos(a) * 700));
      const sy = Math.max(120, Math.min(MAP.h - 120, p.y + Math.sin(a) * 700));
      const road = town.nearestRoad(sx, sy);
      const car = makeCar(road.axis === 'x' ? road.line : sx, road.axis === 'x' ? sy : road.line, 0, { name: 'Interceptor', color: '#1c2733', pace: 1.15, kind: 'police' }, 'police');
      car.angle = Math.atan2(p.y - car.y, p.x - car.x);
      car.axis = road.axis;
      car.line = road.line;
      car.dir = 1;
      car.lane = 0;
      state.cars.push(car);
    } else if (cops.length > want) {
      cops[cops.length - 1].dead = true;
      state.cars = state.cars.filter((c) => !c.dead);
    }
  }

  function stepPlayer(dt, input, audio) {
    const p = state.player;
    if (p.fireTimer > 0) p.fireTimer -= dt;
    if (p.punchTimer > 0) p.punchTimer -= dt;
    if (p.reloading > 0) {
      p.reloading -= dt;
      if (p.reloading <= 0) p.ammo = ON_FOOT.clip;
    }
    if (p.inCar) {
      const car = p.inCar;
      driveCar(car, input, dt, p.tunes);
      const moved = town.moveCircle(car.x, car.y, Math.cos(car.angle) * car.speed * dt, Math.sin(car.angle) * car.speed * dt, 20);
      const hitWall = Math.hypot(moved.x - (car.x + Math.cos(car.angle) * car.speed * dt), moved.y - (car.y + Math.sin(car.angle) * car.speed * dt)) > 1;
      if (hitWall && Math.abs(car.speed) > 200) {
        car.health -= 12;
        car.speed *= -0.25;
        burst(car.x, car.y, '#f2c94c', 8, 200);
        audio.crash();
      }
      car.x = moved.x; car.y = moved.y;
      p.x = car.x; p.y = car.y;
      audio.engine(Math.abs(car.speed) / (DRIVE.topSpeed * car.model.pace), true);
      // Running over pedestrians.
      for (const ped of state.peds) {
        if (!ped.dead && dist(car, ped) < 26 && Math.abs(car.speed) > 60) {
          ped.dead = true;
          burst(ped.x, ped.y, '#c94a4a', 10, 200);
          raiseHeat(HEAT.runOver);
          state.kills += 1;
          audio.crash();
        }
      }
      return;
    }
    audio.engine(0, false);
    // On foot.
    const mv = input.moveVector();
    const running = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = running ? ON_FOOT.run : ON_FOOT.walk;
    p.moving = mv.x !== 0 || mv.y !== 0;
    if (p.moving) p.walkPhase += dt * 10;
    const moved = town.moveCircle(p.x, p.y, mv.x * speed * dt, mv.y * speed * dt, ON_FOOT.radius);
    p.x = moved.x; p.y = moved.y;
    // Aim at the mouse (screen coords are converted by boot.js into world coords).
    p.aimAngle = Math.atan2(p.aimY - p.y, p.aimX - p.x);
    // Hold the mouse to fire; a quick click also fires once, even if the
    // press and release fall between two frames. The queued click is
    // consumed here either way, so one press can never fire twice.
    const clicked = input.takeClick();
    if (input.mouse.down || clicked) {
      if (shoot() === 'shot') audio.shoot();
    }
    if (p.ammo === 0 && p.reloading <= 0) { p.reloading = ON_FOOT.reloadSecs; audio.reload(); }
  }

  function stepShots(dt, audio) {
    state.bullets = updateShots(state.bullets, town, dt);
    for (const b of state.bullets) {
      if (b.from !== 'player') continue;
      for (const ped of state.peds) {
        if (!ped.dead && dist(b, ped) < 14) {
          ped.dead = true; b.life = 0;
          burst(ped.x, ped.y, '#c94a4a', 10, 180);
          raiseHeat(HEAT.killPed);
          state.kills += 1;
          audio.hit();
        }
      }
      for (const g of state.gang) {
        if (!g.dead && dist(b, g) < 15) {
          g.health -= b.damage; b.life = 0;
          burst(g.x, g.y, '#c94a4a', 8, 160);
          if (g.health <= 0) { g.dead = true; story.onKill(); state.kills += 1; state.player.money += 100; burst(g.x, g.y, '#ffd23f', 10, 160); }
          audio.hit();
        }
      }
      for (const car of state.cars) {
        if (!car.dead && car.kind !== 'player' && dist(b, car) < 28) {
          b.life = 0;
          car.health -= b.damage;
          burst(b.x, b.y, '#f2c94c', 5, 140);
          if (car.kind === 'police') raiseHeat(HEAT.shootCop);
          if (car.health <= 0) {
            car.dead = true;
            burst(car.x, car.y, '#ff7a2f', 26, 320);
            burst(car.x, car.y, '#3d3d46', 16, 160);
            if (car.kind === 'police') raiseHeat(1);
            audio.crash();
          }
        }
      }
    }
    // Gang members shoot back at the player when close.
    for (const g of state.gang) {
      if (g.dead) continue;
      g.fireTimer -= dt;
      const d = dist(g, state.player);
      if (d < 380 && g.fireTimer <= 0) {
        g.fireTimer = 1.4;
        const a = Math.atan2(state.player.y - g.y, state.player.x - g.x) + (rng.next() - 0.5) * 0.3;
        state.bullets.push({ x: g.x, y: g.y, vx: Math.cos(a) * 700, vy: Math.sin(a) * 700, life: 0.6, from: 'gang', damage: 9 });
        audio.shoot();
      }
      if (d > 60 && d < 500) {
        const a = Math.atan2(state.player.y - g.y, state.player.x - g.x);
        const moved = town.moveCircle(g.x, g.y, Math.cos(a) * g.speed * dt, Math.sin(a) * g.speed * dt, 11);
        g.x = moved.x; g.y = moved.y;
      }
    }
    // Enemy bullets hitting the player.
    for (const b of state.bullets) {
      if (b.from === 'player' || b.life <= 0) continue;
      const p = state.player;
      const target = p.inCar || p;
      if (dist(b, target) < (p.inCar ? 28 : 14)) {
        b.life = 0;
        if (p.inCar) { p.inCar.health -= b.damage; if (p.inCar.health <= 0) { p.inCar.dead = true; burst(p.inCar.x, p.inCar.y, '#ff7a2f', 26, 320); p.inCar = null; } }
        else hurtPlayer(b.damage, 'shot');
      }
    }
    state.bullets = state.bullets.filter((b) => b.life > 0);
  }

  function stepHits(dt, audio) {
    const p = state.player;
    const playerCar = p.inCar;
    for (const car of state.cars) {
      if (car.dead || car === playerCar || car.kind === 'parked') continue;
      const other = playerCar || p;
      const d = dist(car, other);
      if (d < 44 && d > 0.01) {
        // Push the other car away so an overlap is one bump, not a grind.
        // The player's car is never shoved: police rams must not teleport it.
        // The push is checked against buildings, so a car can never be shoved
        // through a wall and end up stuck inside one.
        const push = 44 - d;
        const nx = (other.x - car.x) / d;
        const ny = (other.y - car.y) / d;
        const px2 = car.x - nx * push;
        const py2 = car.y - ny * push;
        if (!town.hitsBuilding(px2, py2, 20)) { car.x = px2; car.y = py2; }
        else if (!town.hitsBuilding(car.x - nx * push, car.y, 20)) car.x -= nx * push;
        else if (!town.hitsBuilding(car.x, car.y - ny * push, 20)) car.y -= ny * push;
        if (car.kind === 'police') {
          if (playerCar) {
            if (car.ramTimer <= 0) {
              car.ramTimer = 0.9;
              playerCar.health -= 4;
              playerCar.speed *= 0.85;
              burst(playerCar.x, playerCar.y, '#f2c94c', 6, 160);
              audio.crash();
            }
            if (playerCar.health <= 0) { playerCar.dead = true; burst(playerCar.x, playerCar.y, '#ff7a2f', 26, 320); p.inCar = null; }
          } else {
            p.bustTimer += dt;
            if (p.bustTimer > 1.4) return respawn('busted');
          }
        } else if (playerCar) {
          // Traffic shunt, or a roadblock: one impulse, then a cooldown.
          if (car.bumpTimer <= 0) {
            car.bumpTimer = 0.5;
            playerCar.speed *= car.kind === 'roadblock' ? 0.35 : 0.7;
            car.speed = Math.max(car.speed, 60);
            playerCar.health -= car.kind === 'roadblock' ? 10 : 3;
            audio.crash();
            if (car.kind === 'roadblock') {
              car.dead = true;
              burst(car.x, car.y, '#ff7a2f', 20, 280);
              state.message = 'Smashed through the roadblock!';
              state.messageTimer = 2;
            }
          }
        }
      }
    }
    if (!playerCar) {
      const nearCop = state.cars.some((c) => c.kind === 'police' && !c.dead && dist(c, p) < 60);
      if (!nearCop) p.bustTimer = Math.max(0, p.bustTimer - dt * 2);
    }
    return null;
  }

  function stepPickups(audio) {
    const p = state.player;
    for (const pk of town.pickups) {
      if (pk.taken) continue;
      if (dist(p, pk) < 30) {
        pk.taken = true;
        if (pk.kind === 'cash') { p.money += pk.value; state.message = `+$${pk.value} street cash`; state.messageTimer = 2; audio.cash(); }
        else { p.health = Math.min(ON_FOOT.hp, p.health + 50); state.message = 'Health +50'; state.messageTimer = 2; audio.pickup(); }
      }
    }
  }

  // Garage tune: standing near Lena's Garage with $500, press G to tune
  // the car — +15% top speed, up to 3 times. The tune stays with the
  // player, not the car, so stealing a new ride keeps it.
  function stepGarage(input, audio) {
    const p = state.player;
    const near = Math.hypot(p.x - GARAGE_SPOT.x, p.y - GARAGE_SPOT.y) < 150;
    const gDown = input.down && input.down('KeyG');
    if (gDown && !state.garageHeld && near) {
      if (p.tunes >= 3) {
        state.message = 'Garage: your ride is already maxed out.';
        state.messageTimer = 2;
      } else if (p.money < TUNE_PRICE) {
        state.message = `Garage: a tune costs $${TUNE_PRICE} — you have $${p.money}.`;
        state.messageTimer = 2;
      } else {
        p.money -= TUNE_PRICE;
        p.tunes += 1;
        state.message = `Garage tune ${p.tunes}/3 fitted — +15% top speed!`;
        state.messageTimer = 3;
        audio.cash();
        save();
      }
    }
    state.garageHeld = !!gDown;
  }

  function step(dt, input, audio, frameActions) {
    let events = 0;
    state.elapsed += dt;
    state.clock = (8 * 3600 + state.elapsed * 60) % (24 * 3600);
    if (state.messageTimer > 0) state.messageTimer -= dt;
    if (state.gameOver) return events;

    // Wanted decay: quiet for a while and the heat cools off, one star at a time.
    if (state.wanted > 0) {
      state.wantedTimer -= dt;
      if (state.wantedTimer <= 0) {
        state.wanted -= 1;
        state.wantedTimer = state.wanted > 0 ? HEAT.coolDelay : 0;
      }
    }
    syncCops();
    dispatch.update(state, town, dt);

    // Job-specific spawns.
    const m = story.current();
    if (story.active && m) {
      if (m.id === 'takedown' && story.step() && story.step().kind === 'kill' && state.gang.length === 0) {
        state.gang = spawnCrew(rng, 600, 2150, 6);
        state.message = 'Los Tiburones are here — take them down!';
        state.messageTimer = 3;
      }
      if (m.id === 'getaway' && story.step() && story.step().kind === 'wanted' && state.wanted < 3) {
        raiseHeat(3);
      }
      if (m.id === 'score' && story.step() && story.step().kind === 'wanted' && state.wanted < 4) {
        raiseHeat(4);
      }
      if (m.id === 'driver' && story.step() && story.step().kind === 'wanted' && state.wanted < 2) {
        raiseHeat(2);
      }
      if (m.id === 'crown' && story.step() && story.step().kind === 'wanted' && state.wanted < 5) {
        raiseHeat(5);
      }
    }

    // One-shot presses: the caller hands this frame's bits in (the boot loop
    // already took them), otherwise take them from the input directly.
    const actions = frameActions !== undefined ? frameActions : input.takeActions();
    if (actions & 4) { // E — enter / exit a car
      const result = enterCar();
      if (result === 'enter') audio.enterCar();
      else if (result === 'exit') audio.enterCar();
    }
    if (actions & 8) { // R — reload
      const p = state.player;
      if (!p.inCar && p.ammo < ON_FOOT.clip && p.reloading <= 0) { p.reloading = ON_FOOT.reloadSecs; audio.reload(); }
    }
    if (actions & 16) { // F — punch
      if (punch() === 'punch') audio.punch();
    }
    if (actions & 32) { // Q — switch radio station
      const station = stations.next();
      audio.setStation(stations.index);
      state.message = `Radio: ${station.name} — ${station.tag}`;
      state.messageTimer = 2.5;
      audio.dispatchBlip();
    }

    stepGarage(input, audio);
    stepPlayer(dt, input, audio);
    stepShots(dt, audio);
    const bust = stepHits(dt, audio);
    if (bust) {
      events |= bust;
      dispatch.onBusted();
    }
    updateTraffic(state.cars, town, dt);
    updateCops(state.cars, state.player, town, dt, state.wanted);
    updateWalkers(state.peds, town, state.player, state.bullets.some((b) => b.from === 'player'), dt);
    stepPickups(audio);

    // Sparks fade.
    for (const pt of state.sparks) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt; }
    state.sparks = state.sparks.filter((pt) => pt.life > 0);

    // Burning wrecks smoke: a grey column rising off each wreck, with an
    // occasional lick of flame.
    for (const w of state.wrecks) {
      w.smokeTimer -= dt;
      if (w.smokeTimer <= 0) {
        w.smokeTimer = 0.12;
        state.sparks.push({ x: w.x + rng.range(-8, 8), y: w.y - 10, vx: rng.range(-8, 8), vy: rng.range(-70, -40), life: rng.range(1.2, 2.2), color: '#5a5a5a', size: rng.range(6, 12) });
        if (rng.chance(0.3)) state.sparks.push({ x: w.x + rng.range(-6, 6), y: w.y, vx: 0, vy: rng.range(-30, -10), life: 0.4, color: '#ff7a2f', size: rng.range(3, 6) });
      }
    }

    // Jobs advance; a finished story unlocks free roam. The story manager
    // gets a small view of the world plus the wave hook the 'survive' step
    // uses to call in gang attackers.
    const jobEvent = story.update({
      player: state.player, wanted: state.wanted, missionsDone: state.jobsDone,
      onSurviveWave: (n) => {
        const alive = state.gang.filter((g) => !g.dead);
        state.gang = [...alive, ...spawnCrew(rng, 600, 2150, n)];
      },
    }, dt);
    if (jobEvent === 'done') {
      events |= EV_JOB_DONE;
      state.jobsDone += 1;
      // Weapon upgrades come with the story: after job 4 the pistol is
      // tuned, after job 7 it fires faster still.
      if (state.jobsDone === 4) state.player.weaponTier = 1;
      if (state.jobsDone === 7) state.player.weaponTier = 2;
      audio.missionDone();
      save();
    } else if (jobEvent === 'fail') {
      events |= EV_JOB_FAIL;
      audio.missionFail();
    }

    // Health hitting zero on foot ends the run the hard way.
    if (state.player.health <= 0) events |= respawn('wasted');

    // Camera follows the player (or their car), clamped to the city.
    const target = state.player.inCar || state.player;
    state.camera.x += (target.x - state.camera.x) * Math.min(1, dt * 4);
    state.camera.y += (target.y - state.camera.y) * Math.min(1, dt * 4);

    // Sirens, occasionally, while wanted.
    if (state.wanted > 0 && Math.random() < dt * 0.5) audio.siren();
    return events;
  }

  function slotKey(slot) { return `${SAVE_PREFIX}.slot${slot}`; }

  function save(slot) {
    const use = slot || state.slot;
    try {
      window.localStorage.setItem(slotKey(use), JSON.stringify({
        money: state.player.money, missionsDone: state.jobsDone,
        missionIndex: story.index, kills: state.kills, carsStolen: state.carsStolen,
        carUpgrades: state.player.tunes, weaponTier: state.player.weaponTier,
        savedAt: new Date().toISOString(),
      }));
    } catch { /* storage can be off */ }
  }

  function loadSlot(slot) {
    try {
      const raw = window.localStorage.getItem(slotKey(slot));
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  }

  function listSlots() {
    const out = [];
    for (let s = 1; s <= SLOT_COUNT; s += 1) out.push({ slot: s, data: loadSlot(s) });
    return out;
  }

  function load() { return loadSlot(state.slot); }

  function applySave(saveData, slot) {
    if (!saveData) return;
    if (slot) state.slot = slot;
    state.player.money = saveData.money || 0;
    state.jobsDone = saveData.missionsDone || 0;
    state.kills = saveData.kills || 0;
    state.carsStolen = saveData.carsStolen || 0;
    state.player.tunes = saveData.carUpgrades || 0;
    state.player.weaponTier = saveData.weaponTier || 0;
    story.index = Math.min(saveData.missionIndex || 0, JOBS.length - 1);
    story.start();
  }

  reset();
  return {
    state, city: town, missions: story, dispatch, radio: stations, reset, step, save, load, loadSlot, listSlots, applySave, addWanted: raiseHeat,
    respect() { return rankFor(state.jobsDone); },
    get player() { return state.player; },
  };
}
