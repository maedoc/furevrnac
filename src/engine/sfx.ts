let actx: AudioContext | null = null;

function ensure(): AudioContext | null {
  if (actx) return actx;
  try {
    actx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext)();
    return actx;
  } catch {
    return null;
  }
}

export function tone(
  freq: number,
  dur = 0.06,
  type: OscillatorType = "square",
  vol = 0.12,
  slideTo?: number,
): void {
  const ctx = ensure();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  if (slideTo !== undefined)
    osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
  gain.gain.setValueAtTime(vol, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + dur);
}

export const sfx = {
  tap: () => tone(660, 0.04, "square", 0.08),
  move: () => tone(440, 0.05, "square", 0.1),
  eat: () => tone(220, 0.09, "square", 0.14, 110),
  bounce: () => tone(520, 0.045, "square", 0.1),
  brick: () => tone(340, 0.05, "square", 0.1, 480),
  clear: () => {
    tone(523, 0.07);
    setTimeout(() => tone(659, 0.07), 70);
    setTimeout(() => tone(784, 0.1), 140);
  },
  score: () => tone(880, 0.12, "square", 0.12, 440),
  die: () => tone(200, 0.25, "sawtooth", 0.14, 60),
  flag: () => tone(880, 0.04, "triangle", 0.1),
  boom: () => {
    tone(120, 0.3, "sawtooth", 0.18, 40);
    tone(90, 0.35, "square", 0.12, 30);
  },
  check: () => {
    tone(740, 0.08, "square", 0.12);
    setTimeout(() => tone(740, 0.08, "square", 0.12), 110);
  },
  win: () => {
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => tone(f, 0.12), i * 110),
    );
  },
};
