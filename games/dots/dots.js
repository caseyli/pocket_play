// Dot Pop: connect same-colour dots to pop them. Endless, no fail.
// Module interface: start(container, { audio, muted, hud }) and stop().

import { buzz } from '../../js/audio.js';
import { DOT_COLORS, drawCharacter, idleLook, lookToward } from '../../js/characters.js';
import { MILESTONE, THEMES, spawnShapes, updateShapes, drawShape, drawStar } from './themes.js';

// ---------- Tunables ----------
const N = 8;            // grid size (N x N)
const G = 55;           // gravity, rows per second^2
const POP_GAP = 0.06;   // seconds between pops along a chain
const IDLE_MS = 4000;   // wiggle dots after this long without touch
const SHUFFLE_S = 0.75; // shuffle-away duration
const COLORS = DOT_COLORS;  // the shared character colours
const BIG_CHAINS = [ // checked in order; first match wins
  { min: 10, word: 'WOW!',     shake: 14, cheer: true, buzz: [30, 40, 60] },
  { min: 8,  word: 'Awesome!', shake: 9,  cheer: true, buzz: 40 },
  { min: 5,  word: 'Great!',   shake: 5,  cheer: false, buzz: 25 },
];
const STAR_PATH = 'M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.5l1.3-6.6L2.5 9.3l6.6-.8z';

let game = null; // the running instance, if any

export function start(container, opts) {
  if (game) stop();
  game = createGame(container, opts);
}

export function stop() {
  if (!game) return;
  game.destroy();
  game = null;
}

