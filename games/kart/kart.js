// Dot Dash: a very simple kart game for 2-4 year olds.
// Pick a driver, pick a course, drive one lap. Behind-the-kart view; the kart steers itself.
// Two controls: Go and Stop.
// Green light: hold Go. Red light: hold Stop until the kart stops. There is no losing.
// Module interface: start(container, { audio, muted, hud }) and stop().

import { buzz } from '../../js/audio.js';
import { DOT_COLORS, INK, drawCharacter, idleLook, lookToward } from '../../js/characters.js';
import {
  SEG_LEN, ROAD_W, LANES, DRAW_DIST, CAM_H, MAX_SPEED, ACCEL, COAST, BRAKE,
  GREEN_DRIVE_S, YELLOW_S, RED_HOLD_S, REMIND_AFTER_S, FRIENDS,
  buildTrack, COURSES, drawSprite, drawGate, drawCoursePreview,
} from './track.js';

const DEPTH = 0.84;           // camera depth (about a 100 degree field of view)
const CURVE_K = 0.42;         // how strongly track curves bend on screen
const KART_W = 480;           // kart width, world units
const SPRITE_W = 700;         // base scenery width, world units
const FRIEND_LANE = 0.64;     // friends drive in the side lanes (fraction of half-width)
const START_RED_S = 1.6;      // red light before the very first green
const GO_HINT_S = 3;          // pulse the Go button after this long parked on green
const FINISH_CARD_S = 6;      // the "Congrats!" card stays this long (or until tapped), then back to the start
const STAR_PATH = 'M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.5l1.3-6.6L2.5 9.3l6.6-.8z';

let game = null;

export function start(container, opts) {
  if (game) stop();
  game = createGame(container, opts);
}

export function stop() {
  if (!game) return;
  game.destroy();
  game = null;
}

const lerp = (a, b, p) => a + (b - a) * p;
const rand = (a, b) => a + Math.random() * (b - a);

