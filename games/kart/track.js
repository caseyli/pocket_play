// Dot Dash: the courses (road shape + scenery) and the tunable numbers.

import { drawSprite } from '../../js/scenery.js';
export { drawSprite };

// ---------- Tunables (tuned for 2-4 year olds: slow, forgiving) ----------
export const SEG_LEN = 200;          // world units per road segment
export const ROAD_W = 760;           // half the road width, world units
export const LANES = 3;
export const DRAW_DIST = 160;        // segments drawn ahead
export const CAM_H = 900;            // camera height above the road
export const MAX_SPEED = 3600;       // world units / second (a course takes about 45-60 s at full speed)
export const ACCEL = 1300;           // holding Go
export const COAST = 650;            // nothing held: rolls gently to a stop
export const BRAKE = 3600;           // holding Stop
export const GREEN_DRIVE_S = [6, 10];  // green lasts this many seconds *of driving*
export const YELLOW_S = 2.2;         // warning before red
export const RED_HOLD_S = 1.4;       // stay stopped this long, then green
export const REMIND_AFTER_S = 1.6;   // still rolling on red this long -> gentle reminder
export const FRIENDS = 3;

// ---------- Road shapes ----------
// Each section: [enter, hold, leave] in segments, curve strength, target hill height.
// Curves don't need to "add up": the road is drawn relative to the kart, so any loop works.
// Every course ends at height 0 so it joins up with the start line.
const MEADOW = [ // gentle: a couple of easy bends and one small hill
  [10, 30, 10, 0, 0], [20, 40, 20, 2.2, 0], [15, 30, 15, 0, 900], [20, 30, 20, -2.6, 0],
  [20, 50, 20, 0, -400], [15, 25, 15, 2.8, 0], [15, 25, 15, -2.8, 300], [20, 60, 20, 0, 0],
  [25, 45, 25, 3, 600], [20, 30, 20, 0, 0], [20, 40, 20, -2.2, 0], [15, 30, 15, 0, 0],
];
const SNOW = [ // bumpy: rolling hills, few bends
  [10, 30, 10, 0, 0], [20, 30, 20, 0, 1400], [20, 30, 20, 0, -200], [20, 30, 20, 1.6, 1200],
  [20, 30, 20, 0, 0], [20, 40, 20, -1.8, 1600], [25, 30, 25, 0, -300], [20, 30, 20, 0, 1000],
  [20, 40, 20, 2, 0], [20, 30, 20, 0, 800], [15, 30, 15, 0, 0],
];
const BEACH = [ // curvy: winding along the shore, flat
  [10, 30, 10, 0, 0], [15, 25, 15, 3, 0], [15, 25, 15, -3, 0], [15, 25, 15, 3.4, 0],
  [20, 40, 20, 0, 200], [15, 25, 15, -3.4, 0], [15, 25, 15, 3, 0], [15, 25, 15, -3, 0],
  [20, 50, 20, 0, 0], [20, 30, 20, 3.6, 0], [15, 25, 15, -2.6, 0], [15, 30, 15, 0, 0],
];
const NIGHT = [ // a bit of everything
  [10, 30, 10, 0, 0], [20, 40, 20, -2.4, 600], [15, 30, 15, 0, 0], [15, 25, 15, 3, 0],
  [20, 30, 20, 0, 1200], [20, 30, 20, -3, 0], [20, 50, 20, 0, -300], [15, 25, 15, 2.6, 400],
  [15, 25, 15, -2.6, 0], [20, 40, 20, 0, 900], [20, 40, 20, 2.4, 0], [15, 30, 15, 0, 0],
];

const easeIn = (a, b, p) => a + (b - a) * p * p;
const easeInOut = (a, b, p) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5);

