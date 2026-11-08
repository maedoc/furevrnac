import { describe, it, expect } from "vitest";
import {
  COLS,
  ROWS,
  EXIT_X,
  PUZZLES,
  initState,
  pieceAt,
  canSlide,
  slide,
  checkWin,
  heroOf,
  clonePieces,
  restorePieces,
  canonicalKey,
  solveMinMoves,
} from "../src/games/khunpan-sim";

describe("khunpan sim", () => {
  it("every puzzle is a valid 4x5 board with exactly two empty cells", () => {
    for (let i = 0; i < PUZZLES.length; i++) {
      const s = initState(i);
      const occupied = s.pieces.reduce((n, p) => n + p.w * p.h, 0);
      expect(COLS * ROWS - occupied).toBe(2);
      for (const p of s.pieces) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.x + p.w).toBeLessThanOrEqual(COLS);
        expect(p.y + p.h).toBeLessThanOrEqual(ROWS);
      }
      for (let a = 0; a < s.pieces.length; a++) {
        for (let b = a + 1; b < s.pieces.length; b++) {
          const p = s.pieces[a];
          const q = s.pieces[b];
          const overlap =
            p.x < q.x + q.w &&
            q.x < p.x + p.w &&
            p.y < q.y + q.h &&
            q.y < p.y + p.h;
          expect(overlap).toBe(false);
        }
      }
      expect(s.pieces.filter((p) => p.kind === "hero").length).toBe(1);
      expect(heroOf(s).w).toBe(2);
      expect(heroOf(s).h).toBe(2);
    }
  });

  it("a piece slides into empty space and the move counter ticks", () => {
    const s = initState(0);
    const before = clonePieces(s);
    expect(slide(s, 7, 0, -1)).toBe(true);
    expect(s.moves).toBe(1);
    expect(s.pieces[7].y).toBe(before[7].y - 1);
  });

  it("a piece cannot slide into another piece or off the board", () => {
    const s = initState(0);
    const hero = heroOf(s);
    expect(canSlide(s, hero, -1, 0)).toBe(false);
    expect(canSlide(s, hero, 1, 0)).toBe(false);
    expect(canSlide(s, hero, 0, 1)).toBe(false);
    expect(slide(s, hero.id, 0, 1)).toBe(false);
    expect(s.moves).toBe(0);
  });

  it("pieceAt finds the piece under a cell", () => {
    const s = initState(0);
    expect(pieceAt(s, 1, 0)?.kind).toBe("hero");
    expect(pieceAt(s, 0, 0)).toBeNull();
    expect(pieceAt(s, 0, 2)?.kind).toBe("general");
  });

  it("winning is detected when the hero reaches the bottom gate", () => {
    const s = initState(0);
    const hero = heroOf(s);
    hero.x = EXIT_X;
    hero.y = ROWS - 2;
    checkWin(s);
    expect(s.won).toBe(true);
  });

  it("restorePieces returns to a snapshot and clears the win flag", () => {
    const s = initState(0);
    const snap = clonePieces(s);
    slide(s, 7, 0, -1);
    slide(s, 2, 0, -1);
    expect(s.moves).toBe(2);
    restorePieces(s, snap);
    expect(s.moves).toBe(2);
    expect(canonicalKey(s)).toBe(canonicalKey({ ...s, pieces: snap }));
  });

  it("every puzzle is solvable (BFS over the full state graph)", () => {
    for (let i = 0; i < PUZZLES.length; i++) {
      const min = solveMinMoves(i);
      expect(min, `${PUZZLES[i].name} must be solvable`).not.toBeNull();
      expect(min!).toBeGreaterThan(10);
    }
  });

  it("the hero cannot jump two cells in one slide", () => {
    const s = initState(2);
    const hero = heroOf(s);
    expect(canSlide(s, hero, 0, 2)).toBe(false);
    expect(canSlide(s, hero, 2, 0)).toBe(false);
  });

  it("no moves are accepted after a win", () => {
    const s = initState(0);
    const hero = heroOf(s);
    hero.x = EXIT_X;
    hero.y = ROWS - 2;
    checkWin(s);
    expect(slide(s, 6, 0, 1)).toBe(false);
  });
});
