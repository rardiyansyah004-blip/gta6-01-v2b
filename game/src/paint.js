// Drawing only: the world state and the current screen in, pixels out. The
// camera follows the player; the HUD, minimap, dispatch feed and menus are
// drawn in screen space on top. Golden-hour sun, flat shapes with soft
// shadows, neon signs downtown — a bright, sun-soaked city on the bay.
import { AREAS, JOBS, MAP, TINTS, TYPEFACE } from './settings.js';
import { LANES_X, LANES_Y, STREET_W } from './town.js';
import { areaAt } from './town.js';

export const MODE_TITLE = 'title';
export const MODE_PLAY = 'play';
export const MODE_PAUSED = 'paused';
export const MODE_BUSTED = 'busted';

const VIEW_W = 1280;
const VIEW_H = 720;

export function makePainter(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, cw: 0, ch: 0 };
  let areaName = '';
  let areaTimer = 0;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.scale = Math.min(canvas.width / VIEW_W, canvas.height / VIEW_H);
    view.cw = canvas.width;
    view.ch = canvas.height;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, weight) {
    const key = `${size}:${weight || ''}`;
    if (!fonts.has(key)) fonts.set(key, `${weight || ''} ${size}px ${TYPEFACE}`);
    ctx.font = fonts.get(key);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function screenFromWorld(wx, wy, camera) {
    const s = view.scale;
    const vw = view.cw / s;
    const vh = view.ch / s;
    return {
      x: (wx - (camera.x - vw / 2)) * s,
      y: (wy - (camera.y - vh / 2)) * s,
    };
  }

  function worldFromScreen(sx, sy, camera) {
    const s = view.scale;
    const vw = view.cw / s;
    const vh = view.ch / s;
    return { x: camera.x - vw / 2 + sx / s, y: camera.y - vh / 2 + sy / s };
  }

  function visibleRect(camera) {
    const s = view.scale;
    const vw = view.cw / s;
    const vh = view.ch / s;
    return { x: camera.x - vw / 2, y: camera.y - vh / 2, w: vw, h: vh };
  }

  function drawGround(world, camera) {
    const vis = visibleRect(camera);
    // Base ground: warm dry grass / dirt.
    ctx.fillStyle = '#bfae7e';
    ctx.fillRect(vis.x, vis.y, vis.w, vis.h);
    // Neighbourhood ground tints.
    for (const d of AREAS) {
      if (d.x + d.w < vis.x || d.x > vis.x + vis.w || d.y + d.h < vis.y || d.y > vis.y + vis.h) continue;
      ctx.fillStyle = d.ground;
      ctx.fillRect(d.x, d.y, d.w, d.h);
    }
    // The sea, east edge.
    ctx.fillStyle = TINTS.water;
    ctx.fillRect(3060, 0, MAP.w - 3060, MAP.h);
    ctx.fillStyle = '#7cc4e8';
    for (let y = 0; y < MAP.h; y += 120) {
      ctx.fillRect(3070, y + ((Date.now() / 900 + y) % 120), 60, 3);
    }
    // Beach sand.
    ctx.fillStyle = TINTS.sand;
    ctx.fillRect(2860, 0, 200, MAP.h);
    // Park blocks.
    ctx.fillStyle = '#6da054';
    for (const park of world.city.parks) ctx.fillRect(park.x, park.y, park.w, park.h);
    // Sidewalks: pale strips along every road.
    ctx.fillStyle = TINTS.sidewalk;
    for (const rx of LANES_X) ctx.fillRect(rx - STREET_W / 2 - 14, 0, STREET_W + 28, MAP.h);
    for (const ry of LANES_Y) ctx.fillRect(0, ry - STREET_W / 2 - 14, MAP.w, STREET_W + 28);
    // Roads.
    ctx.fillStyle = TINTS.road;
    for (const rx of LANES_X) ctx.fillRect(rx - STREET_W / 2, 0, STREET_W, MAP.h);
    for (const ry of LANES_Y) ctx.fillRect(0, ry - STREET_W / 2, MAP.w, STREET_W);
    // Lane dashes.
    ctx.fillStyle = TINTS.lane;
    for (const rx of LANES_X) {
      for (let y = 0; y < MAP.h; y += 48) ctx.fillRect(rx - 2, y, 4, 26);
    }
    for (const ry of LANES_Y) {
      for (let x = 0; x < MAP.w; x += 48) ctx.fillRect(x, ry - 2, 26, 4);
    }
    // Crosswalks at intersections.
    ctx.fillStyle = 'rgba(245,242,234,0.85)';
    for (const rx of LANES_X) {
      for (const ry of LANES_Y) {
        for (let i = -3; i <= 3; i += 1) ctx.fillRect(rx + i * 12 - 4, ry - STREET_W / 2 + 6, 8, 14);
      }
    }
  }

  function drawBuildings(world, camera) {
    const vis = visibleRect(camera);
    for (const b of world.city.buildings) {
      if (b.x + b.w < vis.x || b.x > vis.x + vis.w || b.y + b.h < vis.y || b.y > vis.y + vis.h) continue;
      // Height shadow: the roof is offset up-left, walls below it.
      const h = b.floors * 7;
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(b.x + 6, b.y + 6, b.w, b.h);
      ctx.fillStyle = '#5a4f42';
      ctx.fillRect(b.x, b.y + h * 0.4, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      // Windows, lit warm by the low sun.
      ctx.fillStyle = 'rgba(255,244,200,0.8)';
      for (let wx = b.x + 12; wx < b.x + b.w - 14; wx += 26) {
        for (let wy = b.y + 12; wy < b.y + b.h - 14; wy += 26) ctx.fillRect(wx, wy, 12, 12);
      }
      if (b.label) text(b.label, b.x + b.w / 2, b.y + b.h / 2 + 5, 15, 'rgba(255,255,255,0.92)', 'center', 'bold');
    }
    // Neon signs glow above downtown roofs.
    for (const n of world.city.signs) {
      if (n.x < vis.x || n.x > vis.x + vis.w || n.y < vis.y || n.y > vis.y + vis.h) continue;
      ctx.fillStyle = 'rgba(255,80,180,0.9)';
      text(n.text, n.x, n.y, 13, 'rgba(255,80,180,0.95)', 'center', 'bold');
    }
    // Trees and palms.
    for (const t of world.city.trees) {
      ctx.fillStyle = '#5d7a3a';
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7fae62';
      ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.r * 0.7, 0, Math.PI * 2); ctx.fill();
    }
    for (const p of world.city.palms) {
      ctx.strokeStyle = '#8a6a3a';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 4, p.y - 22); ctx.stroke();
      ctx.fillStyle = '#3f9e4d';
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath(); ctx.ellipse(p.x + 4 + Math.cos(a) * 10, p.y - 22 + Math.sin(a) * 6, 12, 4, a, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function drawCarShape(car, isPlayer) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    const L = 54; const W = 26;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-L / 2 + 3, -W / 2 + 4, L, W);
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(-L / 2, -W / 2, L, W, 7);
    ctx.fill();
    // Cabin + windshield.
    ctx.fillStyle = 'rgba(20,28,40,0.9)';
    ctx.beginPath();
    ctx.roundRect(-8, -W / 2 + 4, 18, W - 8, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,220,255,0.8)';
    ctx.fillRect(8, -W / 2 + 5, 5, W - 10);
    // Headlights and taillights.
    ctx.fillStyle = '#fff8c9';
    ctx.fillRect(L / 2 - 3, -W / 2 + 3, 3, 6);
    ctx.fillRect(L / 2 - 3, W / 2 - 9, 3, 6);
    ctx.fillStyle = '#ff5252';
    ctx.fillRect(-L / 2, -W / 2 + 3, 3, 6);
    ctx.fillRect(-L / 2, W / 2 - 9, 3, 6);
    if (car.kind === 'police' || car.kind === 'patrol') {
      const blink = Math.floor(car.sirenPhase) % 2 === 0;
      ctx.fillStyle = blink ? '#ff2f2f' : '#2f7bff';
      ctx.beginPath(); ctx.arc(-2, -W / 2 + 2, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = blink ? '#2f7bff' : '#ff2f2f';
      ctx.beginPath(); ctx.arc(-2, W / 2 - 2, 4, 0, Math.PI * 2); ctx.fill();
      text('PD', 0, 5, 11, '#ffffff', 'center', 'bold');
    }
    if (car.kind === 'roadblock') {
      // Striped barricade across the road: hard to miss, fun to smash through.
      ctx.fillStyle = '#ffb02e';
      ctx.fillRect(-L / 2, -W / 2 - 6, L, 5);
      ctx.fillRect(-L / 2, W / 2 + 1, L, 5);
      text('PD', 0, 5, 11, '#ffffff', 'center', 'bold');
    }
    if (isPlayer) {
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(-L / 2 - 3, -W / 2 - 3, L + 6, W + 6, 9);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawHeli(heli, player) {
    if (!heli) return;
    // Searchlight cone from the helicopter down to the player.
    const grad = ctx.createLinearGradient(heli.x, heli.y, player.x, player.y);
    grad.addColorStop(0, 'rgba(255,250,200,0.28)');
    grad.addColorStop(1, 'rgba(255,250,200,0.05)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(heli.x - 10, heli.y);
    ctx.lineTo(player.x - 46, player.y);
    ctx.lineTo(player.x + 46, player.y);
    ctx.lineTo(heli.x + 10, heli.y);
    ctx.closePath();
    ctx.fill();
    // Shadow on the ground, then the body, then the spinning rotor.
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(heli.x + 40, heli.y + 50, 30, 14, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(heli.x, heli.y);
    ctx.rotate(heli.angle);
    ctx.fillStyle = '#1c2733';
    ctx.beginPath(); ctx.roundRect(-26, -12, 52, 24, 8); ctx.fill();
    ctx.fillStyle = '#7ec8ff';
    ctx.beginPath(); ctx.arc(16, 0, 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 3;
    const r = heli.rotor % Math.PI;
    ctx.beginPath(); ctx.moveTo(Math.cos(r) * -34, Math.sin(r) * -34); ctx.lineTo(Math.cos(r) * 34, Math.sin(r) * 34); ctx.stroke();
    ctx.restore();
    text('AIR ONE', heli.x, heli.y - 30, 12, '#ffffff', 'center', 'bold');
  }

  // A burning wreck: charred body, caved-in cabin, a flicker of flame, and
  // a smoke column drawn above it so the wreck reads in a still frame (the
  // game also emits rising smoke particles every step).
  function drawWrecks(world) {
    for (const w of world.state.wrecks) {
      // Smoke column: three grey puffs stacked above the wreck.
      for (let i = 0; i < 3; i += 1) {
        const sway = Math.sin(Date.now() / 700 + w.x + i * 2) * 6;
        ctx.fillStyle = `rgba(90,90,90,${0.5 - i * 0.12})`;
        ctx.beginPath(); ctx.arc(w.x + sway + i * 4, w.y - 24 - i * 18, 12 - i * 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.save();
      ctx.translate(w.x, w.y);
      ctx.rotate(w.angle);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(-25, -11, 54, 26);
      ctx.fillStyle = '#2b2b2b';
      ctx.beginPath();
      ctx.roundRect(-27, -13, 54, 26, 7);
      ctx.fill();
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.roundRect(-8, -9, 18, 18, 4);
      ctx.fill();
      const flicker = 0.5 + Math.sin(Date.now() / 90 + w.x) * 0.5;
      ctx.fillStyle = `rgba(255,${Math.floor(90 + flicker * 60)},20,${0.5 + flicker * 0.4})`;
      ctx.beginPath(); ctx.arc(14, 0, 6 + flicker * 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  function drawFigure(x, y, shirt, angle, walkPhase, scale) {
    const s = scale || 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const bob = Math.sin(walkPhase) * 2 * s;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(0, 4, 11 * s, 6 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2b2b2b';
    ctx.beginPath(); ctx.arc(0, 0, 12 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shirt;
    ctx.beginPath(); ctx.arc(bob * 0.4, 0, 9 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8b88a';
    ctx.beginPath(); ctx.arc(0, 0, 5 * s, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawMarker(world, camera) {
    const m = world.missions;
    if (!m.active) return;
    const s = m.step();
    if (!s) return;
    // Race steps: the next checkpoint is the big marker; the rest are small dots.
    if (s.kind === 'race') {
      s.checkpoints.forEach((cp, i) => {
        const isNext = i === m.raceCheckpoint;
        const pulse = 1 + Math.sin(Date.now() / 220) * 0.12;
        ctx.save();
        ctx.translate(cp.x, cp.y);
        ctx.strokeStyle = isNext ? '#ffd23f' : 'rgba(255,210,63,0.5)';
        ctx.lineWidth = isNext ? 4 : 2;
        ctx.beginPath(); ctx.arc(0, 0, (isNext ? cp.radius * 0.55 : 18) * pulse, 0, Math.PI * 2); ctx.stroke();
        if (isNext) {
          ctx.fillStyle = 'rgba(255,210,63,0.16)';
          ctx.beginPath(); ctx.arc(0, 0, cp.radius * 0.55 * pulse, 0, Math.PI * 2); ctx.fill();
          text(`${i + 1}`, 0, 5, 16, '#ffd23f', 'center', 'bold');
        }
        ctx.restore();
      });
      return;
    }
    if (s.kind === 'survive') {
      // Hold-the-docks zone.
      const pulse = 1 + Math.sin(Date.now() / 220) * 0.08;
      ctx.save();
      ctx.translate(600, 2200);
      ctx.strokeStyle = '#ff7a2f';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, 120 * pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,122,47,0.12)';
      ctx.beginPath(); ctx.arc(0, 0, 120 * pulse, 0, Math.PI * 2); ctx.fill();
      text('HOLD', 0, 5, 16, '#ff7a2f', 'center', 'bold');
      ctx.restore();
      return;
    }
    if (s.x === undefined) return;
    const pulse = 1 + Math.sin(Date.now() / 220) * 0.12;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, s.radius * 0.55 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,210,63,0.16)';
    ctx.beginPath(); ctx.arc(0, 0, s.radius * 0.55 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(-9, 4); ctx.lineTo(9, 4); ctx.closePath(); ctx.fill();
    ctx.restore();
    // Edge arrow when the marker is off-screen.
    const vis = visibleRect(camera);
    if (s.x < vis.x || s.x > vis.x + vis.w || s.y < vis.y || s.y > vis.y + vis.h) {
      const cx = Math.max(vis.x + 40, Math.min(vis.x + vis.w - 40, s.x));
      const cy = Math.max(vis.y + 40, Math.min(vis.y + vis.h - 40, s.y));
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.atan2(s.y - cy, s.x - cx));
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-10, -11); ctx.lineTo(-10, 11); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  function drawMinimap(world) {
    const mw = 196; const mh = 148;
    const x0 = view.cw / view.scale - mw - 16;
    const y0 = 16;
    const sx = mw / MAP.w;
    const sy = mh / MAP.h;
    ctx.save();
    ctx.setTransform(view.scale, 0, 0, view.scale, 0, 0);
    ctx.fillStyle = 'rgba(12,14,20,0.78)';
    ctx.beginPath(); ctx.roundRect(x0 - 6, y0 - 6, mw + 12, mh + 12, 10); ctx.fill();
    ctx.fillStyle = '#5d6b4a';
    ctx.fillRect(x0, y0, mw, mh);
    ctx.fillStyle = '#2f8fc4';
    ctx.fillRect(x0 + 3060 * sx, y0, (MAP.w - 3060) * sx, mh);
    ctx.strokeStyle = '#3d3d46';
    ctx.lineWidth = 3;
    for (const rx of LANES_X) { ctx.beginPath(); ctx.moveTo(x0 + rx * sx, y0); ctx.lineTo(x0 + rx * sx, y0 + mh); ctx.stroke(); }
    for (const ry of LANES_Y) { ctx.beginPath(); ctx.moveTo(x0, y0 + ry * sy); ctx.lineTo(x0 + mw, y0 + ry * sy); ctx.stroke(); }
    const m = world.missions;
    if (m.active) {
      const s = m.step();
      if (s && s.kind === 'race') {
        const cp = s.checkpoints[m.raceCheckpoint];
        if (cp) {
          ctx.fillStyle = '#ffd23f';
          ctx.beginPath(); ctx.arc(x0 + cp.x * sx, y0 + cp.y * sy, 6, 0, Math.PI * 2); ctx.fill();
        }
      } else if (s && s.x !== undefined) {
        ctx.fillStyle = '#ffd23f';
        ctx.beginPath(); ctx.arc(x0 + s.x * sx, y0 + s.y * sy, 6, 0, Math.PI * 2); ctx.fill();
      }
    }
    for (const car of world.state.cars) {
      if (car.dead) continue;
      ctx.fillStyle = car.kind === 'police' || car.kind === 'patrol' ? '#4a90ff' : car.kind === 'roadblock' ? '#ffb02e' : 'rgba(230,230,230,0.85)';
      ctx.fillRect(x0 + car.x * sx - 2, y0 + car.y * sy - 2, 4, 4);
    }
    // Burning wrecks: orange dots on the minimap.
    for (const w of world.state.wrecks) {
      ctx.fillStyle = '#ff7a2f';
      ctx.beginPath(); ctx.arc(x0 + w.x * sx, y0 + w.y * sy, 3, 0, Math.PI * 2); ctx.fill();
    }
    // Air One on the minimap: a yellow diamond.
    if (world.state.heli) {
      ctx.fillStyle = '#ffd23f';
      const hx = x0 + world.state.heli.x * sx;
      const hy = y0 + world.state.heli.y * sy;
      ctx.beginPath(); ctx.moveTo(hx, hy - 6); ctx.lineTo(hx + 6, hy); ctx.lineTo(hx, hy + 6); ctx.lineTo(hx - 6, hy); ctx.closePath(); ctx.fill();
    }
    const p = world.state.player;
    ctx.fillStyle = '#ff5252';
    ctx.beginPath(); ctx.arc(x0 + p.x * sx, y0 + p.y * sy, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x0 + p.x * sx, y0 + p.y * sy, 5, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  function drawFeed(world) {
    const s = view.scale;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    const feed = world.dispatch.feed;
    if (!feed.length) return;
    const lines = feed.slice(0, 4);
    const boxH = 30 + lines.length * 18;
    ctx.fillStyle = 'rgba(12,18,28,0.72)';
    ctx.beginPath(); ctx.roundRect(14, 122, 330, boxH, 10); ctx.fill();
    text('SBPD DISPATCH', 26, 142, 13, TINTS.radio, 'left', 'bold');
    lines.forEach((line, i) => {
      const age = line.t || 0;
      ctx.globalAlpha = age > 8 ? 0.45 : 1;
      text(line.text.length > 46 ? line.text.slice(0, 46) + '…' : line.text, 26, 162 + i * 18, 12, '#d7e6f5', 'left');
      ctx.globalAlpha = 1;
    });
  }

  function drawHud(world) {
    const s = view.scale;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    const p = world.state.player;
    const st = world.state;
    // Top-left: money, health, ammo, radio.
    ctx.fillStyle = TINTS.panel;
    ctx.beginPath(); ctx.roundRect(14, 14, 250, 100, 10); ctx.fill();
    text(`$${p.money.toLocaleString('en-US')}`, 28, 46, 28, TINTS.panelAccent, 'left', 'bold');
    text(p.inCar ? `${p.inCar.model.name}  •  ${Math.round(Math.abs(p.inCar.speed) * 0.22)} mph` : 'On foot', 28, 72, 15, TINTS.panelText, 'left');
    ctx.fillStyle = '#3a3f4a';
    ctx.beginPath(); ctx.roundRect(28, 80, 180, 12, 6); ctx.fill();
    ctx.fillStyle = p.health > 30 ? '#58d68d' : '#ff5252';
    ctx.beginPath(); ctx.roundRect(28, 80, 180 * Math.max(0, p.health) / 100, 12, 6); ctx.fill();
    text('HP', 212, 91, 12, TINTS.panelText, 'left', 'bold');
    const gunName = ['PISTOL', 'PISTOL MK II', 'PISTOL MK III'][p.weaponTier] || 'PISTOL';
    if (!p.inCar) text(`${gunName}  •  Ammo ${p.ammo}${p.reloading > 0 ? ' — reloading…' : ''}`, 28, 106, 12, '#c9d1de', 'left');
    else text(`♪ ${world.radio.label()}`, 28, 106, 12, '#ffd23f', 'left');
    // Wanted stars, top centre.
    const stars = st.wanted;
    ctx.fillStyle = TINTS.panel;
    ctx.beginPath(); ctx.roundRect(VIEW_W / 2 - 110, 14, 220, 40, 10); ctx.fill();
    for (let i = 0; i < 5; i += 1) {
      text('★', VIEW_W / 2 - 88 + i * 40, 44, 26, i < stars ? TINTS.heat : 'rgba(255,255,255,0.25)', 'left');
    }
    if (st.heli) text('AIR ONE OVERHEAD', VIEW_W / 2, 74, 13, '#ffd23f', 'center', 'bold');
    drawMinimap(world);
    drawFeed(world);
    // Mission objective, under the minimap.
    const m = world.missions;
    const rank = world.respect();
    const objY = 16 + 148 + 12 + 14;
    ctx.fillStyle = TINTS.panel;
    const obj = m.objectiveText();
    const lines = wrapText(obj, 300, 15);
    const boxH = 54 + lines.length * 19 + (m.active && m.timeLeft > 0 ? 20 : 0);
    ctx.beginPath(); ctx.roundRect(VIEW_W - 16 - 330, objY, 330, boxH, 10); ctx.fill();
    text(m.allDone() ? 'STORY COMPLETE' : (m.active ? `MISSION ${m.index + 1}/${JOBS.length} — ${m.current().title}` : `NEXT MISSION — ${m.current() ? m.current().title : ''}`), VIEW_W - 30, objY + 24, 15, TINTS.job, 'right', 'bold');
    text(`RESPECT: ${rank.name.toUpperCase()}  •  ${world.state.jobsDone}/9 JOBS DONE`, VIEW_W - 30, objY + 42, 12, '#ffd23f', 'right', 'bold');
    lines.forEach((line, i) => text(line, VIEW_W - 30, objY + 62 + i * 19, 15, TINTS.panelText, 'right'));
    if (m.active && m.timeLeft > 0) text(`⏱ ${Math.ceil(m.timeLeft)}s left`, VIEW_W - 30, objY + 62 + lines.length * 19, 15, '#ffb04a', 'right', 'bold');
    // Garage hint when the player is near Lena's Garage.
    if (Math.hypot(p.x - 560, p.y - 300) < 200) {
      text(`GARAGE — press G to tune your ride ($500, ${p.tunes}/3)`, VIEW_W / 2, VIEW_H - 120, 15, '#ffd23f', 'center', 'bold');
    }
    // District name, bottom-left on its own pill, above the controls hint
    // so the two lines never sit on top of each other.
    const d = areaAt(p.x, p.y);
    if (d.name !== areaName) { areaName = d.name; areaTimer = 3; }
    if (areaTimer > 0) {
      areaTimer -= 1 / 60;
      ctx.globalAlpha = Math.min(1, areaTimer);
      ctx.fillStyle = 'rgba(12,14,20,0.6)';
      ctx.beginPath(); ctx.roundRect(14, VIEW_H - 78, 30 + areaName.length * 12, 34, 8); ctx.fill();
      text(areaName, 28, VIEW_H - 54, 20, '#ffffff', 'left', 'bold');
      ctx.globalAlpha = 1;
    }
    // Message / banner, bottom centre.
    const banner = m.bannerTimer > 0 ? m.banner : (st.messageTimer > 0 ? st.message : '');
    if (banner) {
      ctx.fillStyle = TINTS.panel;
      ctx.beginPath(); ctx.roundRect(VIEW_W / 2 - 280, VIEW_H - 96, 560, 44, 10); ctx.fill();
      text(banner, VIEW_W / 2, VIEW_H - 66, 18, '#ffffff', 'center', 'bold');
    }
    // Controls hint, bottom-left, on a dark strip so it stays readable over
    // crosswalks and bright ground.
    ctx.fillStyle = 'rgba(12,14,20,0.5)';
    ctx.fillRect(8, VIEW_H - 30, 660, 24);
    text('WASD move/drive  •  E enter car  •  Click shoot  •  R reload  •  F punch  •  Q radio  •  G garage  •  P pause  •  M music', 16, VIEW_H - 14, 13, 'rgba(255,255,255,0.75)', 'left');
    // Speed, bottom-right when driving.
    if (p.inCar) text(`${Math.round(Math.abs(p.inCar.speed) * 0.22)} mph`, VIEW_W - 16, VIEW_H - 14, 20, TINTS.panelText, 'right', 'bold');
  }

  function wrapText(str, maxWidth, size) {
    ctx.font = `${size}px ${TYPEFACE}`;
    const words = String(str).split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
      else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }

  function drawPanel(title, lines, prompt, accent) {
    const s = view.scale;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.fillStyle = 'rgba(8,10,16,0.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const w = 720;
    const h = 150 + lines.length * 30 + 70;
    const x = (VIEW_W - w) / 2;
    const y = (VIEW_H - h) / 2;
    ctx.fillStyle = 'rgba(14,18,28,0.92)';
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 16); ctx.fill();
    ctx.strokeStyle = accent || '#ffd23f';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 16); ctx.stroke();
    text(title, VIEW_W / 2, y + 64, 46, '#ffffff', 'center', 'bold');
    lines.forEach((line, i) => text(line, VIEW_W / 2, y + 112 + i * 30, 19, '#d7dce6', 'center'));
    text(prompt, VIEW_W / 2, y + h - 30, 20, '#ffd23f', 'center', 'bold');
  }

  function drawWorld(world) {
    const camera = world.state.camera;
    const s = view.scale;
    const vw = view.cw / s;
    const vh = view.ch / s;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#1a1210';
    ctx.fillRect(0, 0, view.cw, view.ch);
    ctx.setTransform(s, 0, 0, s, view.cw / 2 - camera.x * s, view.ch / 2 - camera.y * s);
    drawGround(world, camera);
    drawBuildings(world, camera);
    // Pickups.
    for (const pk of world.city.pickups) {
      if (pk.taken) continue;
      const bob = Math.sin(Date.now() / 300 + pk.x) * 2;
      ctx.fillStyle = pk.kind === 'cash' ? '#ffd23f' : '#58d68d';
      ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1c2733';
      text(pk.kind === 'cash' ? '$' : '+', pk.x, pk.y + bob + 5, 14, '#1c2733', 'center', 'bold');
    }
    drawMarker(world, camera);
    drawWrecks(world);
    // Cars (parked/traffic first, player car last).
    const cars = [...world.state.cars].sort((a, b) => (a === world.state.player.inCar ? 1 : 0) - (b === world.state.player.inCar ? 1 : 0));
    for (const car of cars) {
      if (car.dead) continue;
      drawCarShape(car, car === world.state.player.inCar);
    }
    // Pedestrians and gang.
    for (const ped of world.state.peds) {
      if (ped.dead) continue;
      drawFigure(ped.x, ped.y, ped.shirt, ped.fleeing ? Math.atan2(world.state.player.y - ped.y, world.state.player.x - ped.x) : 0, ped.walkPhase, 1);
    }
    for (const g of world.state.gang) {
      if (g.dead) continue;
      drawFigure(g.x, g.y, '#222222', Math.atan2(world.state.player.y - g.y, world.state.player.x - g.x), g.walkPhase, 1.1);
      // Health bar over gang members.
      ctx.fillStyle = '#3a3f4a';
      ctx.fillRect(g.x - 14, g.y - 24, 28, 5);
      ctx.fillStyle = '#ff5252';
      ctx.fillRect(g.x - 14, g.y - 24, 28 * Math.max(0, g.health) / 100, 5);
    }
    // Player on foot, with a thick gold ring so the character reads at a
    // glance even in a busy street.
    const p = world.state.player;
    if (!p.inCar) {
      ctx.strokeStyle = 'rgba(255,210,63,0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x, p.y, 22, 0, Math.PI * 2); ctx.stroke();
      drawFigure(p.x, p.y, '#e84a4a', p.aimAngle, p.walkPhase, 1.4);
      // Gun barrel + aim line.
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x + Math.cos(p.aimAngle) * 14, p.y + Math.sin(p.aimAngle) * 14);
      ctx.lineTo(p.x + Math.cos(p.aimAngle) * 34, p.y + Math.sin(p.aimAngle) * 34);
      ctx.stroke();
    }
    // Bullets.
    ctx.strokeStyle = '#ffe27a';
    ctx.lineWidth = 3;
    for (const b of world.state.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    // Sparks.
    for (const pt of world.state.sparks) {
      ctx.globalAlpha = Math.max(0, pt.life * 1.6);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
    // Air One, above it all, searchlight on the player.
    drawHeli(world.state.heli, p);
    // Dusk: warm light from the top of the frame, cooling to violet at the
    // bottom — the golden hour the whole city is lit by.
    const glow = ctx.createLinearGradient(camera.x - vw / 2, camera.y - vh / 2, camera.x - vw / 2, camera.y + vh / 2);
    glow.addColorStop(0, 'rgba(255,190,100,0.10)');
    glow.addColorStop(1, 'rgba(70,35,110,0.10)');
    ctx.fillStyle = glow;
    ctx.fillRect(camera.x - vw / 2, camera.y - vh / 2, vw, vh);
  }

  function drawTitle(world, saveSlots) {
    drawWorld(world);
    const slots = saveSlots || [];
    const lines = [
      'Solara Bay — a sun-soaked city of palm trees, neon and bad decisions.',
      'Steal cars, outrun the SBPD, and run nine jobs for Lena Ortiz, Marco Ruiz',
      'and Dario Voss — from a first stolen sedan to the Crown of Solara.',
      '',
      'WASD move & drive  •  E steal / exit car  •  Mouse aim, click to shoot',
      'R reload  •  F punch  •  Q radio  •  G garage tune  •  Shift run  •  P pause',
      '',
    ];
    slots.forEach((entry) => {
      const d = entry.data;
      lines.push(d
        ? `SLOT ${entry.slot} — ${d.missionsDone}/9 jobs  •  $${d.money.toLocaleString('en-US')}  •  ${d.kills} takedowns  (press ${entry.slot} to continue)`
        : `SLOT ${entry.slot} — empty`);
    });
    const hasSave = slots.some((e) => e.data);
    const prompt = hasSave
      ? 'Space: continue latest save  •  1/2/3: pick a slot  •  N: new game'
      : 'Press Space or click to start  •  N: new game';
    drawPanel('SOLARA BAY', lines, prompt, '#ffd23f');
    const s = view.scale;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    text('9 MISSIONS  •  5 DISTRICTS  •  SBPD DISPATCH + AIR ONE  •  3 RADIO STATIONS  •  WANTED 1–5 STARS', VIEW_W / 2, 92, 16, '#ffd23f', 'center', 'bold');
  }

  function draw(world, screen, saveSlots) {
    resize();
    if (screen === MODE_TITLE) {
      drawTitle(world, saveSlots);
      return;
    }
    drawWorld(world);
    drawHud(world);
    if (screen === MODE_PAUSED) {
      drawPanel('PAUSED', ['Solara Bay waits for no one — except right now.', 'Your progress saves after every mission.'], 'Press P to keep playing', '#7ee787');
    } else if (screen === MODE_BUSTED) {
      drawPanel(world.state.gameOver === 'busted' ? 'BUSTED' : 'WASTED', ['The SBPD sends its regards.', 'You wake up at St. Marina Hospital, lighter in the wallet.'], 'Press Space to get back out there', '#ff5252');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, worldFromScreen, screenFromWorld, view };
}
