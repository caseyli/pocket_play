// Dot Dash: the track, the scenery worlds and the tunable numbers.

// ---------- Tunables (tuned for 2-4 year olds: slow, forgiving) ----------
export const SEG_LEN = 200;          // world units per road segment
export const ROAD_W = 760;           // half the road width, world units
export const LANES = 3;
export const DRAW_DIST = 160;        // segments drawn ahead
export const CAM_H = 900;            // camera height above the road
export const MAX_SPEED = 3600;       // world units / second (about 30 s a lap at full speed)
export const ACCEL = 1300;           // holding Go
export const COAST = 650;            // nothing held: rolls gently to a stop
export const BRAKE = 3600;           // holding Stop
export const GREEN_DRIVE_S = [6, 10];  // green lasts this many seconds *of driving*
export const YELLOW_S = 2.2;         // warning before red
export const RED_HOLD_S = 1.4;       // stay stopped this long, then green
export const REMIND_AFTER_S = 1.6;   // still rolling on red this long -> gentle reminder
export const LAPS_PER_WORLD = 1;     // new scenery every lap
export const FRIENDS = 3;

// ---------- Track layout ----------
// Each section: [enter, hold, leave] in segments, curve strength, target hill height.
// Curves don't need to "add up": the road is drawn relative to the kart, so any loop works.
const SECTIONS = [
  [10, 30, 10, 0, 0],      // start straight
  [20, 40, 20, 2.2, 0],    // easy right
  [15, 30, 15, 0, 900],    // little hill
  [20, 30, 20, -2.6, 0],   // left
  [20, 50, 20, 0, -400],   // dip
  [15, 25, 15, 2.8, 0],    // s-bend
  [15, 25, 15, -2.8, 300],
  [20, 60, 20, 0, 0],      // long straight
  [25, 45, 25, 3, 600],    // big sweeping right over a rise
  [20, 30, 20, 0, 0],
  [20, 40, 20, -2.2, 0],   // left home
  [15, 30, 15, 0, 0],      // back to the start line (height 0, so the loop is seamless)
];

const easeIn = (a, b, p) => a + (b - a) * p * p;
const easeInOut = (a, b, p) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5);

