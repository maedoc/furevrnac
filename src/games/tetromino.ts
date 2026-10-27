import type { Game, GameContext } from "./types";
import { sfx } from "../engine/sfx";
import {
  PALETTE,
  inkRect,
  inkText,
  speechBubble,
  speedLines,
  hexWithAlpha,
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
    sfx.move();
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
      sfx.clear();
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
          sfx.tap();
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

    // one distinct color per piece kind (7 types), theme-aware
    const kindFill = (k: number): string => {
      const fills = [
        PALETTE.accent, // I: vermillion
        PALETTE.tint2, // O: cream
        PALETTE.tint3, // T: ochre
        PALETTE.gray, // S: gray
        PALETTE.tint1, // Z: subtle
        "#8db052", // L: leaf green (fixed, reads on both themes)
        "#5a7ea3", // J: steel blue (fixed, reads on both themes)
      ];
      return fills[(k - 1) % fills.length];
    };

    // faint grid instead of per-cell boxes
    ctx.strokeStyle = PALETTE.gray;
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 1;
    for (let x = 1; x < COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(ox + x * cell, oy);
      ctx.lineTo(ox + x * cell, oy + ROWS * cell);
      ctx.stroke();
    }
    for (let y = 1; y < ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(ox, oy + y * cell);
      ctx.lineTo(ox + COLS * cell, oy + y * cell);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // filled cells, no borders; silhouette stroke only around piece edges
    const drawCell = (x: number, y: number, k: number, ghost = false): void => {
      if (k === 0) return;
      if (this.clearFlash.includes(y)) return;
      const px = ox + x * cell;
      const py = oy + y * cell;
      ctx.save();
      if (ghost) {
        ctx.globalAlpha = 0.28;
        ctx.fillStyle = kindFill(k);
        ctx.fillRect(px + 1, py + 1, cell - 2, cell - 2);
      } else {
        ctx.fillStyle = kindFill(k);
        ctx.fillRect(px, py, cell, cell);
        // subtle inner highlight
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        ctx.fillRect(px, py, cell, cell * 0.25);
      }
      ctx.restore();
    };

    // board cells
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        drawCell(x, y, this.board[y][x]);
      }
    }

    // stroke the outline of each locked piece-run for the ink look
    const isSet = (x: number, y: number): boolean =>
      x >= 0 && x < COLS && y >= 0 && y < ROWS && this.board[y][x] !== 0;
    const isSetGhost = (x: number, y: number): boolean =>
      x >= 0 && x < COLS && y >= 0 && y < ROWS && this.board[y][x] !== 0;
    void isSetGhost;
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!isSet(x, y)) continue;
        if (this.clearFlash.includes(y)) continue;
        const px = ox + x * cell;
        const py = oy + y * cell;
        // draw only outer edges of the block run
        if (!isSet(x, y - 1)) {
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + cell, py);
          ctx.stroke();
        }
        if (!isSet(x, y + 1)) {
          ctx.beginPath();
          ctx.moveTo(px, py + cell);
          ctx.lineTo(px + cell, py + cell);
          ctx.stroke();
        }
        if (!isSet(x - 1, y)) {
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px, py + cell);
          ctx.stroke();
        }
        if (!isSet(x + 1, y)) {
          ctx.beginPath();
          ctx.moveTo(px + cell, py);
          ctx.lineTo(px + cell, py + cell);
          ctx.stroke();
        }
      }
    }

    if (this.piece) {
      const p = this.piece;
      let gy = p.y;
      while (!this.collides(p.shape, p.x, gy)) gy++;
      gy--;
      const inShape = (x: number, y: number): boolean =>
        y >= 0 &&
        y < p.shape.length &&
        x >= 0 &&
        x < p.shape[y].length &&
        p.shape[y][x] !== 0;
      for (let y = 0; y < p.shape.length; y++) {
        for (let x = 0; x < p.shape[y].length; x++) {
          if (!p.shape[y][x]) continue;
          if (gy + y >= 0) drawCell(p.x + x, gy + y, p.kind + 1, true);
          if (p.y + y >= 0) drawCell(p.x + x, p.y + y, p.kind + 1);
        }
      }
      // ink outline around the active piece silhouette
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = "round";
      for (let y = 0; y < p.shape.length; y++) {
        for (let x = 0; x < p.shape[y].length; x++) {
          if (!p.shape[y][x]) continue;
          const px = ox + (p.x + x) * cell;
          const py = oy + (p.y + y) * cell;
          if (p.y + y < 0) continue;
          if (!inShape(x, y - 1) || p.y + y - 1 < 0) {
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px + cell, py);
            ctx.stroke();
          }
          if (!inShape(x, y + 1)) {
            ctx.beginPath();
            ctx.moveTo(px, py + cell);
            ctx.lineTo(px + cell, py + cell);
            ctx.stroke();
          }
          if (!inShape(x - 1, y)) {
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px, py + cell);
            ctx.stroke();
          }
          if (!inShape(x + 1, y)) {
            ctx.beginPath();
            ctx.moveTo(px + cell, py);
            ctx.lineTo(px + cell, py + cell);
            ctx.stroke();
          }
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
      ctx.fillStyle = hexWithAlpha(PALETTE.paper, 0.85);
      ctx.fillRect(0, 0, w, h);
      speedLines(ctx, w / 2, h / 2, s * 0.25, Math.max(w, h) * 0.75, 0.5, 36);
      speechBubble(ctx, `The stack overflows — ${this.score}`, w / 2, h / 2, s * 0.055);
      inkText(ctx, "tap to return", w / 2, h * 0.62, s * 0.035, PALETTE.gray);
    }
  }

  teardown(): void {}
}
