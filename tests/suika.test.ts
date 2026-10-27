import { describe, it, expect } from "vitest";
import {
  DROP_CD,
  TIERS,
  canDrop,
  drop,
  initState,
  nextTier,
  step,
  stepSeconds,
} from "../src/games/suika-sim";

const bounds = { left: 0, right: 10, floor: 14 };

describe("suika sim", () => {
  it("drop adds a fruit at the aimed position and starts cooldown", () => {
    const s = initState();
    expect(drop(s, 0, 5, 2)).toBe(true);
    expect(s.fruits.length).toBe(1);
    expect(s.fruits[0].x).toBe(5);
    expect(canDrop(s)).toBe(false);
  });

  it("cooldown expires and allows the next drop", () => {
    const s = initState();
    drop(s, 0, 5, 2);
    stepSeconds(s, DROP_CD + 0.01, bounds);
    expect(canDrop(s)).toBe(true);
  });

  it("fruit falls and rests on the floor", () => {
    const s = initState();
    drop(s, 1, 5, 2);
    stepSeconds(s, 3, bounds);
    const f = s.fruits[0];
    expect(f.y + f.r).toBeCloseTo(bounds.floor, 0);
    expect(Math.abs(f.vy)).toBeLessThan(1);
  });

  it("two same-tier fruits merge into the next tier", () => {
    const s = initState();
    drop(s, 2, 4, 2);
    stepSeconds(s, DROP_CD + 0.1, bounds);
    drop(s, 2, 4.6, 2);
    stepSeconds(s, 2, bounds);
    expect(s.fruits.length).toBe(1);
    expect(s.fruits[0].tier).toBe(3);
    expect(s.score).toBe(TIERS[2].score);
  });

  it("different-tier fruits do not merge but collide", () => {
    const s = initState();
    drop(s, 0, 5, 2);
    stepSeconds(s, 3, bounds);
    const restY = s.fruits[0].y;
    drop(s, 3, 5, 1);
    stepSeconds(s, 3, bounds);
    expect(s.fruits.length).toBe(2);
    expect(s.fruits[0].tier).not.toBe(s.fruits[1].tier);
    expect(s.fruits.some((f) => f.y < restY)).toBe(true);
  });

  it("two watermelons vanish with a bonus", () => {
    const s = initState();
    s.fruits.push(
      { x: 4, y: 13, vx: 0, vy: 0, r: TIERS[7].r, tier: 7, dead: false, justMerged: false, age: 1 },
      { x: 6.5, y: 13, vx: 0, vy: 0, r: TIERS[7].r, tier: 7, dead: false, justMerged: false, age: 1 },
    );
    stepSeconds(s, 1, bounds);
    expect(s.fruits.length).toBe(0);
    expect(s.score).toBe(TIERS[7].score * 2);
  });

  it("chain merges: dropping onto a pair cascades", () => {
    const s = initState();
    s.fruits.push(
      { x: 4, y: 12.8, vx: 0, vy: 0, r: TIERS[1].r, tier: 1, dead: false, justMerged: false, age: 1 },
      { x: 5.7, y: 12.8, vx: 0, vy: 0, r: TIERS[1].r, tier: 1, dead: false, justMerged: false, age: 1 },
      { x: 6.9, y: 12.8, vx: 0, vy: 0, r: TIERS[0].r, tier: 0, dead: false, justMerged: false, age: 1 },
    );
    s.dropCd = 0;
    drop(s, 0, 6.1, 10);
    stepSeconds(s, 2, bounds);
    const tiers = s.fruits.map((f) => f.tier).sort();
    expect(tiers).toContain(2);
    expect(tiers).not.toContain(0);
  });

  it("fruits are contained by the walls", () => {
    const s = initState();
    drop(s, 4, 0.2, 2);
    stepSeconds(s, 2, bounds);
    expect(s.fruits[0].x - s.fruits[0].r).toBeGreaterThanOrEqual(bounds.left - 0.01);
  });

  it("stacking to the top ends the game", () => {
    const s = initState();
    // alternate two non-merging tiers at one spot: the stack must grow
    // until a fruit settles above the loss line
    let i = 0;
    while (!s.over && s.time < 120) {
      step(s, 1 / 60, bounds);
      if (canDrop(s)) {
        drop(s, i % 2 === 0 ? 3 : 4, 5, 1);
        i++;
      }
    }
    expect(s.over).toBe(true);
  });

  it("a freshly dropped fruit above the line does not end the game", () => {
    const s = initState();
    for (let i = 0; i < 3; i++) {
      stepSeconds(s, DROP_CD + 0.05, bounds);
      drop(s, 1, 2 + i * 3, 1.2);
      step(s, 1 / 60, bounds);
      expect(s.over).toBe(false);
    }
  });

  it("a quiet early game does not end prematurely", () => {
    const s = initState();
    drop(s, 1, 5, 2);
    stepSeconds(s, 4, bounds);
    expect(s.over).toBe(false);
  });

  it("nextTier only offers the first five tiers", () => {
    for (let i = 0; i < 20; i++) {
      const t = nextTier(() => 0.99999);
      expect(t).toBeLessThanOrEqual(4);
      expect(t).toBeGreaterThanOrEqual(0);
    }
  });

  it("the sim is deterministic", () => {
    const run = (): { score: number; n: number; y: number[] } => {
      const s = initState();
      let seed = 42;
      const rng = () => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return seed / 2147483648;
      };
      for (let i = 0; i < 240; i++) {
        step(s, 1 / 60, bounds);
        if (canDrop(s)) drop(s, nextTier(rng), 3 + rng() * 4, 2);
      }
      return {
        score: s.score,
        n: s.fruits.length,
        y: s.fruits.map((f) => Math.round(f.y * 100)),
      };
    };
    expect(run()).toEqual(run());
  });
});