/** Build the looping list of road segments for a course. */
export function buildTrack(course) {
  const segs = [];
  let lastY = 0;
  const add = (curve, y) => {
    const i = segs.length;
    segs.push({ index: i, curve, p1: { y: lastY, z: i * SEG_LEN }, p2: { y, z: (i + 1) * SEG_LEN }, sprites: [], cars: [], clip: 0 });
    lastY = y;
  };
  for (const [enter, hold, leave, curve, height] of course.shape) {
    const startY = lastY, endY = height, total = enter + hold + leave;
    for (let n = 0; n < enter; n++) add(easeIn(0, curve, n / enter), easeInOut(startY, endY, n / total));
    for (let n = 0; n < hold; n++) add(curve, easeInOut(startY, endY, (enter + n) / total));
    for (let n = 0; n < leave; n++) add(easeInOut(curve, 0, n / leave), easeInOut(startY, endY, (enter + hold + n) / total));
  }
  segs[segs.length - 1].p2.y = 0;

  // Scenery: deterministic, so it's the same every lap. `slot` picks the world's sprite kind.
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 12; i < segs.length; i += 3 + Math.floor(rnd() * 4)) {
    const side = rnd() < 0.5 ? -1 : 1;
    segs[i].sprites.push({ slot: Math.floor(rnd() * 3), x: side * (1.35 + rnd() * 1.6), size: 0.8 + rnd() * 0.5 });
    if (rnd() < 0.5) segs[i].sprites.push({ slot: Math.floor(rnd() * 3), x: -side * (1.5 + rnd() * 2), size: 0.7 + rnd() * 0.5 });
  }
  segs[2].sprites.push({ slot: 'gate', x: 0, size: 1 });
  return segs;
}

// ---------- Courses ----------
// `name` is the short label on the course picker; `label` is shown when the race starts;
// `shape` is the road layout; the rest is colours and scenery.
export const COURSES = [
  { name: 'Meadow', label: 'Sunny meadow!', shape: MEADOW, sky: ['#7cc8ff', '#c9ecff'], hills: '#8fd47a', hillsFar: '#b6e3a3',
    grass: ['#76c85e', '#6cbd54'], road: ['#8a8fa3', '#858a9e'], rumble: ['#ff6b81', '#ffffff'], kinds: ['tree', 'bush', 'flowers'] },
  { name: 'Snow', label: 'Snowy hills!', shape: SNOW, sky: ['#a9c8ec', '#e8f2ff'], hills: '#ffffff', hillsFar: '#dbe8f7',
    grass: ['#f4f8ff', '#e6eefa'], road: ['#8f95ab', '#8a90a6'], rumble: ['#3A86FF', '#ffffff'], kinds: ['pine', 'snowman', 'pine'], snow: true },
  { name: 'Beach', label: 'Sandy beach!', shape: BEACH, sky: ['#5fc3f2', '#c8f0ff'], hills: '#3fb6e0', hillsFar: '#8ad8f2', sea: true,
    grass: ['#f6dc9b', '#efd28c'], road: ['#9a9aa8', '#9595a3'], rumble: ['#FFC93C', '#ffffff'], kinds: ['palm', 'umbrella', 'palm'] },
  { name: 'Night', label: 'Starry night!', shape: NIGHT, sky: ['#1a1b4b', '#3b3a8c'], hills: '#2b2c6e', hillsFar: '#38397f', stars: true,
    grass: ['#2f6b4a', '#2a6243'], road: ['#565b74', '#52576f'], rumble: ['#9D4EDD', '#e9e3ff'], kinds: ['lamp', 'bush', 'lamp'], night: true },
];

