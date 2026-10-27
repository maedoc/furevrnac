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
  LOSS_Y,
  TIERS,
  canDrop,
  drop,
  initState,
  nextTier,
  step,
  type SimState,
} from "./suika-sim";

const WORLD_W = 10;
const WORLD_H = 15;
const DROP_Y = 1.2;

export class SuikaGame implements Game {
  readonly id = "suika";
  readonly name = "Ink Orchard";
  readonly blurb = "Drop fruit, match pairs, grow the watermelon.";
  readonly accent = "#3f7a3a";

  private sim: SimState = initState();
  private queue: number[] = [];
  private aimX = WORLD_W / 2;
  private dragging = false;
  private best = 0;
  private overT = 0;
  private newBest = false;
  private prevScore = 0;
  private splash: { x: number; y: number; t: number }[] = [];

  init(g: GameContext): void {
    this.sim = initState();
    this.best = g.save.get("suika:best", 0);
    this.newBest = false;
    this.overT = 0;
    this.prevScore = 0;
    this.splash = [];
    this.aimX = WORLD_W / 2;
    this.queue = [];
    this.refillQueue();
    this.refillQueue();
    this.refillQueue();
    this.queue.shift();
  }

  private refillQueue(): void {
    this.queue.push(nextTier(Math.random));
  }

  private geo(g: GameContext): { scale: number; ox: number; oy: number } {
    const scale = Math.min(g.w / (WORLD_W + 1.5), (g.h * 0.82) / WORLD_H);
    return {
      scale,
      ox: (g.w - WORLD_W * scale) / 2,
      oy: g.h * 0.13,
    };
  }

  update(dt: number, g: GameContext): void {
    const s = this.sim;
    const bounds = { left: 0, right: WORLD_W, floor: WORLD_H };

    const { scale, ox } = this.geo(g);
    for (const e of g.input.consumeEvents()) {
      if (e.type === "tap" || e.type === "drag" || e.type === "longpress") {
        this.aimX = Math.min(
          WORLD_W - 0.6,
          Math.max(0.6, (e.x - ox) / scale),
        );
        if (e.type === "drag") this.dragging = true;
      }
    }
    if (!g.input.isPointerDown()) this.dragging = false;

    const wasOver = s.over;
    if (!s.over) {
      let t = 0;
      const dts = Math.min(dt, 100);
      while (t < dts) {
        const stepDt = Math.min(1000 / 60, dts - t);
        step(s, stepDt / 1000, bounds);
        t += stepDt;
        if (s.over) break;
      }
    }

    if (s.score > this.prevScore) {
      const gained = s.score - this.prevScore;
      this.prevScore = s.score;
      sfx.eat();
      if (gained >= 15) sfx.clear();
      const f = s.fruits[s.fruits.length - 1];
      if (f && f.justMerged)
        this.splash.push({ x: f.x, y: f.y, t: 300 });
      if (s.score > this.best) {
        this.best = s.score;
        this.newBest = true;
        g.save.set("suika:best", this.best);
      }
    } else this.prevScore = s.score;

    this.splash.forEach((p) => (p.t -= dt));
    this.splash = this.splash.filter((p) => p.t > 0);

    if (s.over && !wasOver) {
      sfx.die();
      if (navigator.vibrate) navigator.vibrate(80);
    }
    if (s.over) this.overT += dt;

    if (this.queue.length < 3) this.refillQueue();
  }

  private tryDrop(): void {
    if (!canDrop(this.sim)) return;
    const tier = this.queue.shift();
    if (tier === undefined) return;
    this.refillQueue();
    if (drop(this.sim, tier, this.aimX, DROP_Y)) {
      sfx.tap();
      if (navigator.vibrate) navigator.vibrate(10);
    } else this.queue.unshift(tier);
  }

