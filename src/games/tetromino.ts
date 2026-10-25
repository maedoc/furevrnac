import type { Game, GameContext } from "./types";
import {
  PALETTE,
  inkRect,
  inkText,
  speechBubble,
  speedLines,
} from "../engine/style";

const COLS = 10;
const ROWS = 20;

const SHAPES: number[][][] = [
  [[1, 1, 1, 1]],
  [
    [1, 1],
    [1, 1],
  ],
  [
    [0, 1, 0],
    [1, 1, 1],
  ],
  [
    [1, 0, 0],
    [1, 1, 1],
  ],
  [
    [0, 0, 1],
    [1, 1, 1],
  ],
  [
    [1, 1, 0],
    [0, 1, 1],
  ],
  [
    [0, 1, 1],
    [1, 1, 0],
  ],
];

export class TetrominoGame implements Game {
  readonly id = "tetromino";
  readonly name = "Tetromino Fall";
  readonly blurb = "Swipe to move, swipe up to drop.";
  readonly accent = "#d43d2a";

  private board: number[][] = [];
  private piece: { shape: number[][]; x: number; y: number; kind: number } | null = null;
  private nextKind = 0;
  private fallMs = 700;
  private acc = 0;
  private score = 0;
  private lines = 0;
  private best = 0;
  private over = false;
  private clearFlash: number[] = [];
  private flashT = 0;

  init(g: GameContext): void {
    this.board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    this.score = 0;
    this.lines = 0;
    this.fallMs = 700;
    this.acc = 0;
    this.over = false;
    this.clearFlash = [];
    this.flashT = 0;
    this.best = g.save.get("tetromino:best", 0);
    this.nextKind = Math.floor(Math.random() * SHAPES.length);
    this.spawn();
  }

