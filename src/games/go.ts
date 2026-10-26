import type { Game, GameContext } from "./types";
import { PALETTE, inkRect, inkText, speechBubble } from "../engine/style";
import { sfx } from "../engine/sfx";
import {
  boardKey,
  newGoBoard,
  place,
  scoreArea,
  type GoBoard,
  type Stone,
} from "./go-logic";

type Phase = "size" | "play" | "end";
const SIZES = [9, 13, 19];

export class GoGame implements Game {
  readonly id = "go";
  readonly name = "Ink Go";
  readonly blurb = "Territory, captures, ko. Pass twice to score.";
  readonly accent = "#d43d2a";

  private board: GoBoard = newGoBoard(9);
  private size = 9;
  private turn: "w" | "b" = "b";
  private history = new Set<string>();
  private phase: Phase = "size";
  private passes = 0;
  private komi = 6.5;
  private captured = { b: 0, w: 0 };
  private last: [number, number] | null = null;
  private msg = "";
  private score: { black: number; white: number; dame: number } | null = null;

  init(g: GameContext): void {
    void g;
    this.phase = "size";
    this.board = newGoBoard(9);
    this.size = 9;
    this.turn = "b";
    this.history = new Set([boardKey(this.board)]);
    this.passes = 0;
    this.captured = { b: 0, w: 0 };
    this.last = null;
    this.msg = "";
    this.score = null;
  }

  private geo(g: GameContext): { ox: number; oy: number; cell: number } {
    const board = Math.min(g.w * 0.94, g.h * 0.8);
    const cell = board / this.size;
    return {
      ox: (g.w - board) / 2,
      oy: (g.h - board) / 2 + g.h * 0.02,
      cell,
    };
  }

  update(dt: number, g: GameContext): void {
    void dt;
    const events = g.input.consumeEvents();

    if (this.phase === "size") {
      for (const e of events) {
        if (e.type !== "tap") continue;
        const s = Math.min(g.w, g.h);
        const bw = Math.min(g.w * 0.8, 360);
        const bh = s * 0.11;
        const gap = bh * 0.5;
        const top = g.h * 0.32;
        SIZES.forEach((opt, i) => {
          const y = top + i * (bh + gap);
          if (
            e.x > g.w / 2 - bw / 2 &&
            e.x < g.w / 2 + bw / 2 &&
            e.y > y &&
            e.y < y + bh
          ) {
            this.size = opt;
            this.board = newGoBoard(opt);
            this.history = new Set([boardKey(this.board)]);
            this.phase = "play";
            sfx.tap();
          }
        });
      }
      return;
    }

    const { ox, oy, cell } = this.geo(g);
    const passY = g.h * 0.955;
    const passH = Math.min(g.w, g.h) * 0.05;

    for (const e of events) {
      if (e.type !== "tap") continue;
      if (this.phase === "end") {
        g.exit();
        return;
      }
      if (e.y > passY - passH) {
        this.passes++;
        this.turn = this.turn === "w" ? "b" : "w";
        sfx.tap();
        if (this.passes >= 2) {
          this.score = scoreArea(this.board, this.komi);
          this.phase = "end";
          sfx.win();
        } else this.msg = "Pass — pass again to end and score.";
        continue;
      }
      const gx = Math.floor((e.x - ox) / cell);
      const gy = Math.floor((e.y - oy) / cell);
      if (gx < 0 || gx >= this.size || gy < 0 || gy >= this.size) continue;
      const res = place(this.board, gx, gy, this.turn, this.history);
      if (!res.ok) {
        this.msg =
          res.reason === "ko"
            ? "Ko — that would repeat the board."
            : res.reason === "suicide"
              ? "Suicide — that stone would have no liberties."
              : "Occupied.";
        sfx.die();
        continue;
      }
      this.board = res.board;
      this.history.add(boardKey(res.board));
      this.captured[this.turn] += res.captured;
      if (res.captured > 0) {
        sfx.eat();
        if (navigator.vibrate) navigator.vibrate(20);
      } else sfx.move();
      this.last = [gx, gy];
      this.turn = this.turn === "w" ? "b" : "w";
      this.passes = 0;
      this.msg = "";
    }
  }

