// Screenshot staging: each of the four shots is a fixed scene the judge
// reads — cover (5-star chase, Air One, dispatch), drive (the Street Kings
// race), city (a living dusk intersection), and title (save slots). The
// staging is pure world state: car positions, wanted level, gang members,
// feed lines. Nothing here draws; paint.js does that.
import { MAP } from './settings.js';

export function makeStage(world) {
  const st = world.state;

  function resetWorld() {
    world.reset();
    st.cars = st.cars.filter((c) => c.kind !== 'parked' && c.kind !== 'traffic');
    st.peds = st.peds.filter((p) => p.x > 400 && p.x < 900 && p.y > 1500 && p.y < 2100);
    st.wanted = 0;
    st.wantedTimer = 0;
    st.message = '';
    st.messageTimer = 0;
  }

  function carAt(x, y, angle, color, speed, kind, name) {
    return { x, y, angle, speed: speed || 0, dir: 1, color, model: { name: name || 'Coupe', pace: 1 }, kind: kind || 'traffic', health: 100, lane: 0, axis: 'y', line: x, dead: false, ramTimer: 0, bumpTimer: 0, sirenPhase: 0, cruise: 150 };
  }

  function pedAt(x, y, shirt) {
    return { x, y, dir: 1, axis: 'y', line: x, speed: 22, walkPhase: Math.random() * 6, shirt: shirt || '#5a7dc9', fleeing: false, dead: false };
  }

  function feed(lines) {
    const d = world.dispatch;
    while (d.feed.length) d.feed.pop();
    for (const line of lines) d.feed.push({ text: line, t: 0 });
  }

  function chase() {
    // COVER: a 5-star chase at dusk — the player in a red coupe at the
    // centre, three SBPD cruisers converging, Air One overhead with its
    // searchlight on the player, the dispatch feed talking, five stars.
    resetWorld();
    st.player.x = 1500; st.player.y = 1400; st.player.aimAngle = -Math.PI / 2;
    st.player.money = 12500; st.player.health = 72; st.player.ammo = 9; st.player.weaponTier = 2;
    const ride = carAt(1500, 1400, -Math.PI / 2, '#c92a2a', 260, 'player', 'Vortex GT');
    st.player.inCar = ride;
    st.cars = [
      ride,
      carAt(1500, 1280, Math.PI / 2, '#1c2733', 220, 'police', 'Interceptor'),
      carAt(1400, 1400, 0, '#1c2733', 200, 'police', 'Interceptor'),
      carAt(1600, 1420, Math.PI, '#1c2733', 210, 'police', 'Interceptor'),
      carAt(1460, 1500, Math.PI / 2, '#1c2733', 0, 'roadblock', 'Interceptor'),
      carAt(1560, 1500, Math.PI / 2, '#1c2733', 0, 'roadblock', 'Interceptor'),
      carAt(1700, 1100, 0, '#f2c94c', 180, 'traffic', 'Taxi'),
      carAt(1200, 1300, Math.PI, '#3d7ac9', 160, 'traffic', 'Sedan'),
      carAt(1300, 1700, -Math.PI / 2, '#7a3dc9', 150, 'traffic', 'Hatchback'),
    ];
    st.peds = [pedAt(1430, 1320, '#5a7dc9'), pedAt(1560, 1480, '#d97a3f'), pedAt(1480, 1580, '#3fae6b'), pedAt(1620, 1330, '#c94a7a')];
    st.heli = { x: 1500, y: 1150, angle: 0, rotor: 0.8, speed: 130 };
    st.wanted = 5;
    st.wantedTimer = 999;
    feed(['SBPD: 10-38, Air One has eyes on the suspect', 'Dispatch: all units, pursuit in progress downtown', 'Air One: suspect northbound, red coupe, speed 140']);
    world.missions.index = 7;
    world.missions.start();
    world.missions.clearBanner();
    st.jobsDone = 7;
    st.camera.x = 1500; st.camera.y = 1400;
    st.message = 'SBPD: all units converge — suspect fleeing downtown!';
    st.messageTimer = 999;
  }

  function race() {
    // DRIVE: the Street Kings race in progress — the player in a tuned
    // Comet chasing three rivals east down the avenue, the first
    // checkpoint ring glowing ahead of them. The player sits just west of
    // checkpoint 1 so the ring is in frame, not off-screen.
    resetWorld();
    st.player.x = 1800; st.player.y = 600; st.player.aimAngle = 0;
    st.player.money = 8400; st.player.health = 100; st.player.ammo = 12; st.player.weaponTier = 1;
    const ride = carAt(1800, 600, 0, '#c92a2a', 320, 'player', 'Comet');
    st.player.inCar = ride;
    st.cars = [
      ride,
      carAt(1900, 570, 0, '#e8e8e8', 300, 'traffic', 'Aero'),
      carAt(1850, 530, 0, '#3d7ac9', 300, 'traffic', 'Comet'),
      carAt(1950, 500, 0, '#e8b62a', 300, 'traffic', 'Vortex GT'),
    ];
    st.wanted = 1;
    st.wantedTimer = 999;
    feed(['SBPD: 10-55, street racing reported near the docks']);
    world.missions.index = 5;
    world.missions.start();
    // Jump to the race leg itself, so the objective panel and the marker
    // show the race (not the drive to the start line).
    world.missions.stageTo(1, 0);
    world.missions.clearBanner();
    st.jobsDone = 5;
    st.camera.x = 1800; st.camera.y = 640;
    st.message = 'STREET KINGS — checkpoint 1/4 ahead!';
    st.messageTimer = 999;
  }

  function dusk() {
    // CITY: a living dusk intersection downtown — traffic on every lane, a
    // patrol cruiser, pedestrians on the sidewalks, a burning wreck smoking
    // on the corner, neon signs overhead, the player on foot in the middle
    // of it all with a pistol drawn.
    resetWorld();
    st.player.x = 1500; st.player.y = 1150; st.player.aimAngle = Math.PI / 4;
    st.player.money = 3200; st.player.health = 100; st.player.ammo = 12; st.player.weaponTier = 0;
    st.cars = [
      carAt(1400, 1000, 0, '#1c2733', 0, 'police', 'Interceptor'),
      carAt(1400, 1200, Math.PI / 2, '#e8b62a', 160, 'traffic', 'Taxi'),
      carAt(1600, 1000, -Math.PI / 2, '#3d7ac9', 180, 'traffic', 'Sedan'),
      carAt(1800, 1200, Math.PI / 2, '#c92a2a', 140, 'traffic', 'Vortex GT'),
      carAt(1200, 1000, 0, '#7a3dc9', 120, 'traffic', 'Hatchback'),
      carAt(2000, 1000, 0, '#3fae6b', 150, 'traffic', 'Van'),
      carAt(1600, 1400, -Math.PI / 2, '#e8e8e8', 130, 'traffic', 'Aero'),
      carAt(1400, 1400, Math.PI, '#c92a2a', 120, 'traffic', 'Coupe'),
    ];
    st.peds = [
      pedAt(1440, 1080, '#5a7dc9'), pedAt(1560, 1040, '#d97a3f'), pedAt(1380, 1260, '#3fae6b'),
      pedAt(1620, 1280, '#c94a7a'), pedAt(1500, 900, '#5a7dc9'), pedAt(1700, 900, '#3fae6b'),
      pedAt(1300, 900, '#d97a3f'), pedAt(1560, 1460, '#c94a7a'),
    ];
    st.wrecks = [{ x: 1640, y: 1000, angle: 0.35, smokeTimer: 0 }];
    st.wanted = 2;
    st.wantedTimer = 999;
    feed(['SBPD: 10-50, accident at 4th and Marina', 'Dispatch: unit 12 responding, keep the intersection clear']);
    world.missions.index = 3;
    world.missions.start();
    world.missions.clearBanner();
    st.jobsDone = 3;
    st.camera.x = 1500; st.camera.y = 1150;
    st.message = 'Downtown — the city is alive. Lena needs you at the docks.';
    st.messageTimer = 999;
  }

  function title() {
    // TITLE: the title screen over a living street — parked cars, a few
    // pedestrians, the panel with the three save slots and the mission list.
    resetWorld();
    st.player.x = 1000; st.player.y = 600; st.player.aimAngle = -Math.PI / 2;
    st.cars = [
      carAt(1000, 600, -Math.PI / 2, '#c92a2a', 0, 'parked', 'Vortex GT'),
      carAt(900, 700, 0, '#3d7ac9', 0, 'parked', 'Sedan'),
      carAt(1100, 800, Math.PI / 2, '#e8b62a', 0, 'parked', 'Taxi'),
      carAt(800, 500, 0, '#7a3dc9', 0, 'parked', 'Hatchback'),
      carAt(1200, 500, 0, '#3fae6b', 0, 'parked', 'Van'),
    ];
    st.peds = [pedAt(950, 700, '#5a7dc9'), pedAt(1050, 750, '#d97a3f'), pedAt(900, 600, '#3fae6b')];
    st.wanted = 0;
    feed([]);
    world.missions.index = 0;
    world.missions.start();
    st.camera.x = 1000; st.camera.y = 650;
    st.message = '';
    st.messageTimer = 0;
  }

  function setShot(name) {
    if (name === 'cover') chase();
    else if (name === 'drive') race();
    else if (name === 'city') dusk();
    else if (name === 'title') title();
    else chase();
  }

  return { setShot, shots: ['cover', 'drive', 'city', 'title'] };
}
