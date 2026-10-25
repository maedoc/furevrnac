import type { Game } from "../games/types";
import {
  PALETTE,
  inkRect,
  inkText,
  halftonePattern,
} from "../engine/style";
import type { Input, InputEvent } from "../engine/input";

interface Card {
  x: number;
  y: number;
  w: number;
  h: number;
  game: Game;
}

export class HomeScreen {
  private cards: Card[] = [];
  private scroll = 0;
  private maxScroll = 0;

  layout(w: number, h: number, games: Game[]): void {
    const cw = Math.min(w * 0.86, 420);
    const ch = Math.min(h * 0.16, 96);
    const gap = ch * 0.28;
    const total = games.length * (ch + gap) - gap;
    this.maxScroll = Math.max(0, total - h * 0.62);
    this.cards = games.map((game, i) => ({
      x: w / 2 - cw / 2,
      y: h * 0.24 + i * (ch + gap) - this.scroll,
      w: cw,
      h: ch,
      game,
    }));
  }

  update(dt: number, ctx: { w: number; h: number; input: Input; onOpen: (g: Game) => void }): void {
    void dt;
    const events: InputEvent[] = ctx.input.consumeEvents();
    let dragged = false;
    for (const e of events) {
      if (e.type === "drag") {
        dragged = true;
        this.scroll = Math.min(
          this.maxScroll,
          Math.max(0, this.scroll - e.dy),
        );
      } else if (e.type === "tap") {
        const card = this.cards.find(
          (c) =>
            e.x >= c.x && e.x <= c.x + c.w && e.y >= c.y && e.y <= c.y + c.h,
        );
        if (card) ctx.onOpen(card.game);
      }
    }
    void dragged;
  }

  render(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = PALETTE.paper;
    ctx.fillRect(0, 0, w, h);

    const s = Math.min(w, h);
    inkText(ctx, "FUREVRNAC", w / 2, h * 0.075, s * 0.075, PALETTE.ink, "900");
    ctx.save();
    ctx.translate(w / 2, h * 0.075);
    ctx.rotate(-0.03);
    inkText(ctx, "FUREVRNAC", 1.5, 1.5, s * 0.075, "rgba(212,61,42,0.35)", "900");
    ctx.restore();
    inkText(ctx, "the forever almanac", w / 2, h * 0.135, s * 0.032, PALETTE.gray);
    ctx.strokeStyle = PALETTE.accent;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(w * 0.15, h * 0.165);
    ctx.lineTo(w * 0.85, h * 0.165);
    ctx.stroke();

    for (const c of this.cards) {
      if (c.y > h || c.y + c.h < 0) continue;
      inkRect(ctx, c.x, c.y, c.w, c.h, PALETTE.white, PALETTE.ink, 3.5);
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(c.x + 3, c.y + 3, c.w - 6, c.h - 6, 6);
      ctx.clip();
      const pattern = halftonePattern(ctx);
      ctx.fillStyle = pattern;
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillRect(c.x, c.y + c.h * 0.55, c.w, c.h * 0.45);
      ctx.restore();
      ctx.restore();

      ctx.fillStyle = c.game.accent;
      ctx.beginPath();
      ctx.arc(c.x + c.h * 0.35, c.y + c.h / 2, c.h * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 3;
      ctx.stroke();

      inkText(ctx, c.game.name, c.x + c.h * 0.72, c.y + c.h * 0.32, Math.min(c.h * 0.26, s * 0.045), PALETTE.ink, "900", "left");
      inkText(ctx, c.game.blurb, c.x + c.h * 0.72, c.y + c.h * 0.62, Math.min(c.h * 0.17, s * 0.03), PALETTE.gray, "500", "left");
      inkText(ctx, "▶", c.x + c.w - c.h * 0.25, c.y + c.h / 2, c.h * 0.22, PALETTE.accent);
    }

    inkText(ctx, "free · offline · forever", w / 2, h * 0.965, s * 0.028, PALETTE.gray);
  }
}
