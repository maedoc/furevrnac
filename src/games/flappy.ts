import type { Game, GameContext } from "./types";
import {
  PALETTE,
  inkRect,
  inkText,
  speechBubble,
  speedLines,
} from "../engine/style";
import { sfx } from "../engine/sfx";
import {
  GAP_H,
  PIPE_W,
  flap,
  initState,
  step,
  type SimState,
} from "./flappy-sim";

const WORLD_H = 20;
const BIRD_X = 4;
const VIEW_W = 18;

export class FlappyGame implements Game {
  readonly id = "flappy";
  readonly name = "Ink Wings";
  readonly blurb = "Tap to flap. Thread the brush strokes.";
  readonly accent = "#d43d2a";

  private sim: SimState = initState(WORLD_H / 2);
  private best = 0;
  private flapAnim = 0;
  private overT = 0;

  init(g: GameContext): void {
    this.sim = initState(WORLD_H / 2);
    this.best = g.save.get("flappy:best", 0);
    this.flapAnim = 0;
    this.overT = 0;
  }

  private geo(g: GameContext): { scale: number; ox: number; oy: number } {
    const scale = Math.min(g.w / VIEW_W, g.h / WORLD_H);
    return {
      scale,
      ox: (g.w - VIEW_W * scale) / 2,
      oy: (g.h - WORLD_H * scale) / 2,
    };
  }

  update(dt: number, g: GameContext): void {
    const s = this.sim;
    const wasOver = s.over;
    const prevScore = s.score;

    for (const e of g.input.consumeEvents()) {
      if (e.type === "tap" || e.type === "longpress") {
        if (s.over) continue;
        flap(s);
        this.flapAnim = 180;
        sfx.tap();
        if (navigator.vibrate) navigator.vibrate(8);
      }
    }

    if (this.flapAnim > 0) this.flapAnim -= dt;

    let t = 0;
    while (t < dt) {
      const stepDt = Math.min(1000 / 60, dt - t);
      step(s, stepDt / 1000, WORLD_H, Math.random);
      t += stepDt;
    }

    if (s.score > prevScore) sfx.score();
    if (s.over && !wasOver) {
      sfx.die();
      if (navigator.vibrate) navigator.vibrate(80);
      if (s.score > this.best) {
        this.best = s.score;
        g.save.set("flappy:best", this.best);
      }
    }
    if (s.over) this.overT += dt;
  }

  render(g: GameContext): void {
    const { ctx, w, h } = g;
    const s = this.sim;
    const sv = Math.min(w, h);
    const { scale, ox, oy } = this.geo(g);

    ctx.fillStyle = PALETTE.paper;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();

    const birdScreenX = ox + BIRD_X * scale;

    for (const p of s.pipes) {
      const px = ox + p.x * scale;
      if (px > w + 50 || px < -50) continue;
      const gapTop = oy + p.gapY * scale;
      const gapBottom = oy + (p.gapY + GAP_H) * scale;
      const pw = PIPE_W * scale;
      // top stroke
      inkRect(ctx, px - pw / 2, oy - 4, pw, gapTop - oy + 4, PALETTE.white, PALETTE.ink, 3.5);
      // bottom stroke
      inkRect(
        ctx,
        px - pw / 2,
        gapBottom,
        pw,
        oy + WORLD_H * scale - gapBottom + 4,
        PALETTE.white,
        PALETTE.ink,
        3.5,
      );
      // brush tip accents at gap edges
      ctx.strokeStyle = this.accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px - pw * 0.42, gapTop - 3);
      ctx.lineTo(px + pw * 0.42, gapTop - 3);
      ctx.moveTo(px - pw * 0.42, gapBottom + 3);
      ctx.lineTo(px + pw * 0.42, gapBottom + 3);
      ctx.stroke();
    }

    const by = oy + s.bird.y * scale;
    const flapPhase = this.flapAnim > 0 ? 1 : 0;
    ctx.save();
    ctx.translate(birdScreenX, by);
    ctx.rotate(Math.max(-0.5, Math.min(1, s.bird.vy / 16)));
    ctx.fillStyle = PALETTE.ink;
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, scale * 0.62, scale * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    // wing
    ctx.fillStyle = PALETTE.paper;
    ctx.beginPath();
    ctx.ellipse(
      -scale * 0.1,
      scale * 0.08,
      scale * 0.3,
      scale * 0.2 * (0.4 + flapPhase * 0.8),
      flapPhase ? -0.6 : 0.2,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    // eye
    ctx.fillStyle = PALETTE.white;
    ctx.beginPath();
    ctx.arc(scale * 0.3, -scale * 0.12, scale * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.ink;
    ctx.beginPath();
    ctx.arc(scale * 0.34, -scale * 0.12, scale * 0.05, 0, Math.PI * 2);
    ctx.fill();
    // beak
    ctx.fillStyle = this.accent;
    ctx.beginPath();
    ctx.moveTo(scale * 0.5, 0);
    ctx.lineTo(scale * 0.85, -scale * 0.05);
    ctx.lineTo(scale * 0.85, scale * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();

    inkText(ctx, `${s.score}`, w / 2, h * 0.09, sv * 0.075, PALETTE.ink, "900");
    inkText(ctx, `best ${this.best}`, w / 2, h * 0.15, sv * 0.028, PALETTE.gray);

    if (!s.started) {
      speechBubble(ctx, "tap to flap", w / 2, h * 0.45, sv * 0.05);
    }
    if (s.over) {
      ctx.fillStyle = `rgba(246,241,231,${Math.min(0.85, this.overT / 400)})`;
      ctx.fillRect(0, 0, w, h);
      if (this.overT > 400) {
        speedLines(ctx, w / 2, h / 2, sv * 0.25, Math.max(w, h) * 0.75, 0.5, 36);
        speechBubble(ctx, `The brush falls — ${s.score}`, w / 2, h * 0.44, sv * 0.05);
        inkText(ctx, "tap to return", w / 2, h * 0.56, sv * 0.035, PALETTE.gray);
        if (this.overT > 800 && g.input.consumeEvents().length > 0) g.exit();
      }
    }
  }

  teardown(): void {}
}
