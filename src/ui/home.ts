import type { Game } from "../games/types";
import {
  PALETTE,
  inkRect,
  inkText,
  halftonePattern,
} from "../engine/style";
import type { Input, InputEvent } from "../engine/input";
import { cycleTheme, isDark } from "../engine/theme";

interface CardDims {
  w: number;
  h: number;
  gap: number;
  top: number;
}

export class HomeScreen {
  private toggleR = { x: 0, y: 0, r: 0 };
  private scroll = 0;
  private velocity = 0;
  private maxScroll = 0;
  private dims: CardDims = { w: 0, h: 0, gap: 0, top: 0 };

  layout(w: number, h: number, games: Game[]): void {
    const cw = Math.min(w * 0.86, 420);
    const ch = Math.min(h * 0.16, 96);
    const gap = ch * 0.28;
    this.dims = { w: cw, h: ch, gap, top: h * 0.24 };
    const total = games.length * (ch + gap) - gap;
    this.maxScroll = Math.max(0, total - h * 0.6);
    this.scroll = Math.min(this.scroll, this.maxScroll);
  }

  update(
    dt: number,
    ctx: { w: number; h: number; input: Input; onOpen: (g: Game) => void; games: Game[] },
  ): void {
    const events: InputEvent[] = ctx.input.consumeEvents();
    const { h: ch, gap } = this.dims;

    let dragged = false;
    let tapCandidate: { x: number; y: number } | null = null;

    for (const e of events) {
      if (e.type === "drag") {
        dragged = true;
        this.scroll -= e.dy;
        this.velocity = -e.dy / (dt / 1000 + 0.001);
        this.clamp();
      } else if (e.type === "tap") {
        tapCandidate = { x: e.x, y: e.y };
      }
    }

    if (!dragged) {
      this.scroll += this.velocity * (dt / 1000);
      this.velocity *= Math.pow(0.0025, dt / 1000);
      if (Math.abs(this.velocity) < 0.01) this.velocity = 0;
      this.clamp();
    }

    if (tapCandidate) {
      const t = this.toggleR;
      if (Math.hypot(tapCandidate.x - t.x, tapCandidate.y - t.y) < t.r * 1.6) {
        cycleTheme();
        return;
      }
      const y = tapCandidate.y + this.scroll;
      let idx = Math.floor((y - this.dims.top + gap) / (ch + gap));
      if (idx < 0) idx = 0;
      if (idx >= ctx.games.length) idx = ctx.games.length - 1;
      const cardTop = this.dims.top + idx * (ch + gap);
      if (y >= cardTop && y <= cardTop + ch) {
        const gx = tapCandidate.x;
        const cx = ctx.w / 2 - this.dims.w / 2;
        if (gx >= cx && gx <= cx + this.dims.w) {
          ctx.onOpen(ctx.games[idx]);
          this.velocity = 0;
        }
      }
    }
  }

  private clamp(): void {
    if (this.scroll < 0) {
      this.scroll = 0;
      this.velocity = 0;
    }
    if (this.scroll > this.maxScroll) {
      this.scroll = this.maxScroll;
      this.velocity = 0;
    }
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

    // theme toggle (top-right): sun/moon ink disc
    this.toggleR = { x: w - s * 0.07, y: h * 0.075, r: s * 0.045 };
    ctx.beginPath();
    ctx.arc(this.toggleR.x, this.toggleR.y, this.toggleR.r, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.white;
    ctx.fill();
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    const dark = isDark();
    if (dark) {
      // crescent moon
      ctx.beginPath();
      ctx.arc(this.toggleR.x, this.toggleR.y, this.toggleR.r * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.ink;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(this.toggleR.x + this.toggleR.r * 0.28, this.toggleR.y - this.toggleR.r * 0.12, this.toggleR.r * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.white;
      ctx.fill();
    } else {
      // sun rays
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 2;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(this.toggleR.x + Math.cos(a) * this.toggleR.r * 0.55, this.toggleR.y + Math.sin(a) * this.toggleR.r * 0.55);
        ctx.lineTo(this.toggleR.x + Math.cos(a) * this.toggleR.r * 0.85, this.toggleR.y + Math.sin(a) * this.toggleR.r * 0.85);
        ctx.stroke();
      }
    }
    ctx.strokeStyle = PALETTE.accent;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(w * 0.15, h * 0.165);
    ctx.lineTo(w * 0.85, h * 0.165);
    ctx.stroke();

    const { w: cw, h: ch, gap, top } = this.dims;
    const bottomFade = h * 0.9;

    for (let i = 0; ; i++) {
      const cardY = top + i * (ch + gap) - this.scroll;
      if (cardY >= h) break;
      if (i >= this.gameCount) break;
      if (cardY + ch < 0) continue;
      this.renderCard(ctx, w, cardY, cw, ch, i);
    }
    void bottomFade;

    if (this.maxScroll > 0 && this.scroll < this.maxScroll - 4) {
      ctx.fillStyle = PALETTE.accent;
      ctx.beginPath();
      ctx.arc(w / 2, h * 0.925, s * 0.012, 0, Math.PI * 2);
      ctx.fill();
    }
    inkText(ctx, "free · offline · forever", w / 2, h * 0.965, s * 0.028, PALETTE.gray);
  }

  private gameCount = 0;

  setGameCount(n: number): void {
    this.gameCount = n;
  }

  private renderCard(
    ctx: CanvasRenderingContext2D,
    w: number,
    y: number,
    cw: number,
    ch: number,
    index: number,
  ): void {
    const x = w / 2 - cw / 2;
    const game = this.games[index];
    if (!game) return;

    inkRect(ctx, x, y, cw, ch, PALETTE.white, PALETTE.ink, 3.5);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x + 3, y + 3, cw - 6, ch - 6, 6);
    ctx.clip();
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = halftonePattern(ctx);
    ctx.fillRect(x, y + ch * 0.55, cw, ch * 0.45);
    ctx.restore();
    ctx.restore();

    ctx.fillStyle = game.accent;
    ctx.beginPath();
    ctx.arc(x + ch * 0.35, y + ch / 2, ch * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 3;
    ctx.stroke();

    inkText(ctx, game.name, x + ch * 0.72, y + ch * 0.32, Math.min(ch * 0.26, w * 0.045), PALETTE.ink, "900", "left");
    inkText(ctx, game.blurb, x + ch * 0.72, y + ch * 0.62, Math.min(ch * 0.17, w * 0.03), PALETTE.gray, "500", "left");
    inkText(ctx, "▶", x + cw - ch * 0.25, y + ch / 2, ch * 0.22, game.accent);
  }

  private games: Game[] = [];

  setGames(games: Game[]): void {
    this.games = games;
    this.gameCount = games.length;
  }
}
