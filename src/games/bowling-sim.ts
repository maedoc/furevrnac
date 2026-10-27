export const LANE_W = 10;
export const LANE_LEN = 60;
export const PIN_R = 0.45;
export const BALL_R = 0.7;
const FRICTION_PER_S = 0.985; // fraction of speed lost per second
const PIN_FRICTION_PER_S = 0.6;
const DOWN_V = 1.2; // pin speed above which it topples
const WALL_BOUNCE = 0.4;
const NOISE = 0.022; // radians of scatter per unit force

export interface Ball {
  x: number;
  z: number;
  vx: number;
  vz: number;
  spin: number;
  moving: boolean;
}

export interface Pin {
  id: number;
  x: number;
  z: number;
  vx: number;
  vz: number;
  up: boolean;
  fallingT: number;
}

export type Phase =
  | "aim"
  | "rolling"
  | "settling"
  | "sweep"
  | "frameDone"
  | "gameOver";

export interface SimState {
  ball: Ball | null;
  pins: Pin[];
  phase: Phase;
  settleT: number;
  // scoring
  players: number;
  current: number; // player index
  frame: number; // 0-9
  roll: number; // roll within frame
  standingBefore: number;
  scores: number[][]; // rolls per frame per player: [player][frame] = [r1, r2, ...]
  gameOver: boolean;
}

const PIN_SPOTS: [number, number][] = [
  [0, 0],
  [-0.9, 0.9],
  [0.9, 0.9],
  [-1.8, 1.8],
  [0, 1.8],
  [1.8, 1.8],
  [-2.7, 2.7],
  [-0.9, 2.7],
  [0.9, 2.7],
  [2.7, 2.7],
];

export function rackPins(): Pin[] {
  const cx = LANE_W / 2;
  return PIN_SPOTS.map(([x, dz], i) => ({
    id: i,
    x: cx + x,
    z: LANE_LEN - 3 + dz,
    vx: 0,
    vz: 0,
    up: true,
    fallingT: 0,
  }));
}

export function initState(players: number): SimState {
  return {
    ball: null,
    pins: rackPins(),
    phase: "aim",
    settleT: 0,
    players,
    current: 0,
    frame: 0,
    roll: 0,
    standingBefore: 10,
    scores: Array.from({ length: players }, () =>
      Array.from({ length: 10 }, () => [] as number[]),
    ),
    gameOver: false,
  };
}

export interface Throw {
  x: number; // -1..1 across lane
  force: number; // 0..1
  hook: number; // -1..1 side curve (unused for now, mild spin)
}

/** Throw the ball; harder throws get more angular scatter (less accuracy). */
export function throwBall(s: SimState, t: Throw, rng: () => number): void {
  if (s.phase !== "aim") return;
  const force = Math.max(0.1, Math.min(1, t.force));
  const speed = 14 + force * 26;
  const scatter = (rng() * 2 - 1) * NOISE * force * 3;
  const angle = scatter + t.x * 0.08;
  s.ball = {
    x: (LANE_W / 2) + t.x * (LANE_W / 2 - BALL_R - 0.3),
    z: 2,
    vx: Math.sin(angle) * speed,
    vz: Math.cos(angle) * speed,
    spin: t.hook * force,
    moving: true,
  };
  s.phase = "rolling";
}

interface Body {
  x: number;
  z: number;
  vx: number;
  vz: number;
  r: number;
  m: number;
}

function collide(a: Body, b: Body): void {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const dist = Math.hypot(dx, dz) || 0.001;
  const minD = a.r + b.r;
  if (dist >= minD) return;
  const nx = dx / dist;
  const nz = dz / dist;
  const overlap = minD - dist;
  const totalM = a.m + b.m;
  a.x -= (nx * overlap * b.m) / totalM;
  a.z -= (nz * overlap * b.m) / totalM;
  b.x += (nx * overlap * a.m) / totalM;
  b.z += (nz * overlap * a.m) / totalM;
  const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
  if (rel >= 0) return;
  const imp = (-rel * 1.6) / totalM; // bouncy, arcade-tuned
  a.vx -= imp * nx * b.m;
  a.vz -= imp * nz * b.m;
  b.vx += imp * nx * a.m;
  b.vz += imp * nz * a.m;
}

