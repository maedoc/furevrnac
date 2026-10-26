import type { Game, GameContext } from "./types";
import { PALETTE, inkRect, inkText, speechBubble, speedLines } from "../engine/style";
import { sfx } from "../engine/sfx";
import {
  applyMove,
  gameStatus,
  initialBoard,
  isInCheck,
  legalTargets,
  type Castling,
  type Move,
  type Piece,
} from "./chess-logic";

const GLYPH: Record<string, string> = {
  wK: "♔",
  wQ: "♕",
  wR: "♖",
  wB: "♗",
  wN: "♘",
  wP: "♙",
  bK: "♚",
  bQ: "♛",
  bR: "♜",
  bB: "♝",
  bN: "♞",
  bP: "♟",
};

export class ChessGame implements Game {
  readonly id = "chess";
  readonly name = "Ink Chess";
  readonly blurb = "Two brushes, one board. Pass and play.";
  readonly accent = "#d43d2a";

  private board = initialBoard();
  private turn: "w" | "b" = "w";
  private rights: Castling = { wK: true, wQ: true, bK: true, bQ: true };
  private ep: [number, number] | null = null;
  private sel: [number, number] | null = null;
  private targets: Move[] = [];
  private last: { from: [number, number]; to: [number, number] } | null = null;
  private status: "playing" | "check" | "checkmate" | "stalemate" = "playing";
  private promoPick: { moves: Move[]; from: [number, number]; to: [number, number] } | null = null;
  private moveCount = 0;

  init(g: GameContext): void {
    void g;
    this.board = initialBoard();
    this.turn = "w";
    this.rights = { wK: true, wQ: true, bK: true, bQ: true };
    this.ep = null;
    this.sel = null;
    this.targets = [];
    this.last = null;
    this.status = "playing";
    this.promoPick = null;
    this.moveCount = 0;
  }

  private geometry(g: GameContext): { ox: number; oy: number; cell: number } {
    const size = Math.min(g.w * 0.94, g.h * 0.84);
    const cell = size / 8;
    return {
      ox: (g.w - size) / 2,
      oy: (g.h - size) / 2 + g.h * 0.01,
      cell,
    };
  }

  private tryCommit(move: Move, g: GameContext): void {
    const { board, ep } = applyMove(this.board, move, this.rights);
    this.board = board;
    this.ep = ep;
    this.last = { from: move.from, to: move.to };
    this.sel = null;
    this.targets = [];
    this.turn = this.turn === "w" ? "b" : "w";
    this.moveCount++;
    this.status = gameStatus(this.board, this.turn, this.rights, this.ep);
    if (this.status === "checkmate") {
      sfx.win();
    } else if (this.status === "check") {
      sfx.check();
    } else {
      sfx.move();
    }
    if (navigator.vibrate && this.status === "checkmate")
      navigator.vibrate([40, 60, 40]);
    void g;
  }

