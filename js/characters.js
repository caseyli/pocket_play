// The Pocket Play cast: round dots with cartoon faces. Every game uses these characters.
// Draw one with drawCharacter(ctx, x, y, R, options).

export const INK = '#1d2340';

/** The five dot colours. Vary in lightness as well as hue, for colour-blind players. */
export const DOT_COLORS = [
  { name: 'red',    fill: '#FF4D6D', light: '#FF9DB0', dark: '#C9184A' },
  { name: 'blue',   fill: '#3A86FF', light: '#8DBBFF', dark: '#1D4ED8' },
  { name: 'yellow', fill: '#FFC93C', light: '#FFE9A0', dark: '#D99A00' },
  { name: 'green',  fill: '#2EC27E', light: '#86E6B9', dark: '#138A55' },
  { name: 'purple', fill: '#9D4EDD', light: '#CFA6F2', dark: '#6A1FB0' },
];

/** Idle pupil drift for a character with phase `ph` at time `t` (seconds). */
export const idleLook = (t, ph) => ({ x: Math.sin(t * 0.6 + ph) * 0.5, y: Math.cos(t * 0.45 + ph) * 0.3 });

/** Unit vector from (x, y) toward (tx, ty), for pupils that follow a finger. */
export function lookToward(x, y, tx, ty) {
  const dx = tx - x, dy = ty - y, m = Math.hypot(dx, dy) || 1;
  return { x: dx / m, y: dy / m };
}

/**
 * Draw a dot character centred at (x, y) with radius R.
 * options:
 *   color   DOT_COLORS entry or index (default 0)
 *   mood    'normal' | 'happy' (^ ^) | 'surprised' (o) | 'excited' (big grin) (default 'normal')
 *   look    { x, y } pupil direction, each -1..1 (default centre)
 *   open    eye openness 0..1, for blinking (default 1)
 *   mouth   null | 'smile' | 'o' | 'grin' (default null; 'surprised' implies 'o', 'excited' implies 'grin')
 *   sx, sy  squash/stretch (default 1). Stretching keeps the bottom planted.
 *   rot     rotation in radians
 *   alpha   opacity
 *   shadow  draw a ground shadow (default true)
 *   outline white outline, used for "selected" (default false)
 *   hat     null | 'chef'
 */
export function drawCharacter(ctx, x, y, R, o = {}) {
  const col = typeof o.color === 'number' ? DOT_COLORS[o.color] : o.color || DOT_COLORS[0];
  const sx = o.sx ?? 1, sy = o.sy ?? 1, rot = o.rot || 0, alpha = o.alpha ?? 1;
  const mood = o.mood || 'normal';
  if (alpha <= 0 || sx <= 0.01 || sy <= 0.01) return;

  ctx.save();
  ctx.globalAlpha *= alpha;
  if (o.shadow !== false) {
    ctx.fillStyle = 'rgba(20,30,60,.13)';
    ctx.beginPath(); ctx.ellipse(x, y + R * 0.92, R * 0.78 * sx, R * 0.2, 0, 0, 7); ctx.fill();
  }
  ctx.translate(x, y + R * (1 - sy));
  ctx.rotate(rot);
  ctx.scale(sx, sy);

  // body
  const g = ctx.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.1, 0, 0, R * 1.05);
  g.addColorStop(0, col.light); g.addColorStop(0.55, col.fill); g.addColorStop(1, col.dark);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fill();
  if (o.outline) { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = R * 0.12; ctx.stroke(); }
  if (o.hat === 'chef') drawChefHat(ctx, R);

  const mouth = mood === 'surprised' ? 'o' : mood === 'excited' ? 'grin' : o.mouth || null;
  drawFace(ctx, R, mood, o.look || { x: 0, y: 0 }, o.open ?? 1, mouth);
  ctx.restore();
}

function drawFace(ctx, R, mood, look, open, mouth) {
  const ex = R * 0.34, ey = -R * 0.08;
  ctx.lineCap = 'round';

  if (mood === 'happy') {
    const er = R * 0.25;
    ctx.strokeStyle = INK; ctx.lineWidth = R * 0.13;
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.arc(s * ex, ey + er * 0.35, er * 0.62, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    }
  } else {
    const er = R * (mood === 'surprised' ? 0.3 : 0.25);
    const lidOpen = open;
    const pupilR = er * (mood === 'surprised' ? 0.4 : 0.52);
    const reach = er * 0.42;
    for (const s of [-1, 1]) {
      const cx = s * ex;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(cx, ey, er, er * lidOpen, 0, 0, 7); ctx.fill();
      if (lidOpen > 0.5) {
        const px = cx + look.x * reach, py = ey + look.y * reach;
        const clip = lidOpen < 0.95; // only half-shut eyes need clipping; skip it for speed otherwise
        if (clip) { ctx.save(); ctx.beginPath(); ctx.ellipse(cx, ey, er, er * lidOpen, 0, 0, 7); ctx.clip(); }
        ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(px, py, pupilR, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px - er * 0.18, py - er * 0.2, er * 0.16, 0, 7); ctx.fill();
        if (clip) ctx.restore();
      }
    }
  }

  if (mouth === 'smile') {
    ctx.strokeStyle = INK; ctx.lineWidth = R * 0.09;
    ctx.beginPath(); ctx.arc(0, R * 0.22, R * 0.2, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
  } else if (mouth === 'grin') {
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.moveTo(-R * 0.26, R * 0.2); ctx.quadraticCurveTo(0, R * 0.22, R * 0.26, R * 0.2);
    ctx.quadraticCurveTo(R * 0.22, R * 0.56, 0, R * 0.56); ctx.quadraticCurveTo(-R * 0.22, R * 0.56, -R * 0.26, R * 0.2); ctx.fill();
    ctx.fillStyle = '#ff8fa3';
    ctx.beginPath(); ctx.ellipse(0, R * 0.47, R * 0.12, R * 0.06, 0, 0, 7); ctx.fill();
  } else if (mouth === 'o') {
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.ellipse(0, R * 0.38, R * 0.1, R * 0.13, 0, 0, 7); ctx.fill();
  }
}

function drawChefHat(ctx, R) {
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(-R * 0.36, -R * 1.22, R * 0.34, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(R * 0.36, -R * 1.22, R * 0.34, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(0, -R * 1.42, R * 0.4, 0, 7); ctx.fill();
  ctx.fillRect(-R * 0.56, -R * 1.22, R * 1.12, R * 0.3);
  // band, sitting on the head
  ctx.fillStyle = '#e4e9f3';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(-R * 0.6, -R * 0.98, R * 1.2, R * 0.26, R * 0.1); else ctx.rect(-R * 0.6, -R * 0.98, R * 1.2, R * 0.26);
  ctx.fill();
}
