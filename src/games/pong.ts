import type { Game, GameContext } from "./types";
import { PALETTE, inkRect, inkText, speechBubble, speedLines } from "../engine/style";
import { sfx } from "../engine/sfx";

export class PongGame implements Game {
  readonly id = "pong";
  readonly name = "Ink Pong";
  readonly blurb = "Drag to rally against the ink brush.";
  readonly accent = "#d43d2a";

  private py = 0.5;
  private ay = 0.5;
  private bx = 0.5;
  private by = 0.5;
  private vx = 0.5;
  private vy = 0.2;
  private ps = 0;
  private as = 0;
  private best = 0;
  private rally = 0;
  private state: "serve" | "play" | "over" = "serve";

  init(g: GameContext): void {
    this.py = 0.5;
    this.ay = 0.5;
    this.ps = 0;
    this.as = 0;
    this.rally = 0;
    this.state = "serve";
    this.best = g.save.get("pong:best", 0);
    this.resetBall(1);
  }

  private resetBall(dir: number): void {
    this.bx = 0.5;
    this.by = 0.5;
    this.vx = 0.55 * dir;
    this.vy = (Math.random() - 0.5) * 0.5;
    this.rally = 0;
  }

  update(dt: number, g: GameContext): void {
    const s = dt / 1000;
    for (const e of g.input.consumeEvents()) {
      if (e.type === "drag") {
        this.py = Math.min(0.92, Math.max(0.08, e.y / g.h));
        if (this.state === "serve") this.state = "play";
      } else if (e.type === "tap") {
        if (this.state === "serve") this.state = "play";
        else if (this.state === "over") {
          g.exit();
          return;
        }
      }
    }
    if (this.state !== "play") return;

    const speed = 0.62 + this.rally * 0.03;
    this.bx += this.vx * speed * s;
    this.by += this.vy * speed * s;

    if (this.by < 0.03 || this.by > 0.97) {
      this.vy *= -1;
      this.by = Math.min(0.97, Math.max(0.03, this.by));
      sfx.bounce();
    }

    if (this.vx < 0 && this.bx < 0.07 && Math.abs(this.by - this.py) < 0.11) {
      this.vx = Math.abs(this.vx);
      this.vy += (this.by - this.py) * 1.4;
      this.vy = Math.max(-0.9, Math.min(0.9, this.vy));
      this.bx = 0.07;
      this.rally++;
      sfx.bounce();
      if (navigator.vibrate) navigator.vibrate(10);
    }
    if (this.vx > 0 && this.bx > 0.93 && Math.abs(this.by - this.ay) < 0.11) {
      this.vx = -Math.abs(this.vx);
      this.vy += (this.by - this.ay) * 1.2;
      this.vy = Math.max(-0.9, Math.min(0.9, this.vy));
      this.bx = 0.93;
      this.rally++;
      sfx.bounce();
    }

    const aiSpeed = 0.45 + Math.min(this.rally * 0.02, 0.25);
    if (this.vx > 0) {
      const target = this.by;
      this.ay += Math.max(-aiSpeed * s, Math.min(aiSpeed * s, target - this.ay));
    } else {
      this.ay += Math.max(-aiSpeed * s * 0.5, Math.min(aiSpeed * s * 0.5, 0.5 - this.ay));
    }
    this.ay = Math.min(0.92, Math.max(0.08, this.ay));

    if (this.bx < -0.02) {
      this.as++;
      sfx.die();
      if (this.as >= 5) {
        this.state = "over";
        if (this.ps > this.best) {
          this.best = this.ps;
          g.save.set("pong:best", this.best);
        }
      } else this.state = "serve";
      this.resetBall(1);
    } else if (this.bx > 1.02) {
      this.ps++;
      sfx.score();
      if (this.ps > this.best) {
        this.best = this.ps;
        g.save.set("pong:best", this.best);
      }
      this.state = "serve";
      this.resetBall(-1);
    }
  }

  render(g: GameContext): void {
    const { ctx, w, h } = g;
    const s = Math.min(w, h);
    inkRect(ctx, w * 0.02, h * 0.02, w * 0.96, h * 0.96, PALETTE.white, PALETTE.ink, 4);

    ctx.strokeStyle = PALETTE.gray;
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 14]);
    ctx.beginPath();
    ctx.moveTo(w / 2, h * 0.03);
    ctx.lineTo(w / 2, h * 0.97);
    ctx.stroke();
    ctx.setLineDash([]);

    const ph = h * 0.22;
    const pw = Math.max(w * 0.025, 10);
    ctx.fillStyle = PALETTE.ink;
    ctx.beginPath();
    ctx.roundRect(w * 0.05, this.py * h - ph / 2, pw, ph, 8);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(w * 0.95 - pw, this.ay * h - ph / 2, pw, ph, 8);
    ctx.fill();

    const br = Math.min(w, h) * 0.015;
    ctx.fillStyle = this.accent;
    ctx.beginPath();
    ctx.arc(this.bx * w, this.by * h, br, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    if (this.rally >= 4)
      speedLines(ctx, this.bx * w, this.by * h, br * 2.4, br * 5, 0.4, 12);

    inkText(ctx, String(this.ps), w * 0.25, h * 0.09, s * 0.06, PALETTE.ink, "900");
    inkText(ctx, String(this.as), w * 0.75, h * 0.09, s * 0.06, PALETTE.ink, "900");
    inkText(ctx, `rally ${this.rally}  best ${this.best}`, w / 2, h * 0.965, s * 0.03, PALETTE.gray);

    if (this.state === "serve")
      speechBubble(ctx, "tap to serve", w / 2, h * 0.55, s * 0.05);
    else if (this.state === "over") {
      ctx.fillStyle = "rgba(246,241,231,0.85)";
      ctx.fillRect(0, 0, w, h);
      speedLines(ctx, w / 2, h / 2, s * 0.25, Math.max(w, h) * 0.75, 0.5, 36);
      const msg = this.ps > this.as ? "You win the rally!" : "The brush wins…";
      speechBubble(ctx, `${msg} ${this.ps}–${this.as}`, w / 2, h / 2, s * 0.055);
      inkText(ctx, "tap to return", w / 2, h * 0.62, s * 0.035, PALETTE.gray);
    }
  }

  teardown(): void {}
}
