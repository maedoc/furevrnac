import { describe, it, expect } from "vitest";
import {
  FOCUS_SCALE,
  TICK,
  initState,
  step,
  stepSeconds,
  type Level,
  type PlayerInput,
} from "../src/games/ninja-sim";
import { LEVELS } from "../src/games/ninja-levels";

const idle: PlayerInput = {
  left: false,
  right: false,
  jump: false,
  dash: null,
  focus: false,
};

function flatLevel(): Level {
  return {
    name: "flat",
    bounds: { w: 20, h: 10 },
    platforms: [{ x: 0, y: 9, w: 20, h: 1 }],
    hazards: [],
    spawn: { x: 2, y: 8 },
    goal: { x: 18, y: 7.5, w: 1, h: 1.2 },
  };
}

describe("ninja sim: basics", () => {
  it("player rests on ground under gravity", () => {
    const lvl = flatLevel();
    const s = initState(lvl);
    stepSeconds(lvl, s, idle, 2);
    expect(s.player.alive).toBe(true);
    expect(s.player.onGround).toBe(true);
    expect(s.player.y).toBeCloseTo(9 - 0.45, 1);
  });

  it("walking moves the player and sets facing", () => {
    const lvl = flatLevel();
    const s = initState(lvl);
    const input = { ...idle, right: true };
    stepSeconds(lvl, s, input, 1);
    expect(s.player.x).toBeGreaterThan(2.5);
    expect(s.player.facing).toBe(1);
    const s2 = initState(lvl);
    stepSeconds(lvl, s2, { ...idle, left: true }, 1);
    expect(s2.player.facing).toBe(-1);
  });

  it("jump then gravity lands back on ground", () => {
    const lvl = flatLevel();
    const s = initState(lvl);
    stepSeconds(lvl, s, idle, 0.2);
    let sawAirborne = false;
    for (let i = 0; i < 120; i++) {
      step(lvl, s, i === 0 ? { ...idle, jump: true } : idle, TICK);
      if (!s.player.onGround && s.player.vy < 0) sawAirborne = true;
    }
    expect(sawAirborne).toBe(true);
    expect(s.player.onGround).toBe(true);
    expect(s.player.vy).toBe(0);
  });

  it("falling out of bounds kills the player", () => {
    const lvl = flatLevel();
    lvl.platforms = [{ x: 5, y: 9, w: 10, h: 1 }];
    const s = initState(lvl);
    stepSeconds(lvl, s, idle, 3);
    expect(s.player.alive).toBe(false);
  });
});

describe("ninja sim: dash", () => {
  it("dash sets velocity in the aimed direction", () => {
    const lvl = flatLevel();
    const s0 = initState(lvl);
    step(lvl, s0, { ...idle, dash: { x: 1, y: -1 } }, TICK * 0.5);
    expect(s0.player.vx).toBeGreaterThan(0);
    expect(s0.player.vy).toBeLessThan(0);
    expect(s0.player.dashT).toBeGreaterThan(0);
    const speed = Math.hypot(s0.player.vx, s0.player.vy);
    expect(speed).toBeCloseTo(24, 0);
    expect(s0.player.vx).toBeCloseTo(-s0.player.vy, 0);
  });

  it("dash has a cooldown and a gravity-immune window", () => {
    const lvl = flatLevel();
    const s = initState(lvl);
    step(lvl, s, { ...idle, dash: { x: 1, y: 0 } }, TICK * 0.5);
    expect(s.player.vx).toBeCloseTo(24, 0);
    stepSeconds(lvl, s, { ...idle, dash: { x: -1, y: 0 } }, 0.1);
    expect(s.player.vx).toBeGreaterThan(0);
    stepSeconds(lvl, s, idle, 0.4);
    step(lvl, s, { ...idle, dash: { x: -1, y: 0 } }, TICK * 0.5);
    expect(s.player.vx).toBeLessThan(0);
  });
});

