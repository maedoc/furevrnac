import type { Game, GameContext } from "./types";
import {
  PALETTE,
  inkRect,
  inkText,
  speechBubble,
  speedLines,
} from "../engine/style";
import { sfx } from "../engine/sfx";

const SIZE = 4;

function newGrid(): (number | null)[][] {
  return Array.from({ length: SIZE }, () => Array<number | null>(SIZE).fill(null));
}

function addRandomTile(grid: (number | null)[][]): void {
  const empties: [number, number][] = [];
  grid.forEach((row, y) =>
    row.forEach((v, x) => {
      if (v === null) empties.push([x, y]);
    }),
  );
  if (empties.length === 0) return;
  const [x, y] = empties[Math.floor(Math.random() * empties.length)];
  grid[y][x] = Math.random() < 0.9 ? 2 : 4;
}

function clone(grid: (number | null)[][]): (number | null)[][] {
  return grid.map((r) => [...r]);
}

function rotateLeft(grid: (number | null)[][]): (number | null)[][] {
  const n = grid.map((r) => [...r]);
  const out = newGrid();
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      out[SIZE - 1 - x][y] = n[y][x];
    }
  }
  return out;
}

function slideLeft(grid: (number | null)[][]): { moved: boolean; gained: number } {
  let moved = false;
  let gained = 0;
  for (let y = 0; y < SIZE; y++) {
    const row = grid[y].filter((v) => v !== null) as number[];
    const merged: number[] = [];
    for (let i = 0; i < row.length; i++) {
      if (i + 1 < row.length && row[i] === row[i + 1]) {
        merged.push(row[i] * 2);
        gained += row[i] * 2;
        i++;
      } else {
        merged.push(row[i]);
      }
    }
    while (merged.length < SIZE) merged.push(0 as unknown as number);
    const newRow: (number | null)[] = merged.map((v) => (v === 0 ? null : v));
    for (let x = 0; x < SIZE; x++) {
      if (grid[y][x] !== newRow[x]) moved = true;
      grid[y][x] = newRow[x];
    }
  }
  return { moved, gained };
}

function move(
  grid: (number | null)[][],
  dir: "left" | "right" | "up" | "down",
): { moved: boolean; gained: number } {
  let g = clone(grid);
  let rot = { left: 0, up: 1, right: 2, down: 3 }[dir];
  for (let i = 0; i < rot; i++) g = rotateLeft(g);
  const res = slideLeft(g);
  for (let i = 0; i < (4 - rot) % 4; i++) g = rotateLeft(g);
  if (res.moved) {
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++) grid[y][x] = g[y][x];
  }
  return res;
}

function canMove(grid: (number | null)[][]): boolean {
  return (
    move(grid, "left").moved ||
    move(grid, "right").moved ||
    move(grid, "up").moved ||
    move(grid, "down").moved
  );
}

export { move, canMove, newGrid, addRandomTile };

export class Game2048 implements Game {
  readonly id = "2048";
  readonly name = "Sumi 2048";
  readonly blurb = "Swipe to merge the ink tiles.";
  readonly accent = "#d43d2a";

  private grid = newGrid();
  private score = 0;
  private best = 0;
  private over = false;
  private flash = 0;

  init(g: GameContext): void {
    this.grid = newGrid();
    addRandomTile(this.grid);
    addRandomTile(this.grid);
    this.score = 0;
    this.over = false;
    this.flash = 0;
    this.best = g.save.get("2048:best", 0);
  }

  update(dt: number, g: GameContext): void {
    if (this.flash > 0) this.flash -= dt;
    for (const e of g.input.consumeEvents()) {
      if (e.type === "swipe" && !this.over) {
        const res = move(this.grid, e.dir);
        if (res.moved) {
          this.score += res.gained;
          if (res.gained > 0) {
            sfx.move();
            this.flash = 250;
            if (navigator.vibrate) navigator.vibrate(15);
          }
          addRandomTile(this.grid);
          if (!canMove(this.grid)) {
            this.over = true;
            sfx.die();
            if (this.score > this.best) {
              this.best = this.score;
              g.save.set("2048:best", this.best);
            }
          }
        }
      } else if (e.type === "tap" && this.over) {
        g.exit();
        return;
      }
    }
  }

  render(g: GameContext): void {
    const { ctx, w, h } = g;
    const s = Math.min(w, h);
    const cell = s * 0.19;
    const gap = s * 0.02;
    const ox = w / 2 - (cell * SIZE + gap * (SIZE - 1)) / 2;
    const oy = h / 2 - (cell * SIZE + gap * (SIZE - 1)) / 2 + s * 0.03;

    inkRect(
      ctx,
      ox - gap,
      oy - gap,
      cell * SIZE + gap * (SIZE + 1),
      cell * SIZE + gap * (SIZE + 1),
      PALETTE.gray,
      PALETTE.ink,
      4,
    );

    const tileColor = (v: number): string => {
      if (v <= 4) return PALETTE.white;
      if (v <= 64) return "#eed9c4";
      if (v <= 512) return "#e8b98a";
      return "#d43d2a";
    };

    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const tx = ox + x * (cell + gap);
        const ty = oy + y * (cell + gap);
        const v = this.grid[y][x];
        inkRect(ctx, tx, ty, cell, cell, v === null ? PALETTE.paper : tileColor(v), PALETTE.ink, 2.5);
        if (v !== null) {
          const fs = cell * (v >= 1024 ? 0.3 : v >= 128 ? 0.35 : 0.42);
          inkText(ctx, String(v), tx + cell / 2, ty + cell / 2, fs, v >= 1024 ? PALETTE.white : PALETTE.ink);
        }
      }
    }

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(212,61,42,${(this.flash / 250) * 0.15})`;
      ctx.fillRect(0, 0, w, h);
    }

    inkText(ctx, `Score ${this.score}`, w / 2, s * 0.07, s * 0.045, PALETTE.accent);
    inkText(ctx, `Best ${this.best}`, w / 2, h - s * 0.04, s * 0.035, PALETTE.gray);

    if (this.over) {
      ctx.fillStyle = "rgba(246,241,231,0.85)";
      ctx.fillRect(0, 0, w, h);
      speedLines(ctx, w / 2, h / 2, s * 0.25, Math.max(w, h) * 0.75, 0.5, 36);
      speechBubble(ctx, `The page is full — ${this.score}`, w / 2, h / 2, s * 0.06);
      inkText(ctx, "tap to return", w / 2, h * 0.62, s * 0.035, PALETTE.gray);
    }
  }

  teardown(): void {}
}