/** Build the looping list of road segments. */
export function buildTrack() {
  const segs = [];
  let lastY = 0;
  const add = (curve, y) => {
    const i = segs.length;
    segs.push({ index: i, curve, p1: { y: lastY, z: i * SEG_LEN }, p2: { y, z: (i + 1) * SEG_LEN }, sprites: [], cars: [], clip: 0 });
    lastY = y;
  };
  for (const [enter, hold, leave, curve, height] of SECTIONS) {
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

// ---------- Worlds ----------
export const WORLDS = [
  { label: 'Sunny meadow!', sky: ['#7cc8ff', '#c9ecff'], hills: '#8fd47a', hillsFar: '#b6e3a3',
    grass: ['#76c85e', '#6cbd54'], road: ['#8a8fa3', '#858a9e'], rumble: ['#ff6b81', '#ffffff'], kinds: ['tree', 'bush', 'flowers'] },
  { label: 'Snowy hills!', sky: ['#a9c8ec', '#e8f2ff'], hills: '#ffffff', hillsFar: '#dbe8f7',
    grass: ['#f4f8ff', '#e6eefa'], road: ['#8f95ab', '#8a90a6'], rumble: ['#3A86FF', '#ffffff'], kinds: ['pine', 'snowman', 'pine'], snow: true },
  { label: 'Sandy beach!', sky: ['#5fc3f2', '#c8f0ff'], hills: '#3fb6e0', hillsFar: '#8ad8f2', sea: true,
    grass: ['#f6dc9b', '#efd28c'], road: ['#9a9aa8', '#9595a3'], rumble: ['#FFC93C', '#ffffff'], kinds: ['palm', 'umbrella', 'palm'] },
  { label: 'Starry night!', sky: ['#1a1b4b', '#3b3a8c'], hills: '#2b2c6e', hillsFar: '#38397f', stars: true,
    grass: ['#2f6b4a', '#2a6243'], road: ['#565b74', '#52576f'], rumble: ['#9D4EDD', '#e9e3ff'], kinds: ['lamp', 'bush', 'lamp'], night: true },
];

// ---------- Scenery drawing (bottom-centre at x, y; w = width in pixels) ----------
export function drawSprite(c, kind, x, y, w, world, t) {
  switch (kind) {
    case 'tree': {
      c.fillStyle = '#8a5a3b'; c.fillRect(x - w * 0.07, y - w * 0.55, w * 0.14, w * 0.55);
      c.fillStyle = '#3f9e4a';
      blob(c, x, y - w * 0.85, w * 0.42); blob(c, x - w * 0.25, y - w * 0.62, w * 0.3); blob(c, x + w * 0.25, y - w * 0.62, w * 0.3);
      c.fillStyle = 'rgba(255,255,255,.18)'; blob(c, x - w * 0.12, y - w * 0.98, w * 0.14);
      break;
    }
    case 'bush':
      c.fillStyle = world.night ? '#234f37' : '#4caf50';
      blob(c, x - w * 0.22, y - w * 0.2, w * 0.26); blob(c, x + w * 0.22, y - w * 0.2, w * 0.26); blob(c, x, y - w * 0.32, w * 0.3);
      break;
    case 'flowers': {
      const cols = ['#FF4D6D', '#FFC93C', '#ffffff', '#9D4EDD'];
      for (let i = 0; i < 5; i++) {
        const fx = x + (i - 2) * w * 0.2, fy = y - w * (0.08 + (i % 2) * 0.1);
        c.fillStyle = '#3f9e4a'; c.fillRect(fx - w * 0.015, fy, w * 0.03, y - fy);
        c.fillStyle = cols[i % cols.length]; blob(c, fx, fy, w * 0.07);
        c.fillStyle = '#FFC93C'; blob(c, fx, fy, w * 0.025);
      }
      break;
    }
    case 'pine': {
      c.fillStyle = '#7a5236'; c.fillRect(x - w * 0.06, y - w * 0.25, w * 0.12, w * 0.25);
      for (let i = 0; i < 3; i++) {
        const by = y - w * (0.2 + i * 0.3), hw = w * (0.45 - i * 0.1);
        c.fillStyle = '#2f7d4f'; tri(c, x, by - w * 0.45, x - hw, by, x + hw, by);
        c.fillStyle = '#ffffff'; tri(c, x, by - w * 0.45, x - hw * 0.35, by - w * 0.3, x + hw * 0.35, by - w * 0.3);
      }
      break;
    }
    case 'snowman':
      c.fillStyle = '#ffffff'; blob(c, x, y - w * 0.25, w * 0.28); blob(c, x, y - w * 0.68, w * 0.2);
      c.fillStyle = '#1d2340'; blob(c, x - w * 0.07, y - w * 0.72, w * 0.03); blob(c, x + w * 0.07, y - w * 0.72, w * 0.03);
      c.fillStyle = '#ff8c42'; tri(c, x, y - w * 0.66, x, y - w * 0.62, x + w * 0.16, y - w * 0.63);
      c.fillStyle = '#FF4D6D'; c.fillRect(x - w * 0.2, y - w * 0.5, w * 0.4, w * 0.07);
      break;
    case 'palm': {
      c.strokeStyle = '#a0703f'; c.lineWidth = w * 0.09; c.lineCap = 'round';
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + w * 0.05, y - w * 0.6, x + w * 0.2, y - w * 1.1); c.stroke();
      c.fillStyle = '#2fa35a';
      const tx = x + w * 0.2, ty = y - w * 1.1;
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.62 + Math.sin(t * 1.4 + i) * 0.04;
        c.save(); c.translate(tx, ty); c.rotate(a);
        c.beginPath(); c.ellipse(w * 0.28, 0, w * 0.3, w * 0.08, 0.35, 0, 7); c.fill();
        c.restore();
      }
      break;
    }
    case 'umbrella':
      c.fillStyle = '#c9c9c9'; c.fillRect(x - w * 0.02, y - w * 0.7, w * 0.04, w * 0.7);
      for (let i = 0; i < 4; i++) {
        c.fillStyle = i % 2 ? '#ffffff' : '#FF4D6D';
        c.beginPath(); c.moveTo(x, y - w * 0.78);
        c.arc(x, y - w * 0.62, w * 0.45, Math.PI + i * Math.PI / 4, Math.PI + (i + 1) * Math.PI / 4); c.closePath(); c.fill();
      }
      break;
    case 'lamp': {
      c.fillStyle = '#c7c9e6'; c.fillRect(x - w * 0.03, y - w * 1.2, w * 0.06, w * 1.2);
      const g = c.createRadialGradient(x, y - w * 1.25, 0, x, y - w * 1.25, w * 0.5);
      g.addColorStop(0, 'rgba(255,233,160,.9)'); g.addColorStop(1, 'rgba(255,233,160,0)');
      c.fillStyle = g; blob(c, x, y - w * 1.25, w * 0.5);
      c.fillStyle = '#fff3c4'; blob(c, x, y - w * 1.25, w * 0.1);
      break;
    }
  }
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

function blob(c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(0.5, r), 0, 7); c.fill(); }
function tri(c, x1, y1, x2, y2, x3, y3) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineTo(x3, y3); c.closePath(); c.fill(); }
