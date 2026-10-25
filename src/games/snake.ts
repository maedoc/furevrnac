import type { Game, GameContext } from "./types";
import {
  PALETTE,
  inkRect,
  inkText,
  inkSplash,
  speedLines,
  speechBubble,
} from "../engine/style";

const COLS = 17;
const ROWS = 22;

interface Cell {
  x: number;
  y: number;
}

export class SnakeGame implements Game {
  readonly id = "snake";
  readonly name = "Ink Snake";
  readonly blurb = "Swipe to steer the ink brush serpent.";
  readonly accent = "#d43d2a";

  private body: Cell[] = [];
  private dir = { x: 0, y: 1 };
  private queuedDir = { x: 0, y: 1 };
  private food: Cell = { x: 8, y: 4 };
  private tickMs = 170;
  private acc = 0;
  private score = 0;
  private best = 0;
  private alive = true;
  private splash: { x: number; y: number; t: number } | null = null;

  init(g: GameContext): void {
    this.body = [
      { x: 8, y: 10 },
      { x: 8, y: 11 },
      { x: 8, y: 12 },
    ];
    this.dir = { x: 0, y: -1 };
    this.queuedDir = { x: 0, y: -1 };
    this.score = 0;
    this.tickMs = 170;
    this.acc = 0;
    this.alive = true;
    this.best = g.save.get("snake:best", 0);
    this.spawnFood(g);
  }

  private spawnFood(g: GameContext): void {
    let ok = false;
    while (!ok) {
      this.food = {
        x: Math.floor(Math.random() * COLS),
        y: Math.floor(Math.random() * ROWS),
      };
      ok = !this.body.some(
        (c) => c.x === this.food.x && c.y === this.food.y,
      );
      if (g && ok) break;
    }
  }

  update(dt: number, g: GameContext): void {
    const events = g.input.consumeEvents();
    for (const e of events) {
      if (e.type === "swipe") {
        const nd = {
          left: { x: -1, y: 0 },
          right: { x: 1, y: 0 },
          up: { x: 0, y: -1 },
          down: { x: 0, y: 1 },
        }[e.dir];
        if (nd.x !== -this.dir.x || nd.y !== -this.dir.y) {
          this.queuedDir = nd;
        }
      } else if (e.type === "tap" && !this.alive) {
        g.exit();
        return;
      }
    }
    if (this.splash) {
      this.splash.t -= dt;
      if (this.splash.t <= 0) this.splash = null;
    }
    if (!this.alive) return;

    this.acc += dt;
    while (this.acc >= this.tickMs) {
      this.acc -= this.tickMs;
      this.step(g);
    }
  }

  private step(g: GameContext): void {
    this.dir = this.queuedDir;
    const head = this.body[0];
    const nx = head.x + this.dir.x;
    const ny = head.y + this.dir.y;
    if (
      nx < 0 ||
      ny < 0 ||
      nx >= COLS ||
      ny >= ROWS ||
      this.body.some((c) => c.x === nx && c.y === ny)
    ) {
      this.alive = false;
      if (this.score > this.best) {
        this.best = this.score;
        g.save.set("snake:best", this.best);
      }
      if (navigator.vibrate) navigator.vibrate(80);
      return;
    }
    this.body.unshift({ x: nx, y: ny });
    if (nx === this.food.x && ny === this.food.y) {
      this.score++;
      this.splash = { x: nx, y: ny, t: 300 };
      this.spawnFood(g);
      this.tickMs = Math.max(70, 170 - this.score * 4);
      if (navigator.vibrate) navigator.vibrate(20);
    } else {
      this.body.pop();
    }
  }

  render(g: GameContext): void {
    const { ctx, w, h } = g;
    const pad = Math.min(w, h) * 0.05;
    const gw = w - pad * 2;
    const gh = h - pad * 2 - h * 0.06;
    const cell = Math.min(gw / COLS, gh / ROWS);
    const ox = (w - cell * COLS) / 2;
    const oy = (h - cell * ROWS) / 2 + h * 0.02;


    inkRect(ctx, ox - 6, oy - 6, cell * COLS + 12, cell * ROWS + 12, PALETTE.white, PALETTE.ink, 4);

    ctx.strokeStyle = PALETTE.gray;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.35;
    for (let x = 1; x < COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(ox + x * cell, oy);
      ctx.lineTo(ox + x * cell, oy + ROWS * cell);
      ctx.stroke();
    }
    for (let y = 1; y < ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(ox, oy + y * cell);
      ctx.lineTo(ox + COLS * cell, oy + y * cell);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    const fx = ox + this.food.x * cell + cell / 2;
    const fy = oy + this.food.y * cell + cell / 2;
    ctx.fillStyle = this.accent;
    ctx.beginPath();
    ctx.arc(fx, fy, cell * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    speedLines(ctx, fx, fy, cell * 0.6, cell * 1.4, 0.4, 10);

    ctx.fillStyle = PALETTE.ink;
    this.body.forEach((c, i) => {
      const cx = ox + c.x * cell + cell / 2;
      const cy = oy + c.y * cell + cell / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, cell * 0.36 - Math.min(i * 0.15, cell * 0.1), 0, Math.PI * 2);
      ctx.fill();
    });
    const head = this.body[0];
    const hx = ox + head.x * cell + cell / 2;
    const hy = oy + head.y * cell + cell / 2;
    ctx.fillStyle = PALETTE.white;
    ctx.beginPath();
    ctx.arc(hx - cell * 0.1, hy - cell * 0.05, cell * 0.09, 0, Math.PI * 2);
    ctx.arc(hx + cell * 0.1, hy - cell * 0.05, cell * 0.09, 0, Math.PI * 2);
    ctx.fill();

    if (this.splash) {
      inkSplash(
        ctx,
        ox + this.splash.x * cell + cell / 2,
        oy + this.splash.y * cell + cell / 2,
        cell * (1 - this.splash.t / 300) * 0.8 + 4,
        this.splash.t / 300,
      );
    }

    inkText(ctx, `Score ${this.score}`, w / 2, pad * 0.55, Math.min(w, h) * 0.045, PALETTE.accent);
    inkText(ctx, `Best ${this.best}`, w / 2, h - pad * 0.35, Math.min(w, h) * 0.035, PALETTE.gray);

    if (!this.alive) {
      ctx.fillStyle = "rgba(246,241,231,0.85)";
      ctx.fillRect(0, 0, w, h);
      speedLines(ctx, w / 2, h / 2, Math.min(w, h) * 0.25, Math.max(w, h) * 0.75, 0.5, 36);
      speechBubble(ctx, `The brush rests — ${this.score}`, w / 2, h / 2, Math.min(w, h) * 0.06);
      inkText(ctx, "tap to return", w / 2, h * 0.62, Math.min(w, h) * 0.035, PALETTE.gray);
    }
  }

  teardown(): void {}
}
