// Shared "pick your character" screen. Five dot characters on big tiles; they blink and watch the finger.
// Usage: const picker = createCharacterPicker(parent, { audio, title, onPick(colorIndex) });
//        picker.show(); picker.hide(); picker.destroy();

import { buzz } from './audio.js';
import { DOT_COLORS, drawCharacter, idleLook, lookToward } from './characters.js';

const PICK_DELAY_MS = 650; // let the chosen dot do its happy bounce before moving on

export function createCharacterPicker(parent, { audio, title = "Who's playing?", onPick }) {
  const ac = new AbortController();
  const on = (el, type, fn) => el.addEventListener(type, fn, { signal: ac.signal });
  const el = document.createElement('div');
  el.className = 'pp-pick';
  el.hidden = true;
  el.innerHTML = '<p class="pp-pick-title"></p><div class="pp-pick-grid"></div>';
  el.querySelector('.pp-pick-title').textContent = title;
  const grid = el.querySelector('.pp-pick-grid');
  parent.appendChild(el);

  let raf = 0, last = 0, pointer = null, chosen = -1, timer = 0;
  const tiles = DOT_COLORS.map((col, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pp-pick-btn';
    b.setAttribute('aria-label', `${col.name} dot`);
    const cv = document.createElement('canvas');
    b.appendChild(cv);
    grid.appendChild(b);
    on(b, 'click', () => choose(i));
    return { b, cv, sel: 0, blinkT: 0.5 + Math.random() * 3.5, ph: Math.random() * 6 };
  });
  on(el, 'pointermove', (e) => { pointer = { x: e.clientX, y: e.clientY }; });
  on(el, 'pointerleave', () => { pointer = null; });

  function choose(i) {
    if (chosen >= 0) return;
    audio.init();
    chosen = i;
    tiles[i].sel = 1;
    audio.connect(4); audio.connect(7);
    buzz(15);
    timer = setTimeout(() => { timer = 0; onPick(i); }, PICK_DELAY_MS);
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = now / 1000, dpr = Math.min(window.devicePixelRatio || 1, 2);
    tiles.forEach((p, i) => {
      const size = p.b.clientWidth;
      if (!size) return;
      const px = Math.round(size * dpr);
      if (p.cv.width !== px) p.cv.width = p.cv.height = px;
      const c = p.cv.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, size, size);
      p.blinkT -= dt; if (p.blinkT < 0) p.blinkT = 1.5 + Math.random() * 3.5;
      p.sel = Math.max(0, p.sel - dt * 2.2);
      let sx = 1, sy = 1;
      if (p.sel > 0) { const k = 1 + 0.3 * p.sel * Math.sin((1 - p.sel) * Math.PI * 3); sx = k; sy = 2 - k; }
      const R = size * 0.34, cx = size / 2, cy = size * 0.47;
      let look = idleLook(t, p.ph);
      if (pointer) { const r = p.cv.getBoundingClientRect(); look = lookToward(r.left + cx, r.top + cy, pointer.x, pointer.y); }
      const isChosen = i === chosen;
      drawCharacter(c, cx, cy, R, { color: i, sx, sy, look, open: p.blinkT < 0.13 ? 0.12 : 1, mood: isChosen ? 'happy' : 'normal', outline: isChosen });
    });
    raf = requestAnimationFrame(frame);
  }

  return {
    el,
    show() {
      chosen = -1;
      tiles.forEach((p) => (p.sel = 0));
      el.hidden = false;
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
    },
    hide() {
      el.hidden = true;
      cancelAnimationFrame(raf); raf = 0;
    },
    destroy() {
      cancelAnimationFrame(raf); raf = 0;
      clearTimeout(timer);
      ac.abort();
      el.remove();
    },
  };
}