export function step(s: SimState, dt: number): void {
  if (s.phase === "aim" || s.phase === "sweep" || s.phase === "frameDone" || s.phase === "gameOver")
    return;

  if (s.phase === "rolling" || s.phase === "settling") {
    const b = s.ball;
    if (b && b.moving) {
      b.vx += b.spin * 4 * dt * (b.vz / 30);
      const fr = Math.pow(FRICTION_PER_S, dt);
      b.vx *= fr;
      b.vz *= fr;
      b.x += b.vx * dt;
      b.z += b.vz * dt;
      if (b.x < BALL_R) {
        b.x = BALL_R;
        b.vx = Math.abs(b.vx) * WALL_BOUNCE;
      }
      if (b.x > LANE_W - BALL_R) {
        b.x = LANE_W - BALL_R;
        b.vx = -Math.abs(b.vx) * WALL_BOUNCE;
      }
      if (b.z > LANE_LEN + 4) b.z = LANE_LEN + 4;
      if (b.z >= LANE_LEN + 4 || Math.hypot(b.vx, b.vz) < 0.5) {
        b.moving = false;
        if (s.phase === "rolling") s.phase = "settling";
      }
    }

    // pins move
    for (const p of s.pins) {
      if (p.up && (Math.abs(p.vx) + Math.abs(p.vz)) > 0.001) {
        if (Math.hypot(p.vx, p.vz) > DOWN_V) {
          p.up = false;
          p.fallingT = 0;
        }
      }
      if (!p.up) {
        const pfr = Math.pow(PIN_FRICTION_PER_S, dt);
        p.vx *= pfr;
        p.vz *= pfr;
        p.x += p.vx * dt;
        p.z += p.vz * dt;
        p.fallingT += dt;
      }
      if (p.x < PIN_R) {
        p.x = PIN_R;
        p.vx = Math.abs(p.vx) * WALL_BOUNCE;
      }
      if (p.x > LANE_W - PIN_R) {
        p.x = LANE_W - PIN_R;
        p.vx = -Math.abs(p.vx) * WALL_BOUNCE;
      }
    }

    // collisions: ball vs pins, pins vs pins
    if (b && b.moving) {
      const ballBody: Body = {
        x: b.x, z: b.z, vx: b.vx, vz: b.vz, r: BALL_R, m: 6,
      };
      for (const p of s.pins) {
        if (!p.up && p.fallingT > 0.4) continue;
        const pinBody: Body = {
          x: p.x, z: p.z, vx: p.vx, vz: p.vz, r: PIN_R, m: 1,
        };
        collide(ballBody, pinBody);
        // write pin changes back
        p.x = pinBody.x;
        p.z = pinBody.z;
        p.vx = pinBody.vx;
        p.vz = pinBody.vz;
      }
      b.x = ballBody.x;
      b.z = ballBody.z;
      b.vx = ballBody.vx;
      b.vz = ballBody.vz;
    }
    for (let i = 0; i < s.pins.length; i++) {
      for (let j = i + 1; j < s.pins.length; j++) {
        const a = s.pins[i];
        const c = s.pins[j];
        if (!a.up && a.fallingT > 0.4 && !c.up && c.fallingT > 0.4) continue;
        const ab: Body = { x: a.x, z: a.z, vx: a.vx, vz: a.vz, r: PIN_R, m: 1 };
        const cb: Body = { x: c.x, z: c.z, vx: c.vx, vz: c.vz, r: PIN_R, m: 1 };
        collide(ab, cb);
        a.x = ab.x; a.z = ab.z; a.vx = ab.vx; a.vz = ab.vz;
        c.x = cb.x; c.z = cb.z; c.vx = cb.vx; c.vz = cb.vz;
      }
    }

    if (s.phase === "rolling" && b && !b.moving) s.phase = "settling";

    if (s.phase === "settling") {
      const still =
        (!b || !b.moving) &&
        s.pins.every(
          (p) =>
            !p.up ||
            Math.hypot(p.vx, p.vz) < 0.05,
        );
      s.settleT += dt;
      if ((still && s.settleT > 0.6) || s.settleT > 5) {
        s.settleT = 0;
        s.phase = "sweep";
        endRoll(s);
      }
    }
  }
}

