// Keyboard + mouse, read fresh every frame. Keys are tracked by code so
// keyboard layouts do not matter; the mouse aim is kept in world
// coordinates by the caller (boot.js converts it before the world steps).
export const ACT_CONFIRM = 1;
export const ACT_PAUSE = 2;
export const ACT_ENTER = 4;
export const ACT_RELOAD = 8;
export const ACT_PUNCH = 16;
export const ACT_RADIO = 32;
export const ACT_NEW = 64;
export const ACT_MUSIC = 1024;
export const ACT_SLOT1 = 128;
export const ACT_SLOT2 = 256;
export const ACT_SLOT3 = 512;

export function makeControls(canvas) {
  const keys = new Set();
  const held = { bits: 0 };
  const mouse = { x: 0, y: 0, down: false, clicked: false, rightDown: false };

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Space' || event.code === 'Enter') held.bits |= ACT_CONFIRM;
    if (event.code === 'KeyP' || event.code === 'Escape') held.bits |= ACT_PAUSE;
    if (event.code === 'KeyE') held.bits |= ACT_ENTER;
    if (event.code === 'KeyR') held.bits |= ACT_RELOAD;
    if (event.code === 'KeyF') held.bits |= ACT_PUNCH;
    if (event.code === 'KeyQ') held.bits |= ACT_RADIO;
    if (event.code === 'KeyN') held.bits |= ACT_NEW;
    if (event.code === 'KeyM') held.bits |= ACT_MUSIC;
    if (event.code === 'Digit1') held.bits |= ACT_SLOT1;
    if (event.code === 'Digit2') held.bits |= ACT_SLOT2;
    if (event.code === 'Digit3') held.bits |= ACT_SLOT3;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) { mouse.down = true; mouse.clicked = true; }
    if (event.button === 2) mouse.rightDown = true;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouse.down = false;
    if (event.button === 2) mouse.rightDown = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    mouse,
    down(code) { return keys.has(code); },
    // WASD / arrows as a normalised -1..1 pair.
    moveVector() {
      let x = 0; let y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
      return { x, y };
    },
    takeActions() {
      const bits = held.bits;
      held.bits = 0;
      return bits;
    },
    takeClick() {
      const clicked = mouse.clicked;
      mouse.clicked = false;
      return clicked;
    },
  };
}
