import { describe, it, expect } from "vitest";
import {
  JUMP_V,
  PLAYER_X,
  START_SPEED,
  genAhead,
  initState,
  jump,
  step,
  stepSeconds,
} from "../src/games/runner-sim";

const flat: { x: number; w: number; h: number }[] = [
  { x: -5, w: 200, h: 0 },
];

describe("runner sim", () => {
  it("player slides forward at increasing speed", () => {
    const s = initState();
    stepSeconds(s, 1, flat);
    const d1 = s.dist;
    stepSeconds(s, 1, flat);
    expect(s.dist).toBeGreaterThan(d1 + START_SPEED);
    expect(s.speed).toBeGreaterThan(START_SPEED);
  });

  it("jump only works when grounded and gives upward velocity", () => {
    const s = initState();
    jump(s);
    expect(s.vy).toBe(JUMP_V);
    expect(s.grounded).toBe(false);
    jump(s); // ignored mid-air
    expect(s.vy).toBe(JUMP_V);
  });

  it("gravity brings the jump back down to the platform", () => {
    const s = initState();
    jump(s);
    stepSeconds(s, 2, flat);
    expect(s.grounded).toBe(true);
    expect(s.y).toBe(0);
    expect(s.vy).toBe(0);
  });

  it("falls into a pit and dies below the kill line", () => {
    const s = initState();
    // platform ends at x=6; player at PLAYER_X=4 running right will fly off
    const plat = [{ x: -5, w: 10 - PLAYER_X, h: 0 }];
    stepSeconds(s, 3, plat);
    expect(s.over).toBe(true);
  });

  it("a well-timed jump clears a standard gap", () => {
    const s = initState();
    // first platform ends at x=8, next starts at x=11 (3-unit gap)
    const plats = [
      { x: -5, w: 13, h: 0 },
      { x: 11, w: 200, h: 0 },
    ];
    // jump when the edge is ~1.2 ahead
    let t = 0;
    while (t < 5 && !s.over) {
      const edgeDist = 8 - (s.dist + PLAYER_X);
      if (edgeDist < 0.6 && s.grounded) jump(s);
      step(s, 1 / 60, plats);
      t += 1 / 60;
    }
    expect(s.over).toBe(false);
    expect(s.dist + PLAYER_X).toBeGreaterThan(11);
  });

  it("lands on raised platforms", () => {
    const s = initState();
    s.y = 2.5;
    s.vy = 0;
    stepSeconds(s, 0.5, flat);
    expect(s.y).toBe(0);
    expect(s.grounded).toBe(true);
  });

  it("genAhead produces a continuous, jumpable strip", () => {
    const plats: { x: number; w: number; h: number }[] = [{ x: -5, w: 8, h: 0 }];
    let seed = 11;
    const rng = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    genAhead(plats, 400, rng);
    for (let i = 1; i < plats.length; i++) {
      const gap = plats[i].x - (plats[i - 1].x + plats[i - 1].w);
      expect(gap).toBeGreaterThan(2);
      expect(gap).toBeLessThan(4);
      expect(plats[i].w).toBeGreaterThanOrEqual(3.5);
      expect(plats[i].h).toBeLessThanOrEqual(3);
    }
    // deterministic
    const plats2: { x: number; w: number; h: number }[] = [{ x: -5, w: 8, h: 0 }];
    let seed2 = 11;
    const rng2 = () => {
      seed2 = (seed2 * 16807) % 2147483647;
      return seed2 / 2147483647;
    };
    genAhead(plats2, 400, rng2);
    expect(plats2).toEqual(plats);
  });

  it("the starting platform is never trimmed while the player is on it", () => {
    const plats = [{ x: -10, w: 18, h: 0 }];
    let seed = 9;
    const rng = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 600; i++) {
      genAhead(plats, i * 0.3 + 60, rng, i * 0.3 + PLAYER_X);
      // a platform must always cover the player position
      const px = i * 0.3 + PLAYER_X;
      const covered = plats.some((p) => px >= p.x && px <= p.x + p.w);
      if (i > 3 && px < 8) expect(covered).toBe(true);
    }
  });

  it("the sim is deterministic", () => {
    const run = () => {
      const s = initState();
      const plats = [{ x: -5, w: 200, h: 0 }];
      let t = 0;
      while (t < 3) {
        if (Math.floor(t * 2) % 2 === 0) jump(s);
        step(s, 1 / 60, plats);
        t += 1 / 60;
      }
      return { d: Math.round(s.dist * 100), y: Math.round(s.y * 100) };
    };
    expect(run()).toEqual(run());
  });
});
