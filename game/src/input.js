// Sunset Bay — keyboard and mouse input. WASD/arrows to move and drive,
// mouse to look (pointer lock on the canvas), E to enter/exit a car,
// Space to jump, Shift to run, F or click to shoot/punch, R to restart a
// mission step, M to mute, P/Esc to pause. Exposes a plain state object.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = false;
    this.shotQueued = false; // a click between frames still fires one shot
    this.locked = false;
    this.pressed = new Set(); // keys pressed since last consume
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('click', () => {
      if (!this.locked && document.pointerLockElement !== canvas) canvas.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
    document.addEventListener('mousemove', (e) => {
      if (this.locked) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      }
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouseDown = true;
        this.shotQueued = true;
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
    });
  }

  down(code) {
    return this.keys.has(code);
  }

  // True once per physical press; callers consume it each frame.
  wasPressed(code) {
    if (this.pressed.has(code)) {
      this.pressed.delete(code);
      return true;
    }
    return false;
  }

  // True once per mouse click, even a click shorter than one frame.
  consumeShot() {
    const q = this.shotQueued;
    this.shotQueued = false;
    return q;
  }

  consumeMouse() {
    const dx = this.mouseDX;
    const dy = this.mouseDY;
    this.mouseDX = 0;
    this.mouseDY = 0;
    return { dx, dy };
  }

  moveVector() {
    let x = 0;
    let z = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) z += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) z -= 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    const len = Math.hypot(x, z) || 1;
    return { x: x / len, z: z / len, active: x !== 0 || z !== 0 };
  }
}
