export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function clampInt(value, min, max) {
  return Math.round(clamp(value, min, max));
}

export function round1(value) {
  return Math.round(value * 10) / 10;
}