function createGame(container, { audio, hud }) {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ac = new AbortController();
  const on = (el, type, fn, o) => el.addEventListener(type, fn, { ...o, signal: ac.signal });
  const timeouts = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timeouts.delete(id); fn(); }, ms); timeouts.add(id); };

  // ---------- DOM ----------
  const root = document.createElement('div');
  root.className = 'kart picking';
  root.innerHTML = `
    <canvas class="kart-canvas"></canvas>
    <div class="kart-glow"></div>
    <div class="kart-light" data-light="red" role="img" aria-label="Traffic light: red">
      <i class="lamp lamp-red"></i><i class="lamp lamp-yellow"></i><i class="lamp lamp-green"></i>
    </div>
    <div class="kart-words" aria-live="polite"></div>
    <div class="kart-controls" hidden>
      <button class="kart-btn kart-stop" type="button" aria-label="Stop"><span class="ring"><span class="face">STOP</span></span></button>
      <button class="kart-btn kart-go" type="button" aria-label="Go"><span class="ring"><span class="face">GO
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg></span></span></button>
    </div>
    <div class="kart-pick">
      <p class="kart-pick-title">Who's driving?</p>
      <div class="kart-pick-grid"></div>
    </div>
    <div class="kart-pick kart-courses" hidden>
      <p class="kart-pick-title">Where to?</p>
      <div class="kart-course-grid"></div>
    </div>
    <div class="kart-pick kart-finish" hidden>
      <button class="kart-finish-card" type="button" aria-label="Play again">
        <canvas class="kart-finish-face"></canvas>
        <span class="kart-finish-title">Congrats!</span>
        <span class="kart-finish-text">You finished the course!</span>
        <span class="kart-finish-stars"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${STAR_PATH}" fill="#FFC93C" stroke="#E0A800" stroke-width="1.5" stroke-linejoin="round"/></svg><b>0</b></span>
      </button>
    </div>`;
  container.appendChild(root);

  const canvas = root.querySelector('.kart-canvas'), ctx = canvas.getContext('2d');
  const lightEl = root.querySelector('.kart-light');
  const glowEl = root.querySelector('.kart-glow');
  const words = root.querySelector('.kart-words');
  const controls = root.querySelector('.kart-controls');
  const goBtn = root.querySelector('.kart-go'), stopBtn = root.querySelector('.kart-stop');
  const pickEl = root.querySelector('.kart-pick'), pickGrid = root.querySelector('.kart-pick-grid');
  const coursesEl = root.querySelector('.kart-courses'), courseGrid = root.querySelector('.kart-course-grid');
  const finishEl = root.querySelector('.kart-finish'), finishCard = root.querySelector('.kart-finish-card');
  const finishFace = root.querySelector('.kart-finish-face'), finishStars = root.querySelector('.kart-finish-stars b');

  const scorePill = document.createElement('div');
  scorePill.className = 'hud-score';
  scorePill.innerHTML = `
    <div class="hud-score-num"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${STAR_PATH}" fill="#FFC93C" stroke="#E0A800" stroke-width="1.5" stroke-linejoin="round"/></svg><span>0</span></div>
    <div class="hud-meter" aria-hidden="true"><i></i></div>`;
  hud.appendChild(scorePill);
  const scoreNum = scorePill.querySelector('span'), meter = scorePill.querySelector('i');

  // ---------- State ----------
  let courseIdx = 0, segs = [], N = 0, L = 1;
  function loadCourse(i) {
    courseIdx = i;
    segs = buildTrack(COURSES[i]);
    N = segs.length; L = N * SEG_LEN;
    carSegs = [];
    skyGradKey = '';
  }
  const GATE_Z = 2 * SEG_LEN;
  let W = 0, H = 0, dpr = 1, K = 1, horizonY = 0, kartY = 0, kartDz = 500;
  // phase: 'pick' (driver) -> 'course' -> 'race' -> 'finish' -> back to 'pick'
  let phase = 'pick', driver = 0, stars = 0, finishToken = 0;
  let position = 0, speed = 0, goHeld = false, stopHeld = false, keyGo = false, keyStop = false;
  let light = 'red', lightT = 0, greenLeft = 0, redNeedsStop = false, redHoldT = 0, remindT = 0, starGiven = false, parkedT = 0;
  let leftGrid = false, skyOff = 0, frameNo = 0, raf = 0, lastT = 0, celebrateT = 0, finishBounce = 0;
  let friends = [], carSegs = [], parts = [];
  let skyGrad = null, skyGradKey = '';
  let kartFx = { sel: 0, blinkT: 2, ph: Math.random() * 6 };
  let pickPointer = null;
  const engine = audio.engine();

  const segAt = (z) => segs[Math.floor((((z % L) + L) % L) / SEG_LEN) % N];
  const wrapRel = (d) => { d = ((d % L) + L) % L; return d > L / 2 ? d - L : d; };
  const crossed = (prev, now, mark) => wrapRel(prev - mark) < 0 && wrapRel(now - mark) >= 0;

  // ---------- Sizing ----------
  function resize() {
    const r = root.getBoundingClientRect();
    W = r.width; H = r.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    K = Math.min(W, H * 0.75) / 2;
    horizonY = Math.round(H * 0.42);
    const cr = controls.getBoundingClientRect();
    const controlsTop = controls.hidden || !cr.height ? H - 190 : cr.top - r.top;
    kartY = Math.max(horizonY + 120, controlsTop - 14);
    kartDz = (DEPTH * CAM_H * K) / (kartY - horizonY);
    skyGradKey = '';
    if (phase === 'course') drawCoursePreviews();
  }
  const ro = new ResizeObserver(() => resize());
  ro.observe(root);

  // ---------- Input ----------
  function bindHold(btn, set) {
    const pointers = new Set();
    const update = () => { set(pointers.size > 0); btn.classList.toggle('down', pointers.size > 0); };
    on(btn, 'pointerdown', (e) => {
      e.preventDefault();
      audio.init();
      try { btn.setPointerCapture(e.pointerId); } catch (err) {}
      pointers.add(e.pointerId); update();
    });
    const up = (e) => { pointers.delete(e.pointerId); update(); };
    on(btn, 'pointerup', up); on(btn, 'pointercancel', up); on(btn, 'lostpointercapture', up);
  }
  bindHold(goBtn, (v) => (goHeld = v));
  bindHold(stopBtn, (v) => (stopHeld = v));
  const keyMap = { ArrowUp: 'go', ' ': 'go', w: 'go', ArrowDown: 'stop', s: 'stop' };
  on(window, 'keydown', (e) => {
    const k = keyMap[e.key]; if (!k || phase !== 'race') return;
    e.preventDefault();
    if (k === 'go') keyGo = true; else keyStop = true;
  });
  on(window, 'keyup', (e) => {
    const k = keyMap[e.key]; if (!k) return;
    if (k === 'go') keyGo = false; else keyStop = false;
  });
  on(window, 'blur', () => { keyGo = keyStop = false; });

  // ---------- Driver picker ----------
  const pickers = DOT_COLORS.map((col, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'kart-pick-btn';
    b.setAttribute('aria-label', `${col.name} driver`);
    const cv = document.createElement('canvas');
    b.appendChild(cv);
    pickGrid.appendChild(b);
    on(b, 'click', () => choose(i));
    return { b, cv, c: cv.getContext('2d'), sel: 0, blinkT: rand(0.5, 4), ph: Math.random() * 6 };
  });
  on(pickEl, 'pointermove', (e) => { pickPointer = { x: e.clientX, y: e.clientY }; });
  on(pickEl, 'pointerleave', () => { pickPointer = null; });

  function drawPickers(t, dt) {
    for (let i = 0; i < pickers.length; i++) {
      const p = pickers[i];
      const size = p.b.clientWidth;
      if (!size) continue;
      const px = Math.round(size * dpr);
      if (p.cv.width !== px) { p.cv.width = p.cv.height = px; }
      const c = p.c;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, size, size);
      p.blinkT -= dt; if (p.blinkT < 0) p.blinkT = rand(1.5, 5);
      p.sel = Math.max(0, p.sel - dt * 2.2);
      let sx = 1, sy = 1;
      if (p.sel > 0) { const b = 1 + 0.3 * p.sel * Math.sin((1 - p.sel) * Math.PI * 3); sx = b; sy = 2 - b; }
      const R = size * 0.34, cx = size / 2, cy = size * 0.47;
      let look = idleLook(t, p.ph);
      if (pickPointer) { const r = p.cv.getBoundingClientRect(); look = lookToward(r.left + cx, r.top + cy, pickPointer.x, pickPointer.y); }
      const chosen = phase !== 'pick' && i === driver;
      drawCharacter(c, cx, cy, R, { color: i, sx, sy, look, open: p.blinkT < 0.13 ? 0.12 : 1, mood: chosen ? 'happy' : 'normal', outline: chosen });
    }
  }

  function choose(i) {
    if (phase !== 'pick') return;
    audio.init();
    driver = i;
    phase = 'chosen';
    pickers[i].sel = 1;
    audio.connect(4); audio.connect(7);
    buzz(15);
    later(() => showCourses(), 650);
  }

  // ---------- Course picker ----------
  const courseBtns = COURSES.map((course, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'kart-course-btn';
    b.setAttribute('aria-label', course.label.replace('!', ''));
    b.innerHTML = `<canvas></canvas><span>${course.name}</span>`;
    courseGrid.appendChild(b);
    on(b, 'click', () => chooseCourse(i));
    return { b, cv: b.querySelector('canvas') };
  });

  function drawCoursePreviews() {
    courseBtns.forEach(({ cv }, i) => {
      const w = cv.clientWidth, h = cv.clientHeight;
      if (!w || !h) return;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      const c = cv.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawCoursePreview(c, w, h, COURSES[i]);
      // the chosen driver, ready to go
      const R = Math.min(w, h) * 0.13;
      drawCharacter(c, w / 2, h * 0.8, R, { color: driver, look: { x: 0, y: -0.6 } });
    });
  }

  function showCourses() {
    pickEl.hidden = true;
    coursesEl.hidden = false;
    courseBtns.forEach(({ b }) => b.classList.remove('chosen'));
    phase = 'course';
    drawCoursePreviews();
  }

  function chooseCourse(i) {
    if (phase !== 'course') return;
    audio.init();
    phase = 'courseChosen';
    courseBtns[i].b.classList.add('chosen');
    audio.connect(5); audio.connect(9);
    buzz(15);
    loadCourse(i);
    later(() => startRace(), 650);
  }

  // ---------- Race ----------
  function startRace() {
    coursesEl.hidden = true;
    root.classList.remove('picking');
    controls.hidden = false;
    resize();
    phase = 'race';
    position = ((L - kartDz - SEG_LEN * 4) % L + L) % L; // just behind the start gate
    speed = 0;
    stars = 0; scoreNum.textContent = '0';
    leftGrid = false; parts = []; words.replaceChildren();
    goHeld = stopHeld = keyGo = keyStop = false;
    starGiven = false; parkedT = 0;
    floatWord(COURSES[courseIdx].label, '#FFC93C');
    const others = DOT_COLORS.map((_, i) => i).filter((i) => i !== driver).sort(() => Math.random() - 0.5).slice(0, FRIENDS);
    const playerZ = position + kartDz;
    friends = others.map((color, k) => ({
      color, lane: k % 2 ? FRIEND_LANE : -FRIEND_LANE,
      z: (playerZ + 700 + k * 1700) % L,
      speed: 0, cruise: MAX_SPEED * (0.58 + k * 0.08), wait: 0, blinkT: rand(1, 4), ph: Math.random() * 6,
    }));
    setLight('red', true);
    lightT = START_RED_S;
    redNeedsStop = false;
  }

  function setLight(s, quiet) {
    light = s;
    lightEl.dataset.light = s;
    lightEl.setAttribute('aria-label', `Traffic light: ${s}`);
    glowEl.dataset.light = s;
    lightEl.classList.remove('remind');
    if (s === 'green') {
      greenLeft = rand(GREEN_DRIVE_S[0], GREEN_DRIVE_S[1]);
      parkedT = 0;
      for (const f of friends) f.wait = rand(0.2, 0.9);
      if (!quiet) { audio.lightGreen(); floatWord('Go!', '#2EC27E'); }
    } else if (s === 'yellow') {
      lightT = YELLOW_S;
      redNeedsStop = speed > 60; // moving when the warning came: stopping now (or on red) earns a star
      starGiven = false;
      if (!quiet) audio.lightYellow();
    } else {
      redNeedsStop = (redNeedsStop && !starGiven) || speed > 60;
      redHoldT = 0; remindT = 0;
      if (!quiet) { audio.lightRed(); floatWord('Stop!', '#FF4D6D'); }
    }
  }

  function floatWord(text, color) {
    const el = document.createElement('div');
    el.className = 'float-word';
    el.textContent = text;
    el.style.color = color;
    el.style.top = Math.round(horizonY + (kartY - horizonY) * 0.28) + 'px';
    words.appendChild(el);
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }

  function addStar() {
    stars++;
    scoreNum.textContent = stars;
    scorePill.classList.remove('bump'); void scorePill.offsetWidth; scorePill.classList.add('bump');
    audio.star();
    buzz(25);
    kartFx.sel = 1;
    burst(W / 2, kartY - KART_W * (DEPTH / kartDz) * K * 0.9, ['#FFC93C', '#ffffff', DOT_COLORS[driver].fill], 22, 0.9);
  }

  function newLap() {
    if (!leftGrid) { leftGrid = true; return; } // the first time through the gate is the start
    finishRace();
  }

  // ---------- Finish ----------
  function finishRace() {
    phase = 'finish';
    root.classList.add('picking');           // hide the traffic light and glow
    controls.hidden = true;
    goHeld = stopHeld = keyGo = keyStop = false;
    goBtn.classList.remove('down', 'kart-nudge'); stopBtn.classList.remove('down', 'kart-nudge');
    glowEl.classList.remove('moving-on-red');
    light = 'green';                         // friends drive on past
    for (const f of friends) f.wait = 0;
    audio.jingle();
    later(() => audio.cheer(), 450);
    buzz([40, 60, 40, 60, 80]);
    celebrateT = 1.2;
    kartFx.sel = 1;
    const token = ++finishToken;
    later(() => {
      if (token !== finishToken) return;
      finishStars.textContent = stars;
      finishEl.hidden = false;
      finishBounce = 0;
    }, 1300);
    later(() => { if (token === finishToken) backToStart(); }, 1300 + FINISH_CARD_S * 1000);
  }
  on(finishCard, 'click', () => { if (phase === 'finish' && !finishEl.hidden) backToStart(); });

  function backToStart() {
    finishToken++;
    finishEl.hidden = true;
    engine.quiet();
    phase = 'pick';
    friends = [];
    for (const s of carSegs) s.cars.length = 0;
    carSegs = [];
    pickers.forEach((p) => (p.sel = 0));
    pickEl.hidden = false;
    audio.swoosh();
  }

  function drawFinishFace(t, dt) {
    const size = finishFace.clientWidth;
    if (!size) return;
    const px = Math.round(size * dpr);
    if (finishFace.width !== px) finishFace.width = finishFace.height = px;
    const c = finishFace.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, size, size);
    finishBounce += dt;
    const R = size * 0.3;
    const hop = reduceMotion ? 0 : Math.abs(Math.sin(finishBounce * 3.4)); // happy little hops
    const land = reduceMotion ? 0 : Math.max(0, 1 - hop * 6);               // squash just as it lands
    c.fillStyle = 'rgba(20,30,60,.12)';
    c.beginPath(); c.ellipse(size / 2, size * 0.86, R * (0.8 - hop * 0.25), R * 0.16, 0, 0, 7); c.fill();
    drawCharacter(c, size / 2, size * 0.86 - R - hop * size * 0.14, R, {
      color: driver, mood: 'happy', mouth: 'smile', shadow: false, sx: 1 + land * 0.12, sy: 1 - land * 0.12,
    });
  }

  // ---------- Particles ----------
  function burst(x, y, cols, count, power) {
    if (reduceMotion) count = Math.ceil(count / 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, s = (120 + Math.random() * 240) * power;
      parts.push({ kind: 'confetti', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 160 * power, r: 3 + Math.random() * 4,
        color: cols[i % cols.length], life: 1, decay: 0.9 + Math.random() * 0.6, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10 });
    }
  }
  function puff(x, y, s, side) {
    parts.push({ kind: 'puff', x, y, vx: side * rand(20, 60), vy: rand(10, 30), r: s, life: 1, decay: 2.2 });
  }

  // ---------- Update ----------
  function update(dt, t) {
    frameNo++;
    if (phase === 'race') updateRace(dt, t);
    else if (phase === 'finish') updateFinish(dt);

    if (celebrateT > 0) {
      const before = celebrateT; celebrateT -= dt;
      for (let k = 0; k < 6; k++) {
        const at = 1.2 - k * 0.15;
        if (before > at && celebrateT <= at) burst(W * rand(0.15, 0.85), H * rand(0.15, 0.4), DOT_COLORS.map((c) => c.fill).concat('#fff'), 24, 1.2);
      }
    }
    for (const p of parts) {
      if (p.kind === 'confetti') { p.vy += 700 * dt; p.rot += p.vr * dt; }
      else { p.r += 14 * dt; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= p.decay * dt;
    }
    parts = parts.filter((p) => p.life > 0);
    kartFx.sel = Math.max(0, kartFx.sel - dt * 2);
    kartFx.blinkT -= dt; if (kartFx.blinkT < 0) kartFx.blinkT = rand(1.5, 5);
  }

  function updateFinish(dt) {
    speed = Math.max(0, speed - BRAKE * 0.35 * dt);   // roll gently to a stop past the line
    position = (position + speed * dt) % L;
    updateFriends(dt, position + kartDz);
    engine.set(speed / MAX_SPEED);
  }

  function updateFriends(dt, playerZ) {
    for (const s of carSegs) s.cars.length = 0;
    carSegs = [];
    for (const f of friends) {
      let target = 0;
      if (light === 'green') { f.wait -= dt; target = f.wait > 0 ? 0 : f.cruise; }
      else if (light === 'yellow') target = f.cruise * 0.55;
      const rel = wrapRel(f.z - playerZ);
      if (target > 0 && rel < -3000) target *= 1.7;       // far behind: catch up
      if (target > 0 && rel > 16000) target *= 0.45;      // far ahead: wait for us
      const acc = target > f.speed ? ACCEL * 0.7 : (light === 'red' ? BRAKE * 0.6 : COAST * 1.5);
      f.speed += Math.max(-acc * dt, Math.min(acc * dt, target - f.speed));
      if (f.speed < 5 && target === 0) f.speed = 0;
      f.z = (f.z + f.speed * dt) % L;
      f.blinkT -= dt; if (f.blinkT < 0) f.blinkT = rand(1.5, 5);
      const s = segAt(f.z);
      s.cars.push(f); carSegs.push(s);
    }

  }

  function updateRace(dt, t) {
    const go = goHeld || keyGo, brake = stopHeld || keyStop;
    const prevPlayerZ = position + kartDz;
    const wasMoving = speed > 0;

    // speed
    if (brake) speed -= BRAKE * dt;
    else if (go) speed += ACCEL * dt * (1 - 0.35 * (speed / MAX_SPEED));
    else speed -= COAST * dt;
    speed = Math.max(0, Math.min(MAX_SPEED, speed));
    if (speed < 8 && !go) speed = 0;
    if (brake && wasMoving && speed > MAX_SPEED * 0.45 && Math.random() < dt * 3) audio.squeak();

    position = (position + speed * dt) % L;
    const playerZ = position + kartDz;
    if (crossed(prevPlayerZ, playerZ, GATE_Z)) newLap();

    // traffic light
    if (light === 'green') {
      greenLeft -= dt * (speed / MAX_SPEED);       // only counts down while driving
      if (greenLeft <= 0) setLight('yellow');
      parkedT = speed < 1 && !go ? parkedT + dt : 0;
    } else if (light === 'yellow') {
      lightT -= dt;
      if (speed === 0 && redNeedsStop && !starGiven) { starGiven = true; addStar(); } // stopped early: good!
      if (lightT <= 0) setLight('red');
    } else if (light === 'red') {
      if (lightT > 0) { // the very first red before the race starts
        lightT -= dt;
        if (lightT <= 0) setLight('green');
      } else if (speed === 0) {
        remindT = 0;
        lightEl.classList.remove('remind');
        if (redNeedsStop && !starGiven) { starGiven = true; addStar(); }
        redHoldT += dt;
        if (redHoldT >= RED_HOLD_S) setLight('green');
      } else {
        redHoldT = 0;
        if (!brake) {
          remindT += dt;
          if (remindT >= REMIND_AFTER_S) {
            remindT = -1.6; // repeat gently every ~3s while still rolling
            audio.remind();
            lightEl.classList.remove('remind'); void lightEl.offsetWidth; lightEl.classList.add('remind');
          }
        }
      }
    }
    goBtn.classList.toggle('kart-nudge', light === 'green' && parkedT > GO_HINT_S);
    stopBtn.classList.toggle('kart-nudge', light === 'red' && lightT <= 0 && speed > 0 && !brake);
    glowEl.classList.toggle('moving-on-red', light === 'red' && lightT <= 0 && speed > 0);

    updateFriends(dt, playerZ);

    // engine + exhaust
    engine.set(speed / MAX_SPEED);
    if (go && !brake && speed < MAX_SPEED * 0.95 && !reduceMotion && Math.random() < dt * 14) {
      const w = KART_W * (DEPTH / kartDz) * K;
      puff(kartX - w * 0.18, kartY - w * 0.06, w * 0.03, -1); puff(kartX + w * 0.18, kartY - w * 0.06, w * 0.03, 1);
    }
    skyOff += segAt(playerZ).curve * (speed / MAX_SPEED) * dt * 0.06;
  }

  // ---------- Draw ----------
  let kartX = 0;

  function poly(x1, y1, x2, y2, x3, y3, x4, y4, color) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4); ctx.closePath(); ctx.fill();
  }

  function project(p, camX, camY, camZ) {
    p.cz = p.z - camZ;
    p.scale = DEPTH / p.cz;
    p.sx = W / 2 + p.scale * (camX) * K;
    p.sy = horizonY - p.scale * (p.y - camY) * K;
    p.sw = p.scale * ROAD_W * K;
  }

  function drawBackground(world, t) {
    const key = courseIdx + ':' + H + ':' + horizonY;
    if (key !== skyGradKey) {
      skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
      skyGrad.addColorStop(0, world.sky[0]); skyGrad.addColorStop(1, world.sky[1]);
      skyGradKey = key;
    }
    ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, W, horizonY + 2);

    if (world.stars) {
      for (let i = 0; i < 40; i++) {
        const x = ((i * 97.3 + skyOff * 40) % W + W) % W, y = (i * 53.7) % (horizonY * 0.85);
        ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.3 + i));
        ctx.fillStyle = '#fff'; ctx.fillRect(x, y, 2, 2);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff6d0'; ctx.beginPath(); ctx.arc(W * 0.8, horizonY * 0.3, 26, 0, 7); ctx.fill();
      ctx.fillStyle = world.sky[0]; ctx.beginPath(); ctx.arc(W * 0.8 + 11, horizonY * 0.3 - 6, 22, 0, 7); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(255,248,200,.9)'; ctx.beginPath(); ctx.arc(W * 0.82, horizonY * 0.3, 30, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.88)';
      for (let i = 0; i < 4; i++) {
        const s = 36 + i * 10;
        const x = ((i * W * 0.37 + skyOff * 60 * (0.5 + i * 0.2) + t * 6) % (W + 200) + W + 200) % (W + 200) - 100;
        const y = horizonY * (0.25 + (i % 3) * 0.18);
        ctx.beginPath(); ctx.arc(x, y, s * 0.5, 0, 7); ctx.arc(x + s * 0.45, y - s * 0.2, s * 0.42, 0, 7); ctx.arc(x + s * 0.9, y, s * 0.38, 0, 7); ctx.fill();
      }
    }

    // distant hills (or sea), with parallax on curves
    if (world.sea) {
      ctx.fillStyle = world.hillsFar; ctx.fillRect(0, horizonY - 26, W, 28);
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      for (let i = 0; i < 9; i++) ctx.fillRect(((i * 71 + skyOff * 120 + t * 10) % W + W) % W, horizonY - 20 + (i % 3) * 7, 24, 2);
    } else {
      hills(world.hillsFar, 34, 0.004, skyOff * 80, horizonY - 4);
      hills(world.hills, 22, 0.007, skyOff * 160, horizonY + 2);
    }
    ctx.fillStyle = world.grass[0]; ctx.fillRect(0, horizonY, W, H - horizonY);
  }

  function hills(color, amp, freq, off, base) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(0, base);
    for (let x = 0; x <= W + 8; x += 8) {
      const u = x + off;
      ctx.lineTo(x, base - amp * (0.6 + 0.4 * Math.sin(u * freq) + 0.3 * Math.sin(u * freq * 2.3 + 1)));
    }
    ctx.lineTo(W, base + 4); ctx.lineTo(0, base + 4); ctx.closePath(); ctx.fill();
  }

  function drawRoad(world, t) {
    const base = segAt(position);
    const basePct = (position % SEG_LEN) / SEG_LEN;
    const playerZ = position + kartDz;
    const pSeg = segAt(playerZ);
    const pPct = (((playerZ % L) + L) % L % SEG_LEN) / SEG_LEN;
    const camY = lerp(pSeg.p1.y, pSeg.p2.y, pPct) + CAM_H;
    let maxy = H, x = 0, dx = -(base.curve * basePct) * CURVE_K;

    const visible = [];
    for (let n = 0; n < DRAW_DIST; n++) {
      const seg = segs[(base.index + n) % N];
      const camZ = position - (seg.index < base.index ? L : 0);
      project(seg.p1, x, camY, camZ);
      project(seg.p2, x + dx, camY, camZ);
      x += dx; dx += seg.curve * CURVE_K;
      seg.clip = maxy;
      seg.seen = frameNo;
      seg.rel = n;
      visible.push(seg);
      const p1 = seg.p1, p2 = seg.p2;
      if (p1.cz <= 1 || p2.sy >= p1.sy || p2.sy >= maxy) continue;
      const y1 = Math.min(p1.sy, maxy) + 1, y2 = p2.sy;
      const alt = Math.floor(seg.index / 3) % 2;
      ctx.fillStyle = world.grass[alt]; ctx.fillRect(0, y2, W, y1 - y2);
      const r1 = p1.sw * 0.13, r2 = p2.sw * 0.13;
      poly(p1.sx - p1.sw - r1, y1, p1.sx - p1.sw, y1, p2.sx - p2.sw, y2, p2.sx - p2.sw - r2, y2, world.rumble[alt]);
      poly(p1.sx + p1.sw + r1, y1, p1.sx + p1.sw, y1, p2.sx + p2.sw, y2, p2.sx + p2.sw + r2, y2, world.rumble[alt]);
      poly(p1.sx - p1.sw, y1, p1.sx + p1.sw, y1, p2.sx + p2.sw, y2, p2.sx - p2.sw, y2, world.road[alt]);
      if (seg.index === 2 || seg.index === 3) { // checkered start line
        const cols = 8;
        for (let i = 0; i < cols; i++) {
          const a = -1 + (2 * i) / cols, b = -1 + (2 * (i + 1)) / cols;
          poly(p1.sx + a * p1.sw, y1, p1.sx + b * p1.sw, y1, p2.sx + b * p2.sw, y2, p2.sx + a * p2.sw, y2,
            (i + seg.index) % 2 ? INK : '#ffffff');
        }
      } else if (alt) { // lane markings
        const lw1 = p1.sw * 0.035, lw2 = p2.sw * 0.035;
        for (let l = 1; l < LANES; l++) {
          const f = -1 + (2 * l) / LANES;
          poly(p1.sx + f * p1.sw - lw1, y1, p1.sx + f * p1.sw + lw1, y1, p2.sx + f * p2.sw + lw2, y2, p2.sx + f * p2.sw - lw2, y2, 'rgba(255,255,255,.75)');
        }
      }
      maxy = p2.sy;
    }

    // sprites and karts, far to near
    const pRel = (pSeg.index - base.index + N) % N;
    kartX = lerp(pSeg.p1.sx, pSeg.p2.sx, pPct);
    for (let i = visible.length - 1; i >= 0; i--) {
      const seg = visible[i];
      if (seg.p1.cz <= 1) { if (seg.rel === pRel) drawPlayer(t, pSeg); continue; }
      const scale = seg.p1.scale;
      for (const s of seg.sprites) {
        const sx = seg.p1.sx + s.x * seg.p1.sw, sy = seg.p1.sy;
        if (s.slot === 'gate') { withClip(seg, sy, () => drawGate(ctx, seg.p1.sx - seg.p1.sw * 1.13, seg.p1.sx + seg.p1.sw * 1.13, sy, SPRITE_W * scale * K)); continue; }
        const w = SPRITE_W * s.size * scale * K;
        if (w < 1.5 || sx + w < 0 || sx - w > W) continue;
        withClip(seg, sy, () => drawSprite(ctx, world.kinds[s.slot], sx, sy, w, world, t));
      }
      for (const f of seg.cars) {
        const p = (f.z % SEG_LEN) / SEG_LEN;
        const sc = lerp(seg.p1.scale, seg.p2.scale, p);
        if (!(sc > 0)) continue;
        const sx = lerp(seg.p1.sx, seg.p2.sx, p) + f.lane * lerp(seg.p1.sw, seg.p2.sw, p);
        const sy = lerp(seg.p1.sy, seg.p2.sy, p);
        const w = KART_W * 0.92 * sc * K;
        if (w < 2) continue;
        const stopped = f.speed === 0 && light === 'red';
        withClip(seg, sy, () => drawKart(sx, sy, w, f.color, {
          mood: stopped ? 'happy' : 'normal', look: { x: 0, y: -0.7 }, open: f.blinkT < 0.13 ? 0.12 : 1,
          braking: light !== 'green' && f.speed > 0, bob: Math.sin(t * 20 + f.ph) * (f.speed / MAX_SPEED) * w * 0.012,
          lean: -seg.curve * (f.speed / MAX_SPEED) * 0.03,
        }));
      }
      if (seg.rel === pRel) drawPlayer(t, pSeg);
    }
  }

  function withClip(seg, bottom, fn) {
    if (bottom <= seg.clip + 1) { fn(); return; }
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, seg.clip); ctx.clip(); fn(); ctx.restore();
  }

  function drawPlayer(t, pSeg) {
    if (phase !== 'race' && phase !== 'finish') return;
    const w = KART_W * (DEPTH / kartDz) * K;
    const v = speed / MAX_SPEED;
    const brake = stopHeld || keyStop;
    let mood = 'normal';
    if (phase === 'finish' || kartFx.sel > 0 || (light !== 'green' && speed === 0 && starGiven)) mood = 'happy';
    else if ((light === 'red' && lightT <= 0 && speed > 0) || (brake && v > 0.35)) mood = 'surprised'; // uh-oh!
    else if (v > 0.6) mood = 'excited';
    const shake = reduceMotion ? 0 : Math.sin(t * 22) * v * w * 0.012;
    let sx = 1, sy = 1;
    if (kartFx.sel > 0) { const b = 1 + 0.25 * kartFx.sel * Math.sin((1 - kartFx.sel) * Math.PI * 3); sx = b; sy = 2 - b; }
    drawKart(kartX, kartY, w, driver, {
      mood, look: { x: -pSeg.curve * 0.12, y: -0.75 }, open: kartFx.blinkT < 0.13 ? 0.12 : 1,
      braking: brake && speed > 0, bob: shake, lean: reduceMotion ? 0 : -pSeg.curve * v * 0.035, headSx: sx, headSy: sy,
    });
  }

  /** A kart seen from behind, with its dot driver on top. (x, y) = ground contact, w = width in px. */
  function drawKart(x, y, w, colorIdx, o) {
    const col = DOT_COLORS[colorIdx];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(o.lean || 0);
    // shadow
    ctx.fillStyle = 'rgba(20,30,60,.22)';
    ctx.beginPath(); ctx.ellipse(0, 0, w * 0.56, w * 0.08, 0, 0, 7); ctx.fill();
    ctx.translate(0, o.bob || 0);
    // wheels
    ctx.fillStyle = '#2b2f45';
    rrect(-w * 0.5, -w * 0.3, w * 0.22, w * 0.3, w * 0.07); rrect(w * 0.28, -w * 0.3, w * 0.22, w * 0.3, w * 0.07);
    ctx.fillStyle = '#9aa0b8';
    rrect(-w * 0.45, -w * 0.2, w * 0.12, w * 0.1, w * 0.03); rrect(w * 0.33, -w * 0.2, w * 0.12, w * 0.1, w * 0.03);
    // body
    const g = ctx.createLinearGradient(0, -w * 0.48, 0, -w * 0.1);
    g.addColorStop(0, col.light); g.addColorStop(0.45, col.fill); g.addColorStop(1, col.dark);
    ctx.fillStyle = g;
    rrect(-w * 0.36, -w * 0.46, w * 0.72, w * 0.36, w * 0.12);
    // spoiler
    ctx.fillStyle = col.dark;
    ctx.fillRect(-w * 0.2, -w * 0.54, w * 0.04, w * 0.1); ctx.fillRect(w * 0.16, -w * 0.54, w * 0.04, w * 0.1);
    rrect(-w * 0.34, -w * 0.6, w * 0.68, w * 0.07, w * 0.03);
    // bumper
    ctx.fillStyle = '#3a3f5a';
    rrect(-w * 0.4, -w * 0.17, w * 0.8, w * 0.09, w * 0.045);
    // tail lights (bright when braking)
    for (const s of [-1, 1]) {
      if (o.braking) {
        ctx.fillStyle = 'rgba(255,80,80,.35)'; ctx.beginPath(); ctx.arc(s * w * 0.25, -w * 0.28, w * 0.11, 0, 7); ctx.fill();
      }
      ctx.fillStyle = o.braking ? '#ff3b3b' : '#a8324a';
      ctx.beginPath(); ctx.arc(s * w * 0.25, -w * 0.28, w * 0.05, 0, 7); ctx.fill();
    }
    // badge
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(0, -w * 0.3, w * 0.07, 0, 7); ctx.fill();
    ctx.fillStyle = col.fill; ctx.beginPath(); ctx.arc(0, -w * 0.3, w * 0.035, 0, 7); ctx.fill();
    // driver
    const R = w * 0.3;
    drawCharacter(ctx, 0, -w * 0.5 - R * 0.62, R, {
      color: col, mood: o.mood, look: o.look, open: o.open, shadow: false, sx: o.headSx, sy: o.headSy,
    });
    ctx.restore();
  }

  function rrect(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
    ctx.fill();
  }

  function drawParts() {
    for (const p of parts) {
      ctx.globalAlpha = Math.max(0, p.life) * (p.kind === 'puff' ? 0.3 : 1);
      if (p.kind === 'puff') { ctx.fillStyle = '#d5d9e6'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
      else {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color; ctx.fillRect(-p.r, -p.r * 0.6, p.r * 2, p.r * 1.2);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawSnow(t) {
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    for (let i = 0; i < 40; i++) {
      const x = ((i * 89.7 + Math.sin(t + i) * 20 + skyOff * 100) % W + W) % W;
      const y = ((i * 61.3 + t * (30 + (i % 5) * 8)) % H + H) % H;
      ctx.beginPath(); ctx.arc(x, y, 1.5 + (i % 3), 0, 7); ctx.fill();
    }
  }

  function draw(t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const world = COURSES[courseIdx];
    drawBackground(world, t);
    drawRoad(world, t);
    if (world.snow && !reduceMotion) drawSnow(t);
    drawParts();
    meter.style.width = phase === 'finish' ? '100%'
      : phase === 'race' && leftGrid ? ((((position + kartDz - GATE_Z) % L) + L) % L / L * 100) + '%' : '0%';
  }

  // ---------- Loop ----------
  function frame(now) {
    const dt = Math.min(0.033, Math.max(0, (now - lastT) / 1000));
    lastT = now;
    const t = now / 1000;
    update(dt, t);
    draw(t);
    if (phase === 'pick' || phase === 'chosen') drawPickers(t, dt);
    else if (phase === 'finish' && !finishEl.hidden) drawFinishFace(t, dt);
    raf = requestAnimationFrame(frame);
  }

  loadCourse(0);
  resize();
  position = ((L - kartDz - SEG_LEN * 4) % L + L) % L;
  audio.jingle();
  lastT = performance.now();
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      raf = 0;
      ac.abort();
      ro.disconnect();
      engine.stop();
      for (const id of timeouts) clearTimeout(id);
      timeouts.clear();
      friends = []; parts = []; carSegs = [];
      root.remove();
      scorePill.remove();
    },
  };
}
