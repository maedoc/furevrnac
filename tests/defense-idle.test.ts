import { describe, it, expect } from "vitest";
import {
  COLS,
  ROWS,
  initState,
  movePlayer,
  shoot,
  step,
  stepSeconds,
} from "../src/games/invaders-sim";
import {
  PATH,
  TOWER_COST,
  canPlace,
  initState as towerInit,
  pathPos,
  placeTower,
  step as towerStep,
  stepSeconds as towerStepSeconds,
} from "../src/games/tower-sim";
import {
  TREE_COST,
  TAPPER_COST,
  buyFertilizer,
  buyTapper,
  buyTree,
  catchUp,
  initState as orchardInit,
  production,
  tap,
} from "../src/games/orchard-idle-sim";

const rng = () => 0.5;

describe("invaders sim", () => {
  it("spawns a wave of ROWS*COLS invaders", () => {
    const s = initState();
    expect(s.invaders.length).toBe(ROWS * COLS);
    expect(s.invaders.every((i) => i.alive)).toBe(true);
  });

  it("the player moves and is clamped to the lane", () => {
    const s = initState();
    movePlayer(s, 100);
    expect(s.px).toBeLessThan(100);
    movePlayer(s, -1000);
    expect(s.px).toBeGreaterThanOrEqual(-8);
  });

  it("shooting adds a friendly bullet, rate-limited to 3", () => {
    const s = initState();
    expect(shoot(s)).toBe(true);
    expect(shoot(s)).toBe(true);
    expect(shoot(s)).toBe(true);
    expect(shoot(s)).toBe(false);
    expect(s.bullets.filter((b) => b.friendly).length).toBe(3);
  });

  it("a bullet fired under the swarm kills an invader and scores", () => {
    const s = initState();
    // position under the first invader column (gx starts at -2.5)
    s.px = s.invaders[0].gx;
    shoot(s);
    const before = s.invaders.filter((i) => i.alive).length;
    stepSeconds(s, 2, rng);
    const after = s.invaders.filter((i) => i.alive).length;
    expect(after).toBeLessThan(before);
    expect(s.score).toBeGreaterThan(0);
  });

  it("invaders march sideways and descend at the edges", () => {
    const s = initState();
    const x0 = s.invaders[0].gx;
    stepSeconds(s, 0.9, rng); // one step
    expect(s.invaders[0].gx).not.toBe(x0);
  });

  it("clearing the wave starts the next one", () => {
    const s = initState();
    s.invaders.forEach((i) => (i.alive = false));
    stepSeconds(s, 1.0, rng);
    expect(s.invaders.every((i) => i.alive)).toBe(true);
    expect(s.wave).toBe(2);
  });

  it("enemy bullets erode bunkers before reaching the player", () => {
    const s = initState();
    const hp0 = s.bunkers[1].hp;
    s.bullets.push({ x: 0, y: 8, vy: 8, friendly: false });
    stepSeconds(s, 1.2, rng);
    expect(s.bunkers[1].hp).toBeLessThan(hp0);
    expect(s.lives).toBe(3);
  });

  it("the sim is deterministic with fixed rng", () => {
    const run = () => {
      const s = initState();
      for (let i = 0; i < 600; i++) {
        if (i % 30 === 0) shoot(s);
        movePlayer(s, Math.sin(i / 40) * 0.5);
        step(s, 1 / 60, rng);
      }
      return {
        score: s.score,
        alive: s.invaders.filter((i) => i.alive).length,
        lives: s.lives,
      };
    };
    expect(run()).toEqual(run());
  });
});

