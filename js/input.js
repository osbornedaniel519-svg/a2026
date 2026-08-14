// ===================== Input: keyboard + touch =====================
const Input = (() => {
  const keys = new Set();
  const pending = new Set();       // edge-triggered one-shot actions
  let dir = { x: 0, y: 0 };
  let sprint = false;
  let shootCharging = false;
  let shootStart = 0;
  let shootChargeT = 0;
  let onPause = null;
  let onAnyInput = null;

  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

  function fire(name) { pending.add(name); if (onAnyInput) onAnyInput(); }
  function consume(name) { if (pending.has(name)) { pending.delete(name); return true; } return false; }

  function recomputeKeyboardDir() {
    let x = 0, y = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    const n = normalize(x, y);
    keyboardDir = { x: n.x, y: n.y };
  }
  let keyboardDir = { x: 0, y: 0 };
  let joystickDir = { x: 0, y: 0 };
  let joystickActive = false;

  function updateCombinedDir() {
    dir = joystickActive ? joystickDir : keyboardDir;
  }

  function startShootCharge() {
    if (shootCharging) return;
    shootCharging = true;
    shootStart = performance.now();
  }
  function releaseShootCharge() {
    if (!shootCharging) return;
    shootCharging = false;
    const held = (performance.now() - shootStart) / 1000;
    shootChargeT = clamp(held / 0.9, 0, 1);
    fire('shoot');
  }

  function initKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (e.repeat) {
        if (e.code === 'Space' || e.code === 'Escape') return;
      }
      keys.add(e.code);
      recomputeKeyboardDir(); updateCombinedDir();
      if (onAnyInput) onAnyInput();
      switch (e.code) {
        case 'KeyZ': fire('pass'); break;
        case 'KeyX': fire('through'); break;
        case 'KeyC': startShootCharge(); break;
        case 'Space': fire('tackle'); break;
        case 'KeyQ': fire('switch'); break;
        case 'Escape': if (onPause) onPause(); break;
      }
    });
    window.addEventListener('keyup', (e) => {
      keys.delete(e.code);
      recomputeKeyboardDir(); updateCombinedDir();
      if (e.code === 'KeyC') releaseShootCharge();
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') sprint = true;
    });
  }

  function initTouch() {
    const joyBase = document.getElementById('joyBase');
    const joyStick = document.getElementById('joyStick');
    const btnPass = document.getElementById('btnPass');
    const btnThrough = document.getElementById('btnThrough');
    const btnShoot = document.getElementById('btnShoot');
    const btnSprint = document.getElementById('btnSprint');
    if (!joyBase) return;

    let joyPointerId = null;
    const R = 40;

    function joyMove(clientX, clientY) {
      const rect = joyBase.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = clientX - cx, dy = clientY - cy;
      const len = Math.hypot(dx, dy);
      if (len > R) { dx = dx / len * R; dy = dy / len * R; }
      joyStick.style.transform = `translate(${dx}px, ${dy}px)`;
      const n = normalize(dx, dy);
      joystickDir = { x: n.x, y: n.y };
      joystickActive = len > 8;
      updateCombinedDir();
    }
    function joyReset() {
      joyStick.style.transform = 'translate(0px, 0px)';
      joystickActive = false;
      joystickDir = { x: 0, y: 0 };
      updateCombinedDir();
    }

    joyBase.addEventListener('pointerdown', (e) => {
      joyPointerId = e.pointerId;
      joyBase.setPointerCapture(e.pointerId);
      joyMove(e.clientX, e.clientY);
      if (onAnyInput) onAnyInput();
    });
    joyBase.addEventListener('pointermove', (e) => {
      if (e.pointerId !== joyPointerId) return;
      joyMove(e.clientX, e.clientY);
    });
    function endJoy(e) {
      if (e.pointerId !== joyPointerId) return;
      joyPointerId = null;
      joyReset();
    }
    joyBase.addEventListener('pointerup', endJoy);
    joyBase.addEventListener('pointercancel', endJoy);

    function bindTap(el, name) {
      if (!el) return;
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); fire(name); if (onAnyInput) onAnyInput(); });
    }
    bindTap(btnPass, 'pass');
    bindTap(btnThrough, 'through');

    if (btnShoot) {
      btnShoot.addEventListener('pointerdown', (e) => { e.preventDefault(); startShootCharge(); if (onAnyInput) onAnyInput(); });
      btnShoot.addEventListener('pointerup', (e) => { e.preventDefault(); releaseShootCharge(); });
      btnShoot.addEventListener('pointercancel', () => releaseShootCharge());
    }
    if (btnSprint) {
      btnSprint.addEventListener('pointerdown', (e) => { e.preventDefault(); sprint = true; });
      btnSprint.addEventListener('pointerup', (e) => { e.preventDefault(); sprint = false; });
      btnSprint.addEventListener('pointercancel', () => { sprint = false; });
    }
  }

  function init() {
    initKeyboard();
    initTouch();
    if (isTouch) document.body.classList.add('touch-enabled');
  }

  return {
    init,
    get dir() { return dir; },
    get sprint() { return sprint; },
    get shootCharging() { return shootCharging; },
    get shootChargeT() { return shootCharging ? clamp((performance.now() - shootStart) / 900, 0, 1) : shootChargeT; },
    get isTouch() { return isTouch; },
    consume,
    set onPause(fn) { onPause = fn; },
    set onAnyInput(fn) { onAnyInput = fn; },
  };
})();
