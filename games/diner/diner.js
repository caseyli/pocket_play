// Dot Diner: a very simple cooking game for 2-4 year olds.
// A friend orders a meal (shown as pictures). Tap the things it needs on the shelves, in any order.
// Your dot fetches each one to the tray. Wrong things just wiggle. When the tray is full: "Order up!"
// Module interface: start(container, { audio, muted, hud }) and stop().

import { buzz } from '../../js/audio.js';
import { DOT_COLORS, drawCharacter, idleLook, lookToward } from '../../js/characters.js';
import { createCharacterPicker } from '../../js/picker.js';
import { SHELF_SIZE, ORDERS_PER_KITCHEN, HOP_S, ITEMS, MEALS, KITCHENS } from './menu.js';

const STAR_PATH = 'M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.5l1.3-6.6L2.5 9.3l6.6-.8z';
const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#2EC27E"/><path d="M6.5 12.5l3.5 3.5 7-8" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const SERVE_S = 1.6;          // from "Order up!" to the next customer
const NEW_KITCHEN_EXTRA_S = 1.4;

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
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function createGame(container, { audio, hud }) {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ac = new AbortController();
  const on = (el, type, fn, o) => el.addEventListener(type, fn, { ...o, signal: ac.signal });
  const timeouts = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timeouts.delete(id); fn(); }, ms); timeouts.add(id); };

  // ---------- DOM ----------
  const root = document.createElement('div');
  root.className = 'diner';
  root.innerHTML = `
    <div class="diner-bg"></div>
    <div class="diner-layout">
      <div class="diner-top">
        <div class="diner-window-wrap">
          <div class="diner-awning"></div>
          <div class="diner-window"></div>
        </div>
        <div class="diner-ticket" aria-live="polite">
          <span class="diner-ticket-name"></span>
          <div class="diner-ticket-items"></div>
        </div>
      </div>
      <div class="diner-counter">
        <div class="diner-counter-top"></div>
        <div class="diner-counter-front"></div>
        <div class="diner-tray"></div>
      </div>
      <div class="diner-shelf"><div class="diner-grid"></div></div>
    </div>
    <canvas class="diner-fx"></canvas>
    <div class="diner-carries"></div>
    <div class="diner-words"></div>`;
  container.appendChild(root);

  const $ = (sel) => root.querySelector(sel);
  const windowEl = $('.diner-window'), ticketEl = $('.diner-ticket'), ticketName = $('.diner-ticket-name'), ticketItems = $('.diner-ticket-items');
  const counterEl = $('.diner-counter'), trayEl = $('.diner-tray'), gridEl = $('.diner-grid');
  const canvas = $('.diner-fx'), ctx = canvas.getContext('2d');
  const carriesEl = $('.diner-carries'), words = $('.diner-words');

  const scorePill = document.createElement('div');
  scorePill.className = 'hud-score';
  scorePill.innerHTML = `
    <div class="hud-score-num"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${STAR_PATH}" fill="#FFC93C" stroke="#E0A800" stroke-width="1.5" stroke-linejoin="round"/></svg><span>0</span></div>
    <div class="hud-meter" aria-hidden="true"><i></i></div>`;
  hud.appendChild(scorePill);
  const scoreNum = scorePill.querySelector('span'), meter = scorePill.querySelector('i');

  // ---------- State ----------
  let phase = 'pick'; // 'pick' -> 'play' -> 'serving' -> 'play' ...
  let W = 0, H = 0, dpr = 1, raf = 0, lastT = 0;
  let kitchenIdx = 0, ordersDone = 0, mealBag = [], lastMeal = -1;
  let order = null; // { meal, need: [ids], got: Set, taken: Set, slots: [els] }
  let queue = [], parts = [];
  let geo = { win: null, tray: null, ground: 0, home: { x: 0, y: 0 }, R: 24, custR: 30 };
  const cook = { color: 0, x: 0, y: 0, hop: null, carry: null, busy: false, squash: 0, shake: 0, happy: 0, blinkT: 2, ph: 1, look: null };
  const customer = { color: 1, state: 'away', t: 0, happy: 0, blinkT: 3, ph: 2 };

  // ---------- Kitchen look ----------
  function applyKitchen() {
    const k = KITCHENS[kitchenIdx];
    for (const [name, value] of Object.entries(k.vars)) root.style.setProperty(name, value);
  }

  // ---------- Geometry ----------
  const rel = (el) => {
    const r = el.getBoundingClientRect(), o = root.getBoundingClientRect();
    return { x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height, cx: r.left - o.left + r.width / 2, cy: r.top - o.top + r.height / 2 };
  };
  function resize() {
    const r = root.getBoundingClientRect();
    W = r.width; H = r.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const win = rel(windowEl), tray = rel(trayEl), counter = rel(counterEl);
    const R = Math.max(18, Math.min(36, counter.h * 0.24));
    geo = { win, tray, ground: tray.y + tray.h * 0.62, R, custR: Math.min(win.h * 0.36, win.w * 0.22), counter };
    geo.home = { x: Math.max(R + 8, tray.x - R * 1.5), y: geo.ground };
    if (!cook.hop && !cook.busy) { cook.x = geo.home.x; cook.y = geo.home.y; }
    // keep items already on the tray in their slots
    if (order) order.slots.forEach((slot) => { if (slot.carry && slot.carry.dataset.state === 'tray') placeOnSlot(slot.carry, slot, false); });
  }
  const ro = new ResizeObserver(() => resize());
  ro.observe(root);

  // ---------- Picker ----------
  const picker = createCharacterPicker(root, {
    audio, title: "Who's cooking?",
    onPick: (i) => {
      cook.color = i;
      picker.hide();
      phase = 'play';
      newOrder();
    },
  });

  // ---------- Orders ----------
  function pickMeal() {
    if (!mealBag.length) mealBag = shuffle(MEALS.map((_, i) => i));
    let i = mealBag.pop();
    if (i === lastMeal && mealBag.length) { const j = mealBag.pop(); mealBag.unshift(i); i = j; }
    lastMeal = i;
    return MEALS[i];
  }

  function newOrder() {
    const meal = pickMeal();
    order = { meal, need: meal.items.slice(), got: new Set(), taken: new Set(), slots: [] };
    queue = [];
    carriesEl.replaceChildren();

    // ticket: the meal as pictures
    ticketName.textContent = meal.name;
    ticketItems.replaceChildren();
    order.ticket = {};
    for (const id of order.need) {
      const n = document.createElement('div');
      n.className = 'diner-need';
      n.innerHTML = ITEMS[id].svg + `<span class="diner-check">${CHECK}</span>`;
      n.title = ITEMS[id].name;
      ticketItems.appendChild(n);
      order.ticket[id] = n;
    }
    ticketEl.classList.remove('pop'); void ticketEl.offsetWidth; ticketEl.classList.add('pop');

    // tray: one spot per thing needed
    trayEl.replaceChildren();
    order.slots = order.need.map(() => {
      const s = document.createElement('div');
      s.className = 'diner-slot';
      trayEl.appendChild(s);
      return s;
    });

    // shelves: everything needed plus some extras, mixed up
    const extras = shuffle(Object.keys(ITEMS).filter((id) => !order.need.includes(id))).slice(0, Math.max(0, SHELF_SIZE - order.need.length));
    const shelf = shuffle(order.need.concat(extras));
    gridEl.replaceChildren();
    const rows = [];
    for (let r = 0; r < Math.ceil(shelf.length / 4); r++) {
      const row = document.createElement('div');
      row.className = 'diner-row';
      gridEl.appendChild(row);
      rows.push(row);
    }
    shelf.forEach((id, k) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'diner-item';
      b.dataset.id = id;
      b.style.setProperty('--d', `${k * 45}ms`);
      b.setAttribute('aria-label', ITEMS[id].name);
      b.innerHTML = `${ITEMS[id].svg}<span>${ITEMS[id].name}</span>`;
      on(b, 'click', () => tapItem(b));
      rows[Math.floor(k / 4)].appendChild(b);
    });

    // a friend comes to the window
    let c;
    do { c = Math.floor(Math.random() * DOT_COLORS.length); } while (c === cook.color);
    customer.color = c;
    customer.state = 'enter'; customer.t = 0; customer.happy = 0;
    audio.hello();
    phase = 'play';
    resize();
  }

  function tapItem(btn) {
    if (phase !== 'play' || btn.classList.contains('taken')) return;
    audio.init();
    const id = btn.dataset.id;
    cook.look = rel(btn);
    if (!order.need.includes(id) || order.taken.has(id)) {
      // not part of this meal: a gentle wiggle, no penalty
      btn.classList.remove('nope'); void btn.offsetWidth; btn.classList.add('nope');
      audio.nope();
      buzz([15, 40, 15]);
      cook.shake = 1;
      return;
    }
    order.taken.add(id);
    btn.classList.add('taken');
    btn.disabled = true;
    // the item lifts off the shelf, waiting to be picked up
    const r = rel(btn.querySelector('svg'));
    const el = document.createElement('div');
    el.className = 'diner-carry lifted';
    el.innerHTML = ITEMS[id].svg;
    setBox(el, r.x, r.y, r.w);
    carriesEl.appendChild(el);
    audio.connect(order.taken.size + 1);
    buzz(10);
    queue.push({ id, btn, el });
    nextTask();
  }

  function setBox(el, x, y, size) {
    el.style.left = x + 'px'; el.style.top = y + 'px';
    el.style.width = el.style.height = size + 'px';
  }

  function placeOnSlot(el, slot, animate) {
    const r = rel(slot), size = Math.min(r.w, r.h) * 0.96;
    el.classList.toggle('settle', !!animate);
    setBox(el, r.cx - size / 2, r.cy - size / 2, size);
  }

  // The cook works through taps one at a time: hop to the shelf, grab, hop to the tray, drop.
  function nextTask() {
    if (cook.busy) return;
    const task = queue.shift();
    if (!task) {
      if (Math.abs(cook.x - geo.home.x) > 2 || Math.abs(cook.y - geo.home.y) > 2) hopTo(geo.home.x, geo.home.y, null);
      return;
    }
    cook.busy = true;
    const b = rel(task.btn);
    hopTo(b.cx, b.y + b.h * 0.3, () => {
      // grab it
      task.el.classList.remove('lifted');
      task.el.dataset.state = 'carried';
      cook.carry = task.el;
      cook.happy = 0.6;
      const slot = order.slots.find((s) => !s.carry);
      slot.carry = task.el;
      const s = rel(slot);
      hopTo(s.cx, geo.ground, () => {
        cook.carry = null;
        task.el.dataset.state = 'tray';
        placeOnSlot(task.el, slot, true);
        order.got.add(task.id);
        order.ticket[task.id].classList.add('done');
        audio.pop(order.got.size + 2);
        buzz(12);
        cook.busy = false;
        if (order.got.size === order.need.length) orderUp();
        else nextTask();
      });
    });
  }

  function hopTo(x, y, done) {
    const dist = Math.hypot(x - cook.x, y - cook.y);
    cook.hop = { fx: cook.x, fy: cook.y, tx: x, ty: y, t: 0, dur: reduceMotion ? HOP_S * 0.6 : HOP_S * (0.75 + Math.min(0.5, dist / 900)),
      h: reduceMotion ? 10 : 30 + Math.min(70, dist * 0.25), done };
  }

  function orderUp() {
    phase = 'serving';
    gridEl.querySelectorAll('.diner-item').forEach((b) => (b.disabled = true));
    audio.ding();
    later(() => audio.cheer(), 300);
    buzz([30, 50, 30]);
    floatWord('Order up!', '#FF4D6D');
    ordersDone++;
    scoreNum.textContent = ordersDone;
    scorePill.classList.remove('bump'); void scorePill.offsetWidth; scorePill.classList.add('bump');
    meter.style.width = ((ordersDone % ORDERS_PER_KITCHEN) / ORDERS_PER_KITCHEN) * 100 + '%';
    cook.happy = 1.4;
    customer.state = 'happy'; customer.t = 0;
    burst(geo.tray.cx, geo.tray.y, ['#FFC93C', '#ffffff', DOT_COLORS[customer.color].fill], 20, 0.8);

    // the meal goes out through the window
    const win = geo.win;
    order.slots.forEach((slot, k) => {
      const el = slot.carry; if (!el) return;
      later(() => {
        const r = rel(el);
        el.classList.add('serve');
        el.style.transform = `translate(${win.cx - r.cx}px, ${win.cy + win.h * 0.2 - r.cy}px) scale(.45)`;
        el.style.opacity = '0';
      }, 250 + k * 70);
    });
    later(() => { customer.state = 'leave'; customer.t = 0; }, 1000);

    let wait = SERVE_S * 1000;
    if (ordersDone % ORDERS_PER_KITCHEN === 0) {
      wait += NEW_KITCHEN_EXTRA_S * 1000;
      later(() => {
        kitchenIdx = (kitchenIdx + 1) % KITCHENS.length;
        applyKitchen();
        root.classList.remove('flash'); void root.offsetWidth; root.classList.add('flash');
        floatWord(KITCHENS[kitchenIdx].label, '#FFC93C');
        audio.jingle();
        buzz([40, 60, 40]);
        celebrate();
        meter.style.width = '0%';
      }, SERVE_S * 1000 - 200);
    }
    later(() => newOrder(), wait);
  }

  function floatWord(text, color) {
    const el = document.createElement('div');
    el.className = 'float-word';
    el.textContent = text;
    el.style.color = color;
    el.style.top = Math.round((geo.counter ? geo.counter.y : H * 0.4) - 10) + 'px';
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
  function celebrate() {
    const cols = DOT_COLORS.map((c) => c.fill).concat('#ffffff');
    for (let k = 0; k < 6; k++) later(() => burst(W * rand(0.15, 0.85), H * rand(0.2, 0.5), cols, 24, 1.2), k * 120);
  }

  // ---------- Update ----------
  function update(dt) {
    // cook
    if (cook.hop) {
      const h = cook.hop;
      h.t = Math.min(1, h.t + dt / h.dur);
      const e = h.t < 0.5 ? 2 * h.t * h.t : 1 - Math.pow(-2 * h.t + 2, 2) / 2;
      cook.x = lerp(h.fx, h.tx, e);
      cook.y = lerp(h.fy, h.ty, e) - Math.sin(h.t * Math.PI) * h.h;
      if (h.t >= 1) { cook.hop = null; cook.squash = 1; if (h.done) h.done(); }
    }
    cook.squash = Math.max(0, cook.squash - dt * 5);
    cook.shake = Math.max(0, cook.shake - dt * 1.8);
    cook.happy = Math.max(0, cook.happy - dt);
    cook.blinkT -= dt; if (cook.blinkT < 0) cook.blinkT = rand(1.5, 5);
    if (cook.carry) {
      const size = parseFloat(cook.carry.style.width) || 40;
      const top = cook.y - geo.R * 2 - (reduceMotion ? 0 : Math.sin(performance.now() / 120) * 1.5);
      setBox(cook.carry, cook.x - size / 2, top - size * 0.78, size);
    }

    // customer
    customer.t += dt;
    customer.happy = Math.max(0, customer.happy - dt);
    customer.blinkT -= dt; if (customer.blinkT < 0) customer.blinkT = rand(1.5, 5);
    if (customer.state === 'enter' && customer.t >= 0.5) { customer.state = 'wait'; customer.t = 0; }
    if (customer.state === 'leave' && customer.t >= 0.55) { customer.state = 'away'; }

    for (const p of parts) { p.vy += 700 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.life -= p.decay * dt; }
    parts = parts.filter((p) => p.life > 0);
  }

  // ---------- Draw ----------
  function draw(t) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (phase !== 'pick') {
      drawCustomer(t);
      drawCook(t);
    }
    for (const p of parts) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.fillStyle = p.color; ctx.fillRect(-p.r, -p.r * 0.6, p.r * 2, p.r * 1.2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawCustomer(t) {
    const win = geo.win; if (!win) return;
    const inset = 8; // inside the window frame
    ctx.save();
    ctx.beginPath(); ctx.rect(win.x + inset, win.y + inset, win.w - inset * 2, win.h - inset * 2); ctx.clip();
    if (KITCHENS[kitchenIdx].snow && !reduceMotion) {
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      for (let i = 0; i < 14; i++) {
        const x = win.x + ((i * 37 + Math.sin(t + i) * 8) % win.w + win.w) % win.w;
        const y = win.y + ((i * 23 + t * (18 + (i % 4) * 6)) % win.h);
        ctx.beginPath(); ctx.arc(x, y, 1.5 + (i % 3) * 0.6, 0, 7); ctx.fill();
      }
    }
    if (customer.state !== 'away') {
      const R = geo.custR;
      let off = 0;
      if (customer.state === 'enter') { const p = Math.min(1, customer.t / 0.5); off = (1 - (1 - (1 - p) ** 3)) * -(win.w / 2 + R); }
      if (customer.state === 'leave') { const p = Math.min(1, customer.t / 0.55); off = p * p * (win.w / 2 + R); }
      let hop = 0;
      if (customer.state === 'happy' && !reduceMotion) hop = Math.abs(Math.sin(customer.t * 9)) * R * 0.35;
      const bob = reduceMotion ? 0 : Math.sin(t * 2.2) * 1.5;
      const x = win.cx + off, y = win.y + win.h - R * 0.55 - hop + bob;
      const happy = customer.state === 'happy' || customer.state === 'leave';
      const tr = rel(ticketEl);
      drawCharacter(ctx, x, y, R, {
        color: customer.color, shadow: false, mood: happy ? 'happy' : 'normal', mouth: happy ? 'smile' : null,
        look: happy ? { x: 0, y: 0 } : lookToward(x, y, tr.cx, tr.cy), open: customer.blinkT < 0.13 ? 0.12 : 1,
      });
    }
    ctx.restore();
  }

  function drawCook(t) {
    const R = geo.R;
    let sx = 1, sy = 1, rot = 0;
    if (cook.squash > 0) { sx = 1 + 0.18 * cook.squash; sy = 1 - 0.18 * cook.squash; }
    if (cook.shake > 0 && !reduceMotion) rot = Math.sin(cook.shake * 28) * 0.22 * cook.shake;
    let look = cook.look ? lookToward(cook.x, cook.y - R, cook.look.cx, cook.look.cy) : idleLook(t, cook.ph);
    if (!cook.hop && !cook.busy && !queue.length) cook.look = null;
    const mood = cook.happy > 0 ? 'happy' : 'normal';
    drawCharacter(ctx, cook.x, cook.y - R, R, {
      color: cook.color, hat: 'chef', sx, sy, rot, look, mood, mouth: mood === 'happy' ? 'smile' : null,
      open: cook.blinkT < 0.13 ? 0.12 : 1,
    });
  }

  // ---------- Loop ----------
  function frame(now) {
    const dt = Math.min(0.033, Math.max(0, (now - lastT) / 1000));
    lastT = now;
    update(dt);
    draw(now / 1000);
    raf = requestAnimationFrame(frame);
  }

  applyKitchen();
  resize();
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
      queue = []; parts = []; order = null;
      root.remove();
      scorePill.remove();
    },
  };
}
