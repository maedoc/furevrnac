import type { Game, GameContext } from "./types";
import { PALETTE, inkRect, inkText, speechBubble, speedLines,
  hexWithAlpha,
} from "../engine/style";
import { sfx } from "../engine/sfx";

export class PongGame implements Game {
  readonly id = "pong";
  readonly name = "Ink Pong";
  readonly blurb = "Duel the brush AI or a friend.";
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
  private state: "pick" | "serve" | "play" | "over" = "pick";
  private twoPlayer = false;

  init(g: GameContext): void {
    this.py = 0.5;
    this.ay = 0.5;
    this.ps = 0;
    this.as = 0;
    this.rally = 0;
    this.state = "pick";
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
    if (this.state === "pick") {
      const bw = Math.min(g.w * 0.8, 360);
      const bh = Math.min(g.w, g.h) * 0.11;
      const gap = bh * 0.5;
      const top = g.h * 0.32;
      for (const e of g.input.consumeEvents()) {
        if (e.type !== "tap") continue;
        if (
          e.x > g.w / 2 - bw / 2 &&
          e.x < g.w / 2 + bw / 2 &&
          e.y > top &&
          e.y < top + bh
        ) {
          this.twoPlayer = false;
          this.state = "serve";
          sfx.tap();
        } else if (
          e.x > g.w / 2 - bw / 2 &&
          e.x < g.w / 2 + bw / 2 &&
          e.y > top + bh + gap &&
          e.y < top + 2 * bh + gap
        ) {
          this.twoPlayer = true;
          this.state = "serve";
          sfx.tap();
        }
      }
      return;
    }

    const events = g.input.consumeEvents();

    if (this.state === "over") {
      for (const e of events) {
        if (e.type === "tap") {
          g.exit();
          return;
        }
      }
      return;
    }

    if (this.twoPlayer) {
      // each half of the screen drives its own paddle; simultaneous
      // touches supported via multi-pointer input
      for (const p of g.input.activePointers()) {
        if (p.x < g.w * 0.5)
          this.py = Math.min(0.92, Math.max(0.08, p.y / g.h));
        else this.ay = Math.min(0.92, Math.max(0.08, p.y / g.h));
      }
      for (const e of events) {
        if (e.type === "tap" || e.type === "drag") {
          if (e.x < g.w * 0.5)
            this.py = Math.min(0.92, Math.max(0.08, e.y / g.h));
          else this.ay = Math.min(0.92, Math.max(0.08, e.y / g.h));
          if (this.state === "serve") this.state = "play";
        }
      }
    } else {
      for (const e of events) {
        if (e.type === "drag" || e.type === "tap") {
          this.py = Math.min(0.92, Math.max(0.08, e.y / g.h));
          if (this.state === "serve") this.state = "play";
        }
      }
    }
    if (this.state !== "play") return;
    this.physics(dt / 1000, g);
  }

  private physics(s: number, g: GameContext): void {
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

    if (!this.twoPlayer) {
      const aiSpeed = 0.45 + Math.min(this.rally * 0.02, 0.25);
      if (this.vx > 0) {
        this.ay += Math.max(-aiSpeed * s, Math.min(aiSpeed * s, this.by - this.ay));
      } else {
        this.ay += Math.max(-aiSpeed * s * 0.5, Math.min(aiSpeed * s * 0.5, 0.5 - this.ay));
      }
      this.ay = Math.min(0.92, Math.max(0.08, this.ay));
    }

    if (this.bx < -0.02) {
      this.as++;
      sfx.die();
      if (this.as >= 5) {
        this.state = "over";
        if (!this.twoPlayer && this.ps > this.best) {
          this.best = this.ps;
          g.save.set("pong:best", this.best);
        }
      } else this.state = "serve";
      this.resetBall(1);
    } else if (this.bx > 1.02) {
      this.ps++;
      sfx.score();
      if (!this.twoPlayer && this.ps > this.best) {
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

    if (this.state === "pick") {
      inkText(ctx, "Ink Pong", w / 2, h * 0.15, s * 0.07, PALETTE.ink, "900");
      inkText(ctx, "choose your duel", w / 2, h * 0.23, s * 0.035, PALETTE.gray);
      const bw = Math.min(w * 0.8, 360);
      const bh = s * 0.11;
      const gap = bh * 0.5;
      const labels = ["vs Brush AI", "two players"];
      const hints = ["one thumb vs the ink brush", "left half vs right half — drag"];
      labels.forEach((label, i) => {
        const y = h * 0.32 + i * (bh + gap);
        inkRect(ctx, w / 2 - bw / 2, y, bw, bh, PALETTE.white, PALETTE.ink, 3.5);
        inkText(ctx, label, w / 2, y + bh * 0.38, s * 0.05, PALETTE.ink, "700");
        inkText(ctx, hints[i], w / 2, y + bh * 0.72, s * 0.026, PALETTE.gray);
      });
      return;
    }

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
    const footer = this.twoPlayer
      ? "two players"
      : `rally ${this.rally}  best ${this.best}`;
    inkText(ctx, footer, w / 2, h * 0.965, s * 0.03, PALETTE.gray);

    if (this.state === "serve")
      speechBubble(ctx, "tap or drag to serve", w / 2, h * 0.55, s * 0.05);
    else if (this.state === "over") {
      ctx.fillStyle = hexWithAlpha(PALETTE.paper, 0.85);
      ctx.fillRect(0, 0, w, h);
      speedLines(ctx, w / 2, h / 2, s * 0.25, Math.max(w, h) * 0.75, 0.5, 36);
      const leftName = this.twoPlayer ? "Left" : "You";
      const rightName = this.twoPlayer ? "Right" : "Brush";
      const msg =
        this.ps === this.as
          ? "A perfect draw!"
          : `${this.ps > this.as ? leftName : rightName} wins the duel!`;
      speechBubble(ctx, `${msg} ${this.ps}–${this.as}`, w / 2, h * 0.44, s * 0.05);
      inkText(ctx, "tap to return", w / 2, h * 0.56, s * 0.035, PALETTE.gray);
    }
  }

  teardown(): void {}
}
