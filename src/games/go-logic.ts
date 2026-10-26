export type Stone = "w" | "b" | null;

export type GoBoard = Stone[][];

export function newGoBoard(size: number): GoBoard {
  return Array.from({ length: size }, () =>
    Array<Stone>(size).fill(null),
  );
}

function neighbors(size: number, x: number, y: number): [number, number][] {
  const out: [number, number][] = [];
  if (x > 0) out.push([x - 1, y]);
  if (x < size - 1) out.push([x + 1, y]);
  if (y > 0) out.push([x, y - 1]);
  if (y < size - 1) out.push([x, y + 1]);
  return out;
}

export function groupAt(
  b: GoBoard,
  x: number,
  y: number,
): { stones: [number, number][]; liberties: number } {
  const size = b.length;
  const color = b[y][x];
  if (!color) return { stones: [], liberties: 0 };
  const seen = new Set<string>([`${x},${y}`]);
  const stones: [number, number][] = [[x, y]];
  const libertySet = new Set<string>();
  const queue: [number, number][] = [[x, y]];
  while (queue.length > 0) {
    const [cx, cy] = queue.pop()!;
    for (const [nx, ny] of neighbors(size, cx, cy)) {
      const key = `${nx},${ny}`;
      const s = b[ny][nx];
      if (!s) libertySet.add(key);
      else if (s === color && !seen.has(key)) {
        seen.add(key);
        stones.push([nx, ny]);
        queue.push([nx, ny]);
      }
    }
  }
  return { stones, liberties: libertySet.size };
}

export function boardKey(b: GoBoard): string {
  return b.map((r) => r.map((s) => (s ? (s === "w" ? "w" : "b") : ".")).join("")).join("");
}

export interface PlaceResult {
  board: GoBoard;
  captured: number;
  ok: boolean;
  reason?: "occupied" | "suicide" | "ko";
}

export function place(
  b: GoBoard,
  x: number,
  y: number,
  color: "w" | "b",
  history: Set<string>,
): PlaceResult {
  const size = b.length;
  if (b[y][x]) return { board: b, captured: 0, ok: false, reason: "occupied" };
  const out = b.map((r) => [...r]);
  out[y][x] = color;
  const enemy: "w" | "b" = color === "w" ? "b" : "w";
  let captured = 0;
  for (const [nx, ny] of neighbors(size, x, y)) {
    if (out[ny][nx] === enemy) {
      const g = groupAt(out, nx, ny);
      if (g.liberties === 0) {
        for (const [sx, sy] of g.stones) {
          out[sy][sx] = null;
          captured++;
        }
      }
    }
  }
  if (captured === 0 && groupAt(out, x, y).liberties === 0)
    return { board: b, captured: 0, ok: false, reason: "suicide" };
  if (history.has(boardKey(out)))
    return { board: b, captured: 0, ok: false, reason: "ko" };
  return { board: out, captured, ok: true };
}

export interface Score {
  black: number;
  white: number;
  dame: number;
}

export function scoreArea(b: GoBoard, komi: number): Score {
  const size = b.length;
  const seen: boolean[][] = Array.from({ length: size }, () =>
    Array<boolean>(size).fill(false),
  );
  let black = 0;
  let white = 0;
  let dame = 0;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const s = b[y][x];
      if (s === "b") black++;
      else if (s === "w") white++;
      else if (!seen[y][x]) {
        const region: [number, number][] = [[x, y]];
        seen[y][x] = true;
        const queue: [number, number][] = [[x, y]];
        let touchesB = false;
        let touchesW = false;
        while (queue.length > 0) {
          const [cx, cy] = queue.pop()!;
          for (const [nx, ny] of neighbors(size, cx, cy)) {
            const s2 = b[ny][nx];
            if (s2 === "b") touchesB = true;
            else if (s2 === "w") touchesW = true;
            else if (!seen[ny][nx]) {
              seen[ny][nx] = true;
              region.push([nx, ny]);
              queue.push([nx, ny]);
            }
          }
        }
        if (touchesB && !touchesW) black += region.length;
        else if (touchesW && !touchesB) white += region.length;
        else dame += region.length;
      }
    }
  return { black, white: white + komi, dame };
}
