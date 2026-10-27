import { describe, it, expect } from "vitest";
import {
  GAP_H,
  flap,
  initState,
  step,
  stepSeconds,
} from "../src/games/flappy-sim";
import {
  ROUND_TIME,
  initState as whackInit,
  step as whackStep,
  stepSeconds as whackStepSeconds,
  whack,
} from "../src/games/whack-sim";

const rng = () => 0.5;

describe("flappy sim", () => {
  it("does nothing until first flap", () => {
    const s = initState(10);
    stepSeconds(s, 2, 20, rng);
    expect(s.started).toBe(false);
    expect(s.bird.y).toBe(10);
    expect(s.pipes.length).toBe(0);
  });

  it("flap sets upward velocity and starts the game", () => {
    const s = initState(10);
    flap(s);
    expect(s.started).toBe(true);
    expect(s.bird.vy).toBeLessThan(0);
  });

  it("gravity pulls the bird down without flapping", () => {
    const s = initState(10);
    flap(s);
    s.bird.vy = 0;
    stepSeconds(s, 0.5, 20, rng);
    expect(s.bird.vy).toBeGreaterThan(5);
    expect(s.bird.y).toBeGreaterThan(10);
  });

  it("pipes spawn and scroll toward the player", () => {
    const s = initState(10);
    flap(s);
    const H = 20;
    const autopilot = (secs: number): void => {
      let t = 0;
      while (t < secs && !s.over) {
        const next = s.pipes.find((p) => p.x + 1.2 > 4);
        const target = next ? next.gapY + GAP_H / 2 : H / 2;
        if (s.bird.y > target + 0.4 && s.bird.vy > 0) flap(s);
        step(s, 1 / 60, H, rng);
        t += 1 / 60;
      }
    };
    autopilot(4);
    expect(s.over).toBe(false);
    expect(s.pipes.length).toBeGreaterThan(0);
    const first = s.pipes[0];
    const firstX = first.x;
    autopilot(0.5);
    expect(s.pipes[0].x).toBeLessThan(firstX);
  });

  it("score increments once per pipe passed", () => {
    const s = initState(10);
    flap(s);
    const H = 20;
    let t = 0;
    while (t < 6 && !s.over) {
      const next = s.pipes.find((p) => p.x + 1.2 > 4);
      const target = next ? next.gapY + GAP_H / 2 : H / 2;
      if (s.bird.y > target + 0.4 && s.bird.vy > 0) flap(s);
      step(s, 1 / 60, H, rng);
      t += 1 / 60;
    }
    expect(s.over).toBe(false);
    expect(s.score).toBeGreaterThanOrEqual(2);
    expect(s.pipes.every((p) => p.scored === (p.x + 1.2 < 4))).toBe(true);
  });

  it("hitting the ground ends the run", () => {
    const s = initState(18);
    flap(s);
    stepSeconds(s, 3, 20, rng);
    expect(s.over).toBe(true);
    expect(s.bird.alive).toBe(false);
  });

  it("gap size allows passage with well-timed flaps", () => {
    const s = initState(10);
    flap(s);
    expect(GAP_H).toBeGreaterThan(4);
  });

  it("the sim is deterministic", () => {
    const run = (): { d: number; y: number; sc: number } => {
      const s = initState(10);
      let t = 0;
      let seed = 7;
      const r = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
      };
      while (t < 6 && !s.over) {
        if (s.bird.vy > 2) flap(s);
        step(s, 1 / 60, 20, r);
        t += 1 / 60;
      }
      return { d: Math.round(s.dist * 100), y: Math.round(s.bird.y * 100), sc: s.score };
    };
    expect(run()).toEqual(run());
  });
});

describe("whack sim", () => {
  it("moles pop up over time", () => {
    const s = whackInit(9);
    whackStepSeconds(s, 3, () => 0.5);
    expect(s.moles.filter((m) => m.up).length).toBeGreaterThan(0);
  });

  it("whacking an up mole scores; empty holes do nothing", () => {
    const s = whackInit(9);
    whackStepSeconds(s, 3, () => 0.5);
    const upIdx = s.moles.findIndex((m) => m.up);
    expect(whack(s, upIdx)).toBe(true);
    expect(s.score).toBe(1);
    expect(whack(s, (upIdx + 1) % 9)).toBe(false);
    expect(s.score).toBe(1);
  });

  it("missing an up mole counts as a miss", () => {
    const s = whackInit(9);
    s.moles[0].up = true;
    s.moles[0].state = "up";
    s.moles[0].upT = 0.01;
    whackStep(s, 0.1, () => 0.5);
    expect(s.misses).toBe(1);
  });

  it("round ends after ROUND_TIME", () => {
    const s = whackInit(9);
    whackStepSeconds(s, ROUND_TIME + 1, () => 0.5);
    expect(s.over).toBe(true);
  });

  it("spawn rate accelerates over the round", () => {
    const s = whackInit(9);
    const early = s.rate;
    whackStepSeconds(s, 10, () => 0.5);
    expect(s.rate).toBeGreaterThan(early);
  });

  it("bonked moles recover to down", () => {
    const s = whackInit(9);
    s.moles[0].up = true;
    s.moles[0].state = "up";
    s.moles[0].upT = 5;
    whack(s, 0);
    expect(s.moles[0].state).toBe("bonked");
    whackStepSeconds(s, 0.4, () => 0.5);
    expect(s.moles[0].state).toBe("down");
  });

  it("deterministic with a fixed rng", () => {
    const run = (): { sc: number; miss: number } => {
      const s = whackInit(9);
      let seed = 3;
      const r = () => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
      };
      let t = 0;
      while (!s.over && t < 20) {
        whackStep(s, 1 / 60, r);
        const up = s.moles.findIndex((m) => m.up && m.state === "up");
        if (up >= 0 && r() < 0.5) whack(s, up);
        t += 1 / 60;
      }
      return { sc: s.score, miss: s.misses };
    };
    expect(run()).toEqual(run());
  });
});
