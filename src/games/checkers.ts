import type { Game, GameContext } from "./types";
import { PALETTE, inkRect, inkText, speechBubble, speedLines } from "../engine/style";
import { sfx } from "../engine/sfx";
import {
  allMoves,
  applyCheckers,
  colorOf,
  initialCheckers,
  jumpsFor,
  movesFor,
  winner,
  type CMove,
  type Draught,
} from "./checkers-logic";

export class CheckersGame implements Game {
  readonly id = "checkers";
  readonly name = "Ink Checkers";
  readonly blurb = "Two brushes, forced captures, kings.";
  readonly accent = "#d43d2a";

  private board = initialCheckers();
  private turn: "w" | "b" = "w";
  private sel: [number, number] | null = null;
  private targets: CMove[] = [];
  private chain: [number, number] | null = null;
  private last: { from: [number, number]; to: [number, number] } | null = null;
  private win: "w" | "b" | null = null;

  init(g: GameContext): void {
    void g;
    this.board = initialCheckers();
    this.turn = "w";
    this.sel = null;
    this.targets = [];
    this.chain = null;
    this.last = null;
    this.win = null;
  }

  private geo(g: GameContext): { ox: number; oy: number; cell: number } {
    const size = Math.min(g.w * 0.94, g.h * 0.84);
    const cell = size / 8;
    return {
      ox: (g.w - size) / 2,
      oy: (g.h - size) / 2 + g.h * 0.01,
      cell,
    };
  }

  update(dt: number, g: GameContext): void {
    void dt;
    const { ox, oy, cell } = this.geo(g);
    for (const e of g.input.consumeEvents()) {
      if (e.type !== "tap") continue;
      if (this.win) {
        g.exit();
        return;
      }
      const gx = Math.floor((e.x - ox) / cell);
      const gy = Math.floor((e.y - oy) / cell);
      if (gx < 0 || gx > 7 || gy < 0 || gy > 7) continue;

      const move = this.targets.find((m) => m.to[0] === gx && m.to[1] === gy);
      if (this.sel && move) {
        const nb = applyCheckers(this.board, move);
        this.last = { from: move.from, to: move.to };
        sfx.move();
        if (move.jump) {
          sfx.eat();
          if (navigator.vibrate) navigator.vibrate(20);
        }
        if (move.jump && jumpsFor(nb, gx, gy).length > 0) {
          this.board = nb;
          this.chain = [gx, gy];
          this.sel = [gx, gy];
          this.targets = jumpsFor(nb, gx, gy);
        } else {
          this.board = nb;
          this.chain = null;
          this.sel = null;
          this.targets = [];
          this.turn = this.turn === "w" ? "b" : "w";
          this.win = winner(this.board);
          if (this.win) sfx.win();
        }
        continue;
      }

      if (this.chain) continue;
      const p = this.board[gy][gx];
      if (p && colorOf(p) === this.turn) {
        this.sel = [gx, gy];
        const { moves, mustJump } = allMoves(this.board, this.turn);
        const mine = mustJump
          ? moves.filter((m) => m.from[0] === gx && m.from[1] === gy)
          : movesFor(this.board, gx, gy);
        this.targets = mine;
        sfx.tap();
      } else {
        this.sel = null;
        this.targets = [];
      }
    }
  }

  render(g: GameContext): void {
    const { ctx, w, h } = g;
    const s = Math.min(w, h);
    const { ox, oy, cell } = this.geo(g);

    inkRect(ctx, ox - 6, oy - 6, cell * 8 + 12, cell * 8 + 12, PALETTE.white, PALETTE.ink, 4);
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? PALETTE.paper : PALETTE.tint1;
        ctx.fillRect(ox + x * cell, oy + y * cell, cell, cell);
        if (this.last) {
          const [fx, fy] = this.last.from;
          const [tx, ty] = this.last.to;
          if ((x === fx && y === fy) || (x === tx && y === ty)) {
            ctx.fillStyle = "rgba(212,61,42,0.18)";
            ctx.fillRect(ox + x * cell, oy + y * cell, cell, cell);
          }
        }
      }

    for (const m of this.targets) {
      const [tx, ty] = m.to;
      ctx.fillStyle = "rgba(212,61,42,0.35)";
      ctx.beginPath();
      ctx.arc(ox + tx * cell + cell / 2, oy + ty * cell + cell / 2, cell * 0.14, 0, Math.PI * 2);
      ctx.fill();
      if (m.jump) {
        const [cx, cy] = m.jump.captured;
        ctx.strokeStyle = PALETTE.accent;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(ox + cx * cell + cell / 2, oy + cy * cell + cell / 2, cell * 0.4, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    if (this.sel) {
      ctx.strokeStyle = this.accent;
      ctx.lineWidth = 3.5;
      ctx.strokeRect(ox + this.sel[0] * cell + 2, oy + this.sel[1] * cell + 2, cell - 4, cell - 4);
    }

    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        const p = this.board[y][x] as Draught;
        if (!p) continue;
        const px = ox + x * cell + cell / 2;
        const py = oy + y * cell + cell / 2;
        const r = cell * 0.34;
        const isKing = p === "W" || p === "B";
        ctx.fillStyle = p.toLowerCase() === "w" ? PALETTE.white : PALETTE.ink;
        ctx.strokeStyle = PALETTE.ink;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        if (isKing) {
          ctx.strokeStyle = this.accent;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(px, py, r * 0.5, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

    const turnLabel = this.chain
      ? "Multi-jump — keep going!"
      : this.turn === "w"
        ? "White's turn"
        : "Black's turn";
    inkText(
      ctx,
      turnLabel,
      w / 2,
      h * 0.045,
      s * 0.04,
      this.turn === "w" ? PALETTE.ink : PALETTE.accent,
    );

    if (this.win) {
      const name = this.win === "w" ? "White" : "Black";
      speedLines(ctx, w / 2, h / 2, s * 0.25, Math.max(w, h) * 0.75, 0.4, 36);
      speechBubble(ctx, `${name} sweeps the board!`, w / 2, h * 0.46, s * 0.05);
      inkText(ctx, "tap to return", w / 2, h * 0.58, s * 0.035, PALETTE.gray);
    }
  }

  teardown(): void {}
}
