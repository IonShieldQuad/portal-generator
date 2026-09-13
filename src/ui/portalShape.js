// Pure geometry for the portal graphic, shared by the static SVG card and the
// animated canvas so both look consistent.

const MAX_WOBBLE = 0.28;

export function hashSeed(str) {
  let h = 2166136261;
  const s = String(str ?? '');
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

// Deterministic pseudo-random in [0,1) from a seed and index.
export function rand01(seed, i) {
  const x = Math.sin(seed * 127.1 + i * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// 0 (perfect circle) → MAX_WOBBLE (very distorted).
export function wobbleAmp(stability) {
  const instability = Math.max(0, Math.min(1, 1 - stability));
  return Math.pow(instability, 1.5) * MAX_WOBBLE;
}

// Radial multiplier at angle theta. Integer harmonics keep the loop closed.
export function ringRadius(theta, stability, phase, seed) {
  const amp = wobbleAmp(stability);
  const p1 = seed * 6.283;
  const p2 = seed * 4.1;
  const p3 = seed * 2.7;
  const noise =
    Math.sin(theta * 3 + phase * 0.9 + p1) * 0.5 +
    Math.sin(theta * 5 - phase * 1.3 + p2) * 0.3 +
    Math.sin(theta * 8 + phase * 1.9 + p3) * 0.2;
  return 1 + amp * noise;
}

export function ringPoints(cx, cy, R, stability, phase, seed, steps = 64) {
  const points = [];
  for (let i = 0; i < steps; i += 1) {
    const theta = (i / steps) * Math.PI * 2;
    const r = R * ringRadius(theta, stability, phase, seed);
    points.push([cx + Math.cos(theta) * r, cy + Math.sin(theta) * r]);
  }
  return points;
}

export function ringPathD(cx, cy, R, stability, phase, seed, steps = 48) {
  const points = ringPoints(cx, cy, R, stability, phase, seed, steps);
  return `M ${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L ')} Z`;
}

// A jagged lightning bolt shooting outward from a point on the ring.
export function boltPoints(cx, cy, R, angle, seed, segments = 5, length = 0.45) {
  const points = [];
  let a = angle;
  let r = R * 0.98;
  for (let i = 0; i <= segments; i += 1) {
    points.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    a += (rand01(seed, i) - 0.5) * 0.55;
    r += (R * length) / segments;
  }
  return points;
}
