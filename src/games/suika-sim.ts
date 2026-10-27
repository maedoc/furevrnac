export interface Fruit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  tier: number;
  dead: boolean;
  justMerged: boolean;
}

export interface Tier {
  r: number;
  score: number;
  color: string;
  leaf: string;
  name: string;
}

export const TIERS: Tier[] = [
  { r: 0.55, score: 1, color: "#5a6ea3", leaf: "#2e6b4f", name: "myrtille" },
  { r: 0.8, score: 3, color: "#d43d2a", leaf: "#2e6b4f", name: "cherry" },
  { r: 1.05, score: 6, color: "#e8942a", leaf: "#2e6b4f", name: "clementine" },
  { r: 1.35, score: 10, color: "#e86a2a", leaf: "#2e6b4f", name: "orange" },
  { r: 1.7, score: 15, color: "#8db052", leaf: "#2e6b4f", name: "pomme" },
  { r: 2.1, score: 21, color: "#d4b02a", leaf: "#2e6b4f", name: "ananas" },
  { r: 2.6, score: 28, color: "#7aa852", leaf: "#2e6b4f", name: "melon" },
  { r: 3.2, score: 36, color: "#3f7a3a", leaf: "#2e6b4f", name: "watermelon" },
];

export const GRAVITY = 60;
export const LOSS_Y = 2.0;
const RESTITUTION = 0.15;
const DAMP = 0.995;
export const DROP_CD = 0.6;

export interface SimState {
  fruits: Fruit[];
  score: number;
  dropCd: number;
  over: boolean;
  time: number;
  shake: number;
}

export function initState(): SimState {
  return { fruits: [], score: 0, dropCd: 0, over: false, time: 0, shake: 0 };
}

export function canDrop(s: SimState): boolean {
  return !s.over && s.dropCd <= 0;
}

export function drop(s: SimState, tier: number, x: number, topY: number): boolean {
  if (!canDrop(s)) return false;
  s.fruits.push({
    x,
    y: topY,
    vx: 0,
    vy: 0,
    r: TIERS[tier].r,
    tier,
    dead: false,
    justMerged: false,
  });
  s.dropCd = DROP_CD;
  return true;
}

function mergeFruits(s: SimState, a: Fruit, b: Fruit): void {
  if (a.tier !== b.tier) return;
  if (a.tier >= TIERS.length - 1) {
    a.dead = true;
    b.dead = true;
    s.score += TIERS[a.tier].score * 2;
    return;
  }
  const nx = (a.x + b.x) / 2;
  const ny = (a.y + b.y) / 2;
  a.dead = true;
  b.dead = true;
  s.fruits.push({
    x: nx,
    y: ny,
    vx: (a.vx + b.vx) / 2,
    vy: (a.vy + b.vy) / 2,
    r: TIERS[a.tier + 1].r,
    tier: a.tier + 1,
    dead: false,
    justMerged: true,
  });
  s.score += TIERS[a.tier].score;
}

export function step(
  s: SimState,
  dt: number,
  bounds: { left: number; right: number; floor: number },
): void {
  s.time += dt;
  if (s.shake > 0) s.shake -= dt;
  if (s.over) return;
  if (s.dropCd > 0) s.dropCd -= dt;
  for (const f of s.fruits) f.justMerged = false;

  for (const f of s.fruits) {
    f.vy += GRAVITY * dt;
    f.vx *= DAMP;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
  }

  for (let i = 0; i < s.fruits.length; i++) {
    const a = s.fruits[i];
    if (a.dead) continue;
    for (let j = i + 1; j < s.fruits.length; j++) {
      const b = s.fruits[j];
      if (b.dead) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      const minD = a.r + b.r;
      if (dist >= minD) continue;
      if (a.tier === b.tier) {
        mergeFruits(s, a, b);
        continue;
      }
      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = minD - dist;
      a.x -= (nx * overlap) / 2;
      a.y -= (ny * overlap) / 2;
      b.x += (nx * overlap) / 2;
      b.y += (ny * overlap) / 2;
      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rel < 0) {
        const imp = (-rel * (1 + RESTITUTION)) / 2;
        a.vx -= imp * nx;
        a.vy -= imp * ny;
        b.vx += imp * nx;
        b.vy += imp * ny;
      }
    }
  }

  for (const f of s.fruits) {
    if (f.x - f.r < bounds.left) {
      f.x = bounds.left + f.r;
      f.vx = Math.abs(f.vx) * RESTITUTION;
    }
    if (f.x + f.r > bounds.right) {
      f.x = bounds.right - f.r;
      f.vx = -Math.abs(f.vx) * RESTITUTION;
    }
    if (f.y + f.r > bounds.floor) {
      f.y = bounds.floor - f.r;
      f.vy = -Math.abs(f.vy) * RESTITUTION;
      f.vx *= 0.96;
    }
  }

  s.fruits = s.fruits.filter((f) => !f.dead);

  if (s.time > 1) {
    for (const f of s.fruits) {
      if (f.y - f.r < LOSS_Y && Math.abs(f.vy) < 4) {
        s.over = true;
        s.shake = 0.4;
        return;
      }
    }
  }
}

export function stepSeconds(
  s: SimState,
  seconds: number,
  bounds: { left: number; right: number; floor: number },
): void {
  let t = 0;
  while (t < seconds) {
    const dt = Math.min(1 / 60, seconds - t);
    step(s, dt, bounds);
    t += dt;
    if (s.over) break;
  }
}

export function nextTier(rng: () => number): number {
  return Math.floor(rng() * 5);
}
