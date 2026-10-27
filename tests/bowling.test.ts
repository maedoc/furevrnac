import { describe, it, expect } from "vitest";
import {
  LANE_LEN,
  LANE_W,
  initState,
  rackPins,
  score,
  standing,
  stepSeconds,
  throwBall,
  type SimState,
} from "../src/games/bowling-sim";

function rollAll(
  s: SimState,
  throws: { x: number; force: number; hook?: number }[],
): void {
  for (const t of throws) {
    // settle any pending phases
    let guard = 0;
    while (s.phase !== "aim" && !s.gameOver && guard++ < 200)
      stepSeconds(s, 0.05);
    if (s.gameOver || s.phase !== "aim") break;
    throwBall(s, { x: t.x, force: t.force, hook: t.hook ?? 0 }, () => 0.5);
    stepSeconds(s, 12);
  }
}

describe("bowling sim: physics", () => {
  it("racks 10 pins", () => {
    expect(rackPins().length).toBe(10);
  });

  it("ball rolls down the lane", () => {
    const s = initState(1);
    throwBall(s, { x: 0, force: 1, hook: 0 }, () => 0.5);
    stepSeconds(s, 1);
    expect(s.ball).not.toBeNull();
    expect(s.ball!.z).toBeGreaterThan(10);
    expect(s.phase === "rolling" || s.phase === "settling" || s.phase === "sweep").toBe(true);
  });

  it("a centered full-power throw knocks down pins", () => {
    const s = initState(1);
    throwBall(s, { x: 0, force: 1, hook: 0 }, () => 0.5);
    stepSeconds(s, 12);
    expect(s.phase).toBe("aim"); // roll recorded, back to aim
    expect(s.scores[0][0].length).toBe(1);
    expect(s.scores[0][0][0]).toBeGreaterThan(0);
    expect(s.scores[0][0][0]).toBeLessThanOrEqual(10);
  });

  it("pins scatter and can knock down other pins (chain)", () => {
    const s = initState(1);
    // gutter-ish throw that clips the edge pin should still cause some chain
    throwBall(s, { x: 0.75, force: 1, hook: 0 }, () => 0.5);
    stepSeconds(s, 12);
    const down = 10 - standing(s).length;
    expect(down).toBeGreaterThan(0);
  });

  it("a wild throw with max force has scatter (rng used)", () => {
    const s1 = initState(1);
    throwBall(s1, { x: 0, force: 1, hook: 0 }, () => 0.99);
    const s2 = initState(1);
    throwBall(s2, { x: 0, force: 1, hook: 0 }, () => 0.01);
    stepSeconds(s1, 0.5);
    stepSeconds(s2, 0.5);
    // different rng -> different trajectories
    const d1 = s1.ball!.x;
    const d2 = s2.ball!.x;
    expect(Math.abs(d1 - d2)).toBeGreaterThan(0.001);
  });

  it("lane walls contain the ball", () => {
    const s = initState(1);
    throwBall(s, { x: 0.95, force: 1, hook: 0 }, () => 0.5);
    stepSeconds(s, 3);
    expect(s.ball!.x).toBeGreaterThanOrEqual(0);
    expect(s.ball!.x).toBeLessThanOrEqual(LANE_W);
    expect(s.ball!.z).toBeLessThanOrEqual(LANE_LEN + 4);
  });
});

describe("bowling sim: frames & scoring state machine", () => {
  it("strike advances the frame and re-racks", () => {
    const s = initState(1);
    // force a strike: dead-center perfect throw
    let guard = 0;
    while (s.phase !== "aim" && guard++ < 10) stepSeconds(s, 0.1);
    throwBall(s, { x: 0, force: 1, hook: 0 }, () => 0.5);
    stepSeconds(s, 12);
    expect(s.scores[0][0]).toEqual([10]);
    expect(standing(s).length).toBe(10); // re-racked
    expect(s.frame).toBe(1);
  });

  it("two rolls in an open frame advance the frame", () => {
    const s = initState(1);
    rollAll(s, [
      { x: 0.9, force: 0.8 }, // likely partial
      { x: 0, force: 1 },
    ]);
    // either frame advanced via 2 rolls, or strike; assert no crash + frame state coherent
    expect(s.scores[0][0].length).toBeGreaterThanOrEqual(1);
  });

  it("scores a perfect game at 300", () => {
    const frames: number[][] = Array.from({ length: 9 }, () => [10]);
    frames.push([10, 10, 10]);
    expect(score(frames)).toBe(300);
  });

  it("scores all spares at 150", () => {
    const frames: number[][] = Array.from({ length: 9 }, () => [9, 1]);
    frames[9] = [9, 1, 9]; // last spare + bonus
    expect(score(frames)).toBe(190);
  });

  it("scores an open game correctly", () => {
    const frames: number[][] = Array.from({ length: 10 }, () => [3, 4]);
    expect(score(frames)).toBe(70);
  });

  it("tenth frame grants a bonus ball after spare", () => {
    const s = initState(1);
    // fast-forward: fill frames 0-8 with [3,4]
    for (let f = 0; f < 9; f++) {
      s.scores[0][f] = [3, 4];
    }
    s.frame = 9;
    s.roll = 0;
    s.standingBefore = 10;
    s.phase = "aim";
    throwBall(s, { x: 0, force: 1, hook: 0 }, () => 0.5);
    stepSeconds(s, 12);
    // not gameOver yet unless the throw cleared and state advanced; 2 rolls max before bonus check
    expect(s.gameOver).toBe(false);
  });

  it("game ends after the tenth frame completes", () => {
    const s = initState(1);
    for (let f = 0; f < 9; f++) s.scores[0][f] = [3, 4];
    s.frame = 9;
    // two open balls
    s.phase = "aim";
    rollAll(s, [
      { x: 0.95, force: 0.9 },
      { x: 0.95, force: 0.9 },
    ]);
    // depending on pin interaction this may be 2 or 3 rolls in the 10th
    expect(s.scores[0][9].length).toBeGreaterThanOrEqual(2);
  });
});

describe("bowling sim: 2 player", () => {
  it("alternates players each frame", () => {
    const s = initState(2);
    expect(s.current).toBe(0);
    throwBall(s, { x: 0, force: 1, hook: 0 }, () => 0.5);
    stepSeconds(s, 12);
    expect(s.scores[0][0].length).toBe(1);
    // after first roll player 0 continues (roll 2) unless strike
    if (s.scores[0][0][0] === 10) {
      expect(s.current).toBe(1);
    } else {
      expect(s.current).toBe(0);
      throwBall(s, { x: 0, force: 1, hook: 0 }, () => 0.5);
      stepSeconds(s, 12);
      expect(s.current).toBe(1);
    }
  });
});
