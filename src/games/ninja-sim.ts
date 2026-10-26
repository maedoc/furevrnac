export interface Vec {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type PlayerInput = {
  left: boolean;
  right: boolean;
  jump: boolean;
  dash: Vec | null;
  focus: boolean;
};

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  facing: 1 | -1;
  dashCd: number;
  dashT: number;
  alive: boolean;
  won: boolean;
  wonT: number;
}

export type Hazard =
  | {
      kind: "saw";
      cx: number;
      cy: number;
      r: number;
      orbit: number;
      speed: number;
      phase: number;
    }
  | {
      kind: "shooter";
      x: number;
      y: number;
      dir: Vec;
      period: number;
      bulletSpeed: number;
      cooldown: number;
      bulletR: number;
    };

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

export interface Level {
  name: string;
  bounds: { w: number; h: number };
  platforms: Rect[];
  hazards: Hazard[];
  spawn: Vec;
  goal: Rect;
}

export interface SimState {
  player: Player;
  bullets: Bullet[];
  sawPos: Record<number, Vec>;
  shooterTimers: number[];
  time: number;
  worldTime: number;
}

export const TICK = 1 / 60;
export const PLAYER_W = 0.8;
export const PLAYER_H = 0.9;
const GRAVITY = 55;
const JUMP_V = 16.5;
const WALK = 9;
const DASH_V = 24;
const DASH_CD = 0.35;
const DASH_TIME = 0.18;
const MAX_FALL = 40;
export const FOCUS_SCALE = 0.22;

export function makePlayer(spawn: Vec): Player {
  return {
    x: spawn.x,
    y: spawn.y,
    vx: 0,
    vy: 0,
    onGround: false,
    facing: 1,
    dashCd: 0,
    dashT: 0,
    alive: true,
    won: false,
    wonT: 0,
  };
}

export function initState(level: Level): SimState {
  return {
    player: makePlayer(level.spawn),
    bullets: [],
    sawPos: {},
    shooterTimers: level.hazards.map((h) =>
      h.kind === "shooter" ? h.cooldown : 0,
    ),
    time: 0,
    worldTime: 0,
  };
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function circleHitsRect(cx: number, cy: number, r: number, rect: Rect): boolean {
  const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  return (nx - cx) ** 2 + (ny - cy) ** 2 <= r * r;
}

function playerRect(p: Player): Rect {
  return { x: p.x - PLAYER_W / 2, y: p.y - PLAYER_H / 2, w: PLAYER_W, h: PLAYER_H };
}

export function sawCenter(h: Extract<Hazard, { kind: "saw" }>, t: number): Vec {
  const a = h.phase + t * h.speed;
  return {
    x: h.cx + Math.cos(a) * h.orbit,
    y: h.cy + Math.sin(a) * h.orbit,
  };
}

function spawnBullets(level: Level, s: SimState, dts: number): void {
  level.hazards.forEach((h, i) => {
    if (h.kind !== "shooter") return;
    s.shooterTimers[i] -= dts;
    if (s.shooterTimers[i] <= 0) {
      s.shooterTimers[i] += h.period;
      s.bullets.push({
        x: h.x,
        y: h.y,
        vx: h.dir.x * h.bulletSpeed,
        vy: h.dir.y * h.bulletSpeed,
        r: h.bulletR,
      });
    }
  });
}

function moveBullets(level: Level, s: SimState, dts: number): void {
  const b = level.bounds;
  s.bullets = s.bullets.filter((bl) => {
    bl.x += bl.vx * dts;
    bl.y += bl.vy * dts;
    return (
      bl.x > -2 && bl.x < b.w + 2 && bl.y > -2 && bl.y < b.h + 2
    );
  });
}

function collidePlatforms(level: Level, p: Player): void {
  p.onGround = false;
  const r = playerRect(p);
  for (const plat of level.platforms) {
    if (!rectsOverlap(r, plat)) continue;
    const overlapL = r.x + r.w - plat.x;
    const overlapR = plat.x + plat.w - r.x;
    const overlapT = r.y + r.h - plat.y;
    const overlapB = plat.y + plat.h - r.y;
    const min = Math.min(overlapL, overlapR, overlapT, overlapB);
    if (min === overlapT && p.vy >= 0) {
      p.y = plat.y - PLAYER_H / 2;
      p.vy = 0;
      p.onGround = true;
    } else if (min === overlapB && p.vy < 0) {
      p.y = plat.y + plat.h + PLAYER_H / 2;
      p.vy = 0;
    } else if (min === overlapL) {
      p.x = plat.x - PLAYER_W / 2;
      p.vx = Math.min(p.vx, 0);
    } else {
      p.x = plat.x + plat.w + PLAYER_W / 2;
      p.vx = Math.max(p.vx, 0);
    }
    r.x = p.x - PLAYER_W / 2;
    r.y = p.y - PLAYER_H / 2;
  }
}

export function step(level: Level, s: SimState, input: PlayerInput, dt: number): void {
  s.time += dt;
  const ts = input.focus ? FOCUS_SCALE : 1;
  const dts = dt * ts;
  s.worldTime += dts;

  const p = s.player;
  if (!p.alive) return;

  if (p.dashCd > 0) p.dashCd -= dt;

  if (p.dashT > 0) {
    p.dashT -= dt;
  } else {
    const move = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (move !== 0) {
      p.vx = move * WALK;
      p.facing = move > 0 ? 1 : -1;
    } else p.vx = 0;

    if (input.jump && p.onGround) {
      p.vy = -JUMP_V;
      p.onGround = false;
    }

    if (input.dash && p.dashCd <= 0) {
      const len = Math.hypot(input.dash.x, input.dash.y) || 1;
      p.vx = (input.dash.x / len) * DASH_V;
      p.vy = (input.dash.y / len) * DASH_V;
      p.dashCd = DASH_CD;
      p.dashT = DASH_TIME;
    }

    p.vy = Math.min(p.vy + GRAVITY * dt, MAX_FALL);
  }
  p.x += p.vx * dt;
  p.y += p.vy * dt;

  collidePlatforms(level, p);

  if (p.y > level.bounds.h + 3) {
    p.alive = false;
    return;
  }

  spawnBullets(level, s, dts);
  moveBullets(level, s, dts);

  for (let i = 0; i < level.hazards.length; i++) {
    const h = level.hazards[i];
    if (h.kind === "saw") {
      const c = sawCenter(h, s.worldTime);
      s.sawPos[i] = c;
      if (circleHitsRect(c.x, c.y, h.r, playerRect(p))) {
        p.alive = false;
        return;
      }
    }
  }
  for (const bl of s.bullets) {
    if (circleHitsRect(bl.x, bl.y, bl.r, playerRect(p))) {
      p.alive = false;
      return;
    }
  }

  if (rectsOverlap(playerRect(p), level.goal)) {
    if (!p.won) p.wonT = s.time;
    p.won = true;
  }
}

export function stepSeconds(
  level: Level,
  s: SimState,
  input: PlayerInput,
  seconds: number,
): void {
  let t = 0;
  while (t < seconds) {
    const dt = Math.min(TICK, seconds - t);
    step(level, s, input, dt);
    t += dt;
    if (!s.player.alive || s.player.won) break;
  }
}
