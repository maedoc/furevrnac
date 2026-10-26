export type Draught = "w" | "W" | "b" | "B" | null;

export function initialCheckers(): Draught[][] {
  const b: Draught[][] = Array.from({ length: 8 }, () =>
    Array<Draught>(8).fill(null),
  );
  for (let y = 0; y < 3; y++)
    for (let x = 0; x < 8; x++)
      if ((x + y) % 2 === 1) b[y][x] = "b";
  for (let y = 5; y < 8; y++)
    for (let x = 0; x < 8; x++)
      if ((x + y) % 2 === 1) b[y][x] = "w";
  return b;
}

export interface Jump {
  from: [number, number];
  to: [number, number];
  captured: [number, number];
}

export interface CMove {
  from: [number, number];
  to: [number, number];
  jump?: Jump;
}

export function colorOf(p: Draught): "w" | "b" | null {
  if (p === "w" || p === "W") return "w";
  if (p === "b" || p === "B") return "b";
  return null;
}

function dirsFor(p: Draught): [number, number][] {
  if (p === "w") return [
    [-1, -1],
    [1, -1],
  ];
  if (p === "b") return [
    [-1, 1],
    [1, 1],
  ];
  return [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ];
}

function inB(x: number, y: number): boolean {
  return x >= 0 && x < 8 && y >= 0 && y < 8;
}

export function movesFor(b: Draught[][], x: number, y: number): CMove[] {
  const p = b[y][x];
  if (!p) return [];
  const out: CMove[] = [];
  for (const [dx, dy] of dirsFor(p)) {
    const tx = x + dx;
    const ty = y + dy;
    if (inB(tx, ty) && !b[ty][tx]) out.push({ from: [x, y], to: [tx, ty] });
  }
  return out;
}

export function jumpsFor(b: Draught[][], x: number, y: number): CMove[] {
  const p = b[y][x];
  if (!p) return [];
  const me = colorOf(p)!;
  const out: CMove[] = [];
  for (const [dx, dy] of dirsFor(p)) {
    const mx = x + dx;
    const my = y + dy;
    const tx = x + 2 * dx;
    const ty = y + 2 * dy;
    if (!inB(tx, ty)) continue;
    const mid = b[my][mx];
    if (mid && colorOf(mid) !== me && !b[ty][tx])
      out.push({
        from: [x, y],
        to: [tx, ty],
        jump: { from: [x, y], to: [tx, ty], captured: [mx, my] },
      });
  }
  return out;
}

export function allMoves(
  b: Draught[][],
  color: "w" | "b",
): { moves: CMove[]; mustJump: boolean } {
  const jumps: CMove[] = [];
  const moves: CMove[] = [];
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const p = b[y][x];
      if (!p || colorOf(p) !== color) continue;
      jumps.push(...jumpsFor(b, x, y));
      moves.push(...movesFor(b, x, y));
    }
  if (jumps.length > 0) return { moves: jumps, mustJump: true };
  return { moves, mustJump: false };
}

export function applyCheckers(b: Draught[][], m: CMove): Draught[][] {
  const out = b.map((r) => [...r]);
  const [fx, fy] = m.from;
  const [tx, ty] = m.to;
  let p = out[fy][fx];
  out[fy][fx] = null;
  if (m.jump) {
    const [cx, cy] = m.jump.captured;
    out[cy][cx] = null;
  }
  if (p === "w" && ty === 0) p = "W";
  if (p === "b" && ty === 7) p = "B";
  out[ty][tx] = p;
  return out;
}

export function mustContinueJumping(
  b: Draught[][],
  x: number,
  y: number,
): boolean {
  return jumpsFor(b, x, y).length > 0;
}

export function winner(b: Draught[][]): "w" | "b" | null {
  if (allMoves(b, "w").moves.length === 0) return "b";
  if (allMoves(b, "b").moves.length === 0) return "w";
  return null;
}
