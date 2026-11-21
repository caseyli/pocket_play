// Background worlds for Dot Pop. Tweak MILESTONE or the THEMES list freely.

/** Points needed to move on to the next world. */
export const MILESTONE = 100;

/** Worlds cycle in this order. `shape` picks the drifting background shapes. */
export const THEMES = [
  { label: 'Sunny sky!',     bg: 'linear-gradient(180deg,#86cfff 0%,#c4eaff 60%,#fff2c9 100%)', shape: 'cloud' },
  { label: 'Under the sea!', bg: 'linear-gradient(180deg,#3fd0e0 0%,#1b93c9 55%,#155a96 100%)', shape: 'bubble' },
  { label: 'Outer space!',   bg: 'radial-gradient(120% 90% at 50% 10%,#3b3a8c 0%,#1a1b4b 55%,#0c0d2a 100%)', shape: 'star' },
  { label: 'Candy land!',    bg: 'linear-gradient(160deg,#ffd3ea 0%,#e6d6ff 50%,#cff2ff 100%)', shape: 'heart' },
  { label: 'Forest!',        bg: 'linear-gradient(180deg,#c6f0a6 0%,#76c870 60%,#3c9150 100%)', shape: 'leaf' },
  { label: 'Sunset!',        bg: 'linear-gradient(180deg,#ff8f70 0%,#ffbd66 50%,#ffe6a1 100%)', shape: 'sparkle' },
];

const COUNTS = { star: 34, cloud: 7 };
const DEFAULT_COUNT = 16;

/** Create the drifting shapes for a world. `visible` = start fully opaque (no fade-in). */
export function spawnShapes(shape, w, h, visible) {
  const n = COUNTS[shape] || DEFAULT_COUNT;
  const out = [];
  for (let i = 0; i < n; i++) out.push(makeShape(shape, Math.random() * w, Math.random() * h, visible));
  return out;
}

function makeShape(shape, x, y, visible) {
  const p = { shape, x, y, rot: Math.random() * 6, vr: 0, a: visible ? 1 : 0, fade: 1, ph: Math.random() * 6.28, s: 1, vx: 0, vy: 0 };
  switch (shape) {
    case 'cloud':   p.s = 40 + Math.random() * 40; p.vx = 8 + Math.random() * 14; p.rot = 0; break;
    case 'bubble':  p.s = 5 + Math.random() * 14;  p.vy = -(18 + Math.random() * 30); break;
    case 'star':    p.s = 1.5 + Math.random() * 3; p.vx = 3; break;
    case 'heart':   p.s = 8 + Math.random() * 12;  p.vy = -(12 + Math.random() * 18); p.vr = Math.random() - 0.5; break;
    case 'leaf':    p.s = 8 + Math.random() * 10;  p.vy = 18 + Math.random() * 22; p.vr = (Math.random() - 0.5) * 2; break;
    case 'sparkle': p.s = 4 + Math.random() * 8;   p.vy = -(6 + Math.random() * 12); p.vr = 0.5; break;
  }
  return p;
}

/** Advance shapes; returns the list with fully faded-out shapes removed. */
export function updateShapes(parts, dt, t, w, h) {
  const m = 90;
  for (const p of parts) {
    p.x += p.vx * dt + (p.shape === 'leaf' ? Math.sin(t * 1.5 + p.ph) * 20 * dt : 0);
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    p.a = Math.max(0, Math.min(1, p.a + p.fade * dt * 0.8));
    if (p.fade > 0) {
      if (p.x > w + m) p.x = -m; else if (p.x < -m) p.x = w + m;
      if (p.y > h + m) p.y = -m; else if (p.y < -m) p.y = h + m;
    }
  }
  return parts.filter((p) => p.fade > 0 || p.a > 0);
}

export function drawShape(c, p, t) {
  c.save();
  c.translate(p.x, p.y);
  c.rotate(p.rot);
  c.globalAlpha = p.a;
  switch (p.shape) {
    case 'cloud':
      c.fillStyle = 'rgba(255,255,255,.85)';
      c.beginPath();
      c.arc(0, 0, p.s * 0.5, 0, 7);
      c.arc(p.s * 0.45, -p.s * 0.2, p.s * 0.42, 0, 7);
      c.arc(p.s * 0.9, 0, p.s * 0.38, 0, 7);
      c.fill();
      break;
    case 'bubble':
      c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 2;
      c.beginPath(); c.arc(0, 0, p.s, 0, 7); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.5)';
      c.beginPath(); c.arc(-p.s * 0.35, -p.s * 0.35, p.s * 0.22, 0, 7); c.fill();
      break;
    case 'star':
      c.globalAlpha = p.a * (0.45 + 0.55 * Math.abs(Math.sin(t * 1.3 + p.ph)));
      drawStar(c, 0, 0, p.s * 2.2, p.s * 0.7, '#fff');
      break;
    case 'heart': {
      const s = p.s;
      c.fillStyle = 'rgba(255,120,190,.55)';
      c.beginPath();
      c.moveTo(0, s * 0.35);
      c.bezierCurveTo(-s, -s * 0.3, -s * 0.45, -s, 0, -s * 0.45);
      c.bezierCurveTo(s * 0.45, -s, s, -s * 0.3, 0, s * 0.35);
      c.fill();
      break;
    }
    case 'leaf':
      c.fillStyle = 'rgba(40,120,60,.5)';
      c.beginPath(); c.ellipse(0, 0, p.s, p.s * 0.45, 0, 0, 7); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(-p.s, 0); c.lineTo(p.s, 0); c.stroke();
      break;
    case 'sparkle':
      c.globalAlpha = p.a * (0.5 + 0.5 * Math.abs(Math.sin(t * 2 + p.ph)));
      drawStar(c, 0, 0, p.s, p.s * 0.25, 'rgba(255,255,255,.9)');
      break;
  }
  c.restore();
}

/** Four-pointed star. Shared with the confetti. */
export function drawStar(c, x, y, R, r, fill) {
  c.fillStyle = fill;
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2, rr = i % 2 ? r : R;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
  c.fill();
}
