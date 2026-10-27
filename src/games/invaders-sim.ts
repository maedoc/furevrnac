export const W = 16;
export const H = 22;
export const ROWS = 4;
export const COLS = 6;
export const PLAYER_Y = H - 1.5;
export const BUNKER_Y = H - 4;

export interface Bullet {
  x: number;
  y: number;
  vy: number;
  friendly: boolean;
}

export interface Invader {
  gx: number;
  gy: number;
  alive: boolean;
  kind: 0 | 1 | 2; // glyph row
}

export interface SimState {
  invaders: Invader[];
  bullets: Bullet[];
  px: number;
  wave: number;
  score: number;
  lives: number;
  over: boolean;
  dir: 1 | -1;
  stepT: number;
  stepRate: number;
  fireT: number;
  bunkers: { x: number; hp: number }[];
  invaderBulletsOnly: boolean;
}

export function makeWave(wave: number): Invader[] {
  const out: Invader[] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      out.push({
        gx: c - (COLS - 1) / 2,
        gy: r,
        alive: true,
        kind: (r % 3) as 0 | 1 | 2,
      });
  void wave;
  return out;
}

export function initState(): SimState {
  return {
    invaders: makeWave(1),
    bullets: [],
    px: 0,
    wave: 1,
    score: 0,
    lives: 3,
    over: false,
    dir: 1,
    stepT: 0,
    stepRate: 0.8,
    fireT: 1.2,
    bunkers: [-5, 0, 5].map((x) => ({ x, hp: 3 })),
    invaderBulletsOnly: false,
  };
}

export function movePlayer(s: SimState, dx: number): void {
  s.px = Math.max(-W / 2 + 1, Math.min(W / 2 - 1, s.px + dx));
}

export function shoot(s: SimState): boolean {
  if (s.over) return false;
  const friendly = s.bullets.filter((b) => b.friendly).length;
  if (friendly >= 3) return false; // rate limit
  s.bullets.push({ x: s.px, y: PLAYER_Y - 0.8, vy: -22, friendly: true });
  return true;
}

export function step(s: SimState, dt: number, rng: () => number): void {
  if (s.over) return;

  // bullets
  s.bullets = s.bullets.filter((b) => {
    b.y += b.vy * dt;
    return b.y > -1 && b.y < H + 1;
  });

  // invader marching
  s.stepT += dt;
  const rate = Math.max(0.15, s.stepRate - s.wave * 0.05);
  if (s.stepT >= rate) {
    s.stepT = 0;
    const alive = s.invaders.filter((i) => i.alive);
    if (alive.length === 0) {
      // wave cleared
      s.wave++;
      s.invaders = makeWave(s.wave);
      return;
    }
    let hitEdge = false;
    for (const i of alive) {
      const x = i.gx + 0.5 * s.dir;
      if (Math.abs(x) > W / 2 - 1.2) hitEdge = true;
    }
    if (hitEdge) {
      s.dir = (s.dir * -1) as 1 | -1;
      for (const i of alive) i.gy += 0.8;
    } else {
      for (const i of alive) i.gx += 0.5 * s.dir;
    }
    // invaders reaching the ground = loss
    for (const i of alive) {
      if (i.gy > PLAYER_Y - 3.5) {
        s.over = true;
        return;
      }
    }
  }

  // invader fire
  s.fireT -= dt;
  if (s.fireT <= 0) {
    s.fireT = Math.max(0.35, 1.4 - s.wave * 0.08) * (0.6 + rng() * 0.8);
    const alive = s.invaders.filter((i) => i.alive);
    if (alive.length > 0) {
      const shooter = alive[Math.floor(rng() * alive.length)];
      s.bullets.push({
        x: shooter.gx,
        y: shooter.gy + 1,
        vy: 8 + s.wave * 0.5,
        friendly: false,
      });
    }
  }

  // collisions: friendly bullets vs invaders
  for (const b of s.bullets) {
    if (!b.friendly) continue;
    for (const i of s.invaders) {
      if (!i.alive) continue;
      if (
        Math.abs(b.x - i.gx) < 0.65 &&
        Math.abs(b.y - i.gy) < 0.65
      ) {
        i.alive = false;
        b.y = -99; // consumed
        s.score += (i.kind + 1) * 10 * s.wave;
        break;
      }
    }
  }

  // enemy bullets vs bunkers
  for (const b of s.bullets) {
    if (b.friendly) continue;
    for (const bu of s.bunkers) {
      if (bu.hp > 0 && Math.abs(b.x - bu.x) < 1.1 && Math.abs(b.y - BUNKER_Y) < 0.9) {
        bu.hp--;
        b.y = 99;
        break;
      }
    }
    // friendly bullets also erode bunkers from below (classic)
  }
  for (const b of s.bullets) {
    if (!b.friendly) continue;
    for (const bu of s.bunkers) {
      if (bu.hp > 0 && Math.abs(b.x - bu.x) < 1.1 && Math.abs(b.y - BUNKER_Y) < 0.9) {
        bu.hp--;
        b.y = -99;
        break;
      }
    }
  }

  // enemy bullet vs player
  for (const b of s.bullets) {
    if (b.friendly) continue;
    if (Math.abs(b.x - s.px) < 0.8 && Math.abs(b.y - PLAYER_Y) < 0.7) {
      b.y = 99;
      s.lives--;
      if (s.lives <= 0) s.over = true;
      return;
    }
  }
}

export function stepSeconds(s: SimState, seconds: number, rng: () => number): void {
  let t = 0;
  while (t < seconds) {
    step(s, Math.min(1 / 60, seconds - t), rng);
    t += 1 / 60;
    if (s.over) break;
  }
}
