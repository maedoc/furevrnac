export const COLS = 4;
export const ROWS = 5;
export const EXIT_X = 1;
export const EXIT_W = 2;

export type PieceKind = "hero" | "general" | "guard" | "soldier";

export interface Piece {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: PieceKind;
}

export interface Puzzle {
  name: string;
  rects: [number, number, number, number][]; // x, y, w, h
}

export interface SimState {
  puzzle: number;
  pieces: Piece[];
  moves: number;
  won: boolean;
}

export function kindOf(w: number, h: number): PieceKind {
  if (w === 2 && h === 2) return "hero";
  if (h === 2) return "general";
  if (w === 2) return "guard";
  return "soldier";
}

export function initState(puzzle: number): SimState {
  const def = PUZZLES[puzzle];
  return {
    puzzle,
    pieces: def.rects.map(([x, y, w, h], i) => ({
      id: i,
      x,
      y,
      w,
      h,
      kind: kindOf(w, h),
    })),
    moves: 0,
    won: false,
  };
}

export function heroOf(s: SimState): Piece {
  return s.pieces.find((p) => p.kind === "hero")!;
}

export function pieceAt(s: SimState, x: number, y: number): Piece | null {
  return (
    s.pieces.find(
      (p) => x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h,
    ) ?? null
  );
}

export function canSlide(
  s: SimState,
  p: Piece,
  dx: number,
  dy: number,
): boolean {
  if (dx === 0 && dy === 0) return false;
  const nx = p.x + dx;
  const ny = p.y + dy;
  if (nx < 0 || ny < 0 || nx + p.w > COLS || ny + p.h > ROWS) return false;
  for (const o of s.pieces) {
    if (o.id === p.id) continue;
    if (nx < o.x + o.w && o.x < nx + p.w && ny < o.y + o.h && o.y < ny + p.h)
      return false;
  }
  return true;
}

export function checkWin(s: SimState): void {
  const hero = heroOf(s);
  if (hero.x === EXIT_X && hero.y === ROWS - 2) s.won = true;
}

export function slide(s: SimState, id: number, dx: number, dy: number): boolean {
  if (s.won) return false;
  const p = s.pieces.find((q) => q.id === id);
  if (!p || !canSlide(s, p, dx, dy)) return false;
  p.x += dx;
  p.y += dy;
  s.moves++;
  checkWin(s);
  return true;
}

export function clonePieces(s: SimState): Piece[] {
  return s.pieces.map((p) => ({ ...p }));
}

export function restorePieces(s: SimState, pieces: Piece[]): void {
  s.pieces = pieces.map((p) => ({ ...p }));
  s.won = false;
}

export function canonicalKey(s: SimState): string {
  return s.pieces
    .map((p) => `${p.x},${p.y},${p.w},${p.h}`)
    .sort()
    .join("|");
}

/** Breadth-first search for the minimum number of single-cell slides to win. */
export function solveMinMoves(
  puzzle: number | Puzzle,
  maxStates = 250000,
): number | null {
  const def = typeof puzzle === "number" ? PUZZLES[puzzle] : puzzle;
  const start: SimState = {
    puzzle: typeof puzzle === "number" ? puzzle : -1,
    pieces: def.rects.map(([x, y, w, h], i) => ({
      id: i,
      x,
      y,
      w,
      h,
      kind: kindOf(w, h),
    })),
    moves: 0,
    won: false,
  };
  const seen = new Set([canonicalKey(start)]);
  let frontier: SimState[] = [start];
  let depth = 0;
  while (frontier.length > 0) {
    const next: SimState[] = [];
    for (const s of frontier) {
      if (s.won) return depth;
      for (const p of s.pieces) {
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          if (!canSlide(s, p, dx, dy)) continue;
          const t: SimState = {
            puzzle: start.puzzle,
            pieces: clonePieces(s),
            moves: s.moves + 1,
            won: false,
          };
          const tp = t.pieces.find((q) => q.id === p.id)!;
          tp.x += dx;
          tp.y += dy;
          checkWin(t);
          const key = canonicalKey(t);
          if (seen.has(key)) continue;
          seen.add(key);
          if (seen.size > maxStates) return null;
          next.push(t);
        }
      }
    }
    frontier = next;
    depth++;
  }
  return null;
}

export const PUZZLES: Puzzle[] = [
  {
    name: "Open Road",
    rects: [
      [1, 0, 2, 2],
      [3, 1, 1, 2],
      [0, 2, 1, 2],
      [2, 3, 1, 2],
      [1, 2, 1, 2],
      [0, 4, 2, 1],
      [3, 4, 1, 1],
      [0, 1, 1, 1],
      [3, 3, 1, 1],
      [3, 0, 1, 1],
    ],
  },
  {
    name: "Twin Blades",
    rects: [
      [1, 0, 2, 2],
      [0, 0, 1, 2],
      [3, 0, 1, 2],
      [0, 2, 1, 2],
      [3, 2, 1, 2],
      [1, 2, 1, 1],
      [2, 2, 1, 1],
      [1, 3, 2, 1],
      [0, 4, 1, 1],
      [3, 4, 1, 1],
    ],
  },
  {
    name: "The Escape",
    rects: [
      [1, 0, 2, 2],
      [0, 0, 1, 2],
      [3, 0, 1, 2],
      [0, 2, 1, 2],
      [3, 2, 1, 2],
      [1, 2, 2, 1],
      [1, 3, 1, 1],
      [2, 3, 1, 1],
      [0, 4, 1, 1],
      [3, 4, 1, 1],
    ],
  },
];
