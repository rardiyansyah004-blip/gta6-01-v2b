// Boot: the screens (title → play → pause → busted), the frame loop, save
// slots, and the screenshot hook the dossier build uses. Everything the
// player sees flows through here; the game logic lives in game.js, the
// drawing in paint.js, the shot scenes in stage.js.
import { makeGame } from './game.js';
import { makePainter, MODE_BUSTED, MODE_PAUSED, MODE_PLAY, MODE_TITLE } from './paint.js';
import { makeControls } from './controls.js';
import { makeSound } from './sound.js';
import { makeStage } from './stage.js';
import { SAVE_PREFIX, SLOT_COUNT } from './settings.js';

export function boot(canvas, seed) {
  const world = makeGame(seed || 20261121);
  const painter = makePainter(canvas);
  const input = makeControls(canvas);
  const audio = makeSound();
  const stage = makeStage(world);
  let screen = MODE_TITLE;
  let last = performance.now();
  let shotReady = false;
  let shot = null;

  const params = new URLSearchParams(window.location.search);
  const shotName = params.get('shot');
  const seedParam = Number.parseInt(params.get('seed') || '', 10);
  const useSeed = Number.isFinite(seedParam) ? seedParam : 20261121;

  function saves() { return world.listSlots(); }

  function startGame(slot) {
    if (slot) world.state.slot = slot;
    screen = MODE_PLAY;
    audio.unlock();
  }

  function startFresh() {
    world.reset();
    world.state.slot = 1;
    startGame();
  }

  function continueLatest() {
    const slots = saves();
    const filled = slots.filter((e) => e.data);
    if (!filled.length) { startFresh(); return; }
    const latest = filled.reduce((a, b) => (new Date(b.data.savedAt) > new Date(a.data.savedAt) ? b : a));
    world.state.slot = latest.slot;
    world.applySave(latest.data, latest.slot);
    startGame(latest.slot);
  }

  function pickSlot(slot) {
    const entry = world.loadSlot(slot);
    if (entry) {
      world.state.slot = slot;
      world.applySave(entry, slot);
    } else {
      world.state.slot = slot;
      world.reset();
    }
    startGame(slot);
  }

  // The screenshot hook: ?shot=cover|drive|city|mission&seed=20261121 sets
  // up a fixed scene, draws it, and flips window.__shotReady so the
  // dossier build can capture it.
  if (shotName) {
    stage.setShot(shotName);
    screen = shotName === 'title' ? MODE_TITLE : MODE_PLAY;
    if (shotName === 'title') {
      // Title shot: seed the three save slots with progress, so the panel
      // shows real saves to continue.
      try {
        for (let s = 1; s <= SLOT_COUNT; s += 1) {
          window.localStorage.setItem(`${SAVE_PREFIX}.slot${s}`, JSON.stringify({
            money: 4000 + s * 2500, missionsDone: s * 3, missionIndex: s * 3,
            kills: 12 + s * 9, carsStolen: 6 + s * 4, carUpgrades: s - 1,
            weaponTier: s > 1 ? 1 : 0, savedAt: new Date().toISOString(),
          }));
        }
      } catch { /* storage can be off */ }
    }
    shot = shotName;
    window.setTimeout(() => { shotReady = true; }, 600);
  }

  function stepTitle(actions, clicked) {
    const key = actions;
    if (key & 64) { startFresh(); return; } // N
    if (key & 1 || clicked) { continueLatest(); return; } // Space / click
    if (key & 128) pickSlot(1);
    else if (key & 256) pickSlot(2);
    else if (key & 512) pickSlot(3);
  }

  function stepPlay(dt, actions) {
    // Screenshot staging: the world is frozen — the staged scene is drawn
    // as-is every frame, so cars, the helicopter and the feed never drift
    // away from the composition the shot was staged for.
    if (shot) return;
    if (actions & 2) { screen = MODE_PAUSED; return; } // P / Esc
    if (actions & 64) { startFresh(); return; } // N — restart
    if (actions & 1024) audio.toggleMusic(); // M — one toggle per press
    // Aim: mouse screen position → world position, using the painter's camera.
    const worldPos = painter.worldFromScreen(input.mouse.x, input.mouse.y, world.state.camera);
    world.state.player.aimX = worldPos.x;
    world.state.player.aimY = worldPos.y;
    world.step(dt, input, audio, actions);
    if (world.state.player.health <= 0 && !world.state.gameOver) {
      // The game has already respawned the player; busted/wasted is shown
      // as a banner, not a dead end. Nothing more to do here.
    }
  }

  function frame(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;
    const actions = input.takeActions();
    const clicked = input.takeClick();
    if (screen === MODE_TITLE) stepTitle(actions, clicked);
    else if (screen === MODE_PLAY) stepPlay(dt, actions);
    else if (screen === MODE_PAUSED) {
      if (actions & 2) screen = MODE_PLAY;
    } else if (screen === MODE_BUSTED) {
      if (actions & 1 || clicked) screen = MODE_PLAY;
    }
    painter.draw(world, screen, saves());
    window.requestAnimationFrame(frame);
  }

  // Expose the live state for play-testing and for the dossier build.
  window.__game = {
    world, input, audio, stage,
    get state() { return world.state; },
    get missions() { return world.missions; },
    get dispatch() { return world.dispatch; },
    get player() { return world.state.player; },
    get screen() { return screen; },
    get shotReady() { return shotReady; },
    setShot(name) { stage.setShot(name); shot = name; screen = name === 'title' ? MODE_TITLE : MODE_PLAY; },
    startFresh, continueLatest, pickSlot,
  };
  Object.defineProperty(window, '__shotReady', { get() { return shotReady; }, configurable: true });

  window.requestAnimationFrame(frame);
  return window.__game;
}