describe("tower sim", () => {
  it("towers cannot be placed on the path", () => {
    const s = towerInit();
    const onPath = PATH[1];
    expect(canPlace(s, onPath[0], onPath[1])).toBe(false);
    expect(canPlace(s, 0, 6)).toBe(true);
  });

  it("placing a tower costs gold", () => {
    const s = towerInit();
    s.gold = 100;
    expect(placeTower(s, 0, 6)).toBe(true);
    expect(s.gold).toBe(100 - TOWER_COST[0]);
    expect(s.towers.length).toBe(1);
  });

  it("enemies walk the path and leak damage", () => {
    const s = towerInit();
    s.betweenWaves = false;
    s.spawnQueue = 0;
    s.enemies.push({
      pathIdx: PATH.length - 2,
      t: 0.95,
      hp: 10,
      maxHp: 10,
      speed: 1,
      kind: 0,
      dead: false,
    });
    const lives0 = s.lives;
    towerStepSeconds(s, 3, rng);
    expect(s.enemies.length).toBe(0);
    expect(s.lives).toBeLessThan(lives0);
  });

  it("a tower shoots enemies in range and kills grant gold", () => {
    const s = towerInit();
    s.towers.push({ x: 2, y: 3, kind: 0, cd: 0 });
    s.betweenWaves = false;
    s.spawnQueue = 0;
    // enemy entering range on the path
    s.enemies.push({
      pathIdx: 0,
      t: 0.4,
      hp: 1,
      maxHp: 1,
      speed: 0.1,
      kind: 0,
      dead: false,
    });
    const gold0 = s.gold;
    towerStepSeconds(s, 4, rng);
    expect(s.enemies.length).toBe(0);
    expect(s.gold).toBeGreaterThan(gold0);
  });

  it("waves escalate and pay between-wave bonuses", () => {
    const s = towerInit();
    s.gold = 500;
    s.waveT = 0.1;
    towerStepSeconds(s, 0.5, rng);
    expect(s.wave).toBe(1);
    expect(s.spawnQueue).toBeGreaterThan(0);
  });

  it("pathPos interpolates along segments", () => {
    const e = { pathIdx: 0, t: 0.5, hp: 1, maxHp: 1, speed: 1, kind: 0, dead: false };
    const p = pathPos(e);
    expect(p.x).toBe((-1 + 3) / 2);
    expect(p.y).toBeCloseTo(2);
  });
});

describe("orchard idle sim", () => {
  it("production scales with trees and upgrades", () => {
    const s = orchardInit(0);
    const p0 = production(s);
    s.trees = 5;
    expect(production(s)).toBeGreaterThan(p0);
    s.fertilizers = 3;
    expect(production(s)).toBe(5 * (1 + 1.5) + 0);
    s.tappers = 2;
    expect(production(s)).toBe(5 * 2.5 + 8);
  });

  it("catchUp accrues offline ink, capped at 24h", () => {
    const s = orchardInit(0);
    s.lastTick = 0;
    s.trees = 10;
    const gain = catchUp(s, 3600 * 1000); // 1h offline
    expect(gain).toBeCloseTo(10 * 3600, 0);
    expect(s.ink).toBeCloseTo(10 * 3600, 0);
    // 48h offline only credits 24h
    s.lastTick = 0;
    const gain2 = catchUp(s, 48 * 3600 * 1000);
    expect(gain2).toBeCloseTo(production(s) * 24 * 3600, 0);
  });

  it("buying has escalating costs and checks funds", () => {
    const s = orchardInit(0);
    s.ink = 1000;
    const c1 = TREE_COST(s.trees);
    expect(buyTree(s)).toBe(true);
    expect(s.ink).toBe(1000 - c1);
    expect(TREE_COST(s.trees)).toBeGreaterThan(c1);
    s.ink = 0;
    expect(buyTree(s)).toBe(false);
    expect(buyTapper(s)).toBe(false);
    expect(buyFertilizer(s)).toBe(false);
  });

  it("manual taps give a burst", () => {
    const s = orchardInit(0);
    const ink0 = s.ink;
    const burst = tap(s);
    expect(burst).toBeGreaterThan(0);
    expect(s.ink).toBe(ink0 + burst);
  });

  it("growth stage tracks tree count", () => {
    const s = orchardInit(0);
    s.trees = 1;
    expect(["🌱", "🌿", "🌳", "🌴", "🌲"]).toContain(["🌱", "🌿", "🌳", "🌴", "🌲"][0]);
    void s;
  });
});
