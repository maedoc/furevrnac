import type { Game, GameContext } from "./types";
import {
  PALETTE,
  inkRect,
  inkText,
  speechBubble,
  hexWithAlpha,
} from "../engine/style";
import { sfx } from "../engine/sfx";
import {
  COLS,
  ROWS,
  EXIT_X,
  EXIT_W,
  PUZZLES,
  initState,
  pieceAt,
  canSlide,
  slide,
  clonePieces,
  restorePieces,
  type SimState,
  type Piece,
} from "./khunpan-sim";

type Phase = "play" | "won" | "alldone";

const KIND_FILL: Record<Piece["kind"], string> = {
  hero: PALETTE.accent,
  general: PALETTE.ink,
  guard: PALETTE.tint3,
  soldier: PALETTE.tint1,
};

export class KhunpanGame implements Game {
  readonly id = "khunpan";
  readonly name = "Khun Pan";
  readonly blurb = "Slide the blocks, free the trapped hero at the gate.";
  readonly accent = "#a0522d";

  private sim: SimState = initState(0);
  private phase: Phase = "play";
  private undoStack: Piece[][] = [];
  private bests: Record<string, number> = {};
  private grab: { id: number; offX: number; offY: number } | null = null;
  private wonT = 0;
  private lastPuzzle = 0;

  init(g: GameContext): void {
    this.bests = g.save.get("khunpan:best", {} as Record<string, number>);
    this.lastPuzzle = g.save.get("khunpan:last", 0);
    this.loadPuzzle(this.lastPuzzle);
  }

  private loadPuzzle(idx: number): void {
    this.sim = initState(idx);
    this.lastPuzzle = idx;
    this.undoStack = [];
    this.grab = null;
    this.phase = "play";
    this.wonT = 0;
  }

  private geo(g: GameContext): { scale: number; ox: number; oy: number } {
    const scale = Math.min((g.w * 0.92) / COLS, (g.h * 0.72) / ROWS);
    return {
      scale,
      ox: (g.w - COLS * scale) / 2,
      oy: g.h * 0.16,
    };
  }

  update(dt: number, g: GameContext): void {
    const { scale, ox, oy } = this.geo(g);

    if (this.phase === "won") {
      this.wonT += dt;
      for (const _e of g.input.consumeEvents()) {
        if (this.wonT > 600) {
          if (this.sim.puzzle + 1 >= PUZZLES.length) {
            this.phase = "alldone";
          } else {
            this.loadPuzzle(this.sim.puzzle + 1);
            g.save.set("khunpan:last", this.lastPuzzle);
            sfx.tap();
          }
        }
        return;
      }
      return;
    }
    if (this.phase === "alldone") {
      for (const _e of g.input.consumeEvents()) {
        g.exit();
        return;
      }
      return;
    }

    for (const e of g.input.consumeEvents()) {
      if (e.type !== "tap") continue;
      this.tryButton(g, e.x, e.y);
    }

    const held = g.input.isPointerDown();
    if (held && !this.grab) {
      const pos = g.input.pointerPos();
      const cx = Math.floor((pos.x - ox) / scale);
      const cy = Math.floor((pos.y - oy) / scale);
      const p = pieceAt(this.sim, cx, cy);
      if (p) {
        this.grab = {
          id: p.id,
          offX: pos.x - (ox + p.x * scale),
          offY: pos.y - (oy + p.y * scale),
        };
      }
    }
    if (held && this.grab) {
      const pos = g.input.pointerPos();
      const p = this.sim.pieces.find((q) => q.id === this.grab!.id)!;
      const wantX = Math.round((pos.x - this.grab.offX - ox) / scale);
      const wantY = Math.round((pos.y - this.grab.offY - oy) / scale);
      const dx = Math.sign(wantX - p.x);
      const dy = Math.sign(wantY - p.y);
      if (dx !== 0 && canSlide(this.sim, p, dx, 0)) {
        this.pushUndo();
        slide(this.sim, p.id, dx, 0);
      } else if (dy !== 0 && canSlide(this.sim, p, 0, dy)) {
        this.pushUndo();
        slide(this.sim, p.id, 0, dy);
      }
      if (this.sim.won) this.onWin(g);
    }
    if (!held) this.grab = null;
  }

  private pushUndo(): void {
    this.undoStack.push(clonePieces(this.sim));
    if (this.undoStack.length > 200) this.undoStack.shift();
  }

  private undo(): void {
    const prev = this.undoStack.pop();
    if (!prev) return;
    restorePieces(this.sim, prev);
    sfx.tap();
  }

  private tryButton(g: GameContext, x: number, y: number): boolean {
    const { scale } = this.geo(g);
    const r = Math.max(28, scale * 0.5);
    const cy = g.h * 0.92;
    if (Math.hypot(x - g.w * 0.18, y - cy) < r * 1.2) {
      this.undo();
      return true;
    }
    if (Math.hypot(x - g.w * 0.82, y - cy) < r * 1.2) {
      this.loadPuzzle(this.sim.puzzle);
      sfx.tap();
      return true;
    }
    return false;
  }

  private onWin(g: GameContext): void {
    sfx.win();
    if (navigator.vibrate) navigator.vibrate(80);
    const key = String(this.sim.puzzle);
    if (!this.bests[key] || this.sim.moves < this.bests[key]) {
      this.bests[key] = this.sim.moves;
      g.save.set("khunpan:best", this.bests);
    }
    this.grab = null;
    this.phase = "won";
    this.wonT = 0;
  }

