export const W = 10;
export const PATH: [number, number][] = [
  [-1, 2],
  [3, 2],
  [3, 5],
  [7, 5],
  [7, 1],
  [10, 1],
];

export interface Tower {
  x: number;
  y: number;
  kind: 0 | 1 | 2; // arrow, cannon, frost
  cd: number;
}

export interface Enemy {
  pathIdx: number;
  t: number; // 0..1 along segment
  hp: number;
  maxHp: number;
  speed: number;
  kind: 0 | 1; // imp, brute
  dead: boolean;
}

export interface Shot {
  x: number;
  y: number;
  tx: number;
  ty: number;
  t: number;
  tower: number;
}

export interface SimState {
  towers: Tower[];
  enemies: Enemy[];
  shots: Shot[];
  gold: number;
  lives: number;
  wave: number;
  waveT: number;
  betweenWaves: boolean;
  spawnQueue: number; // enemies left to spawn this wave
  spawnT: number;
  score: number;
  over: boolean;
  selectedTowerKind: 0 | 1 | 2;
}

export const TOWER_COST = [30, 60, 45];
export const TOWER_RANGE = [2.4, 2.0, 2.2];
export const TOWER_RATE = [0.8, 1.6, 1.0];
export const TOWER_DMG = [1, 4, 1];
export const ENEMY_HP = [4, 14];
export const ENEMY_SPEED = [1.1, 0.7];
export const ENEMY_REWARD = [6, 18];

export function initState(): SimState {
  return {
    towers: [],
    enemies: [],
    shots: [],
    gold: 60,
    lives: 10,
    wave: 0,
    waveT: 3,
    betweenWaves: true,
    spawnQueue: 0,
    spawnT: 0,
    score: 0,
    over: false,
    selectedTowerKind: 0,
  };
}

export function waveSize(wave: number): number {
  return 5 + wave * 3;
}

export function pathPos(e: Enemy): { x: number; y: number } {
  const a = PATH[Math.min(e.pathIdx, PATH.length - 2)];
  const b = PATH[Math.min(e.pathIdx + 1, PATH.length - 1)];
  const x = a[0] + (b[0] - a[0]) * e.t;
  const y = a[1] + (b[1] - a[1]) * e.t;
  return { x, y };
}

export function canPlace(s: SimState, x: number, y: number): boolean {
  if (x < 0 || x >= W || y < 0 || y >= 7) return false;
  // not on the path
  for (let i = 0; i < PATH.length - 1; i++) {
    const [ax, ay] = PATH[i];
    const [bx, by] = PATH[i + 1];
    const lox = Math.min(ax, bx) - 0.4;
    const hix = Math.max(ax, bx) + 0.4;
    const loy = Math.min(ay, by) - 0.4;
    const hiy = Math.max(ay, by) + 0.4;
    if (x >= lox && x <= hix && y >= loy && y <= hiy) return false;
  }
  // not on another tower
  if (s.towers.some((t) => Math.abs(t.x - x) < 1 && Math.abs(t.y - y) < 1))
    return false;
  return true;
}

export function placeTower(s: SimState, x: number, y: number): boolean {
  const kind = s.selectedTowerKind;
  if (s.gold < TOWER_COST[kind]) return false;
  if (!canPlace(s, x, y)) return false;
  s.gold -= TOWER_COST[kind];
  s.towers.push({ x, y, kind, cd: 0 });
  return true;
}

function spawnWave(s: SimState): void {
  s.wave++;
  s.spawnQueue = waveSize(s.wave);
  s.spawnT = 0;
  s.betweenWaves = false;
}

function spawnEnemy(s: SimState, rng: () => number): void {
  const brute = s.wave >= 3 && rng() < 0.25 + s.wave * 0.03;
  const kind: 0 | 1 = brute ? 1 : 0;
  s.enemies.push({
    pathIdx: 0,
    t: 0,
    hp: ENEMY_HP[kind] + s.wave * 1.5,
    maxHp: ENEMY_HP[kind] + s.wave * 1.5,
    speed: ENEMY_SPEED[kind] * (1 + s.wave * 0.04),
    kind,
    dead: false,
  });
}

export function step(s: SimState, dt: number, rng: () => number): void {
  if (s.over) return;

  // wave flow
  if (s.betweenWaves) {
    s.waveT -= dt;
    if (s.waveT <= 0) spawnWave(s);
  } else if (s.spawnQueue > 0) {
    s.spawnT -= dt;
    if (s.spawnT <= 0) {
      s.spawnT = 1.1;
      s.spawnQueue--;
      spawnEnemy(s, rng);
    }
  } else if (s.enemies.length === 0) {
    s.betweenWaves = true;
    s.waveT = 4;
    s.gold += 25 + s.wave * 5;
  }

  // enemies move
  for (const e of s.enemies) {
    e.t += e.speed * dt * 0.5;
    while (e.t >= 1) {
      e.t -= 1;
      e.pathIdx++;
      if (e.pathIdx >= PATH.length - 1) {
        // leaked
        e.dead = true;
        s.lives -= e.kind === 1 ? 2 : 1;
        if (s.lives <= 0) s.over = true;
        break;
      }
    }
  }

  // towers fire
  for (const tw of s.towers) {
    tw.cd -= dt;
    if (tw.cd > 0) continue;
    // find target: furthest along path in range
    let best: Enemy | null = null;
    let bestProgress = -1;
    for (const e of s.enemies) {
      if (e.dead) continue;
      const p = pathPos(e);
      const d = Math.hypot(p.x - tw.x, p.y - tw.y);
      if (d > TOWER_RANGE[tw.kind]) continue;
      const progress = e.pathIdx + e.t;
      if (progress > bestProgress) {
        bestProgress = progress;
        best = e;
      }
    }
    if (best) {
      const p = pathPos(best);
      s.shots.push({
        x: tw.x,
        y: tw.y,
        tx: p.x,
        ty: p.y,
        t: 0,
        tower: tw.kind,
      });
      tw.cd = TOWER_RATE[tw.kind];
    }
  }

  // shots travel + hit
  for (const sh of s.shots) {
    sh.t += dt * 3;
    if (sh.t >= 1) {
      // damage nearest enemy to impact point
      for (const e of s.enemies) {
        if (e.dead) continue;
        const p = pathPos(e);
        if (Math.hypot(p.x - sh.tx, p.y - sh.ty) < 0.8) {
          const dmg = TOWER_DMG[sh.tower];
          e.hp -= dmg;
          if (e.hp <= 0) {
            e.dead = true;
            s.gold += ENEMY_REWARD[e.kind];
            s.score += ENEMY_REWARD[e.kind];
          }
          break;
        }
      }
      sh.t = 2; // spent
    }
  }
  s.shots = s.shots.filter((sh) => sh.t < 1.5);
  s.enemies = s.enemies.filter((e) => !e.dead);
}

export function stepSeconds(s: SimState, seconds: number, rng: () => number): void {
  let t = 0;
  while (t < seconds) {
    step(s, Math.min(1 / 60, seconds - t), rng);
    t += 1 / 60;
    if (s.over) break;
  }
}
