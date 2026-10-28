import { describe, it, expect } from "vitest";
import {
  ACCEL,
  BALL_R,
  LEVELS,
  ballAt,
  step,
  stepSeconds,
} from "../src/games/maze-sim";

describe("maze sim", () => {
  it("levels are structurally sound", () => {
    for (const lvl of LEVELS) {
      expect(lvl.start.x).toBeGreaterThanOrEqual(0);
      expect(lvl.start.y).toBeGreaterThanOrEqual(0);
      expect(lvl.goal.x).toBeLessThan(lvl.cols);
      expect(lvl.goal.y).toBeLessThan(lvl.rows);
      expect(lvl.walls.length).toBeGreaterThan(0);
      for (const h of lvl.holes) {
        expect(h.r).toBeGreaterThan(BALL_R * 0.5);
      }
    }
  });

  it("the ball rests without tilt and stays in bounds", () => {
    const lvl = LEVELS[0];
    const s = ballAt(lvl.start.x, lvl.start.y, lvl);
    stepSeconds(s, 2, lvl);
    expect(s.over).toBe(false);
    expect(s.won).toBe(false);
    expect(s.x).toBeGreaterThanOrEqual(BALL_R - 0.01);
    expect(s.x).toBeLessThanOrEqual(lvl.cols - BALL_R + 0.01);
  });

  it("tilt accelerates the ball in the tilt direction", () => {
    const lvl = LEVELS[0];
    const s = ballAt(lvl.start.x, lvl.start.y, lvl);
    s.tilt = { x: 1, y: 0 };
    stepSeconds(s, 0.5, lvl);
    expect(s.x).toBeGreaterThan(1.5);
    expect(s.vx).toBeGreaterThan(0);
  });

  it("walls stop the ball (level 1 top wall)", () => {
    const lvl = LEVELS[0];
    // start above the wall y=2 x=2..8, tilt down into it
    const s = ballAt(5, 1, lvl);
    s.tilt = { x: 0, y: 1 };
    stepSeconds(s, 2, lvl);
    // ball cannot pass below y=2 - 0.3 - eps
    expect(s.y).toBeLessThan(2.35);
    expect(s.vy).toBeLessThanOrEqual(1);
  });

  it("falling in a hole ends the attempt", () => {
    const lvl = LEVELS[0];
    // the hole sits at (6.5, 2.5); start just left of it and roll right
    const s = ballAt(6, 2, lvl);
    s.tilt = { x: 0.7, y: 0.4 };
    stepSeconds(s, 2, lvl);
    expect(s.over).toBe(true);
    expect(s.falls).toBe(1);
  });

  it("reaching the goal wins with a time", () => {
    const lvl = LEVELS[0];
    const s = ballAt(lvl.goal.x, lvl.goal.y, lvl);
    stepSeconds(s, 1, lvl);
    expect(s.won).toBe(true);
    expect(s.wonT).toBeGreaterThan(0);
  });

  it("level 1 is solvable via its intended route (solvability)", () => {
    const lvl = LEVELS[0];
    // route: right along y<2 gap is blocked; go down left side to y 2-5,
    // right through the y=5..7 corridor, then down to the goal
    const s = ballAt(lvl.start.x, lvl.start.y, lvl);
    let guard = 0;
    while (!s.over && !s.won && guard++ < 3000) {
      let tx = 0;
      let ty = 0;
      if (s.y < 3.8) {
        // descend the left side (gap in wall y=2 is at x<2)
        ty = 1;
        tx = Math.max(-1, Math.min(1, (1.0 - s.x) * 1.2));
      } else if (s.x < 4.2) {
        // cross right through the corridor between walls y=5 and y=7
        tx = 1;
        const mid = 6;
        ty = Math.max(-1, Math.min(1, (mid - s.y) * 1.5));
      } else if (s.y < 7.2) {
        // cross further right, past x=7, above the wall end
        tx = 1;
        ty = Math.max(-1, Math.min(1, (6 - s.y) * 1.5));
        if (s.x > 7.2) {
          // drop through the gap
          tx = 0.2;
          ty = 1;
        }
      } else {
        // below the wall: head to the goal
        const dx = lvl.goal.x + 0.5 - s.x;
        const dy = lvl.goal.y + 0.5 - s.y;
        tx = Math.sign(dx) * Math.min(1, Math.abs(dx));
        ty = Math.sign(dy) * Math.min(1, Math.abs(dy));
      }
      const len = Math.hypot(tx, ty) || 1;
      s.tilt = { x: tx / len, y: ty / len };
      step(s, 1 / 60, lvl);
    }
    expect(s.won).toBe(true);
  });

  it("the sim is deterministic", () => {
    const run = () => {
      const lvl = LEVELS[1];
      const s = ballAt(lvl.start.x, lvl.start.y, lvl);
      for (let i = 0; i < 600; i++) {
        s.tilt = {
          x: Math.sin(i / 20),
          y: Math.cos(i / 30),
        };
        step(s, 1 / 60, lvl);
      }
      return {
        x: Math.round(s.x * 100),
        y: Math.round(s.y * 100),
        t: Math.round(s.time * 100),
      };
    };
    expect(run()).toEqual(run());
  });

  it("full tilt is faster than gentle tilt (accel applies)", () => {
    const lvl = LEVELS[0];
    const a = ballAt(lvl.start.x, lvl.start.y, lvl);
    a.tilt = { x: 1, y: 0 };
    step(a, 0.5, lvl);
    const b = ballAt(lvl.start.x, lvl.start.y, lvl);
    b.tilt = { x: 0.3, y: 0 };
    step(b, 0.5, lvl);
    expect(a.vx).toBeGreaterThan(b.vx);
    expect(ACCEL).toBeGreaterThan(10);
  });
});
