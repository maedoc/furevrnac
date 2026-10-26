import { describe, it, expect } from "vitest";
import {
  applyMove,
  gameStatus,
  initialBoard,
  isInCheck,
  legalTargets,
  type Piece,
} from "../src/games/chess-logic";

const rights = (): {
  wK: boolean;
  wQ: boolean;
  bK: boolean;
  bQ: boolean;
} => ({ wK: true, wQ: true, bK: true, bQ: true });

describe("chess logic", () => {
  it("starts with 20 legal moves per side", () => {
    const b = initialBoard();
    let n = 0;
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++)
        if (b[y][x]?.[0] === "w")
          n += legalTargets(b, x, y, rights(), null).length;
    expect(n).toBe(20);
  });

  it("cannot move into check", () => {
    const b = initialBoard();
    for (let x = 0; x < 8; x++) b[1][x] = null;
    for (let x = 0; x < 8; x++) if (x !== 4) b[0][x] = null;
    b[0][4] = "bQ";
    b[0][3] = "bK";
    const moves = legalTargets(b, 4, 7, rights(), null);
    const targets = moves.map((m) => m.to);
    expect(targets).not.toContainEqual([4, 5]);
  });

  it("detects fool's mate (f3, e5, g4, Qh4#) as checkmate", () => {
    let b = initialBoard();
    const r = rights();
    const play = (fx: number, fy: number, tx: number, ty: number) => {
      const move = legalTargets(b, fx, fy, r, null).find(
        (m) => m.to[0] === tx && m.to[1] === ty && !m.promo,
      );
      expect(move).toBeDefined();
      b = applyMove(b, move!, r).board;
    };
    play(5, 6, 5, 5);
    play(4, 1, 4, 3);
    play(6, 6, 6, 4);
    play(3, 0, 7, 4);
    expect(isInCheck(b, "w")).toBe(true);
    expect(gameStatus(b, "w", r, null)).toBe("checkmate");
  });

  it("castles kingside when path is clear", () => {
    const b = initialBoard();
    for (const x of [5, 6]) {
      b[7][x] = null;
      b[0][x] = null;
    }
    const moves = legalTargets(b, 4, 7, rights(), null);
    const castle = moves.find((m) => m.castle === "K");
    expect(castle).toBeDefined();
    const { board } = applyMove(b, castle!, rights());
    expect(board[7][6]).toBe("wK");
    expect(board[7][5]).toBe("wR");
  });

  it("handles en passant capture", () => {
    const b: Piece[][] = initialBoard().map((row) => row.map(() => null));
    b[3][3] = "wP";
    b[1][4] = "bP";
    b[7][3] = "wK";
    b[0][4] = "bK";
    const r = rights();
    const advance = legalTargets(b, 4, 1, r, null).find(
      (m) => m.to[0] === 4 && m.to[1] === 3,
    )!;
    const after = applyMove(b, advance, r);
    expect(after.ep).toEqual([4, 2]);
    const epCap = legalTargets(after.board, 3, 3, r, after.ep).find(
      (m) => m.ep,
    );
    expect(epCap).toBeDefined();
    const result = applyMove(after.board, epCap!, r);
    expect(result.board[2][4]).toBe("wP");
    expect(result.board[3][4]).toBeNull();
  });

  it("promotes pawns with all four choices", () => {
    const b: Piece[][] = initialBoard().map((row) => row.map(() => null));
    b[1][3] = "wP";
    b[0][7] = "bK";
    b[7][7] = "wK";
    const moves = legalTargets(b, 3, 1, rights(), null);
    const promos = moves.filter((m) => m.to[0] === 3 && m.to[1] === 0 && m.promo);
    expect(promos.map((m) => m.promo)).toEqual(["wQ", "wR", "wB", "wN"]);
  });
});