  render(g: GameContext): void {
    const { ctx, w, h } = g;
    const s = Math.min(w, h);

    if (this.phase === "size") {
      inkText(ctx, "Ink Go", w / 2, h * 0.15, s * 0.07, PALETTE.ink, "900");
      inkText(ctx, "choose your board", w / 2, h * 0.23, s * 0.035, PALETTE.gray);
      const bw = Math.min(w * 0.8, 360);
      const bh = s * 0.11;
      const gap = bh * 0.5;
      SIZES.forEach((opt, i) => {
        const y = h * 0.32 + i * (bh + gap);
        inkRect(ctx, w / 2 - bw / 2, y, bw, bh, PALETTE.white, PALETTE.ink, 3.5);
        inkText(ctx, `${opt} × ${opt}`, w / 2, y + bh / 2, s * 0.05, PALETTE.ink, "700");
      });
      return;
    }

    const { ox, oy, cell } = this.geo(g);
    inkRect(ctx, ox - 8, oy - 8, cell * this.size + 16, cell * this.size + 16, "#e8dcbf", PALETTE.ink, 4);

    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < this.size; i++) {
      ctx.beginPath();
      ctx.moveTo(ox + i * cell + cell / 2, oy + cell / 2);
      ctx.lineTo(ox + i * cell + cell / 2, oy + (this.size - 0.5) * cell);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ox + cell / 2, oy + i * cell + cell / 2);
      ctx.lineTo(ox + (this.size - 0.5) * cell, oy + i * cell + cell / 2);
      ctx.stroke();
    }

    const stars: [number, number][] =
      this.size === 9
        ? [
            [2, 2],
            [6, 2],
            [4, 4],
            [2, 6],
            [6, 6],
          ]
        : this.size === 13
          ? [
              [3, 3],
              [9, 3],
              [6, 6],
              [3, 9],
              [9, 9],
            ]
          : [
              [3, 3],
              [9, 3],
              [15, 3],
              [3, 9],
              [9, 9],
              [15, 9],
              [3, 15],
              [9, 15],
              [15, 15],
            ];
    ctx.fillStyle = PALETTE.ink;
    for (const [sx, sy] of stars) {
      ctx.beginPath();
      ctx.arc(ox + sx * cell + cell / 2, oy + sy * cell + cell / 2, cell * 0.09, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let y = 0; y < this.size; y++)
      for (let x = 0; x < this.size; x++) {
        const st = this.board[y][x] as Stone;
        if (!st) continue;
        const px = ox + x * cell + cell / 2;
        const py = oy + y * cell + cell / 2;
        ctx.fillStyle = st === "b" ? PALETTE.ink : PALETTE.white;
        ctx.strokeStyle = PALETTE.ink;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(px, py, cell * 0.44, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

    if (this.last) {
      const [lx, ly] = this.last;
      ctx.strokeStyle = this.accent;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(
        ox + lx * cell + cell / 2,
        oy + ly * cell + cell / 2,
        cell * 0.5,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }

    inkText(
      ctx,
      this.turn === "b" ? "Black's turn" : "White's turn",
      w / 2,
      h * 0.045,
      s * 0.04,
      this.turn === "b" ? PALETTE.ink : PALETTE.accent,
    );
    inkText(
      ctx,
      `captured ⚑ b:${this.captured.b} w:${this.captured.w}`,
      w / 2,
      h * 0.09,
      s * 0.03,
      PALETTE.gray,
    );

    if (this.phase === "end" && this.score) {
      const diff = Math.abs(this.score.black - this.score.white).toFixed(1);
      const winnerName =
        this.score.black > this.score.white ? "Black" : "White";
      ctx.fillStyle = "rgba(246,241,231,0.85)";
      ctx.fillRect(0, 0, w, h);
      speechBubble(
        ctx,
        `${winnerName} wins by ${diff} — b ${this.score.black} : w ${this.score.white}`,
        w / 2,
        h * 0.44,
        s * 0.05,
      );
      inkText(ctx, "tap to return", w / 2, h * 0.58, s * 0.035, PALETTE.gray);
      return;
    }

    const passH = s * 0.05;
    inkRect(ctx, w / 2 - w * 0.18, h * 0.955 - passH / 2, w * 0.36, passH, PALETTE.white, PALETTE.ink, 3);
    inkText(ctx, "pass", w / 2, h * 0.955, s * 0.035, PALETTE.ink);

    if (this.msg)
      speechBubble(ctx, this.msg, w / 2, h * 0.86, s * 0.032);
  }

  teardown(): void {}
}
