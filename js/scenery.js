// Shared scenery for the outdoor games: trees, bushes, flowers, pines, snowmen, palms, umbrellas, lamps.
// drawSprite(ctx, kind, x, y, w, world, t): bottom-centre at (x, y), w = width in pixels.
// `world` may set `night: true` (darker bushes). `t` = time in seconds (palms sway).

export function drawSprite(c, kind, x, y, w, world, t) {
  switch (kind) {
    case 'tree': {
      c.fillStyle = '#8a5a3b'; c.fillRect(x - w * 0.07, y - w * 0.55, w * 0.14, w * 0.55);
      c.fillStyle = '#3f9e4a';
      blob(c, x, y - w * 0.85, w * 0.42); blob(c, x - w * 0.25, y - w * 0.62, w * 0.3); blob(c, x + w * 0.25, y - w * 0.62, w * 0.3);
      c.fillStyle = 'rgba(255,255,255,.18)'; blob(c, x - w * 0.12, y - w * 0.98, w * 0.14);
      break;
    }
    case 'autumnTree': {
      c.fillStyle = '#8a5a3b'; c.fillRect(x - w * 0.07, y - w * 0.55, w * 0.14, w * 0.55);
      c.fillStyle = '#f08c2e';
      blob(c, x, y - w * 0.85, w * 0.42); c.fillStyle = '#e8622c'; blob(c, x - w * 0.25, y - w * 0.62, w * 0.3);
      c.fillStyle = '#ffb53d'; blob(c, x + w * 0.25, y - w * 0.62, w * 0.3);
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

function blob(c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(0.5, r), 0, 7); c.fill(); }
function tri(c, x1, y1, x2, y2, x3, y3) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineTo(x3, y3); c.closePath(); c.fill(); }