  render(g: GameContext): void {
    const { ctx, w, h } = g;
    const sv = Math.min(w, h);
    const { scale, ox, oy } = this.geo(g);

    ctx.fillStyle = PALETTE.paper;
    ctx.fillRect(0, 0, w, h);

    inkText(
      ctx,
      `Khun Pan \u00b7 ${PUZZLES[this.sim.puzzle].name}`,
      w / 2,
      h * 0.045,
      sv * 0.035,
      PALETTE.ink,
      "900",
    );
    const best = this.bests[String(this.sim.puzzle)];
    inkText(
      ctx,
      best
        ? `${this.sim.moves} moves \u00b7 best ${best}`
        : `${this.sim.moves} moves`,
      w / 2,
      h * 0.085,
      sv * 0.026,
      PALETTE.gray,
    );

    const bw = COLS * scale;
    const bh = ROWS * scale;
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    const gateL = ox + EXIT_X * scale;
    const gateR = gateL + EXIT_W * scale;
    ctx.beginPath();
    ctx.moveTo(ox - 4, oy + bh + 2);
    ctx.lineTo(gateL, oy + bh + 2);
    ctx.moveTo(gateR, oy + bh + 2);
    ctx.lineTo(ox + bw + 4, oy + bh + 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ox - 2, oy - 2);
    ctx.lineTo(ox + bw + 2, oy - 2);
    ctx.moveTo(ox - 2, oy - 2);
    ctx.lineTo(ox - 2, oy + bh + 2);
    ctx.moveTo(ox + bw + 2, oy - 2);
    ctx.lineTo(ox + bw + 2, oy + bh + 2);
    ctx.stroke();

    ctx.strokeStyle = PALETTE.accent;
    ctx.lineWidth = 3;
    const gy = oy + bh + scale * 0.28;
    for (const [ax, dir] of [
      [gateL + scale * 0.3, -1],
      [gateR - scale * 0.3, 1],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(ax, gy - scale * 0.12);
      ctx.lineTo(ax + dir * scale * 0.18, gy);
      ctx.lineTo(ax, gy + scale * 0.12);
      ctx.stroke();
    }

    for (const p of this.sim.pieces) {
      const px = ox + p.x * scale;
      const py = oy + p.y * scale;
      const pw = p.w * scale;
      const ph = p.h * scale;
      const pad = scale * 0.06;
      const fill = KIND_FILL[p.kind];
      inkRect(ctx, px + pad, py + pad, pw - pad * 2, ph - pad * 2, fill, PALETTE.ink, 3);
      if (p.kind === "general" || p.kind === "hero") {
        ctx.strokeStyle = hexWithAlpha("#ffffff", 0.35);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(px + pad * 2.4, py + pad * 2.4, pw - pad * 4.8, ph - pad * 4.8, 6);
        ctx.stroke();
      }
      if (p.kind === "hero") {
        ctx.fillStyle = hexWithAlpha("#ffffff", 0.85);
        ctx.beginPath();
        ctx.arc(px + pw / 2, py + ph / 2, scale * 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = PALETTE.ink;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(px + pw / 2, py + ph / 2, scale * 0.22, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    const r = Math.max(28, scale * 0.5);
    const cy = g.h * 0.92;
    inkRect(ctx, g.w * 0.18 - r, cy - r, r * 2, r * 2, PALETTE.white, PALETTE.ink, 3);
    inkText(ctx, "\u21a9", g.w * 0.18, cy, r * 0.9, PALETTE.ink);
    inkRect(ctx, g.w * 0.82 - r, cy - r, r * 2, r * 2, PALETTE.white, PALETTE.ink, 3);
    inkText(ctx, "\u21bb", g.w * 0.82, cy, r * 0.9, PALETTE.ink);
    inkText(ctx, "undo", g.w * 0.18, cy + r * 1.5, sv * 0.022, PALETTE.gray);
    inkText(ctx, "reset", g.w * 0.82, cy + r * 1.5, sv * 0.022, PALETTE.gray);

    if (this.phase === "won") {
      ctx.fillStyle = hexWithAlpha(PALETTE.paper, 0.7);
      ctx.fillRect(0, 0, w, h);
      speechBubble(
        ctx,
        `Khun Pan escapes! ${this.sim.moves} moves`,
        w / 2,
        h * 0.42,
        sv * 0.045,
      );
      if (this.wonT > 600) {
        const more = this.sim.puzzle + 1 < PUZZLES.length;
        inkText(
          ctx,
          more ? "tap for the next puzzle" : "tap to return",
          w / 2,
          h * 0.55,
          sv * 0.03,
          PALETTE.gray,
        );
      }
    }
    if (this.phase === "alldone") {
      ctx.fillStyle = hexWithAlpha(PALETTE.paper, 0.85);
      ctx.fillRect(0, 0, w, h);
      speechBubble(ctx, "Every gate is open! \ud83c\udf89", w / 2, h * 0.44, sv * 0.05);
      inkText(ctx, "tap to return", w / 2, h * 0.56, sv * 0.035, PALETTE.gray);
    }
  }

  teardown(): void {}
}
