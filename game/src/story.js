// The story: nine jobs from Lena Ortiz, Marco Ruiz and Dario Voss, played
// in order. A job is a list of steps; each step watches the world and
// completes when its condition is met. The manager owns the timer, the
// rewards (with the respect-rank bonus) and the progress the save system
// stores. Step kinds: 'race' (a timed chain of checkpoints, must be
// driving) and 'survive' (hold a spot for a timer while gang waves come).
import { JOBS, RANKS } from './settings.js';

export function rankFor(jobsDone) {
  let rank = RANKS[0];
  for (const r of RANKS) if (jobsDone >= r.jobs) rank = r;
  return rank;
}

export function makeStory() {
  let index = 0;
  let stepIndex = 0;
  let timeLeft = 0;
  let active = false;
  let kills = 0;
  let done = false;
  let failed = false;
  let banner = '';
  let bannerTimer = 0;
  let nextTimer = 0;
  // Race state: which checkpoint of the current 'race' step is next.
  let raceCp = 0;
  // Survive state: seconds left on the current 'survive' step.
  let surviveLeft = 0;
  let surviveWave = 0;

  function current() { return JOBS[index] || null; }
  function step() { const m = current(); return m ? m.steps[stepIndex] : null; }

  function start() {
    const m = current();
    if (!m) return;
    active = true;
    stepIndex = 0;
    kills = 0;
    timeLeft = m.timeLimit || 0;
    done = false;
    failed = false;
    raceCp = 0;
    surviveLeft = 0;
    surviveWave = 0;
    banner = `NEW MISSION — ${m.title}`;
    bannerTimer = 3.5;
    return m;
  }

  function finishStep(world) {
    stepIndex += 1;
    const m = current();
    if (stepIndex >= m.steps.length) {
      active = false;
      done = true;
      const rank = rankFor(world.missionsDone || 0);
      const payout = Math.round(m.reward * (1 + rank.bonus));
      world.player.money += payout;
      index += 1;
      if (index >= JOBS.length) {
        banner = 'STORY COMPLETE — Solara Bay is yours! Free roam.';
      } else {
        banner = `MISSION COMPLETE — ${m.title}  +$${payout}`;
        nextTimer = 2.5;
      }
      bannerTimer = 4;
      return 'done';
    }
    // Entering a new step: reset the per-step state for race / survive.
    raceCp = 0;
    surviveLeft = 0;
    surviveWave = 0;
    banner = step().text;
    bannerTimer = 2.5;
    return 'step';
  }

  function failJob(reason) {
    active = false;
    failed = true;
    banner = `MISSION FAILED — ${current().title} (${reason})`;
    bannerTimer = 4;
    return 'fail';
  }

  // Called every step with the live world; returns 'done' | 'step' | 'fail' | null.
  function update(world, dt) {
    if (bannerTimer > 0) bannerTimer -= dt;
    // Between jobs the next one starts by itself after a breather.
    if (!active && index < JOBS.length && nextTimer > 0) {
      nextTimer -= dt;
      if (nextTimer <= 0) start();
    }
    if (!active) return null;
    const m = current();
    const s = step();
    if (!s) return null;
    if (m.timeLimit) {
      timeLeft -= dt;
      if (timeLeft <= 0) return failJob('time up');
    }
    const p = world.player;
    const px = p.inCar ? p.inCar.x : p.x;
    const py = p.inCar ? p.inCar.y : p.y;
    if (s.kind === 'stealCar') {
      if (p.inCar) return finishStep(world);
    } else if (s.kind === 'reach') {
      if (Math.hypot(px - s.x, py - s.y) < s.radius && (!s.needCar || p.inCar)) return finishStep(world);
    } else if (s.kind === 'wanted') {
      if (world.wanted >= s.stars) return finishStep(world);
    } else if (s.kind === 'loseCops') {
      if (world.wanted === 0) return finishStep(world);
    } else if (s.kind === 'kill') {
      if (kills >= s.count) return finishStep(world);
    } else if (s.kind === 'grab') {
      // A grab has no target of its own: it happens where the previous step
      // brought the player (the bank, the vault). Stand on that spot.
      const prev = m.steps[stepIndex - 1];
      const gx = s.x !== undefined ? s.x : (prev ? prev.x : px);
      const gy = s.y !== undefined ? s.y : (prev ? prev.y : py);
      if (Math.hypot(px - gx, py - gy) < 90) return finishStep(world);
    } else if (s.kind === 'race') {
      // Timed checkpoint chain: drive through each checkpoint in order.
      const cp = s.checkpoints[raceCp];
      if (cp && p.inCar && Math.hypot(px - cp.x, py - cp.y) < cp.radius) {
        raceCp += 1;
        if (raceCp >= s.checkpoints.length) return finishStep(world);
        banner = `Checkpoint ${raceCp + 1}/${s.checkpoints.length} — keep going!`;
        bannerTimer = 1.6;
      }
    } else if (s.kind === 'survive') {
      if (surviveLeft <= 0) surviveLeft = s.seconds;
      surviveLeft -= dt;
      // Waves: a few gang members at the start, more halfway through.
      if (surviveWave === 0 && world.onSurviveWave) world.onSurviveWave(4);
      if (surviveWave === 0) surviveWave = 1;
      if (surviveLeft < s.seconds / 2 && surviveWave === 1) {
        surviveWave = 2;
        if (world.onSurviveWave) world.onSurviveWave(4);
      }
      if (surviveLeft <= 0) return finishStep(world);
    }
    return null;
  }

  function onKill() { kills += 1; }
  function retry() {
    failed = false;
    return start();
  }

  // Screenshot staging only: jump the manager to a step of the current
  // job (for example, the race leg after the first checkpoint), so a
  // staged scene can show a later part of a job.
  function stageTo(stepIdx, raceCheckpoint) {
    stepIndex = stepIdx;
    raceCp = raceCheckpoint || 0;
    surviveLeft = 0;
    surviveWave = 0;
    banner = step() ? step().text : '';
    bannerTimer = 2.5;
  }

  // Screenshot staging only: clear the mission banner so a staged shot
  // shows the HUD, not a "NEW MISSION" banner across the middle.
  function clearBanner() {
    bannerTimer = 0;
  }

  return {
    get index() { return index; },
    set index(v) { index = v; },
    get active() { return active; },
    get done() { return done; },
    get failed() { return failed; },
    get timeLeft() { return timeLeft; },
    get kills() { return kills; },
    get banner() { return banner; },
    get bannerTimer() { return bannerTimer; },
    get raceCheckpoint() { return raceCp; },
    get surviveLeft() { return surviveLeft; },
    current, step, start, update, onKill, retry, stageTo, clearBanner,
    allDone() { return index >= JOBS.length; },
    objectiveText() {
      if (this.allDone()) return 'Story complete! Free roam — Solara Bay is yours.';
      if (!active) {
        const m = current();
        return m ? `Next: ${m.title} — ${m.brief}` : '';
      }
      const s = step();
      if (!s) return '';
      if (s.kind === 'race') return `${s.text} — checkpoint ${raceCp + 1}/${s.checkpoints.length}`;
      if (s.kind === 'survive') return `${s.text} — ${Math.ceil(Math.max(0, surviveLeft))}s left`;
      return s.text;
    },
  };
}
