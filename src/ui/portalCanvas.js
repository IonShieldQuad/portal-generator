import { visualState } from './visual.js';
import { ringPoints, boltPoints, rand01 } from './portalShape.js';

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

let active = null;

export function stopPortalCanvas() {
  if (active) {
    active.stop();
    active = null;
  }
}

export function mountPortalCanvas(container, portal) {
  stopPortalCanvas();
  const canvas = container.querySelector('canvas.portal-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const v = visualState(portal);
  const dpr = window.devicePixelRatio || 1;
  const size = canvas.clientWidth || 180;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  ctx.scale(dpr, dpr);

  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let raf = null;
  if (reduced) {
    drawPortal(ctx, size, v, 0);
    active = { stop() {} };
    return;
  }
  const draw = () => {
    drawPortal(ctx, size, v, performance.now() / 1000);
    raf = requestAnimationFrame(draw);
  };
  draw();
  active = {
    stop() {
      if (raf) cancelAnimationFrame(raf);
    },
  };
}

function drawPortal(ctx, size, v, t) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.34;
  const hue = v.hue;
  const stability = clamp01(v.stability);
  const energy = clamp01(v.reserves);
  const glow = v.coefficientGlow;
  const fade = clamp01(v.coefficientFade);
  const seed = v.seed ?? 0.5;
  const flicker = v.collapsing ? 0.55 + 0.45 * Math.sin(t * 22) : 1;
  const sat = 80 * (1 - 0.7 * fade);

  ctx.clearRect(0, 0, size, size);

  // Dead husk: grey residue, no opening.
  if (v.terminal) {
    ctx.save();
    ctx.strokeStyle = 'rgba(150,150,170,0.45)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 9; i += 1) {
      const a0 = (i / 9) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.92, a0, a0 + 0.32);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(60,60,84,0.45)';
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  // Wobble phase advances faster the less stable the portal is.
  const phase = t * (0.6 + (1 - stability) * 1.7);
  const openingR = R * 0.5 * (0.7 + energy * 0.3);

  // Inner glow.
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.95);
  grad.addColorStop(0, `hsla(${hue},${sat}%,${60 + glow * 20}%,${(0.15 + energy * 0.55) * (1 - fade * 0.75) * flicker})`);
  grad.addColorStop(1, 'hsla(0,0%,0%,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.95, 0, Math.PI * 2);
  ctx.fill();

  // Opening — filled when healthy, a ghost outline when fading.
  if (fade > 0.35) {
    ctx.save();
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = `hsla(${hue},${sat}%,70%,${0.5 * (1 - fade * 0.4) * flicker})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, openingR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else {
    ctx.fillStyle = `hsla(${hue},${sat}%,${45 + energy * 20}%,${(0.2 + energy * 0.55) * (1 - fade * 0.8) * flicker})`;
    ctx.beginPath();
    ctx.arc(cx, cy, openingR, 0, Math.PI * 2);
    ctx.fill();
  }

  // Wobbly ring — the primary stability cue.
  const points = ringPoints(cx, cy, R, stability, phase, seed, 72);
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.strokeStyle = `hsla(${hue},${sat}%,${58 + glow * 18}%,${(0.4 + stability * 0.5) * (1 - 0.5 * fade) * flicker})`;
  ctx.lineWidth = Math.max(1.2, 4 - fade * 1.6);
  ctx.shadowBlur = 8 + glow * 10;
  ctx.shadowColor = `hsla(${hue},90%,60%,${0.5 * (1 - fade * 0.5)})`;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Jagged lightning bolts when overcharged.
  if (glow > 0.05) {
    const count = Math.round(glow * 4);
    const frame = Math.floor(t * 4);
    for (let i = 0; i < count; i += 1) {
      const angle = rand01(seed, frame + i) * Math.PI * 2;
      const pts = boltPoints(cx, cy, R, angle, seed + i + frame, 5, 0.5);
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let j = 1; j < pts.length; j += 1) ctx.lineTo(pts[j][0], pts[j][1]);
      ctx.strokeStyle = `hsla(${hue},100%,70%,${glow * 0.45 * flicker})`;
      ctx.lineWidth = 3;
      ctx.shadowBlur = 10;
      ctx.shadowColor = `hsla(${hue},100%,70%,${glow})`;
      ctx.stroke();
      ctx.strokeStyle = `hsla(${hue},100%,90%,${glow * flicker})`;
      ctx.lineWidth = 1.2;
      ctx.shadowBlur = 4;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  // Dissolve: particles leak outward and fade when the connection is weak.
  if (fade > 0.15) {
    const n = Math.round(fade * 12);
    for (let i = 0; i < n; i += 1) {
      const life = (t * 0.35 + i / n) % 1;
      const a = rand01(seed, i * 7 + Math.floor(t * 0.35)) * Math.PI * 2;
      const rr = R * (1 + life * 0.85);
      ctx.fillStyle = `hsla(${hue},${sat}%,72%,${((1 - life) * fade * 0.6).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Gnome motes — drift when fading/collapsing; vibrate when overcharged.
  const count = Math.min(v.gnomes ?? 0, 24);
  const drift = fade * 0.5 + (v.collapsing ? 0.6 : 0);
  const jitter = glow;
  const moteFrame = Math.floor(t * 14);
  for (let i = 0; i < count; i += 1) {
    const a = (i / Math.max(1, count)) * Math.PI * 2 + t * 0.6;
    const rr = R * 1.18 * (1 + drift * (0.3 + 0.4 * Math.sin(t * 1.3 + i)));
    const jx = (rand01(seed, i * 13 + moteFrame) - 0.5) * jitter * 7;
    const jy = (rand01(seed, i * 17 + moteFrame + 50) - 0.5) * jitter * 7;
    const lightness = 82 + jitter * 14;
    ctx.fillStyle = `hsla(${hue},${sat}%,${lightness}%,${(0.85 * (1 - drift * 0.5)).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(
      cx + Math.cos(a) * rr + jx,
      cy + Math.sin(a) * rr + jy,
      1.7 + jitter * 0.6,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
}
