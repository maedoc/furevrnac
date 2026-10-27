export interface Bird {
  y: number;
  vy: number;
  alive: boolean;
}

export interface Pipe {
  x: number;
  gapY: number;
  scored: boolean;
}

export const PIPE_W = 2.4;
export const GAP_H = 5.2;
export const PIPE_SPACING = 9;
export const SPEED = 5.5;
export const FLAP_V = -9.5;
export const GRAVITY = 34;
const MAX_FALL = 18;

export interface SimState {
  bird: Bird;
  pipes: Pipe[];
  dist: number;
  score: number;
  over: boolean;
  started: boolean;
}

export function initState(startY: number): SimState {
  return {
    bird: { y: startY, vy: 0, alive: true },
    pipes: [],
    dist: 0,
    score: 0,
    over: false,
    started: false,
  };
}

export function flap(s: SimState): void {
  if (s.over) return;
  s.started = true;
  s.bird.vy = FLAP_V;
}

function spawnPipe(s: SimState, x: number, rng: () => number, worldH: number): void {
  const margin = 2.5;
  const maxGapY = worldH - margin - GAP_H;
  const gapY = margin + rng() * Math.max(0.1, maxGapY - margin);
  s.pipes.push({ x, gapY, scored: false });
}

export function firstPipeX(birdX: number): number {
  return birdX + 12;
}

export function step(
  s: SimState,
  dt: number,
  worldH: number,
  rng: () => number,
): void {
  if (s.over) return;
  if (!s.started) return;

  s.dist += SPEED * dt;
  s.bird.vy = Math.min(s.bird.vy + GRAVITY * dt, MAX_FALL);
  s.bird.y += s.bird.vy * dt;

  for (const p of s.pipes) p.x -= SPEED * dt;

  const last = s.pipes[s.pipes.length - 1];
  const birdX = 4;
  if (!last) {
    spawnPipe(s, firstPipeX(birdX), rng, worldH);
  } else if (last.x < birdX + PIPE_SPACING) {
    spawnPipe(s, last.x + PIPE_SPACING, rng, worldH);
  }
  s.pipes = s.pipes.filter((p) => p.x > birdX - 6);

  for (const p of s.pipes) {
    if (!p.scored && p.x + PIPE_W / 2 < 4) {
      p.scored = true;
      s.score++;
    }
  }

  const bx = 4;
  const by = s.bird.y;
  for (const p of s.pipes) {
    const withinX =
      bx + 0.7 > p.x - PIPE_W / 2 && bx - 0.7 < p.x + PIPE_W / 2;
    if (!withinX) continue;
    if (by - 0.7 < p.gapY || by + 0.7 > p.gapY + GAP_H) {
      s.over = true;
      s.bird.alive = false;
      return;
    }
  }
  if (by - 0.7 < 0 || by + 0.7 > worldH) {
    s.over = true;
    s.bird.alive = false;
  }
}

export function stepSeconds(
  s: SimState,
  seconds: number,
  worldH: number,
  rng: () => number,
): void {
  let t = 0;
  while (t < seconds) {
    step(s, Math.min(1 / 60, seconds - t), worldH, rng);
    t += 1 / 60;
    if (s.over) break;
  }
}
