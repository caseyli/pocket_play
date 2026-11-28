// Dot Golf: flick your dot up the green at the target. Endless, no fail.
// Rings score 50-100, the hole scores 150. A new course every 500 points.
// Module interface: start(container, { audio, muted, hud }) and stop().

import { buzz } from '../../js/audio.js';
import { DOT_COLORS, drawCharacter, idleLook } from '../../js/characters.js';
import { createCharacterPicker } from '../../js/picker.js';
import { drawSprite } from '../../js/scenery.js';
import {
  HOLE_R, HOLE_POINTS, RINGS, PIN_DIST, PIN_SIDE, POINTS_PER_COURSE,
  FLICK_MIN, FLICK_MAX, SHOT_MIN, SHOT_MAX, AIM_MAX, ASSIST_AIM, ASSIST_POWER,
  LAUNCH_ANGLE, GRAVITY, BOUNCE, ROLL_FRICTION, COURSES,
} from './courses.js';

// ---------- Camera (behind and above the tee, looking up the green) ----------
const CAM_H = 10;          // metres above the ground
const CAM_BACK = 8;        // metres behind the tee
const DEPTH = 0.84;
const FAIRWAY = 14;        // half-width of the mown green; rougher grass beyond
const RESULT_S = 1.5;      // how long the score shows before the next shot
const HINT_AFTER_S = 2.5;  // show the "flick up" finger after this long without a flick
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
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);

