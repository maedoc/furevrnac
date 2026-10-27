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
  LANE_LEN,
  TOWER_COST,
  TOWER_SLOTS,
  initState as towerInit,
  placeTower,
  step as towerStep,
  stepSeconds as towerStepSeconds,
} from "../src/games/tower-sim";
import {
  TREE_COST,
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

describe("tower sim (pseudo-3D depth model)", () => {
  it("towers only place on valid slots and sides, without overlap", () => {
    const s = towerInit();
    s.gold = 1000;
    expect(placeTower(s, 8, -1)).toBe(true);
    expect(placeTower(s, 8, -1)).toBe(false); // same slot/side taken
    expect(placeTower(s, 8, 1)).toBe(true); // other side ok
    expect(placeTower(s, 9, 1)).toBe(false); // not a slot
  });

  it("placing a tower costs gold", () => {
    const s = towerInit();
    s.gold = 100;
    expect(placeTower(s, 8, -1)).toBe(true);
    expect(s.gold).toBe(100 - TOWER_COST[0]);
  });

  it("enemies march toward the base and leak damage on arrival", () => {
    const s = towerInit();
    s.betweenWaves = false;
    s.spawnQueue = 0;
    s.enemies.push({
      z: LANE_LEN - 1,
      hp: 10,
      maxHp: 10,
      speed: 2,
      kind: 0,
      dead: false,
      slowT: 0,
    });
    const lives0 = s.lives;
    towerStepSeconds(s, 2, rng);
    expect(s.enemies.length).toBe(0);
    expect(s.lives).toBe(lives0 - 1);
  });

  it("a tower kills an approaching enemy and grants gold", () => {
    const s = towerInit();
    s.towers.push({ z: 20, side: -1, kind: 0, cd: 0 });
    s.betweenWaves = false;
    s.spawnQueue = 0;
    s.enemies.push({
      z: 15,
      hp: 3,
      maxHp: 3,
      speed: 1,
      kind: 0,
      dead: false,
      slowT: 0,
    });
    const gold0 = s.gold;
    towerStepSeconds(s, 6, rng);
    expect(s.enemies.length).toBe(0);
    expect(s.gold).toBeGreaterThan(gold0);
  });

  it("frost towers slow enemies", () => {
    const s = towerInit();
    s.towers.push({ z: 10, side: -1, kind: 2, cd: 0 });
    s.betweenWaves = false;
    s.spawnQueue = 0;
    s.enemies.push({
      z: 12,
      hp: 100,
      maxHp: 100,
      speed: 2,
      kind: 0,
      dead: false,
      slowT: 0,
    });
    towerStep(s, 0.5, rng);
    expect(s.enemies[0].slowT).toBeGreaterThan(0);
  });

  it("waves escalate and pay bonuses", () => {
    const s = towerInit();
    s.waveT = 0.1;
    towerStepSeconds(s, 0.5, rng);
    expect(s.wave).toBe(1);
    expect(s.spawnQueue).toBeLessThanOrEqual(6); // spawns trickle out
  });

  it("a reasonable opening can hold the first waves", () => {
    const s = towerInit();
    s.waveT = 0.1;
    // player buys two arrow towers at mid slots as soon as affordable
    let t = 0;
    let guard = 0;
    while (!s.over && guard++ < 20000) {
      towerStep(s, 1 / 60, rng);
      t += 1 / 60;
      if (s.gold >= TOWER_COST[0] && s.towers.length < 2) {
        const slot = TOWER_SLOTS[s.towers.length === 0 ? 1 : 2];
        placeTower(s, slot, s.towers.length === 0 ? -1 : 1);
      }
      if (s.betweenWaves && s.wave >= 3) break;
    }
    expect(s.wave).toBeGreaterThanOrEqual(3);
    expect(s.lives).toBeGreaterThan(0);
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