function createGame(container, { audio, hud }) {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ac = new AbortController();
  const on = (el, type, fn, o) => el.addEventListener(type, fn, { ...o, signal: ac.signal });
  const timeouts = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timeouts.delete(id); fn(); }, ms); timeouts.add(id); };

  // ---------- DOM ----------
  const root = document.createElement('div');
  root.className = 'dots';
  root.innerHTML = `
    <div class="dots-bg"></div>
    <div class="dots-bg" style="opacity:0"></div>
    <canvas class="dots-bgcanvas"></canvas>
    <div class="dots-wrap"><div class="dots-panel"><canvas class="dots-board" aria-label="Dot Pop board"></canvas></div></div>
    <canvas class="dots-fxcanvas"></canvas>
    <div class="dots-words" aria-live="polite"></div>`;
  container.appendChild(root);

  const [bgA, bgB] = root.querySelectorAll('.dots-bg');
  const bgCanvas = root.querySelector('.dots-bgcanvas'), bctx = bgCanvas.getContext('2d');
  const fxCanvas = root.querySelector('.dots-fxcanvas'), fctx = fxCanvas.getContext('2d');
  const wrap = root.querySelector('.dots-wrap');
  const panel = root.querySelector('.dots-panel');
  const board = root.querySelector('.dots-board'), ctx = board.getContext('2d');
  const words = root.querySelector('.dots-words');
  let bgActive = bgA, bgIdle = bgB;

  // Score pill goes in the shell's HUD centre slot.
  const scorePill = document.createElement('div');
  scorePill.className = 'hud-score';
  scorePill.innerHTML = `
    <div class="hud-score-num"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${STAR_PATH}" fill="#FFC93C" stroke="#E0A800" stroke-width="1.5" stroke-linejoin="round"/></svg><span>0</span></div>
    <div class="hud-meter" aria-hidden="true"><i></i></div>`;
  hud.appendChild(scorePill);
  const scoreNum = scorePill.querySelector('span');
  const meter = scorePill.querySelector('i');

  // ---------- State ----------
  // grid[r][c] holds the dot object for that cell; rendering reads from it.
  let grid = [], chain = [], phase = 'idle', score = 0, themeIdx = 0;
  let size = 320, dpr = 1, boardOff = { x: 0, y: 0 }, gameW = 0, gameH = 0;
  let popQueue = [], popTimer = 0, popIndex = 0, shuffleT = 0;
  let pointer = null, pointerId = null, lastTouch = performance.now(), wiggleTimer = 0, shake = 0, landFlag = false;
  let fxParts = [], bgParts = [], raf = 0, lastT = 0;

  const newDot = (y) => ({
    color: Math.floor(Math.random() * COLORS.length), y, vy: 0, sel: 0, squash: 0, wiggle: 0,
    popping: false, pop: 0, blinkT: Math.random() * 5, ph: Math.random() * 6.28, spin: Math.random() < 0.5 ? -1 : 1,
  });

  function hasMove() {
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const k = grid[r][c].color;
      if (c < N - 1 && grid[r][c + 1].color === k) return true;
      if (r < N - 1 && grid[r + 1][c].color === k) return true;
    }
    return false;
  }

  function newBoard() {
    do {
      grid = [];
      for (let r = 0; r < N; r++) {
        const row = [];
        for (let c = 0; c < N; c++) row.push(newDot(r - N - 1.2 - c * 0.12 - Math.random() * 0.25));
        grid.push(row);
      }
    } while (!hasMove());
    phase = 'falling';
  }

  // ---------- Sizing ----------
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    const gr = root.getBoundingClientRect();
    gameW = gr.width; gameH = gr.height;
    for (const cv of [bgCanvas, fxCanvas]) { cv.width = Math.round(gameW * dpr); cv.height = Math.round(gameH * dpr); }
    const wr = wrap.getBoundingClientRect();
    const cs = getComputedStyle(wrap);
    const pad = 20; // panel padding, both sides
    const availW = wr.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - pad;
    const availH = wr.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - pad;
    size = Math.max(200, Math.floor(Math.min(availW, availH, 560)));
    board.style.width = board.style.height = size + 'px';
    board.width = board.height = Math.round(size * dpr);
    const br = board.getBoundingClientRect();
    boardOff = { x: br.left - gr.left, y: br.top - gr.top };
  }
  const ro = new ResizeObserver(() => resize());
  ro.observe(root);

  // ---------- Input ----------
  // Start a chain from anywhere in a cell; only add dots when the finger is near the cell centre,
  // so diagonal finger paths don't grab the wrong neighbour.
  function cellAt(x, y, strict) {
    const cs = size / N, c = Math.floor(x / cs), r = Math.floor(y / cs);
    if (r < 0 || c < 0 || r >= N || c >= N) return null;
    if (strict) {
      const dx = x - (c + 0.5) * cs, dy = y - (r + 0.5) * cs;
      if (dx * dx + dy * dy > (cs * 0.52) ** 2) return null;
    }
    return { r, c };
  }
  const localPt = (e) => { const b = board.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
  const inChain = (r, c) => chain.some((q) => q.r === r && q.c === c);

  on(board, 'pointerdown', (e) => {
    e.preventDefault();
    audio.init();
    lastTouch = performance.now();
    if (phase !== 'idle' || pointerId !== null) return; // input blocked during animations; one finger at a time
    const p = localPt(e), cell = cellAt(p.x, p.y, false);
    if (!cell) return;
    try { board.setPointerCapture(e.pointerId); } catch (err) {}
    pointerId = e.pointerId;
    pointer = p;
    chain = [cell];
    grid[cell.r][cell.c].sel = 1;
    audio.connect(0);
    buzz(8);
  });

  on(board, 'pointermove', (e) => {
    if (e.pointerId !== pointerId || !chain.length) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    for (const ev of evs.length ? evs : [e]) { pointer = localPt(ev); extend(pointer); }
    lastTouch = performance.now();
  });

  function extend(p) {
    const cell = cellAt(p.x, p.y, true);
    if (!cell) return;
    const last = chain[chain.length - 1];
    if (cell.r === last.r && cell.c === last.c) return;
    const prev = chain[chain.length - 2];
    if (prev && prev.r === cell.r && prev.c === cell.c) { // backtrack
      chain.pop();
      audio.back(chain.length - 1);
      return;
    }
    if (Math.abs(cell.r - last.r) + Math.abs(cell.c - last.c) !== 1) return; // orthogonal neighbours only
    const d = grid[cell.r][cell.c];
    if (d.color !== grid[last.r][last.c].color) return;
    if (inChain(cell.r, cell.c)) return;
    chain.push(cell);
    d.sel = 1;
    audio.connect(chain.length - 1);
    buzz(8);
  }

  function endPointer(e, commit) {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    pointer = null;
    if (commit && chain.length >= 2) startPop();
    else chain = []; // a single dot (or a cancelled touch) just cancels, no penalty
  }
  on(board, 'pointerup', (e) => endPointer(e, true));
  on(board, 'pointercancel', (e) => endPointer(e, false));
  on(root, 'contextmenu', (e) => e.preventDefault());

  // ---------- Game flow ----------
  function startPop() {
    const n = chain.length, color = COLORS[grid[chain[0].r][chain[0].c].color].fill;
    popQueue = chain.slice();
    chain = [];
    popTimer = 0; popIndex = 0;
    phase = 'popping';
    const big = BIG_CHAINS.find((b) => n >= b.min);
    if (big) {
      floatWord(big.word, color);
      shake = big.shake;
      if (big.cheer) audio.cheer();
      buzz(big.buzz);
    }
  }

  function collapse() {
    for (let c = 0; c < N; c++) {
      const keep = [];
      for (let r = N - 1; r >= 0; r--) if (!grid[r][c].popping) keep.push(grid[r][c]);
      const missing = N - keep.length;
      for (let r = N - 1, k = 0; r >= 0; r--, k++) {
        grid[r][c] = k < keep.length ? keep[k] : newDot(r - missing - 0.6 - Math.random() * 0.3);
      }
    }
    phase = 'falling';
  }

  function startShuffle() {
    phase = 'shuffling';
    shuffleT = 0;
    audio.swoosh();
    floatWord('Shuffle!', '#9D4EDD');
  }

  function addScore() {
    score++;
    scoreNum.textContent = score;
    scorePill.classList.remove('bump');
    void scorePill.offsetWidth; // restart the CSS animation
    scorePill.classList.add('bump');
    meter.style.width = ((score % MILESTONE) / MILESTONE) * 100 + '%';
    if (score % MILESTONE === 0) nextTheme();
  }

  function nextTheme() {
    themeIdx = (themeIdx + 1) % THEMES.length;
    applyTheme(false);
    later(() => {
      audio.jingle();
      floatWord(THEMES[themeIdx].label, '#FFC93C');
      buzz([40, 60, 40]);
      celebrate();
    }, 250);
  }

  function applyTheme(instant) {
    const t = THEMES[themeIdx];
    if (instant) {
      bgActive.style.transition = bgIdle.style.transition = 'none';
      bgActive.style.background = t.bg;
      bgActive.style.opacity = 1;
      bgIdle.style.opacity = 0;
      void bgActive.offsetWidth;
      bgActive.style.transition = bgIdle.style.transition = '';
      bgParts = spawnShapes(t.shape, gameW, gameH, true);
    } else {
      bgIdle.style.background = t.bg;
      bgIdle.style.opacity = 1;
      bgActive.style.opacity = 0;
      [bgActive, bgIdle] = [bgIdle, bgActive];
      bgParts.forEach((p) => (p.fade = -1));
      bgParts = bgParts.concat(spawnShapes(t.shape, gameW, gameH, false));
    }
  }

  function floatWord(text, color) {
    const el = document.createElement('div');
    el.className = 'float-word';
    el.textContent = text;
    el.style.color = color;
    el.style.top = boardOff.y + size * 0.42 + 'px';
    words.appendChild(el);
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }

  // ---------- Particles ----------
  function burst(x, y, color, count, power) {
    if (reduceMotion) count = Math.ceil(count / 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, s = (120 + Math.random() * 260) * power;
      fxParts.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120 * power, r: 3 + Math.random() * 5, color,
        life: 1, decay: 1.1 + Math.random() * 0.8, star: Math.random() < 0.35, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12,
      });
    }
  }

  function celebrate() {
    const cols = COLORS.map((c) => c.fill).concat(['#ffffff']);
    for (let i = 0; i < 6; i++) {
      later(() => burst(gameW * (0.15 + Math.random() * 0.7), gameH * (0.2 + Math.random() * 0.5), cols[i % cols.length], 26, 1.3), i * 120);
    }
  }

  // ---------- Update ----------
  function update(dt, t) {
    let moving = false;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const d = grid[r][c];
      if (d.y < r || d.vy !== 0) {
        d.vy += G * dt;
        d.y += d.vy * dt;
        if (d.y >= r) {
          d.y = r;
          if (d.vy > 6) { d.vy = -d.vy * 0.22; d.squash = 1; landFlag = true; } // small bounce
          else { if (d.vy > 0) d.squash = Math.max(d.squash, 0.5); d.vy = 0; }
        }
        moving = true;
      }
      d.sel = Math.max(0, d.sel - dt * 3);
      d.squash = Math.max(0, d.squash - dt * 4);
      d.wiggle = Math.max(0, d.wiggle - dt * 1.1);
      d.blinkT -= dt;
      if (d.blinkT < 0) d.blinkT = 1.5 + Math.random() * 5;
      if (d.popping) d.pop = Math.min(1, d.pop + dt * 7);
    }
    if (landFlag) { audio.land(); landFlag = false; }

    if (phase === 'falling' && !moving) {
      phase = 'idle';
      if (!hasMove()) startShuffle();
    }

    if (phase === 'popping') {
      popTimer -= dt;
      while (popQueue.length && popTimer <= 0) {
        const p = popQueue.shift(), d = grid[p.r][p.c], cs = size / N;
        d.popping = true;
        burst(boardOff.x + (p.c + 0.5) * cs, boardOff.y + (d.y + 0.5) * cs, COLORS[d.color].fill, 10, 1);
        audio.pop(popIndex++);
        addScore();
        popTimer += POP_GAP;
      }
      if (!popQueue.length) {
        let done = true;
        for (const row of grid) for (const d of row) if (d.popping && d.pop < 1) done = false;
        if (done) { collapse(); buzz(15); }
      }
    }

    if (phase === 'shuffling') {
      shuffleT += dt;
      if (shuffleT > SHUFFLE_S) newBoard();
    }

    // Idle: wiggle random dots to invite play.
    if (phase === 'idle' && !chain.length && performance.now() - lastTouch > IDLE_MS) {
      wiggleTimer -= dt;
      if (wiggleTimer <= 0) {
        grid[Math.floor(Math.random() * N)][Math.floor(Math.random() * N)].wiggle = 1;
        wiggleTimer = 1.2;
      }
    }

    for (const p of fxParts) {
      p.vy += 700 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.life -= p.decay * dt;
    }
    fxParts = fxParts.filter((p) => p.life > 0);

    bgParts = updateShapes(bgParts, dt, t, gameW, gameH);
    shake = reduceMotion ? 0 : shake * Math.pow(0.02, dt);
  }

  // ---------- Draw ----------
  function draw(t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    const cs = size / N, R = cs * 0.34;

    // faint cell guides
    ctx.fillStyle = 'rgba(29,35,64,.045)';
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      ctx.beginPath(); ctx.arc((c + 0.5) * cs, (r + 0.5) * cs, R * 0.55, 0, 7); ctx.fill();
    }

    // chain line, gently pulsing, following the finger
    if (chain.length) {
      const col = COLORS[grid[chain[0].r][chain[0].c].color];
      ctx.strokeStyle = col.fill;
      ctx.lineCap = ctx.lineJoin = 'round';
      ctx.lineWidth = cs * (0.2 + (reduceMotion ? 0 : 0.03 * Math.sin(t * 12)));
      ctx.beginPath();
      chain.forEach((q, i) => { const x = (q.c + 0.5) * cs, y = (q.r + 0.5) * cs; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      if (pointer) ctx.lineTo(pointer.x, pointer.y);
      ctx.stroke();
    }

    const shuffleK = phase === 'shuffling' ? Math.min(1, shuffleT / 0.6) : 0;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const d = grid[r][c];
      const x = (c + 0.5) * cs, y = (d.y + 0.5) * cs;
      if (y < -cs) continue;
      drawDot(x, y, R, d, inChain(r, c), t, shuffleK);
    }

    // confetti
    fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fctx.clearRect(0, 0, gameW, gameH);
    for (const p of fxParts) {
      fctx.globalAlpha = Math.max(0, p.life);
      if (p.star) {
        fctx.save(); fctx.translate(p.x, p.y); fctx.rotate(p.rot);
        drawStar(fctx, 0, 0, p.r * 1.8, p.r * 0.7, p.color);
        fctx.restore();
      } else {
        fctx.fillStyle = p.color; fctx.beginPath(); fctx.arc(p.x, p.y, p.r, 0, 7); fctx.fill();
      }
    }
    fctx.globalAlpha = 1;

    // background shapes
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bctx.clearRect(0, 0, gameW, gameH);
    for (const p of bgParts) drawShape(bctx, p, t);

    // screen shake
    panel.style.transform = shake > 0.3 ? `translate(${(Math.random() - 0.5) * shake}px,${(Math.random() - 0.5) * shake}px)` : '';
  }

  function drawDot(x, y, R, d, selected, t, shuffleK) {
    let sx = 1, sy = 1, rot = 0, alpha = 1;
    if (selected) sx = sy = 1.1;
    if (d.sel > 0) { const b = 1 + 0.3 * d.sel * Math.sin((1 - d.sel) * Math.PI * 3); sx *= b; sy *= 2 - b; } // boing
    if (d.squash > 0) { sx *= 1 + 0.2 * d.squash; sy *= 1 - 0.2 * d.squash; }
    if (d.wiggle > 0) rot = Math.sin(d.wiggle * 18) * 0.35 * d.wiggle;
    if (d.popping) { sx = sy = 1 + d.pop * 0.6; alpha = 1 - d.pop; }
    if (shuffleK) { sx = sy = 1 - shuffleK; rot = shuffleK * 9 * d.spin; }
    drawCharacter(ctx, x, y, R, {
      color: COLORS[d.color], sx, sy, rot, alpha,
      shadow: !d.popping && !shuffleK,
      outline: selected,
      mood: selected || d.popping ? 'happy' : 'normal',
      look: pointer ? lookToward(x, y, pointer.x, pointer.y) : idleLook(t, d.ph), // follow the finger while dragging
      open: d.blinkT < 0.13 ? 0.12 : 1,
    });
  }

  // ---------- Loop ----------
  function frame(now) {
    const dt = Math.min(0.033, Math.max(0, (now - lastT) / 1000));
    lastT = now;
    update(dt, now / 1000);
    draw(now / 1000);
    raf = requestAnimationFrame(frame);
  }

  // ---------- Go ----------
  resize();
  applyTheme(true);
  newBoard();
  audio.jingle();
  lastT = performance.now();
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      raf = 0;
      ac.abort();
      ro.disconnect();
      for (const id of timeouts) clearTimeout(id);
      timeouts.clear();
      grid = []; chain = []; popQueue = []; fxParts = []; bgParts = [];
      root.remove();
      scorePill.remove();
    },
  };
}
