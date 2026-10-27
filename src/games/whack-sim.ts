export interface Mole {
  upT: number;
  up: boolean;
  state: "up" | "down" | "bonked";
  bonkT: number;
}

export interface SimState {
  moles: Mole[];
  score: number;
  misses: number;
  time: number;
  spawnT: number;
  rate: number;
  upDur: number;
  over: boolean;
}

export const ROUND_TIME = 30;
export const START_RATE = 1.1;

export function initState(n: number): SimState {
  return {
    moles: Array.from({ length: n }, () => ({
      upT: 0,
      up: false,
      state: "down" as const,
      bonkT: 0,
    })),
    score: 0,
    misses: 0,
    time: 0,
    spawnT: 0.5,
    rate: START_RATE,
    upDur: 1.4,
    over: false,
  };
}

export function whack(s: SimState, idx: number): boolean {
  const m = s.moles[idx];
  if (!m || !m.up || m.state === "bonked") return false;
  m.state = "bonked";
  m.bonkT = 0.25;
  s.score++;
  return true;
}

export function step(s: SimState, dt: number, rng: () => number): void {
  if (s.over) return;
  s.time += dt;
  if (s.time >= ROUND_TIME) {
    s.over = true;
    s.moles.forEach((m) => {
      m.up = false;
      m.state = "down";
    });
    return;
  }

  s.rate = START_RATE + s.time * 0.02;
  s.upDur = Math.max(0.7, 1.4 - s.time * 0.015);

  s.spawnT -= dt;
  if (s.spawnT <= 0) {
    s.spawnT = s.rate * (0.6 + rng() * 0.6);
    const down = s.moles
      .map((m, i) => ({ m, i }))
      .filter(({ m }) => !m.up && m.state !== "bonked");
    if (down.length > 0) {
      const pick = down[Math.floor(rng() * down.length)];
      pick.m.up = true;
      pick.m.state = "up";
      pick.m.upT = s.upDur;
    }
  }

  for (const m of s.moles) {
    if (m.state === "bonked") {
      m.bonkT -= dt;
      if (m.bonkT <= 0) m.state = "down";
    } else if (m.up) {
      m.upT -= dt;
      if (m.upT <= 0) {
        m.up = false;
        m.state = "down";
        s.misses++;
      }
    }
  }
}

export function stepSeconds(
  s: SimState,
  seconds: number,
  rng: () => number,
): void {
  let t = 0;
  while (t < seconds) {
    step(s, Math.min(1 / 60, seconds - t), rng);
    t += 1 / 60;
    if (s.over) break;
  }
}
