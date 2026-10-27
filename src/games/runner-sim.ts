export interface RunnerState {
  y: number; // player height above ground line (world units)
  vy: number;
  grounded: boolean;
  dist: number;
  speed: number;
  over: boolean;
  score: number;
  started: boolean;
  jumpHeld: boolean;
}

export interface Platform {
  x: number; // world start
  w: number;
  h: number; // top surface height
}

export const GRAVITY = 62;
export const JUMP_V = 17;
export const START_SPEED = 8;
export const MAX_SPEED = 17;
export const PLAYER_X = 4; // fixed screen x of the runner
export const PLAYER_SIZE = 0.8;
const SPEED_RAMP = 0.06;

export function initState(): RunnerState {
  return {
    y: 0,
    vy: 0,
    grounded: true,
    dist: 0,
    speed: START_SPEED,
    over: false,
    score: 0,
    started: false,
    jumpHeld: false,
  };
}

export function jump(s: RunnerState): boolean {
  if (s.over || !s.grounded) return false;
  s.started = true;
  s.vy = JUMP_V;
  s.grounded = false;
  return true;
}

function surfaceAt(platforms: Platform[], x: number): number | null {
  // highest platform top under x (world units); null = pit
  let top: number | null = null;
  for (const p of platforms) {
    if (x >= p.x && x <= p.x + p.w) {
      if (top === null || p.h > top) top = p.h;
    }
  }
  return top;
}

export function step(
  s: RunnerState,
  dt: number,
  platforms: Platform[],
): void {
  if (s.over) return;
  if (!s.started) {
    s.started = true;
  }
  s.speed = Math.min(MAX_SPEED, s.speed + SPEED_RAMP * dt);
  s.dist += s.speed * dt;
  s.score = Math.floor(s.dist / 5);

  // vertical physics
  s.vy -= GRAVITY * dt;
  s.y += s.vy * dt;

  const ground = surfaceAt(platforms, s.dist + PLAYER_X + PLAYER_SIZE / 2);
  if (ground === null) {
    // over a pit: only death if below the screen
    if (s.y < -3) {
      s.over = true;
      return;
    }
    s.grounded = false;
    return;
  }
  // land on the surface when falling through it
  if (s.y <= ground && s.vy <= 0) {
    s.y = ground;
    s.vy = 0;
    s.grounded = true;
  } else if (s.y > ground) {
    s.grounded = false;
  }
}

export function stepSeconds(
  s: RunnerState,
  seconds: number,
  platforms: Platform[],
): void {
  let t = 0;
  while (t < seconds) {
    step(s, Math.min(1 / 60, seconds - t), platforms);
    t += 1 / 60;
    if (s.over) break;
  }
}

/** Generate an infinite strip of platforms ahead of `upTo`, deterministic per seed. */
export function genAhead(
  platforms: Platform[],
  upTo: number,
  rng: () => number,
  playerX?: number,
): void {
  const MIN_GAP = 2.2;
  const MAX_GAP = 3.8;
  const MIN_W = 3.5;
  const MAX_W = 8;
  let lastEnd = platforms.length
    ? platforms[platforms.length - 1].x + platforms[platforms.length - 1].w
    : 0;
  while (lastEnd < upTo) {
    const gap = MIN_GAP + rng() * (MAX_GAP - MIN_GAP);
    const w = MIN_W + rng() * (MAX_W - MIN_W);
    const h = Math.min(3, Math.max(0, (rng() - 0.35) * 4));
    platforms.push({ x: lastEnd + gap, w, h });
    lastEnd = lastEnd + gap + w;
  }
  // trim platforms fully behind the player (never the one under/near them)
  const behind = playerX === undefined ? upTo - 60 : playerX - 4;
  while (platforms.length > 2 && platforms[1].x + platforms[1].w < behind)
    platforms.shift();
}
