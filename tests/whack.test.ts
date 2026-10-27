import { describe, it, expect } from "vitest";
import {
  ROUND_TIME,
  initState as whackInit,
  step as whackStep,
  stepSeconds as whackStepSeconds,
  whack,
} from "../src/games/whack-sim";

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
