import {
  risk,
  riskBand,
  throughput,
  predictedTimeToCollapse,
  coefficientOptimum,
  coefficientSafe,
  stabilityDelta,
  upkeep,
} from '../domain/portal.js';
import { hashSeed } from './portalShape.js';

const BAND_HUE = { low: 150, medium: 48, high: 28, critical: 350 };

export function collapseUrgency(time) {
  if (!Number.isFinite(time)) return 'low';
  if (time <= 3) return 'critical';
  if (time <= 8) return 'high';
  if (time <= 15) return 'medium';
  return 'low';
}

// Pure mapping from a portal to the numbers the UI renders.
export function visualState(portal) {
  const band = riskBand(risk(portal));
  const optimum = coefficientOptimum(portal);
  const safe = coefficientSafe(portal);
  const deviation = portal.coefficient - optimum;
  const timeToCollapse = predictedTimeToCollapse(portal);
  const dS = stabilityDelta(portal);
  return {
    band,
    risk: risk(portal),
    hue: BAND_HUE[band],
    reserves: portal.reserves / 100,
    stability: portal.stability / 100,
    coefficient: portal.coefficient,
    coefficientOptimum: optimum,
    coefficientSafe: safe,
    coefficientFade: deviation < 0 ? Math.min(1, -deviation / 40) : 0,
    coefficientGlow: deviation > 0 ? Math.min(1, deviation / 40) : 0,
    gnomeRatio: throughput(portal) > 0 ? portal.gnomes / throughput(portal) : 0,
    gnomes: portal.gnomes,
    collapsing: portal.status === 'collapsing',
    terminal: portal.status === 'closed' || portal.status === 'collapsed',
    timeToCollapse,
    urgency: collapseUrgency(timeToCollapse),
    stabilityDelta: dS,
    stabilityTrend: dS > 0.05 ? 'up' : dS < -0.05 ? 'down' : 'flat',
    upkeep: upkeep(portal),
    seed: hashSeed(portal.id || portal.name || 'portal'),
    glyph: (portal.destinationWorld || portal.name || '?').trim().charAt(0).toUpperCase(),
  };
}

export const BAND_LABEL = {
  low: 'низкий',
  medium: 'средний',
  high: 'высокий',
  critical: 'критический',
};

export const STATUS_LABEL = {
  open: 'открыт',
  collapsing: 'схлопывается',
  closed: 'закрыт',
  collapsed: 'схлопнулся',
};
