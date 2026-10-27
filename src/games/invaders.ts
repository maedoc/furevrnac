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
  BUNKER_Y,
  H,
  PLAYER_Y,
  W,
  initState,
  movePlayer,
  shoot,
  step,
  type SimState,
} from "./invaders-sim";

const GLYPHS = ["👾", " UFO ", "🐙"];

export class InvadersGame implements Game {
  readonly id = "invaders";
  readonly name = "Ink Sky Guard";
  readonly blurb = "Drag to aim, tap to fire. Hold the line.";
  readonly accent = "#d43d2a";

  private sim: SimState = initState();
  private best = 0;
  private overT = 0;

  init(g: GameContext): void {
    this.sim = initState();
    this.best = g.save.get("invaders:best", 0);
    this.overT = 0;
  }

  private geo(g: GameContext): { scale: number; ox: number; oy: number } {
    const scale = Math.min(g.w / (W + 1), g.h / (H + 2));
    return {
      scale,
      ox: g.w / 2,
      oy: g.h * 0.05,
    };
  }

  update(dt: number, g: GameContext): void {
    const s = this.sim;
    const wasOver = s.over;
    const { scale, ox } = this.geo(g);

    const events = g.input.consumeEvents();
    for (const e of events) {
      if (e.type === "drag" || e.type === "tap" || e.type === "longpress") {
        const targetPx = (e.x - ox) / scale;
        movePlayer(s, targetPx - s.px);
      }
    }
    // continuous tracking while held
    if (g.input.isPointerDown()) {
      const p = g.input.pointerPos();
      const targetPx = (p.x - ox) / scale;
      const dx = (targetPx - s.px) * Math.min(1, dt / 80);
      movePlayer(s, dx);
      // autofire while held
      if (shoot(s)) sfx.tap();
    } else if (events.some((e) => e.type === "tap")) {
      if (shoot(s)) sfx.tap();
    }

    let t = 0;
    while (t < dt) {
      const stepDt = Math.min(1000 / 60, dt - t);
      step(s, stepDt / 1000, Math.random);
      t += stepDt;
    }

    if (s.over && !wasOver) {
      sfx.die();
      if (navigator.vibrate) navigator.vibrate(80);
      if (s.score > this.best) {
        this.best = s.score;
        g.save.set("invaders:best", this.best);
      }
    }
    if (s.over) this.overT += dt;
  }

  render(g: GameContext): void {
    const { ctx, w, h } = g;
    const s = this.sim;
    const sv = Math.min(w, h);
    const { scale, ox, oy } = this.geo(g);
    const sx = (x: number): number => ox + x * scale;
    const sy = (y: number): number => oy + y * scale;

    ctx.fillStyle = PALETTE.paper;
    ctx.fillRect(0, 0, w, h);

    // ground line
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sx(-W / 2), sy(PLAYER_Y + 1));
    ctx.lineTo(sx(W / 2), sy(PLAYER_Y + 1));
    ctx.stroke();

    // bunkers
    for (const b of s.bunkers) {
      if (b.hp <= 0) continue;
      const size = scale * 1.0 * (0.5 + b.hp * 0.17);
      ctx.font = `${Math.round(scale * 1.1)}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🛡️", sx(b.x), sy(BUNKER_Y));
      void size;
    }

    // invaders
    ctx.font = `${Math.round(scale * 1.5)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const i of s.invaders) {
      if (!i.alive) continue;
      const glyph = i.kind === 0 ? "👾" : i.kind === 1 ? "🛸" : "🐙";
      ctx.fillText(glyph, sx(i.gx), sy(i.gy));
    }
    void GLYPHS;

    // player ship
    ctx.font = `${Math.round(scale * 1.6)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.fillText("🖌️", sx(s.px), sy(PLAYER_Y));

    // bullets
    for (const b of s.bullets) {
      if (b.friendly) {
        ctx.strokeStyle = PALETTE.accent;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(sx(b.x), sy(b.y) - 6);
        ctx.lineTo(sx(b.x), sy(b.y) + 6);
        ctx.stroke();
      } else {
        ctx.fillStyle = PALETTE.ink;
        ctx.beginPath();
        ctx.arc(sx(b.x), sy(b.y), scale * 0.18, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    inkText(ctx, `${s.score}`, w * 0.2, h * 0.03, sv * 0.045, PALETTE.accent, "900");
    inkText(ctx, `wave ${s.wave}`, w * 0.5, h * 0.03, sv * 0.032, PALETTE.ink);
    inkText(ctx, `♥ ${s.lives}  best ${this.best}`, w * 0.8, h * 0.03, sv * 0.03, PALETTE.gray);
    void hexWithAlpha;
    void inkRect;

    if (s.over) {
      ctx.fillStyle = hexWithAlpha(PALETTE.paper, Math.min(0.85, this.overT / 400));
      ctx.fillRect(0, 0, w, h);
      if (this.overT > 400) {
        speedLines(ctx, w / 2, h / 2, sv * 0.25, Math.max(w, h) * 0.75, 0.5, 36);
        speechBubble(ctx, `The line breaks — ${s.score}`, w / 2, h * 0.44, sv * 0.05);
        inkText(ctx, "tap to return", w / 2, h * 0.56, sv * 0.035, PALETTE.gray);
        if (this.overT > 800 && g.input.consumeEvents().length > 0) g.exit();
      }
    }
  }

  teardown(): void {}
}
