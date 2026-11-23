// The SBPD dispatch board: the radio chatter feed, the roadblocks that go
// up at 3+ stars, and Air One, the police helicopter that launches at 4+
// stars. The dispatch owns the escalation the player sees: as the wanted
// level climbs, the feed talks more, roadblocks appear ahead of the player,
// and the helicopter starts tracking from above.
import { CHATTER } from './settings.js';
import { makeCar, makeHeli, moveHeli } from './people.js';

const COP_MODEL = { name: 'Interceptor', color: '#1c2733', pace: 1.15, kind: 'police' };

export function makeDispatch(rng) {
  const feed = [];
  let lastWanted = 0;
  let blockUp = false;
  let heli = null;
  let feedTimer = 0;

  function say(text) {
    feed.unshift({ text, t: 0 });
    if (feed.length > 5) feed.pop();
  }

  function pick(lines) {
    return lines[Math.floor(rng.next() * lines.length)];
  }

  // A roadblock is two police cars parked across the road ahead of the
  // player, so the chase has something to crash through or dodge around.
  function raiseBlock(state, town) {
    const p = state.player;
    const heading = p.inCar ? p.inCar.angle : p.aimAngle;
    const aheadX = p.x + Math.cos(heading) * 520;
    const aheadY = p.y + Math.sin(heading) * 520;
    const road = town.nearestRoad(aheadX, aheadY);
    const bx = road.axis === 'x' ? road.line : aheadX;
    const by = road.axis === 'x' ? aheadY : road.line;
    const angle = road.axis === 'x' ? 0 : Math.PI / 2;
    for (const off of [-34, 34]) {
      const car = makeCar(
        road.axis === 'x' ? bx + off : bx,
        road.axis === 'x' ? by : by + off,
        angle, COP_MODEL, 'roadblock',
      );
      car.axis = road.axis;
      car.line = road.line;
      state.cars.push(car);
    }
    blockUp = true;
    say(pick(CHATTER.roadblock));
  }

  function dropBlock(state) {
    state.cars = state.cars.filter((c) => c.kind !== 'roadblock');
    blockUp = false;
  }

  // Called every step. Returns nothing; it mutates state (feed, cars, heli)
  // and reports nothing the painter cannot read from state itself.
  function update(state, town, dt) {
    for (const line of feed) line.t += dt;
    feedTimer -= dt;
    const wanted = state.wanted;

    // Wanted climbed: the dispatcher reacts, louder the higher it gets.
    if (wanted > lastWanted) {
      const key = `wanted${Math.min(5, wanted)}`;
      say(pick(CHATTER[key] || CHATTER.wanted1));
    }
    // Wanted cleared entirely: stand down.
    if (wanted === 0 && lastWanted > 0) say(pick(CHATTER.lost));
    lastWanted = wanted;

    // Roadblocks at 3+ stars, cleared when the heat drops below 3.
    if (wanted >= 3 && !blockUp) raiseBlock(state, town);
    if (wanted < 3 && blockUp) dropBlock(state);

    // Air One launches at 4 stars, stands down below 4.
    if (wanted >= 4 && !heli) {
      heli = makeHeli(state.player.x + 90, state.player.y - 300);
      state.heli = heli;
      say(pick(CHATTER.heli));
    }
    if (wanted < 4 && heli) {
      heli = null;
      state.heli = null;
    }
    if (heli) {
      moveHeli(heli, state.player, dt);
      // The helicopter calls in the player's position now and then.
      if (feedTimer <= 0) {
        feedTimer = 6;
        if (wanted >= 5) say(pick(CHATTER.wanted5));
        else say(pick(CHATTER.heli));
      }
    }
  }

  function onBusted() {
    say(pick(CHATTER.busted));
    if (heli) { heli = null; }
  }

  return {
    feed, update, onBusted,
    get heli() { return heli; },
    get roadblockActive() { return blockUp; },
    say,
  };
}