function createGame(container, { audio, hud }) {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ac = new AbortController();
  const on = (el, type, fn, o) => el.addEventListener(type, fn, { ...o, signal: ac.signal });
  const timeouts = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timeouts.delete(id); fn(); }, ms); timeouts.add(id); };

  // ---------- DOM ----------
  const root = document.createElement('div');
  root.className = 'golf';
  root.innerHTML = '<canvas class="golf-canvas" aria-label="Golf green. Flick up to throw the ball."></canvas><div class="golf-words" aria-live="polite"></div>';
  container.appendChild(root);
  const canvas = root.querySelector('.golf-canvas'), ctx = canvas.getContext('2d');
  const words = root.querySelector('.golf-words');

  const scorePill = document.createElement('div');
  scorePill.className = 'hud-score';
  scorePill.innerHTML = `
    <div class="hud-score-num"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${STAR_PATH}" fill="#FFC93C" stroke="#E0A800" stroke-width="1.5" stroke-linejoin="round"/></svg><span>0</span></div>
    <div class="hud-meter" aria-hidden="true"><i></i></div>`;
  hud.appendChild(scorePill);
  const scoreNum = scorePill.querySelector('span'), meter = scorePill.querySelector('i');

  // ---------- State ----------
  // phase: 'pick' -> 'ready' -> 'flying' -> 'result' -> 'ready' ...
  let phase = 'pick', color = 0, total = 0, courseIdx = 0;
  let W = 0, H = 0, dpr = 1, K = 1, horizonY = 0, R0 = 28, raf = 0, lastT = 0;
  const pin = { x: 0, z: 18 };
  const ball = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, air: false, holed: 0, appear: 1, squash: 0, blinkT: 2, ph: 1, idle: 0 };
  let swipe = null, trail = [], parts = [], scenery = [], flash = null, cloudT = 0;

  // ---------- Projection ----------
  function proj(x, y, z) {
    const dz = Math.max(0.6, z + CAM_BACK), s = (DEPTH / dz) * K;
    return { sx: W / 2 + x * s, sy: horizonY + (CAM_H - y) * s, s, dz };
  }
  const groundY = (z) => horizonY + CAM_H * (DEPTH / (z + CAM_BACK)) * K;

  function resize() {
    const r = root.getBoundingClientRect();
    W = r.width; H = r.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    horizonY = Math.round(H * (W > H ? 0.26 : 0.21));
    const teeY = H * (W > H ? 0.8 : 0.79);
    K = ((teeY - horizonY) * CAM_BACK) / (DEPTH * CAM_H);
    R0 = Math.max(20, Math.min(W, H) * 0.075);
  }
  const ro = new ResizeObserver(() => resize());
  ro.observe(root);

  // ---------- Course ----------
  function buildScenery() {
    const c = COURSES[courseIdx];
    scenery = [];
    let seed = 11 + courseIdx * 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 26; i++) {
      const side = i % 2 ? 1 : -1;
      const z = 4 + rnd() * 70;
      const x = z > 42 ? (rnd() - 0.5) * 70 : side * (FAIRWAY + 3 + rnd() * 14);
      scenery.push({ x, z, size: 2.8 + rnd() * 2.2, kind: c.kinds[Math.floor(rnd() * c.kinds.length)] });
    }
    scenery.sort((a, b) => b.z - a.z);
  }

  function placePin() {
    pin.z = rand(PIN_DIST[0], PIN_DIST[1]);
    pin.x = rand(-PIN_SIDE, PIN_SIDE) * (pin.z / PIN_DIST[1]);
  }

  // ---------- Picker ----------
  const picker = createCharacterPicker(root, {
    audio, title: 'Pick your ball!',
    onPick: (i) => {
      color = i;
      picker.hide();
      placePin();
      resetBall(true);
      phase = 'ready';
    },
  });

  function resetBall(first) {
    Object.assign(ball, { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, air: false, holed: 0, appear: 0, idle: first ? HINT_AFTER_S : 0 });
  }

  // ---------- Flick ----------
  on(canvas, 'pointerdown', (e) => {
    audio.init();
    if (phase !== 'ready' || swipe) return;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    swipe = { id: e.pointerId, pts: [{ x: e.offsetX, y: e.offsetY, t: performance.now() }] };
    trail = [{ x: e.offsetX, y: e.offsetY, life: 1 }];
  });
  on(canvas, 'pointermove', (e) => {
    if (!swipe || e.pointerId !== swipe.id) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    for (const ev of evs.length ? evs : [e]) {
      const r = canvas.getBoundingClientRect();
      const p = { x: ev.clientX - r.left, y: ev.clientY - r.top, t: ev.timeStamp || performance.now() };
      swipe.pts.push(p);
      trail.push({ x: p.x, y: p.y, life: 1 });
    }
    if (swipe.pts.length > 40) swipe.pts.splice(0, swipe.pts.length - 40);
  });
  const endSwipe = (e) => {
    if (!swipe || e.pointerId !== swipe.id) return;
    const pts = swipe.pts; swipe = null;
    if (phase !== 'ready') return;
    const first = pts[0], last = pts[pts.length - 1];
    const tEnd = last.t;
    const ref = pts.find((p) => p.t >= tEnd - 120) || first;
    const dt = Math.max(16, tEnd - ref.t) / 1000;
    const up = -(last.y - ref.y) / dt / H;          // screen-heights per second, upward
    const totalUp = -(last.y - first.y);
    if (up >= FLICK_MIN * 0.6 && totalUp > H * 0.03) shoot(last.x - first.x, last.y - first.y, up);
    else { ball.squash = 1; ball.idle = HINT_AFTER_S; } // a tap: little hop, and show how to flick
  };
  on(canvas, 'pointerup', endSwipe);
  on(canvas, 'pointercancel', (e) => { if (swipe && e.pointerId === swipe.id) swipe = null; });

  function shoot(dx, dy, up) {
    // power from how fast the flick was
    const p = clamp((up - FLICK_MIN) / (FLICK_MAX - FLICK_MIN), 0, 1);
    let dist = lerp(SHOT_MIN, SHOT_MAX, p);
    // direction: compare the flick with the direction of the flag on screen, so "flick at the flag" goes at the flag
    const b = proj(0, 0, 0), f = proj(pin.x, 0, pin.z);
    const flagScreen = Math.atan2(f.sx - b.sx, b.sy - f.sy);
    const flick = Math.atan2(dx, -dy);
    const pinAngle = Math.atan2(pin.x, pin.z), pinDist = Math.hypot(pin.x, pin.z);
    let ang = clamp(pinAngle + (flick - flagScreen) * 0.85, -AIM_MAX, AIM_MAX);
    // gentle helper for small hands: nudge toward the flag
    ang = lerp(ang, pinAngle, ASSIST_AIM);
    dist = lerp(dist, pinDist, ASSIST_POWER);
    // launch so the ball comes to rest about there: the bounces and roll add about a third to the flight
    const fly = dist * 0.75;
    const v = Math.sqrt((fly * GRAVITY) / Math.sin(2 * LAUNCH_ANGLE));
    const h = v * Math.cos(LAUNCH_ANGLE);
    Object.assign(ball, { vx: h * Math.sin(ang), vz: h * Math.cos(ang), vy: v * Math.sin(LAUNCH_ANGLE), air: true, squash: 1 });
    phase = 'flying';
    audio.flick();
    buzz(15);
  }

  // ---------- Result ----------
  function scoreShot() {
    phase = 'result';
    let pts = 0, ring = -1;
    if (ball.holed) pts = HOLE_POINTS;
    else {
      const d = Math.hypot(ball.x - pin.x, ball.z - pin.z);
      ring = RINGS.findIndex(([r]) => d <= r);
      if (ring >= 0) pts = RINGS[ring][1];
    }
    const before = Math.floor(total / POINTS_PER_COURSE);
    total += pts;
    scoreNum.textContent = total;
    meter.style.width = ((total % POINTS_PER_COURSE) / POINTS_PER_COURSE) * 100 + '%';
    const accent = COURSES[courseIdx].accent;
    if (ball.holed) {
      floatWord('In the hole!', '#FFC93C', 0);
      later(() => floatWord(`+${pts}`, accent, 1), 500);
      audio.cheer(); later(() => audio.star(), 250);
      buzz([30, 50, 30, 50, 60]);
      burstAt(pin.x, 0, pin.z, DOT_COLORS.map((c) => c.fill).concat('#fff'), 34, 1.1);
    } else if (pts) {
      floatWord(`+${pts}`, accent, 0);
      audio.star();
      buzz(25);
      flash = { ring, t: 1 };
      burstAt(ball.x, 0, ball.z, ['#FFC93C', '#ffffff', DOT_COLORS[color].fill], 16, 0.7);
    } else {
      floatWord('So close!', '#ffffff', 0);
      audio.remind();
    }
    let wait = RESULT_S * 1000 + (ball.holed ? 600 : 0);
    if (Math.floor(total / POINTS_PER_COURSE) > before) {
      later(() => newCourse(), wait);
      wait += 1500;
    }
    later(() => { placePin(); resetBall(false); phase = 'ready'; }, wait);
  }

  function newCourse() {
    courseIdx = (courseIdx + 1) % COURSES.length;
    buildScenery();
    root.classList.remove('flash'); void root.offsetWidth; root.classList.add('flash');
    floatWord(COURSES[courseIdx].label, '#FFC93C', 0);
    audio.jingle();
    buzz([40, 60, 40]);
    const cols = DOT_COLORS.map((c) => c.fill).concat('#ffffff');
    for (let k = 0; k < 6; k++) later(() => burst(W * rand(0.15, 0.85), H * rand(0.25, 0.5), cols, 24, 1.2), k * 120);
  }

  function floatWord(text, col, row) {
    const el = document.createElement('div');
    el.className = 'float-word';
    el.textContent = text;
    el.style.color = col;
    el.style.top = Math.round(H * 0.42 + row * H * 0.09) + 'px';
    words.appendChild(el);
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }

  // ---------- Particles ----------
  function burst(x, y, cols, count, power) {
    if (reduceMotion) count = Math.ceil(count / 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, s = (100 + Math.random() * 220) * power;
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 150 * power, r: 3 + Math.random() * 4,
        color: cols[i % cols.length], life: 1, decay: 0.9 + Math.random() * 0.6, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10 });
    }
  }
  function burstAt(x, y, z, cols, count, power) { const p = proj(x, y, z); burst(p.sx, p.sy, cols, count, power); }

  // ---------- Update ----------
  function update(dt) {
    cloudT += dt;
    ball.squash = Math.max(0, ball.squash - dt * 4);
    ball.appear = Math.min(1, ball.appear + dt * 3);
    ball.blinkT -= dt; if (ball.blinkT < 0) ball.blinkT = rand(1.5, 5);
    if (phase === 'ready') ball.idle += dt;
    if (flash) { flash.t -= dt * 1.2; if (flash.t <= 0) flash = null; }
    for (const p of trail) p.life -= dt * 2.5;
    trail = trail.filter((p) => p.life > 0);

    if (phase === 'flying') {
      if (ball.holed) {
        ball.holed = Math.min(1, ball.holed + dt * 3);
        if (ball.holed >= 1 && !ball.scored) { ball.scored = true; scoreShot(); }
      } else {
        stepBall(dt);
      }
    }

    for (const p of parts) { p.vy += 700 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.life -= p.decay * dt; }
    parts = parts.filter((p) => p.life > 0);
  }

  function stepBall(dt) {
    if (ball.air) {
      ball.vy -= GRAVITY * dt;
      ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.z += ball.vz * dt;
      if (ball.y <= 0 && ball.vy < 0) {
        ball.y = 0;
        if (-ball.vy > 1.6) {                     // bounce
          ball.vy = -ball.vy * BOUNCE;
          ball.vx *= 0.62; ball.vz *= 0.62;
          ball.squash = 1;
          audio.land();
        } else { ball.vy = 0; ball.air = false; }
      }
    } else {
      // rolling
      const dxp = pin.x - ball.x, dzp = pin.z - ball.z, dp = Math.hypot(dxp, dzp);
      let sp = Math.hypot(ball.vx, ball.vz);
      if (dp < HOLE_R * 2.4 && sp < 3.5 && dp > 0.01) { // the hole gently pulls a slow ball in
        ball.vx += (dxp / dp) * 3 * dt; ball.vz += (dzp / dp) * 3 * dt;
        sp = Math.hypot(ball.vx, ball.vz);
      }
      const dec = ROLL_FRICTION * dt;
      if (sp <= dec) { ball.vx = ball.vz = 0; sp = 0; }
      else { ball.vx *= (sp - dec) / sp; ball.vz *= (sp - dec) / sp; }
      ball.x += ball.vx * dt; ball.z += ball.vz * dt;
      if (sp === 0) { scoreShot(); return; }
    }
    // into the hole?
    if (ball.y < 0.35 && Math.hypot(ball.x - pin.x, ball.z - pin.z) < HOLE_R && Math.hypot(ball.vx, ball.vz) < 9) {
      ball.holed = 0.01; ball.scored = false;
      ball.x = pin.x; ball.z = pin.z; ball.y = 0;
      audio.plop();
    }
  }

  // ---------- Draw ----------
  function draw(t) {
    const course = COURSES[courseIdx];
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawSky(course, t);
    drawGround(course);
    for (const s of scenery) { // far scenery first
      const p = proj(s.x, 0, s.z);
      const w = s.size * p.s;
      if (w < 2 || p.sx + w < 0 || p.sx - w > W) continue;
      drawSprite(ctx, s.kind, p.sx, p.sy, w, course, t);
    }
    if (phase !== 'pick') {
      drawTarget(course, t);
      drawBallShadow();
      // flag and ball, farther one first
      if (ball.z > pin.z) { drawBall(t); drawFlag(course, t); } else { drawFlag(course, t); drawBall(t); }
      drawTrail();
      if (phase === 'ready' && ball.idle > HINT_AFTER_S && !swipe) drawHint(t);
    }
    for (const p of parts) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color; ctx.fillRect(-p.r, -p.r * 0.6, p.r * 2, p.r * 1.2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawSky(course, t) {
    const g = ctx.createLinearGradient(0, 0, 0, horizonY);
    g.addColorStop(0, course.sky[0]); g.addColorStop(1, course.sky[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, horizonY + 2);
    if (course.stars) {
      for (let i = 0; i < 36; i++) {
        ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.2 + i));
        ctx.fillStyle = '#fff'; ctx.fillRect((i * 97.3) % W, (i * 41.7) % (horizonY * 0.9), 2, 2);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff6d0'; ctx.beginPath(); ctx.arc(W * 0.82, horizonY * 0.42, 20, 0, 7); ctx.fill();
      ctx.fillStyle = course.sky[0]; ctx.beginPath(); ctx.arc(W * 0.82 + 9, horizonY * 0.42 - 5, 17, 0, 7); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(255,248,200,.9)'; ctx.beginPath(); ctx.arc(W * 0.83, horizonY * 0.42, 22, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      for (let i = 0; i < 3; i++) {
        const s = 30 + i * 8;
        const x = ((i * W * 0.41 + cloudT * (5 + i * 2)) % (W + 160)) - 80, y = horizonY * (0.3 + i * 0.18);
        ctx.beginPath(); ctx.arc(x, y, s * 0.5, 0, 7); ctx.arc(x + s * 0.45, y - s * 0.2, s * 0.42, 0, 7); ctx.arc(x + s * 0.9, y, s * 0.38, 0, 7); ctx.fill();
      }
    }
    if (course.sea) { ctx.fillStyle = course.hillsFar; ctx.fillRect(0, horizonY - 14, W, 16); }
    else {
      hills(course.hillsFar, 26, 0.006, horizonY - 2);
      hills(course.hills, 16, 0.011, horizonY + 2);
    }
  }

  function hills(col, amp, freq, base) {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(0, base);
    for (let x = 0; x <= W + 8; x += 8) ctx.lineTo(x, base - amp * (0.6 + 0.4 * Math.sin(x * freq) + 0.3 * Math.sin(x * freq * 2.3 + 1)));
    ctx.lineTo(W, base + 4); ctx.lineTo(0, base + 4); ctx.closePath(); ctx.fill();
  }

  function drawGround(course) {
    ctx.fillStyle = course.stripes[0]; ctx.fillRect(0, horizonY, W, H - horizonY);
    // mowing stripes across the green
    const step = 4;
    for (let z = -CAM_BACK + 1, k = 0; z < 140; z += step, k++) {
      if (k % 2) continue;
      const y1 = Math.min(H, groundY(z)), y2 = groundY(z + step);
      if (y1 <= horizonY) break;
      ctx.fillStyle = course.stripes[1]; ctx.fillRect(0, y2, W, y1 - y2);
    }
    // rougher grass either side
    ctx.fillStyle = course.rough;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      const near = proj(s * FAIRWAY, 0, -CAM_BACK + 1);
      ctx.moveTo(s < 0 ? 0 : W, H); ctx.lineTo(near.sx, Math.min(H, near.sy));
      for (let z = 0; z <= 200; z += 10) { const p = proj(s * FAIRWAY, 0, z); ctx.lineTo(p.sx, p.sy); }
      ctx.lineTo(s < 0 ? 0 : W, horizonY);
      ctx.closePath(); ctx.fill();
    }
  }

  function ringPath(r) {
    ctx.beginPath();
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const p = proj(pin.x + Math.cos(a) * r, 0, pin.z + Math.sin(a) * r);
      i ? ctx.lineTo(p.sx, p.sy) : ctx.moveTo(p.sx, p.sy);
    }
    ctx.closePath();
  }

  function drawTarget(course, t) {
    // a clean target: solid middle, then white and a light tint alternating outwards
    const tint = mix(course.accent, '#ffffff', 0.55);
    for (let i = RINGS.length - 1; i >= 0; i--) {
      ringPath(RINGS[i][0]);
      ctx.fillStyle = i === 0 ? course.accent : i % 2 ? course.ring : tint;
      ctx.fill();
      const lit = flash && flash.ring === i ? flash.t : 0;
      if (lit) { ctx.fillStyle = `rgba(255,255,255,${lit * 0.7})`; ctx.fill(); }
      ctx.strokeStyle = 'rgba(29,35,64,.18)'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    // points, for grown-ups: laid out sideways along the rings, on the side nearer the middle of the screen
    const side = pin.x > 0 ? -1 : 1;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < RINGS.length; i++) {
      const inner = i ? RINGS[i - 1][0] : HOLE_R;
      const p = proj(pin.x + side * (RINGS[i][0] + inner) / 2, 0, pin.z);
      const size = Math.round(clamp(p.s * 0.62, 0, 16));
      if (size < 9) continue;
      ctx.font = `700 ${size}px ui-rounded, 'Arial Rounded MT Bold', system-ui, sans-serif`;
      ctx.fillStyle = i === 0 ? 'rgba(255,255,255,.95)' : 'rgba(29,35,64,.5)';
      ctx.fillText(String(RINGS[i][1]), p.sx, p.sy);
    }
    // the hole
    ringPath(HOLE_R * 0.75);
    ctx.fillStyle = '#1d2340'; ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
  }

  function drawFlag(course, t) {
    const base = proj(pin.x, 0, pin.z), top = proj(pin.x, 3.2, pin.z);
    if (ball.holed) return drawFlagShape(base, top, course, t, 0.35);
    drawFlagShape(base, top, course, t, 1);
  }
  function drawFlagShape(base, top, course, t, alpha) {
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(2, base.s * 0.08); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(base.sx, base.sy); ctx.lineTo(top.sx, top.sy); ctx.stroke();
    const fw = base.s * 1.3, fh = base.s * 0.8, wave = reduceMotion ? 0 : Math.sin(t * 4) * fh * 0.15;
    ctx.fillStyle = course.accent;
    ctx.beginPath(); ctx.moveTo(top.sx, top.sy);
    ctx.quadraticCurveTo(top.sx + fw * 0.5, top.sy + fh * 0.25 + wave, top.sx + fw, top.sy + fh * 0.5);
    ctx.quadraticCurveTo(top.sx + fw * 0.5, top.sy + fh * 0.75 - wave, top.sx, top.sy + fh);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }

  function ballRadius(z) { return R0 * Math.pow(CAM_BACK / (z + CAM_BACK), 0.55); } // shrinks less than true perspective, so it stays easy to see

  function drawBallShadow() {
    if (ball.holed) return;
    const p = proj(ball.x, 0, ball.z), R = ballRadius(ball.z);
    const k = 1 / (1 + ball.y * 0.25);
    ctx.fillStyle = `rgba(20,40,20,${0.25 * k})`;
    ctx.beginPath(); ctx.ellipse(p.sx, p.sy, R * 0.85 * k, R * 0.28 * k, 0, 0, 7); ctx.fill();
  }

  function drawBall(t) {
    const g = proj(ball.x, 0, ball.z), up = proj(ball.x, ball.y, ball.z);
    const R = ballRadius(ball.z) * (0.4 + 0.6 * easeOut(ball.appear));
    let sx = 1, sy = 1;
    if (ball.squash > 0) { sx = 1 + 0.2 * ball.squash; sy = 1 - 0.2 * ball.squash; }
    if (phase === 'ready' && ball.z === 0) { // tee peg
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(g.sx - R * 0.12, g.sy - R * 0.1, R * 0.24, R * 0.45);
    }
    const lift = phase === 'ready' ? R * 0.18 + (reduceMotion ? 0 : Math.sin(t * 2.4) * R * 0.04) : 0; // sits on the tee
    let mood = 'normal', look = idleLook(t, ball.ph), mouth = null;
    if (phase === 'ready') look = { x: clamp((proj(pin.x, 0, pin.z).sx - g.sx) / 200, -0.8, 0.8), y: -0.8 };
    if (phase === 'flying' && !ball.holed) { mood = ball.air ? 'excited' : 'normal'; look = { x: 0, y: -0.5 }; }
    if (ball.holed || (phase === 'result' && flash)) { mood = 'happy'; mouth = 'smile'; }
    const cy = up.sy - R - lift;
    if (ball.holed) {
      // peeking out of the hole
      const hole = proj(pin.x, 0, pin.z);
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, W, hole.sy + 1); ctx.clip();
      drawCharacter(ctx, hole.sx, hole.sy - R * (1.25 - ball.holed * 0.75), R * 0.85, { color, mood: 'happy', mouth: 'smile', shadow: false });
      ctx.restore();
      return;
    }
    drawCharacter(ctx, up.sx, cy, R, { color, mood, mouth, look, sx, sy, shadow: false, open: ball.blinkT < 0.13 ? 0.12 : 1 });
  }

  function drawTrail() {
    if (trail.length < 2) return;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1], b = trail[i];
      ctx.strokeStyle = `rgba(255,255,255,${0.6 * b.life})`;
      ctx.lineWidth = 10 * b.life;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }

  function drawHint(t) {
    // a fingertip sliding up from the ball, with an arrow: "flick up!"
    const g = proj(0, 0, 0), R = ballRadius(0);
    const k = ((t * 0.8) % 1);
    const x = g.sx, y0 = g.sy + R * 0.6, y = y0 - k * R * 4.5;
    ctx.globalAlpha = Math.sin(k * Math.PI) * 0.9;
    ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = R * 0.35; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y + R * 0.4); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x, y, R * 0.42, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(29,35,64,.35)'; ctx.lineWidth = 2; ctx.stroke();
    // arrow above
    const ay = g.sy - R * 6.2;
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.beginPath(); ctx.moveTo(x, ay - R * 0.7); ctx.lineTo(x + R * 0.6, ay); ctx.lineTo(x - R * 0.6, ay); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }

  const easeOut = (p) => 1 - (1 - p) * (1 - p);
  function mix(a, b, k) { // blend two #rrggbb colours
    const p = parseInt(a.slice(1), 16), q = parseInt(b.slice(1), 16);
    const ch = (sh) => Math.round(((p >> sh) & 255) * (1 - k) + ((q >> sh) & 255) * k);
    return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
  }

  // ---------- Loop ----------
  function frame(now) {
    const dt = Math.min(0.033, Math.max(0, (now - lastT) / 1000));
    lastT = now;
    update(dt);
    draw(now / 1000);
    raf = requestAnimationFrame(frame);
  }

  resize();
  buildScenery();
  picker.show();
  audio.jingle();
  lastT = performance.now();
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      cancelAnimationFrame(raf); raf = 0;
      ac.abort();
      ro.disconnect();
      picker.destroy();
      for (const id of timeouts) clearTimeout(id);
      timeouts.clear();
      parts = []; trail = []; scenery = [];
      root.remove();
      scorePill.remove();
    },
  };
}