  render(g: GameContext): void {
    const { ctx, w, h } = g;
    const s = this.sim;
    const sv = Math.min(w, h);
    const { scale, ox, oy } = this.geo(g);

    ctx.save();
    if (s.shake > 0 && !s.over)
      ctx.translate(Math.sin(s.shake * 60) * 3, Math.cos(s.shake * 70) * 2);

    inkText(ctx, `${s.score}`, w * 0.18, h * 0.045, sv * 0.055, PALETTE.ink, "900");
    inkText(ctx, `best ${this.best}`, w * 0.18, h * 0.09, sv * 0.026, PALETTE.gray);
    if (this.newBest && s.score === this.best && s.score > 0)
      inkText(ctx, "★ new best!", w * 0.18, h * 0.115, sv * 0.024, this.accent);

    inkText(ctx, "next", w * 0.82, h * 0.035, sv * 0.026, PALETTE.gray);
    this.queue.slice(0, 3).forEach((tier, i) => {
      const r = TIERS[tier].r * scale * 0.55;
      const px = w * 0.82 + (i - 1) * r * 2.6;
      const py = h * 0.075;
      this.drawFruit(ctx, px, py, r * 1.6 / TIERS[tier].r / scale, tier, false);
      void r;
    });

    inkRect(
      ctx,
      ox - 4,
      oy + LOSS_Y * scale,
      WORLD_W * scale + 8,
      (WORLD_H - LOSS_Y) * scale,
      PALETTE.white,
      PALETTE.ink,
      4,
    );
    ctx.strokeStyle = PALETTE.accent;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(ox, oy + LOSS_Y * scale);
    ctx.lineTo(ox + WORLD_W * scale, oy + LOSS_Y * scale);
    ctx.stroke();
    ctx.setLineDash([]);

    if (!s.over && canDrop(s)) {
      const tier = this.queue[0];
      const r = TIERS[tier].r * scale;
      const px = ox + this.aimX * scale;
      const py = oy + DROP_Y * scale;
      ctx.globalAlpha = 0.5;
      this.drawFruit(ctx, px, py, scale, tier, false);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = PALETTE.gray;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 10]);
      ctx.beginPath();
      ctx.moveTo(px, py + r);
      ctx.lineTo(px, oy + WORLD_H * scale);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    for (const f of s.fruits) {
      const px = ox + f.x * scale;
      const py = oy + f.y * scale;
      this.drawFruit(ctx, px, py, scale, f.tier, f.justMerged);
    }

    for (const p of this.splash) {
      ctx.globalAlpha = p.t / 300;
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 2.5;
      const r = (1 - p.t / 300) * scale * 1.4 + scale * 0.3;
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + p.t;
        ctx.beginPath();
        ctx.moveTo(ox + p.x * scale + Math.cos(a) * r * 0.5, oy + p.y * scale + Math.sin(a) * r * 0.5);
        ctx.lineTo(ox + p.x * scale + Math.cos(a) * r, oy + p.y * scale + Math.sin(a) * r);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    if (s.over) {
      ctx.fillStyle = `rgba(246,241,231,${Math.min(0.85, this.overT / 400)})`;
      ctx.fillRect(0, 0, w, h);
      if (this.overT > 400) {
        speedLines(ctx, w / 2, h / 2, sv * 0.25, Math.max(w, h) * 0.75, 0.5, 36);
        speechBubble(ctx, `The orchard overflows — ${s.score}`, w / 2, h * 0.44, sv * 0.05);
        inkText(ctx, "tap to return", w / 2, h * 0.56, sv * 0.035, PALETTE.gray);
        if (this.overT > 800 && g.input.consumeEvents().length > 0) g.exit();
      }
    } else {
      if (g.input.isPointerDown() && !this.dragging) this.tryDrop();
      if (this.dragging && !g.input.isPointerDown()) {
        this.tryDrop();
        this.dragging = false;
      }
    }
  }

  private drawFruit(
    ctx: CanvasRenderingContext2D,
    px: number,
    py: number,
    scale: number,
    tier: number,
    fresh: boolean,
  ): void {
    const t = TIERS[tier];
    const r = t.r * scale;
    ctx.fillStyle = t.color;
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255,253,248,0.35)";
    ctx.beginPath();
    ctx.arc(px - r * 0.3, py - r * 0.3, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = t.leaf;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    if (tier === 6 || tier === 7) {
      ctx.moveTo(px - r * 0.5, py - r * 0.9);
      ctx.lineTo(px - r * 0.1, py - r * 0.55);
      ctx.moveTo(px + r * 0.3, py - r * 0.9);
      ctx.lineTo(px - r * 0.1, py - r * 0.55);
    } else {
      ctx.moveTo(px, py - r * 0.7);
      ctx.lineTo(px + r * 0.25, py - r * 1.05);
    }
    ctx.stroke();
    if (fresh) {
      ctx.strokeStyle = PALETTE.accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(px, py, r + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  teardown(): void {
    this.dragging = false;
  }
}