  update(dt: number, g: GameContext): void {
    void dt;
    const { ox, oy, cell } = this.geometry(g);
    const events = g.input.consumeEvents();

    const promo = this.promoPick;
    if (promo) {
      for (const e of events) {
        if (e.type !== "tap") continue;
        const moves: Move[] = promo.moves;
        const pick = moves.find((m) => {
          const [tx, ty] = m.to;
          const px = ox + tx * cell + cell / 2;
          const py = oy + ty * cell + cell / 2;
          return Math.hypot(e.x - px, e.y - py) < cell * 0.75;
        });
        if (pick) {
          this.tryCommit(pick, g);
          this.promoPick = null;
        }
      }
      return;
    }

    for (const e of events) {
      if (e.type !== "tap") continue;
      if (this.status === "checkmate" || this.status === "stalemate") {
        g.exit();
        return;
      }
      const gx = Math.floor((e.x - ox) / cell);
      const gy = Math.floor((e.y - oy) / cell);
      if (gx < 0 || gx > 7 || gy < 0 || gy > 7) continue;

      const existing = this.targets.find(
        (m) => m.to[0] === gx && m.to[1] === gy,
      );
      if (this.sel && existing) {
        const promos = this.targets.filter(
          (m) => m.to[0] === gx && m.to[1] === gy && m.promo,
        );
        if (promos.length > 0) {
          this.promoPick = { moves: promos, from: this.sel, to: [gx, gy] };
          sfx.tap();
        } else {
          this.tryCommit(existing, g);
        }
        continue;
      }

      const p = this.board[gy][gx];
      if (p && p[0] === this.turn) {
        this.sel = [gx, gy];
        this.targets = legalTargets(this.board, gx, gy, this.rights, this.ep);
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
    const { ox, oy, cell } = this.geometry(g);

    inkRect(ctx, ox - 6, oy - 6, cell * 8 + 12, cell * 8 + 12, PALETTE.white, PALETTE.ink, 4);

    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const light = (x + y) % 2 === 0;
        ctx.fillStyle = light ? PALETTE.paper : "#e8e0d0";
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
    }

    const [kx, ky] = [-1, -1];
    void kx;
    void ky;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const p = this.board[y][x] as Piece;
        if (p && p[1] === "K" && isInCheck(this.board, p[0] as "w" | "b")) {
          ctx.fillStyle = "rgba(212,61,42,0.3)";
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
    }

    if (this.sel) {
      ctx.strokeStyle = this.accent;
      ctx.lineWidth = 3.5;
      ctx.strokeRect(ox + this.sel[0] * cell + 2, oy + this.sel[1] * cell + 2, cell - 4, cell - 4);
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const p = this.board[y][x];
        if (!p) continue;
        const glyph = GLYPH[p];
        const px = ox + x * cell + cell / 2;
        const py = oy + y * cell + cell / 2 + cell * 0.02;
        ctx.font = `${Math.round(cell * 0.72)}px "Segoe UI Symbol", "Noto Sans Symbols2", serif`;
        ctx.fillStyle =
          p[0] === "w"
            ? PALETTE.white
            : PALETTE.ink;
        ctx.strokeStyle = PALETTE.ink;
        ctx.lineWidth = 1.5;
        ctx.lineJoin = "round";
        ctx.strokeText(glyph, px, py);
        ctx.fillText(glyph, px, py);
      }
    }

    const turnLabel =
      this.turn === "w" ? "White's turn" : "Black's turn";
    inkText(ctx, turnLabel, w / 2, h * 0.045, s * 0.04, this.turn === "w" ? PALETTE.ink : PALETTE.accent);
    inkText(ctx, `${Math.ceil(this.moveCount / 2)} moves`, w / 2, h * 0.965, s * 0.03, PALETTE.gray);

    if (this.promoPick) {
      ctx.fillStyle = "rgba(246,241,231,0.6)";
      ctx.fillRect(0, 0, w, h);
      const { moves, to } = this.promoPick;
      const [tx, ty] = to;
      moves.forEach((m, i) => {
        const px = ox + tx * cell + cell / 2;
        const py = oy + ty * cell + cell / 2 + (i - 1.5) * cell * 0.9;
        inkRect(ctx, px - cell * 0.4, py - cell * 0.4, cell * 0.8, cell * 0.8, PALETTE.white, PALETTE.ink, 2.5);
        ctx.font = `${Math.round(cell * 0.5)}px "Segoe UI Symbol", serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = PALETTE.ink;
        ctx.fillText(GLYPH[m.promo!], px, py);
      });
      return;
    }

    if (this.status === "checkmate") {
      const winner = this.turn === "w" ? "Black" : "White";
      speedLines(ctx, w / 2, h / 2, s * 0.25, Math.max(w, h) * 0.75, 0.4, 36);
      speechBubble(ctx, `Checkmate — ${winner} wins!`, w / 2, h * 0.46, s * 0.05);
      inkText(ctx, "tap to return", w / 2, h * 0.58, s * 0.035, PALETTE.gray);
    } else if (this.status === "stalemate") {
      speechBubble(ctx, "Stalemate — a draw", w / 2, h * 0.46, s * 0.05);
      inkText(ctx, "tap to return", w / 2, h * 0.58, s * 0.035, PALETTE.gray);
    } else if (this.status === "check") {
      speechBubble(ctx, "Check!", w / 2, h * 0.9, s * 0.04, );
    }
  }

  teardown(): void {}
}
