import type { Game, GameContext } from "./types";
import {
  PALETTE,
  inkRect,
  inkText,
  speechBubble,
  speedLines,
  hexWithAlpha,
} from "../engine/style";
import { sfx } from "../engine/sfx";
import {
  MAX_SPEED,
  PLAYER_SIZE,
  PLAYER_X,
  genAhead,
  initState,
  jump,
  step,
  type Platform,
  type RunnerState,
} from "./runner-sim";

const VIEW_W = 18;
const VIEW_H = 12;
const GROUND_LINE = 9; // world y of the pit bottom on screen

export class RunnerGame implements Game {
  readonly id = "runner";
  readonly name = "Ink Runner";
  readonly blurb = "Tap to jump. Don't stop, ninja.";
  readonly accent = "#d43d2a";

  private sim: RunnerState = initState();
  private platforms: Platform[] = [];
  private best = 0;
  private overT = 0;
  private scarf = 0;
  private lastGrounded = true;

  init(g: GameContext): void {
    this.sim = initState();
    this.platforms = [{ x: -10, w: 18, h: 0 }];
    genAhead(this.platforms, 60, Math.random);
    this.best = g.save.get("runner:best", 0);
    this.overT = 0;
    this.scarf = 0;
    this.lastGrounded = true;
  }

  private geo(g: GameContext): { scale: number; ox: number; oy: number } {
    const scale = Math.min(g.w / VIEW_W, g.h / (VIEW_H + 1));
    return {
      scale,
      ox: g.w * 0.18,
      oy: g.h * 0.16,
    };
  }

  update(dt: number, g: GameContext): void {
    const s = this.sim;
    const wasOver = s.over;

    for (const e of g.input.consumeEvents()) {
      if (e.type === "tap" || e.type === "longpress") {
        if (s.over) continue;
        if (jump(s)) {
          sfx.move();
          if (navigator.vibrate) navigator.vibrate(8);
        }
      }
    }

    genAhead(this.platforms, s.dist + 60, Math.random, s.dist + PLAYER_X);

    let t = 0;
    while (t < dt) {
      const stepDt = Math.min(1000 / 60, dt - t);
      step(s, stepDt / 1000, this.platforms);
      t += stepDt;
    }

    if (s.grounded && !this.lastGrounded) {
      sfx.bounce();
      if (navigator.vibrate) navigator.vibrate(6);
    }
    this.lastGrounded = s.grounded;
    this.scarf += dt * (0.01 + (s.speed / MAX_SPEED) * 0.02);

    if (s.over && !wasOver) {
      sfx.die();
      if (navigator.vibrate) navigator.vibrate(80);
      if (s.score > this.best) {
        this.best = s.score;
        g.save.set("runner:best", this.best);
      }
    }
    if (s.over) this.overT += dt;
  }

  render(g: GameContext): void {
    const { ctx, w, h } = g;
    const s = this.sim;
    const sv = Math.min(w, h);
    const { scale, ox, oy } = this.geo(g);
    const toScreenX = (wx: number): number => ox + (wx - s.dist) * scale;
    const toScreenY = (wy: number): number =>
      oy + (GROUND_LINE - wy) * scale;

    ctx.fillStyle = PALETTE.paper;
    ctx.fillRect(0, 0, w, h);

    if (s.speed > MAX_SPEED * 0.85)
      speedLines(ctx, w * 0.42, h * 0.3, sv * 0.28, sv * 0.5, 0.25, 16);

    // platforms
    for (const p of this.platforms) {
      const x1 = toScreenX(p.x);
      const x2 = toScreenX(p.x + p.w);
      if (x2 < -20 || x1 > w + 20) continue;
      const y = toScreenY(p.h);
      const depth = toScreenY(-GROUND_LINE) - y;
      inkRect(ctx, x1, y, x2 - x1, Math.max(depth, scale * 1.2), PALETTE.white, PALETTE.ink, 3.5);
    }

    // ninja cube
    const px = toScreenX(s.dist + PLAYER_X);
    const py = toScreenY(s.y + PLAYER_SIZE / 2);
    const size = PLAYER_SIZE * scale;
    inkRect(ctx, px - size / 2, py - size / 2, size, size, PALETTE.ink, PALETTE.ink, 3);
    // headband
    ctx.fillStyle = PALETTE.paper;
    ctx.fillRect(px - size / 2 + 2, py - size * 0.18, size - 4, 3);
    ctx.fillStyle = this.accent;
    ctx.fillRect(px - size / 2 + 2, py - size * 0.18, size * 0.45, 3);
    // eye
    ctx.fillStyle = PALETTE.paper;
    ctx.beginPath();
    ctx.arc(px + size * 0.12, py - size * 0.05, size * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.ink;
    ctx.beginPath();
    ctx.arc(px + size * 0.14, py - size * 0.05, size * 0.045, 0, Math.PI * 2);
    ctx.fill();
    // scarf trailing behind
    const scarfLen = size * (1.4 + (s.speed / MAX_SPEED) * 1.2);
    const wave = Math.sin(this.scarf) * size * 0.18;
    ctx.strokeStyle = this.accent;
    ctx.lineWidth = Math.max(2.5, size * 0.16);
    ctx.beginPath();
    ctx.moveTo(px - size * 0.45, py - size * 0.1);
    ctx.quadraticCurveTo(
      px - scarfLen * 0.55,
      py - size * 0.1 + wave,
      px - scarfLen,
      py - size * 0.16 - wave,
    );
    ctx.stroke();
    // sliding dust
    if (s.grounded) {
      ctx.fillStyle = "rgba(28,27,26,0.35)";
      for (let i = 0; i < 3; i++) {
        const dx = ((this.scarf * 400 + i * 53) % 17) / 17;
        ctx.beginPath();
        ctx.arc(
          px - size * 0.6 - dx * size * 1.4,
          py + size * 0.42 + wave * 0.4 * i,
          size * 0.07 * (1 - dx * 0.5),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }

    inkText(ctx, `${s.score}m`, w * 0.5, h * 0.055, sv * 0.05, PALETTE.ink, "900");
    inkText(ctx, `best ${this.best}m`, w * 0.5, h * 0.1, sv * 0.026, PALETTE.gray);

    if (s.over) {
      ctx.fillStyle = hexWithAlpha(PALETTE.paper, Math.min(0.85, this.overT / 400));
      ctx.fillRect(0, 0, w, h);
      if (this.overT > 400) {
        speedLines(ctx, w / 2, h / 2, sv * 0.25, Math.max(w, h) * 0.75, 0.5, 36);
        speechBubble(ctx, `The trail ends — ${s.score}m`, w / 2, h * 0.44, sv * 0.05);
        inkText(ctx, "tap to return", w / 2, h * 0.56, sv * 0.035, PALETTE.gray);
        if (this.overT > 800 && g.input.consumeEvents().length > 0) g.exit();
      }
    }
  }

  teardown(): void {}
}