  private collides(shape: number[][], px: number, py: number): boolean {
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (!shape[y][x]) continue;
        const bx = px + x;
        const by = py + y;
        if (bx < 0 || bx >= COLS || by >= ROWS) return true;
        if (by >= 0 && this.board[by][bx]) return true;
      }
    }
    return false;
  }

  private spawn(): void {
    const kind = this.nextKind;
    this.nextKind = Math.floor(Math.random() * SHAPES.length);
    const shape = SHAPES[kind].map((r) => [...r]);
    this.piece = { shape, x: Math.floor((COLS - shape[0].length) / 2), y: -1, kind };
    if (this.collides(shape, this.piece.x, this.piece.y)) {
      this.over = true;
    }
  }

  private lock(g: GameContext): void {
    const p = this.piece!;
    for (let y = 0; y < p.shape.length; y++) {
      for (let x = 0; x < p.shape[y].length; x++) {
        if (!p.shape[y][x]) continue;
        const by = p.y + y;
        const bx = p.x + x;
        if (by >= 0) this.board[by][bx] = p.kind + 1;
      }
    }
    const cleared: number[] = [];
    for (let y = 0; y < ROWS; y++) {
      if (this.board[y].every((v) => v > 0)) cleared.push(y);
    }
    if (cleared.length > 0) {
      this.clearFlash = cleared;
      this.flashT = 320;
      this.lines += cleared.length;
      this.score += [0, 100, 300, 500, 800][cleared.length];
      this.fallMs = Math.max(120, 700 - this.lines * 12);
      if (navigator.vibrate) navigator.vibrate(cleared.length > 2 ? 60 : 25);
      cleared
        .sort((a, b) => a - b)
        .forEach((cy) => {
          this.board.splice(cy, 1);
          this.board.unshift(Array(COLS).fill(0));
        });
    }
    this.spawn();
    if (this.over && this.score > this.best) {
      this.best = this.score;
      g.save.set("tetromino:best", this.best);
    }
  }

  private tryMove(dx: number, dy: number): boolean {
    const p = this.piece!;
    if (!this.collides(p.shape, p.x + dx, p.y + dy)) {
      p.x += dx;
      p.y += dy;
      return true;
    }
    return false;
  }

  private rotate(): void {
    const p = this.piece!;
    const r = p.shape[0].map((_, i) => p.shape.map((row) => row[i]).reverse());
    if (!this.collides(r, p.x, p.y)) p.shape = r;
  }

  private hardDrop(g: GameContext): void {
    while (this.tryMove(0, 1)) {
      /* drop */
    }
    this.lock(g);
  }

  update(dt: number, g: GameContext): void {
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) this.clearFlash = [];
    }
    if (this.over || !this.piece) {
      for (const e of g.input.consumeEvents()) {
        if (e.type === "tap") g.exit();
      }
      return;
    }

    for (const e of g.input.consumeEvents()) {
      if (e.type === "swipe") {
        if (e.dir === "left") {
          this.tryMove(-1, 0);
        } else if (e.dir === "right") {
          this.tryMove(1, 0);
        } else if (e.dir === "down") {
          if (this.tryMove(0, 1)) this.score += 1;
        } else {
          this.rotate();
        }
      } else if (e.type === "tap") {
        this.hardDrop(g);
      }
    }

    this.acc += dt;
    while (this.acc >= this.fallMs) {
      this.acc -= this.fallMs;
      if (!this.tryMove(0, 1)) this.lock(g);
      if (this.over || !this.piece) break;
    }
  }

  render(g: GameContext): void {
    const { ctx, w, h } = g;
    const s = Math.min(w, h);
    const cell = Math.min((w * 0.9) / COLS, (h * 0.86) / ROWS);
    const ox = w / 2 - (cell * COLS) / 2;
    const oy = h / 2 - (cell * ROWS) / 2 + s * 0.01;

    inkRect(ctx, ox - 5, oy - 5, cell * COLS + 10, cell * ROWS + 10, PALETTE.white, PALETTE.ink, 4);

    const kindFill = (k: number): string => {
      const fills = ["#fffdf8", "#eed9c4", "#d43d2a", "#e8b98a", "#f6f1e7", "#eed9c4", "#e8b98a"];
      return fills[(k - 1) % fills.length];
    };

    const drawCell = (x: number, y: number, k: number, ghost = false): void => {
      const px = ox + x * cell;
      const py = oy + y * cell;
      if (this.clearFlash.includes(y)) return;
      ctx.save();
      if (ghost) ctx.globalAlpha = 0.25;
      inkRect(ctx, px + 1, py + 1, cell - 2, cell - 2, k === 0 ? PALETTE.paper : kindFill(k), PALETTE.ink, 2);
      ctx.restore();
    };

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        drawCell(x, y, this.board[y][x]);
      }
    }

    if (this.piece) {
      let gy = this.piece.y;
      while (!this.collides(this.piece.shape, this.piece.x, gy)) gy++;
      gy--;
      for (let y = 0; y < this.piece.shape.length; y++) {
        for (let x = 0; x < this.piece.shape[y].length; x++) {
          if (!this.piece.shape[y][x]) continue;
          if (gy + y >= 0) drawCell(this.piece.x + x, gy + y, 1, true);
          if (this.piece.y + y >= 0)
            drawCell(this.piece.x + x, this.piece.y + y, this.piece.kind + 1);
        }
      }
    }

    if (this.flashT > 0) {
      ctx.fillStyle = `rgba(212,61,42,${(this.flashT / 320) * 0.12})`;
      ctx.fillRect(0, 0, w, h);
    }

    inkText(ctx, `${this.score}`, w / 2, s * 0.045, s * 0.05, PALETTE.accent);
    inkText(ctx, `Lines ${this.lines}  Best ${this.best}`, w / 2, h - s * 0.03, s * 0.032, PALETTE.gray);

    if (this.over) {
      ctx.fillStyle = "rgba(246,241,231,0.85)";
      ctx.fillRect(0, 0, w, h);
      speedLines(ctx, w / 2, h / 2, s * 0.25, Math.max(w, h) * 0.75, 0.5, 36);
      speechBubble(ctx, `The stack overflows — ${this.score}`, w / 2, h / 2, s * 0.055);
      inkText(ctx, "tap to return", w / 2, h * 0.62, s * 0.035, PALETTE.gray);
    }
  }

  teardown(): void {}
}
