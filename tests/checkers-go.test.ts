import { describe, it, expect } from "vitest";
import {
  allMoves,
  applyCheckers,
  initialCheckers,
  jumpsFor,
  winner,
  type Draught,
} from "../src/games/checkers-logic";
import {
  boardKey,
  groupAt,
  newGoBoard,
  place,
  scoreArea,
} from "../src/games/go-logic";

describe("checkers logic", () => {
  it("sets up 12 pieces per side on dark squares", () => {
    const b = initialCheckers();
    const black = b.flat().filter((p) => p === "b").length;
    const white = b.flat().filter((p) => p === "w").length;
    expect(black).toBe(12);
    expect(white).toBe(12);
  });

  it("forces captures when available", () => {
    const b: Draught[][] = Array.from({ length: 8 }, () =>
      Array<Draught>(8).fill(null),
    );
    b[4][3] = "w";
    b[3][4] = "b";
    const { moves, mustJump } = allMoves(b, "w");
    expect(mustJump).toBe(true);
    expect(moves.length).toBe(1);
    expect(moves[0].jump).toBeDefined();
  });

  it("multi-jumps are available after a capture", () => {
    const b: Draught[][] = Array.from({ length: 8 }, () =>
      Array<Draught>(8).fill(null),
    );
    b[5][2] = "w";
    b[4][3] = "b";
    b[2][5] = "b";
    const j = allMoves(b, "w").moves[0];
    expect(j.jump).toBeDefined();
    const after = applyCheckers(b, j);
    expect(after[3][4]).toBe("w");
    expect(after[4][3]).toBeNull();
    expect(jumpsFor(after, 4, 3).length).toBeGreaterThan(0);
  });

  it("promotes to king on the back rank", () => {
    const b: Draught[][] = Array.from({ length: 8 }, () =>
      Array<Draught>(8).fill(null),
    );
    b[1][2] = "w";
    b[0][1] = null;
    const move = { from: [2, 1] as [number, number], to: [1, 0] as [number, number] };
    const after = applyCheckers(b, move);
    expect(after[0][1]).toBe("W");
  });

  it("declares a winner when a side has no moves", () => {
    const b: Draught[][] = Array.from({ length: 8 }, () =>
      Array<Draught>(8).fill(null),
    );
    b[0][1] = "w";
    expect(winner(b)).toBe("b");
  });
});

describe("go logic", () => {
  it("captures a stone with no liberties", () => {
    const b = newGoBoard(9);
    b[0][0] = "b";
    b[0][2] = "b";
    b[0][1] = "w";
    const hist = new Set([boardKey(b)]);
    const res = place(b, 1, 1, "b", hist);
    expect(res.ok).toBe(true);
    expect(res.captured).toBe(1);
    expect(res.board[0][1]).toBeNull();
  });

  it("rejects suicide", () => {
    const b = newGoBoard(9);
    b[0][1] = "w";
    b[1][0] = "w";
    b[1][1] = "w";
    const hist = new Set([boardKey(b)]);
    const res = place(b, 0, 0, "b", hist);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("suicide");
  });

  it("enforces simple ko", () => {
    const b = newGoBoard(9);
    b[1][0] = "w";
    b[0][1] = "w";
    b[2][1] = "w";
    b[0][2] = "b";
    b[2][2] = "b";
    b[1][3] = "b";
    b[1][1] = "b";
    const hist = new Set([boardKey(b)]);
    const snap = place(b, 2, 1, "w", hist);
    expect(snap.ok).toBe(true);
    expect(snap.captured).toBe(1);
    expect(snap.board[1][1]).toBeNull();
    const hist2 = new Set([boardKey(b), boardKey(snap.board)]);
    const retake = place(snap.board, 1, 1, "b", hist2);
    expect(retake.ok).toBe(false);
    expect(retake.reason).toBe("ko");
  });

  it("counts area with komi", () => {
    const b = newGoBoard(9);
    b[4][4] = "b";
    const sc = scoreArea(b, 6.5);
    expect(sc.white).toBe(6.5);
    expect(sc.black).toBe(81);
    expect(sc.dame).toBe(0);
  });

  it("group liberties are computed", () => {
    const b = newGoBoard(9);
    b[4][4] = "b";
    const g = groupAt(b, 4, 4);
    expect(g.stones.length).toBe(1);
    expect(g.liberties).toBe(4);
  });
});
