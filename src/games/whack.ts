import type { Game, GameContext } from "./types";
import {
  PALETTE,
  inkText,
  speechBubble,
  speedLines,
  hexWithAlpha,
} from "../engine/style";
import { sfx } from "../engine/sfx";
import {
  ROUND_TIME,
  initState,
  step,
  whack,
  type SimState,
} from "./whack-sim";

const HOLES = 9;
const COLS = 3;

export class WhackGame implements Game {
  readonly id = "whack";
  readonly name = "Whack-a-Brush";
  readonly blurb = "Tap the ink imps before they hide.";
  readonly accent = "#d43d2a";

  private sim: SimState = initState(HOLES);
  private best = 0;
  private overT = 0;
  private bonks: { x: number; y: number; t: number; hit: boolean }[] = [];

  init(g: GameContext): void {
    this.sim = initState(HOLES);
    this.best = g.save.get("whack:best", 0);
    this.overT = 0;
    this.bonks = [];
  }

  private geo(g: GameContext): { cx: number; cy: number; hw: number; hh: number } {
    const cols = COLS;
    const rows = Math.ceil(HOLES / cols);
    const zoneH = g.h * 0.62;
    const hw = Math.min((g.w * 0.9) / cols / 2, zoneH / rows / 2.4);
    const hh = hw * 0.75;
    return {
      cx: g.w / 2,
      cy: g.h * 0.46,
      hw,
      hh,
    };
  }

  private holePos(g: GameContext, i: number): { x: number; y: number } {
    const { cx, cy, hw, hh } = this.geo(g);
    const cols = COLS;
    const rows = Math.ceil(HOLES / cols);
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      x: cx + (col - (cols - 1) / 2) * hw * 2.3,
      y: cy + (row - (rows - 1) / 2) * hh * 2.3,
    };
  }

  update(dt: number, g: GameContext): void {
    const s = this.sim;
    const wasOver = s.over;

    const events = g.input.consumeEvents();
    if (!s.over) {
      for (const e of events) {
        if (e.type !== "tap" && e.type !== "longpress") continue;
        let hit = false;
        for (let i = 0; i < HOLES; i++) {
          const p = this.holePos(g, i);
          const dx = e.x - p.x;
          const dy = e.y - p.y;
          if (Math.abs(dx) < this.geo(g).hw * 1.4 && Math.abs(dy) < this.geo(g).hh * 1.6) {
            hit = whack(s, i) || hit;
            this.bonks.push({ x: p.x, y: p.y, t: 260, hit: whack(s, i) });
            break;
          }
        }
        if (!hit) {
          this.bonks.push({ x: e.x, y: e.y, t: 200, hit: false });
          sfx.bounce();
        }
      }
      let t = 0;
      while (t < dt) {
        const stepDt = Math.min(1000 / 60, dt - t);
        step(s, stepDt / 1000, Math.random);
        t += stepDt;
      }
    }

    for (const b of this.bonks) b.t -= dt;
    this.bonks = this.bonks.filter((b) => b.t > 0);

    if (s.over && !wasOver) {
      sfx.win();
      if (s.score > this.best) {
        this.best = s.score;
        g.save.set("whack:best", this.best);
      }
    }
    if (s.over) this.overT += dt;
  }

  render(g: GameContext): void {
    const { ctx, w, h } = g;
    const s = this.sim;
    const sv = Math.min(w, h);
    const { hw, hh } = this.geo(g);

    ctx.fillStyle = PALETTE.paper;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < HOLES; i++) {
      const p = this.holePos(g, i);
      const m = s.moles[i];
      // ink well
      ctx.fillStyle = PALETTE.ink;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + hh * 0.4, hw * 1.1, hh * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      let pop = 0;
      if (m.state === "up") pop = Math.min(1, (s.upDur + 0.2 - m.upT) * 4);
      if (m.state === "bonked") pop = Math.max(0, m.bonkT / 0.25) * 0.6;

      if (pop > 0) {
        const rise = pop * hh * 1.1;
        // imp head
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + hh * 0.4, hw, hh * 0.55, 0, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = m.state === "bonked" ? this.accent : PALETTE.gray;
        ctx.beginPath();
        ctx.arc(p.x, p.y - rise + hh * 0.4, hw * 0.72, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = PALETTE.ink;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        // eyes
        ctx.fillStyle = PALETTE.ink;
        ctx.beginPath();
        ctx.arc(p.x - hw * 0.24, p.y - rise + hh * 0.28, hw * 0.1, 0, Math.PI * 2);
        ctx.arc(p.x + hw * 0.24, p.y - rise + hh * 0.28, hw * 0.1, 0, Math.PI * 2);
        ctx.fill();
        if (m.state === "bonked") {
          ctx.strokeStyle = PALETTE.ink;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(p.x - hw * 0.34, p.y - rise + hh * 0.24);
          ctx.lineTo(p.x - hw * 0.12, p.y - rise + hh * 0.38);
          ctx.moveTo(p.x - hw * 0.12, p.y - rise + hh * 0.24);
          ctx.lineTo(p.x - hw * 0.34, p.y - rise + hh * 0.38);
          ctx.moveTo(p.x + hw * 0.12, p.y - rise + hh * 0.24);
          ctx.lineTo(p.x + hw * 0.34, p.y - rise + hh * 0.38);
          ctx.moveTo(p.x + hw * 0.34, p.y - rise + hh * 0.24);
          ctx.lineTo(p.x + hw * 0.12, p.y - rise + hh * 0.38);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    for (const b of this.bonks) {
      ctx.globalAlpha = b.t / 260;
      if (b.hit) {
        ctx.strokeStyle = this.accent;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 14 * (1.4 - b.t / 260), 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.strokeStyle = PALETTE.gray;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(b.x - 8, b.y - 8);
        ctx.lineTo(b.x + 8, b.y + 8);
        ctx.moveTo(b.x + 8, b.y - 8);
        ctx.lineTo(b.x - 8, b.y + 8);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    const left = Math.max(0, ROUND_TIME - s.time);
    inkText(ctx, `${s.score}`, w * 0.25, h * 0.075, sv * 0.06, this.accent, "900");
    inkText(ctx, `best ${this.best}`, w * 0.25, h * 0.125, sv * 0.026, PALETTE.gray);
    inkText(ctx, `${left.toFixed(0)}s`, w * 0.75, h * 0.075, sv * 0.05, PALETTE.ink, "900");
    inkText(ctx, `missed ${s.misses}`, w * 0.75, h * 0.125, sv * 0.026, PALETTE.gray);

    if (s.over) {
      ctx.fillStyle = hexWithAlpha(PALETTE.paper, Math.min(0.85, this.overT / 400));
      ctx.fillRect(0, 0, w, h);
      if (this.overT > 400) {
        speedLines(ctx, w / 2, h / 2, sv * 0.25, Math.max(w, h) * 0.75, 0.5, 36);
        speechBubble(ctx, `${s.score} imps whacked!`, w / 2, h * 0.44, sv * 0.05);
        inkText(ctx, "tap to return", w / 2, h * 0.56, sv * 0.035, PALETTE.gray);
        if (this.overT > 800 && g.input.consumeEvents().length > 0) g.exit();
      }
    }
  }

  teardown(): void {}
}
