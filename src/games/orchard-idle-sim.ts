export interface OrchardState {
  ink: number; // currency
  trees: number;
  tappers: number; // auto-collectors
  fertilizers: number; // multipliers
  lifetime: number;
  lastTick: number; // ms epoch
}

export const TREE_COST = (n: number): number => Math.round(10 * Math.pow(1.35, n));
export const TAPPER_COST = (n: number): number => Math.round(50 * Math.pow(1.6, n));
export const FERT_COST = (n: number): number => Math.round(120 * Math.pow(1.9, n));

/** ink per second */
export function production(s: OrchardState): number {
  const perTree = 1 + s.fertilizers * 0.5;
  return s.trees * perTree + s.tappers * 4;
}

export function initState(now: number): OrchardState {
  return { ink: 0, trees: 1, tappers: 0, fertilizers: 0, lifetime: 0, lastTick: now };
}

/** Advance by elapsed wall-time ms. Returns ink gained. Offline-safe: linear, no compounding exploits. */
export function catchUp(s: OrchardState, now: number): number {
  const dt = Math.max(0, (now - s.lastTick) / 1000);
  const capped = Math.min(dt, 24 * 3600); // max 24h offline
  const gain = production(s) * capped;
  s.ink += gain;
  s.lifetime += gain;
  s.lastTick = now;
  return gain;
}

export function buyTree(s: OrchardState): boolean {
  const cost = TREE_COST(s.trees);
  if (s.ink < cost) return false;
  s.ink -= cost;
  s.trees++;
  return true;
}

export function buyTapper(s: OrchardState): boolean {
  const cost = TAPPER_COST(s.tappers);
  if (s.ink < cost) return false;
  s.ink -= cost;
  s.tappers++;
  return true;
}

export function buyFertilizer(s: OrchardState): boolean {
  const cost = FERT_COST(s.fertilizers);
  if (s.ink < cost) return false;
  s.ink -= cost;
  s.fertilizers++;
  return true;
}

export function tap(s: OrchardState): number {
  // manual tap: small burst relative to production
  const burst = Math.max(1, production(s) * 0.6);
  s.ink += burst;
  s.lifetime += burst;
  return burst;
}

export const GROWTH_ICONS = ["🌱", "🌿", "🌳", "🌴", "🌲"];
export function growthStage(s: OrchardState): number {
  if (s.trees < 3) return 0;
  if (s.trees < 8) return 1;
  if (s.trees < 20) return 2;
  if (s.trees < 50) return 3;
  return 4;
}