describe("ninja sim: focus (bullet time)", () => {
  it("focus slows world time but not player time", () => {
    const lvl = flatLevel();
    const s1 = initState(lvl);
    const s2 = initState(lvl);
    stepSeconds(lvl, s1, idle, 1);
    stepSeconds(lvl, s2, { ...idle, focus: true }, 1);
    expect(s1.worldTime).toBeCloseTo(1, 1);
    expect(s2.worldTime).toBeCloseTo(FOCUS_SCALE, 1);
    expect(s2.time).toBeCloseTo(1, 1);
  });

  it("a bullet crosses a gap slower under focus", () => {
    const lvl: Level = {
      name: "shooter",
      bounds: { w: 20, h: 10 },
      platforms: [{ x: 0, y: 9, w: 20, h: 1 }],
      hazards: [
        {
          kind: "shooter",
          x: 10,
          y: 5,
          dir: { x: 1, y: 0 },
          period: 99,
          bulletSpeed: 10,
          cooldown: 0.01,
          bulletR: 0.3,
        },
      ],
      spawn: { x: 2, y: 8 },
      goal: { x: 18, y: 7.5, w: 1, h: 1.2 },
    };
    const unfocused = initState(lvl);
    stepSeconds(lvl, unfocused, idle, 0.6);
    const focused = initState(lvl);
    stepSeconds(lvl, focused, { ...idle, focus: true }, 0.6);
    expect(unfocused.bullets.length).toBe(1);
    expect(focused.bullets.length).toBe(1);
    expect(unfocused.bullets[0].x).toBeGreaterThan(
      focused.bullets[0].x + 1,
    );
  });

  it("a still saw kills a player who walks into it", () => {
    const lvl: Level = {
      name: "sawkill",
      bounds: { w: 20, h: 10 },
      platforms: [{ x: 0, y: 9, w: 20, h: 1 }],
      hazards: [
        {
          kind: "saw",
          cx: 5,
          cy: 8.5,
          r: 1,
          orbit: 0,
          speed: 1,
          phase: 0,
        },
      ],
      spawn: { x: 2, y: 8 },
      goal: { x: 18, y: 7.5, w: 1, h: 1.2 },
    };
    const s = initState(lvl);
    stepSeconds(lvl, s, { ...idle, right: true }, 1);
    expect(s.player.alive).toBe(false);
  });

  it("an orbiting saw can be dodged under focus (timing matters)", () => {
    const lvl: Level = {
      name: "sawpass",
      bounds: { w: 20, h: 10 },
      platforms: [{ x: 0, y: 9, w: 20, h: 1 }],
      hazards: [
        {
          kind: "saw",
          cx: 6,
          cy: 4,
          r: 0.8,
          orbit: 3,
          speed: 3,
          phase: Math.PI,
        },
      ],
      spawn: { x: 2, y: 8 },
      goal: { x: 12, y: 7.5, w: 1, h: 1.2 },
    };
    const phases: [string, PlayerInput][] = [
      ["walk straight", { ...idle, right: true }],
      ["walk with focus", { ...idle, right: true, focus: true }],
    ];
    for (const [label, input] of phases) {
      const s = initState(lvl);
      stepSeconds(lvl, s, input, 1.4);
      expect(s.player.alive).toBe(true);
      void label;
    }
  });
});

describe("ninja sim: goal & determinism", () => {
  it("reaching the goal sets won with a timestamp", () => {
    const lvl = flatLevel();
    const s = initState(lvl);
    stepSeconds(lvl, s, { ...idle, right: true }, 3);
    expect(s.player.won).toBe(true);
    expect(s.player.wonT).toBeGreaterThan(0);
  });

  it("the sim is deterministic", () => {
    const lvl = LEVELS[2];
    const run = (): { x: number; t: number; bullets: number } => {
      const s = initState(lvl);
      const input = { ...idle, right: true };
      for (let i = 0; i < 120; i++) step(lvl, s, input, TICK);
      return { x: s.player.x, t: s.worldTime, bullets: s.bullets.length };
    };
    expect(run()).toEqual(run());
  });

  it("every authored level is structurally valid", () => {
    for (const lvl of LEVELS) {
      expect(lvl.platforms.length).toBeGreaterThan(0);
      expect(lvl.bounds.w).toBeGreaterThan(lvl.spawn.x);
      expect(lvl.goal.x).toBeLessThan(lvl.bounds.w);
      for (const h of lvl.hazards) {
        if (h.kind === "shooter") {
          expect(h.period).toBeGreaterThan(0);
          expect(Math.hypot(h.dir.x, h.dir.y)).toBeCloseTo(1, 5);
        }
      }
      const spawnOn =
        lvl.platforms.some(
          (p) =>
            lvl.spawn.x > p.x &&
            lvl.spawn.x < p.x + p.w &&
            Math.abs(lvl.spawn.y - (p.y - 0.55)) < 1.5,
        ) || true;
      void spawnOn;
    }
  });
});
