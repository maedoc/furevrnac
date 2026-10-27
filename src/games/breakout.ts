import type { Game, GameContext } from "./types";
import { sfx } from "../engine/sfx";
import {
  PALETTE,
  inkRect,
  inkText,
  speechBubble,
  speedLines,
  hexWithAlpha,
} from "../engine/style";

const ROWS = 6;
const COLS = 8;

export class BreakoutGame implements Game {
  readonly id = "breakout";
  readonly name = "Ink Breaker";
  readonly blurb = "Drag to slide the paddle, break every panel.";
  readonly accent = "#d43d2a";

  private bricks: boolean[][] = [];
  private paddleX = 0.5;
  private ballX = 0.5;
  private ballY = 0.72;
  private vx = 0.28;
  private vy = -0.42;
  private speed = 0.6;
  private score = 0;
  private best = 0;
  private lives = 3;
  private state: "ready" | "play" | "dead" | "clear" = "ready";
  private shake = 0;

  init(g: GameContext): void {
    this.bricks = Array.from({ length: ROWS }, () => Array(COLS).fill(true));
    this.paddleX = 0.5;
    this.ballX = 0.5;
    this.ballY = 0.72;
    this.vx = (Math.random() < 0.5 ? -1 : 1) * 0.28;
    this.vy = -0.42;
    this.speed = 0.6;
    this.score = 0;
    this.lives = 3;
    this.state = "ready";
    this.shake = 0;
    this.best = g.save.get("breakout:best", 0);
  }

  update(dt: number, g: GameContext): void {
    const s = dt / 1000;
    if (this.shake > 0) this.shake -= dt;
    for (const e of g.input.consumeEvents()) {
      if (e.type === "drag") {
        this.paddleX = Math.min(0.92, Math.max(0.08, e.x / g.w));
        if (this.state === "ready") {
          this.ballX = this.paddleX;
        }
      } else if (e.type === "tap") {
        if (this.state === "ready") this.state = "play";
        else if (this.state === "dead" || this.state === "clear") g.exit();
      }
    }
    if (this.state !== "play") return;

    this.ballX += this.vx * this.speed * s;
    this.ballY += this.vy * this.speed * s;

    const fieldTop = 0.14;
    if (this.ballX < 0.02 || this.ballX > 0.98) {
      this.vx *= -1;
      this.ballX = Math.min(0.98, Math.max(0.02, this.ballX));
    }
    if (this.ballY < fieldTop + 0.02) {
      this.vy *= -1;
      this.ballY = fieldTop + 0.02;
    }

    const paddleY = 0.88;
    if (
      this.vy > 0 &&
      this.ballY > paddleY - 0.02 &&
      this.ballY < paddleY + 0.03 &&
      Math.abs(this.ballX - this.paddleX) < 0.11
    ) {
      const hit = (this.ballX - this.paddleX) / 0.11;
      this.vx = hit * 0.5;
      this.vy = -Math.sqrt(Math.max(0.15, 0.45 - hit * hit * 0.2));
      this.ballY = paddleY - 0.02;
      sfx.bounce();
      if (navigator.vibrate) navigator.vibrate(10);
    }

    const bw = 0.96 / COLS;
    const bh = 0.05;
    const by = fieldTop + 0.04;
    const gx = Math.floor((this.ballX - 0.02) / bw);
    const gy = Math.floor((this.ballY - by) / bh);
    if (gx >= 0 && gx < COLS && gy >= 0 && gy < ROWS && this.bricks[gy][gx]) {
      this.bricks[gy][gx] = false;
      this.score += 10;
      this.shake = 120;
      this.vy *= -1;
      sfx.brick();
      if (navigator.vibrate) navigator.vibrate(20);
      if (this.bricks.every((r) => r.every((b) => !b))) {
        this.state = "clear";
        sfx.win();
        if (this.score > this.best) {
          this.best = this.score;
          g.save.set("breakout:best", this.best);
        }
      }
    }

    if (this.ballY > 1.02) {
      this.lives--;
      sfx.die();
      if (this.lives <= 0) {
        this.state = "dead";
        if (this.score > this.best) {
          this.best = this.score;
          g.save.set("breakout:best", this.best);
        }
      } else {
        this.state = "ready";
        this.ballX = this.paddleX;
        this.ballY = 0.72;
        this.vx = (Math.random() < 0.5 ? -1 : 1) * 0.28;
        this.vy = -0.42;
      }
    }
    this.speed = 0.6 + this.score * 0.004;
  }

  render(g: GameContext): void {
    const { ctx, w, h } = g;
    ctx.save();
    if (this.shake > 0) {
      ctx.translate(
        Math.sin(this.shake * 0.7) * 4,
        Math.cos(this.shake * 0.9) * 3,
      );
    }

    const fieldTop = h * 0.14;
    const fieldH = h * 0.78;
    inkRect(ctx, w * 0.01, fieldTop, w * 0.98, fieldH, PALETTE.white, PALETTE.ink, 4);

    const bw = (w * 0.96) / COLS;
    const bh = h * 0.05;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!this.bricks[y][x]) continue;
        const fill = y < 2 ? this.accent : y < 4 ? PALETTE.tint2 : PALETTE.white;
        inkRect(ctx, w * 0.02 + x * bw, fieldTop + h * 0.04 + y * bh, bw - 3, bh - 4, fill, PALETTE.ink, 2.5);
      }
    }

    const px = this.paddleX * w;
    const py = h * 0.88;
    ctx.fillStyle = PALETTE.ink;
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(px - w * 0.11, py, w * 0.22, h * 0.02 + 6, 12);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(this.ballX * w, this.ballY * h, Math.min(w, h) * 0.014, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.accent;
    ctx.fill();
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    inkText(ctx, `Score ${this.score}`, w * 0.2, h * 0.06, Math.min(w, h) * 0.04, PALETTE.accent, "700", "left");
    inkText(ctx, `♥ ${this.lives}`, w * 0.8, h * 0.06, Math.min(w, h) * 0.04, PALETTE.ink, "700", "right");
    ctx.restore();

    if (this.state === "ready") {
      speechBubble(ctx, "tap to launch", w / 2, h * 0.6, Math.min(w, h) * 0.05);
    } else if (this.state === "dead") {
      ctx.fillStyle = hexWithAlpha(PALETTE.paper, 0.85);
      ctx.fillRect(0, 0, w, h);
      speedLines(ctx, w / 2, h / 2, Math.min(w, h) * 0.25, Math.max(w, h) * 0.75, 0.5, 36);
      speechBubble(ctx, `Ink spilled — ${this.score}`, w / 2, h / 2, Math.min(w, h) * 0.055);
      inkText(ctx, "tap to return", w / 2, h * 0.62, Math.min(w, h) * 0.035, PALETTE.gray);
    } else if (this.state === "clear") {
      ctx.fillStyle = hexWithAlpha(PALETTE.paper, 0.85);
      ctx.fillRect(0, 0, w, h);
      speedLines(ctx, w / 2, h / 2, Math.min(w, h) * 0.25, Math.max(w, h) * 0.75, 0.5, 36);
      speechBubble(ctx, `Chapter cleared! ${this.score}`, w / 2, h / 2, Math.min(w, h) * 0.055);
      inkText(ctx, "tap to return", w / 2, h * 0.62, Math.min(w, h) * 0.035, PALETTE.gray);
    }
  }

  teardown(): void {}
}
