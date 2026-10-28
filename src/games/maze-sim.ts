export interface Vec {
  x: number;
  y: number;
}

export interface Wall {
  x: number; // cell-based segments: horizontal wall at (x..x+w, y)
  y: number;
  w: number; // in cells (horizontal walls) or 1 (vertical walls)
  vertical: boolean;
}

export interface Hole {
  x: number;
  y: number;
  r: number;
}

export interface Level {
  name: string;
  cols: number;
  rows: number;
  start: Vec; // cell coords
  walls: Wall[];
  holes: Hole[];
  goal: Vec;
}

export interface SimState {
  x: number; // ball position in cell units (continuous)
  y: number;
  vx: number;
  vy: number;
  tilt: Vec; // -1..1 normalized gravity direction
  level: number;
  over: boolean;
  won: boolean;
  wonT: number;
  falls: number;
  time: number;
}

export const BALL_R = 0.3;
export const ACCEL = 22; // units/s² at full tilt
export const DAMP = 0.995; // per frame at 60fps
export const WALL_BOUNCE = 0.35;
export const WALL_THICK = 0.12;

export function ballAt(x: number, y: number, _level?: Level): SimState {
  return {
    x: x + 0.5,
    y: y + 0.5,
    vx: 0,
    vy: 0,
    tilt: { x: 0, y: 0 },
    level: 0,
    over: false,
    won: false,
    wonT: 0,
    falls: 0,
    time: 0,
  };
}

function wallRect(w: Wall): { x: number; y: number; w: number; h: number } {
  return {
    x: w.vertical ? w.x : w.x,
    y: w.vertical ? w.y : w.y,
    w: w.vertical ? WALL_THICK : w.w,
    h: w.vertical ? w.w : WALL_THICK,
  };
}

/** Circle-vs-AABB collision with positional resolve + bounce. */
function collideWalls(s: SimState, level: Level): void {
  const r = BALL_R;
  for (const w of level.walls) {
    const rect = wallRect(w);
    const nx = Math.max(rect.x, Math.min(s.x, rect.x + rect.w));
    const ny = Math.max(rect.y, Math.min(s.y, rect.y + rect.h));
    const dx = s.x - nx;
    const dy = s.y - ny;
    const dist = Math.hypot(dx, dy);
    if (dist >= r || dist === 0) continue;
    // resolve along the dominant axis
    const overlap = r - dist;
    if (dx === 0 && dy === 0) continue;
    const ux = dx / dist;
    const uy = dy / dist;
    s.x += ux * overlap;
    s.y += uy * overlap;
    const vn = s.vx * ux + s.vy * uy;
    if (vn < 0) {
      s.vx -= (1 + WALL_BOUNCE) * vn * ux;
      s.vy -= (1 + WALL_BOUNCE) * vn * uy;
    }
  }
}

export function step(s: SimState, dt: number, level: Level): void {
  if (s.over || s.won) return;
  s.time += dt;
  s.vx += s.tilt.x * ACCEL * dt;
  s.vy += s.tilt.y * ACCEL * dt;
  const damp = Math.pow(DAMP, dt * 60);
  s.vx *= damp;
  s.vy *= damp;
  s.x += s.vx * dt;
  s.y += s.vy * dt;

  // outer bounds
  if (s.x < BALL_R) {
    s.x = BALL_R;
    if (s.vx < 0) s.vx *= -WALL_BOUNCE;
  }
  if (s.x > level.cols - BALL_R) {
    s.x = level.cols - BALL_R;
    if (s.vx > 0) s.vx *= -WALL_BOUNCE;
  }
  if (s.y < BALL_R) {
    s.y = BALL_R;
    if (s.vy < 0) s.vy *= -WALL_BOUNCE;
  }
  if (s.y > level.rows - BALL_R) {
    s.y = level.rows - BALL_R;
    if (s.vy > 0) s.vy *= -WALL_BOUNCE;
  }

  collideWalls(s, level);

  // holes
  for (const h of level.holes) {
    if (Math.hypot(s.x - h.x, s.y - h.y) < h.r * 0.9) {
      s.over = true;
      s.falls++;
      return;
    }
  }

  // goal
  if (Math.hypot(s.x - (level.goal.x + 0.5), s.y - (level.goal.y + 0.5)) < 0.42) {
    s.won = true;
    s.wonT = s.time;
  }
}

export function stepSeconds(s: SimState, seconds: number, level: Level): void {
  let t = 0;
  while (t < seconds) {
    step(s, Math.min(1 / 60, seconds - t), level);
    t += 1 / 60;
    if (s.over || s.won) break;
  }
}

/** Levels are hand-authored; walls specified as cell segments. */
export const LEVELS: Level[] = [
  {
    name: "First Steps",
    cols: 8,
    rows: 10,
    start: { x: 0, y: 0 },
    goal: { x: 7, y: 9 },
    holes: [{ x: 6.5, y: 2.5, r: 0.45 }],
    walls: [
      { x: 2, y: 2, w: 6, vertical: false }, // forces going left-down
      { x: 0, y: 5, w: 4, vertical: false }, // forces the corridor right
      { x: 4, y: 7, w: 3, vertical: false }, // final drop through the right gap (x>7)
    ],
  },
  {
    name: "The Weave",
    cols: 9,
    rows: 11,
    start: { x: 0, y: 0 },
    goal: { x: 8, y: 10 },
    holes: [
      { x: 2.5, y: 3.5, r: 0.45 },
      { x: 6.5, y: 7.5, r: 0.45 },
    ],
    walls: [
      { x: 1, y: 2, w: 8, vertical: false },
      { x: 0, y: 4, w: 7, vertical: false },
      { x: 2, y: 6, w: 7, vertical: false },
      { x: 0, y: 8, w: 6, vertical: false },
      { x: 4, y: 2, w: 4, vertical: true },
      { x: 2, y: 6, w: 4, vertical: true },
      { x: 6, y: 8, w: 3, vertical: true },
    ],
  },
  {
    name: "Needle's Eye",
    cols: 9,
    rows: 12,
    start: { x: 0, y: 0 },
    goal: { x: 8, y: 11 },
    holes: [
      { x: 4.5, y: 2.5, r: 0.4 },
      { x: 2.5, y: 6.5, r: 0.4 },
      { x: 6.5, y: 9.5, r: 0.4 },
    ],
    walls: [
      { x: 1, y: 3, w: 3, vertical: false },
      { x: 5, y: 3, w: 3, vertical: false },
      { x: 0, y: 5, w: 3, vertical: false },
      { x: 4, y: 5, w: 5, vertical: false },
      { x: 2, y: 8, w: 6, vertical: false },
      { x: 0, y: 10, w: 4, vertical: false },
      { x: 6, y: 10, w: 3, vertical: false },
      { x: 3, y: 0, w: 3, vertical: true },
      { x: 5, y: 5, w: 5, vertical: true },
      { x: 3, y: 8, w: 3, vertical: true },
    ],
  },
];