export function stepSeconds(s: SimState, seconds: number): void {
  let t = 0;
  while (t < seconds) {
    step(s, Math.min(1 / 60, seconds - t));
    t += 1 / 60;
  }
}

export function standing(s: SimState): Pin[] {
  return s.pins.filter((p) => p.up);
}

/** Record the roll result and advance frame/roll/player state machine. */
function endRoll(s: SimState): void {
  const down = 10 - standing(s).length;
  const pinsThisRoll = down - (10 - s.standingBefore);
  s.scores[s.current][s.frame].push(Math.max(0, pinsThisRoll));

  const frameRolls = s.scores[s.current][s.frame];
  const framePins = frameRolls.reduce((a, b) => a + b, 0);

  let nextRoll = s.roll + 1;
  let clearPins = false;

  const isTenth = s.frame === 9;
  if (!isTenth) {
    if (frameRolls.length === 1 && framePins === 10) {
      // strike: frame done
      nextRoll = 0;
      clearPins = true;
    } else if (frameRolls.length === 2) {
      nextRoll = 0;
      clearPins = true;
    } else if (standing(s).length === 0) {
      // swept the rack mid-frame (all down on first ball impossible
      // unless strike) — safety
      nextRoll = 0;
      clearPins = true;
    }
  } else {
    // tenth frame: up to 3 rolls
    if (frameRolls.length === 1) {
      if (framePins === 10) clearPins = true; // strike, re-rack
    } else if (frameRolls.length === 2) {
      if (framePins >= 10) {
        // spare or double-strike: bonus ball
        clearPins = framePins === 20 || frameRolls[1] === 10 || framePins > 10;
        // if second ball was a strike after first strike, re-rack;
        // if spare, re-rack for bonus
        if (framePins >= 10) clearPins = true;
        nextRoll = 2;
      } else {
        // open frame after 2 balls: done
        s.gameOver = true;
        s.phase = "gameOver";
        return;
      }
    } else if (frameRolls.length === 3) {
      s.gameOver = true;
      s.phase = "gameOver";
      return;
    }
  }

  s.roll = nextRoll;
  if (clearPins) s.pins = rackPins();
  else {
    // remove fallen pins from play, keep standing ones in place
    s.pins = s.pins.filter((p) => p.up);
  }
  s.standingBefore = standing(s).length;
  s.ball = null;

  if (!isTenth && nextRoll === 0) {
    // advance player/frame
    if (s.current + 1 >= s.players) {
      s.current = 0;
      s.frame++;
      if (s.frame >= 10) {
        s.gameOver = true;
        s.phase = "gameOver";
        return;
      }
    } else {
      s.current++;
    }
    // for 2P: restore this player's frame state handled by scores[][]
  } else if (isTenth && nextRoll === 0) {
    // handled above (gameOver paths)
  }
  s.phase = "aim";
}

/** Classic bowling score per player up to the current point. */
export function score(frames: number[][]): number {
  let total = 0;
  for (let f = 0; f < 10; f++) {
    const r = frames[f];
    if (r.length === 0) break;
    if (f < 9) {
      if (r[0] === 10) {
        // strike: 10 + next two rolls
        const next = nextRolls(frames, f + 1, 0, 2);
        if (next.length < 2) break;
        total += 10 + next[0] + next[1];
      } else if (r.length >= 2) {
        if (r[0] + r[1] === 10) {
          const next = nextRolls(frames, f + 1, 0, 1);
          if (next.length < 1) break;
          total += 10 + next[0];
        } else {
          total += r[0] + r[1];
        }
      } else break;
    } else {
      total += r.reduce((a, b) => a + b, 0);
    }
  }
  return total;
}

function nextRolls(
  frames: number[][],
  fromFrame: number,
  fromRoll: number,
  count: number,
): number[] {
  const out: number[] = [];
  for (let f = fromFrame; f < 10 && out.length < count; f++) {
    const r = frames[f] ?? [];
    for (let i = fromRoll; i < r.length && out.length < count; i++)
      out.push(r[i]);
    fromRoll = 0;
  }
  return out;
}
