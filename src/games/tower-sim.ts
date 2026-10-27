export const LANE_LEN = 40; // world depth units
export const ROAD_W = 4;

export interface Tower {
  z: number; // depth position along the road
  side: -1 | 1; // left or right of the road
  kind: 0 | 1 | 2; // arrow, bomb, frost
  cd: number;
}

export interface Enemy {
  z: number; // depth (0 = spawn far, LANE_LEN = player base)
  hp: number;
  maxHp: number;
  speed: number;
  kind: 0 | 1; // imp, brute
  dead: boolean;
  slowT: number; // frost slow timer
}

export interface Shot {
  x: number;
  y: number; // screen-ish world coords at fire time
  z: number;
  tz: number; // target depth at fire time
  t: number; // 0..1 travel
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
  spawnQueue: number;
  spawnT: number;
  score: number;
  over: boolean;
  selectedTowerKind: 0 | 1 | 2;
}

export const TOWER_COST = [25, 50, 40];
export const TOWER_RANGE = [9, 7, 8];
export const TOWER_RATE = [0.7, 1.5, 0.9];
export const TOWER_DMG = [2, 6, 1];
export const ENEMY_HP = [5, 18];
export const ENEMY_SPEED = [2.2, 1.4];
export const ENEMY_REWARD = [8, 22];
export const TOWER_SLOTS = [8, 16, 24, 30, 36];

export function initState(): SimState {
  return {
    towers: [],
    enemies: [],
    shots: [],
    gold: 80,
    lives: 10,
    wave: 0,
    waveT: 4,
    betweenWaves: true,
    spawnQueue: 0,
    spawnT: 0,
    score: 0,
    over: false,
    selectedTowerKind: 0,
  };
}

export function waveSize(wave: number): number {
  return 4 + wave * 2;
}

export function canPlace(s: SimState, z: number, side: -1 | 1): boolean {
  if (!TOWER_SLOTS.includes(z)) return false;
  return !s.towers.some((t) => t.z === z && t.side === side);
}

export function placeTower(s: SimState, z: number, side: -1 | 1): boolean {
  const kind = s.selectedTowerKind;
  if (s.gold < TOWER_COST[kind]) return false;
  if (!canPlace(s, z, side)) return false;
  s.gold -= TOWER_COST[kind];
  s.towers.push({ z, side, kind, cd: 0 });
  return true;
}

function spawnWave(s: SimState): void {
  s.wave++;
  s.spawnQueue = waveSize(s.wave);
  s.spawnT = 0;
  s.betweenWaves = false;
}

function spawnEnemy(s: SimState, rng: () => number): void {
  const brute = s.wave >= 3 && rng() < 0.2 + s.wave * 0.04;
  const kind: 0 | 1 = brute ? 1 : 0;
  s.enemies.push({
    z: 0,
    hp: ENEMY_HP[kind] + s.wave * 2,
    maxHp: ENEMY_HP[kind] + s.wave * 2,
    speed: ENEMY_SPEED[kind] * (1 + s.wave * 0.03),
    kind,
    dead: false,
    slowT: 0,
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
      s.spawnT = 1.4;
      s.spawnQueue--;
      spawnEnemy(s, rng);
    }
  } else if (s.enemies.length === 0) {
    s.betweenWaves = true;
    s.waveT = 5;
    s.gold += 20 + s.wave * 6;
  }

  // enemies march toward the player (z increases)
  for (const e of s.enemies) {
    if (e.slowT > 0) {
      e.slowT -= dt;
      e.z += e.speed * 0.5 * dt;
    } else e.z += e.speed * dt;

    if (e.z >= LANE_LEN) {
      e.dead = true;
      s.lives -= e.kind === 1 ? 2 : 1;
      if (s.lives <= 0) s.over = true;
    }
  }

  // towers fire at the closest-to-base enemy in range
  for (const tw of s.towers) {
    tw.cd -= dt;
    if (tw.cd > 0) continue;
    let best: Enemy | null = null;
    for (const e of s.enemies) {
      if (e.dead) continue;
      const d = Math.abs(e.z - tw.z);
      if (d > TOWER_RANGE[tw.kind]) continue;
      // prefer the enemy closest to the base (largest z)
      if (!best || e.z > best.z) best = e;
    }
    if (best) {
      s.shots.push({
        x: tw.side * (ROAD_W / 2 + 0.8),
        y: 0,
        z: tw.z,
        tz: best.z,
        t: 0,
        tower: tw.kind,
      });
      tw.cd = TOWER_RATE[tw.kind];
    }
  }

  // shots travel
  for (const sh of s.shots) {
    sh.t += dt * 2.5;
    if (sh.t >= 1) {
      // hit the enemy nearest the target depth
      for (const e of s.enemies) {
        if (e.dead) continue;
        if (Math.abs(e.z - sh.tz) < 1.2) {
          e.hp -= TOWER_DMG[sh.tower];
          if (sh.tower === 2) e.slowT = 1.6;
          if (e.hp <= 0) {
            e.dead = true;
            s.gold += ENEMY_REWARD[e.kind];
            s.score += ENEMY_REWARD[e.kind];
          }
          break;
        }
      }
      sh.t = 2;
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