/** A little postcard of a course for the course picker. */
export function drawCoursePreview(c, w, h, course) {
  const hy = h * 0.5;
  const sky = c.createLinearGradient(0, 0, 0, hy);
  sky.addColorStop(0, course.sky[0]); sky.addColorStop(1, course.sky[1]);
  c.fillStyle = sky; c.fillRect(0, 0, w, hy + 1);
  if (course.stars) {
    c.fillStyle = '#fff';
    for (let i = 0; i < 14; i++) c.fillRect((i * 37.3) % w, (i * 23.7) % (hy * 0.8), 2, 2);
    c.fillStyle = '#fff6d0'; c.beginPath(); c.arc(w * 0.78, hy * 0.35, h * 0.08, 0, 7); c.fill();
    c.fillStyle = course.sky[0]; c.beginPath(); c.arc(w * 0.78 + h * 0.035, hy * 0.35 - h * 0.02, h * 0.07, 0, 7); c.fill();
  } else {
    c.fillStyle = 'rgba(255,248,200,.95)'; c.beginPath(); c.arc(w * 0.8, hy * 0.35, h * 0.08, 0, 7); c.fill();
  }
  if (course.sea) { c.fillStyle = course.hillsFar; c.fillRect(0, hy - h * 0.06, w, h * 0.07); }
  else {
    c.fillStyle = course.hillsFar; c.beginPath(); c.moveTo(0, hy);
    for (let x = 0; x <= w; x += 4) c.lineTo(x, hy - h * (0.06 + 0.04 * Math.sin(x * 0.05) + 0.02 * Math.sin(x * 0.13)));
    c.lineTo(w, hy); c.closePath(); c.fill();
  }
  c.fillStyle = course.grass[0]; c.fillRect(0, hy, w, h - hy);
  // road
  const top = w * 0.04, bot = w * 0.42, cx = w / 2;
  c.fillStyle = course.rumble[0];
  c.beginPath(); c.moveTo(cx - top * 1.3, hy); c.lineTo(cx + top * 1.3, hy); c.lineTo(cx + bot * 1.18, h); c.lineTo(cx - bot * 1.18, h); c.closePath(); c.fill();
  c.fillStyle = course.road[0];
  c.beginPath(); c.moveTo(cx - top, hy); c.lineTo(cx + top, hy); c.lineTo(cx + bot, h); c.lineTo(cx - bot, h); c.closePath(); c.fill();
  c.fillStyle = 'rgba(255,255,255,.8)';
  for (let i = 0; i < 4; i++) {
    const p1 = 0.15 + i * 0.22, p2 = p1 + 0.1;
    const y1 = hy + (h - hy) * p1, y2 = hy + (h - hy) * p2;
    const w1 = Math.max(1, (top + (bot - top) * p1) * 0.05), w2 = Math.max(1, (top + (bot - top) * p2) * 0.05);
    c.beginPath(); c.moveTo(cx - w1, y1); c.lineTo(cx + w1, y1); c.lineTo(cx + w2, y2); c.lineTo(cx - w2, y2); c.closePath(); c.fill();
  }
  // scenery either side
  drawSprite(c, course.kinds[0], w * 0.14, h * 0.86, w * 0.2, course, 0);
  drawSprite(c, course.kinds[1], w * 0.88, h * 0.8, w * 0.17, course, 0);
  drawSprite(c, course.kinds[2], w * 0.3, hy + h * 0.1, w * 0.09, course, 0);
}

/** Start/finish gate spanning the road. x1/x2 are the road edges in pixels. */
export function drawGate(c, x1, x2, y, w) {
  const postW = Math.max(3, w * 0.08), h = w * 1.2;
  c.fillStyle = '#ffffff';
  c.fillRect(x1 - postW, y - h, postW, h); c.fillRect(x2, y - h, postW, h);
  const bh = h * 0.22, by = y - h, sq = bh / 2;
  const cols = Math.max(4, Math.round((x2 - x1 + postW * 2) / sq));
  const cw = (x2 - x1 + postW * 2) / cols;
  for (let i = 0; i < cols; i++) for (let j = 0; j < 2; j++) {
    c.fillStyle = (i + j) % 2 ? '#1d2340' : '#ffffff';
    c.fillRect(x1 - postW + i * cw, by + j * sq, cw + 0.5, sq + 0.5);
  }
}

