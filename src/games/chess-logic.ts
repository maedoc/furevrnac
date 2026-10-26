export type Piece = string | null;

export interface Move {
  from: [number, number];
  to: [number, number];
  promo?: string;
  castle?: "K" | "Q";
  ep?: boolean;
}

export function initialBoard(): Piece[][] {
  return [
    ["bR", "bN", "bB", "bQ", "bK", "bB", "bN", "bR"],
    ["bP", "bP", "bP", "bP", "bP", "bP", "bP", "bP"],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ["wP", "wP", "wP", "wP", "wP", "wP", "wP", "wP"],
    ["wR", "wN", "wB", "wQ", "wK", "wB", "wN", "wR"],
  ];
}

export function cloneBoard(b: Piece[][]): Piece[][] {
  return b.map((r) => [...r]);
}

export function colorOf(p: Piece): "w" | "b" | null {
  if (!p) return null;
  return p[0] as "w" | "b";
}

function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < 8 && y >= 0 && y < 8;
}

export function findKing(b: Piece[][], color: "w" | "b"): [number, number] {
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++)
      if (b[y][x] === color + "K") return [x, y];
  return [-1, -1];
}

export function isSquareAttacked(
  b: Piece[][],
  x: number,
  y: number,
  by: "w" | "b",
): boolean {
  for (let yy = 0; yy < 8; yy++) {
    for (let xx = 0; xx < 8; xx++) {
      const p = b[yy][xx];
      if (!p || p[0] !== by) continue;
      if (pieceAttacks(b, xx, yy, x, y)) return true;
    }
  }
  return false;
}

function pieceAttacks(
  b: Piece[][],
  x: number,
  y: number,
  tx: number,
  ty: number,
): boolean {
  const p = b[y][x];
  if (!p) return false;
  const kind = p[1];
  const dx = tx - x;
  const dy = ty - y;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  switch (kind) {
    case "P":
      return adx === 1 && (p[0] === "w" ? dy === -1 : dy === 1);
    case "N":
      return (adx === 1 && ady === 2) || (adx === 2 && ady === 1);
    case "K":
      return adx <= 1 && ady <= 1;
    case "R":
      if (dx !== 0 && dy !== 0) return false;
      return clearBetween(b, x, y, tx, ty);
    case "B":
      if (adx !== ady) return false;
      return clearBetween(b, x, y, tx, ty);
    case "Q":
      if (dx !== 0 && dy !== 0 && adx !== ady) return false;
      return clearBetween(b, x, y, tx, ty);
    default:
      return false;
  }
}

function clearBetween(
  b: Piece[][],
  x: number,
  y: number,
  tx: number,
  ty: number,
): boolean {
  const dx = Math.sign(tx - x);
  const dy = Math.sign(ty - y);
  let cx = x + dx;
  let cy = y + dy;
  while (cx !== tx || cy !== ty) {
    if (b[cy][cx]) return false;
    cx += dx;
    cy += dy;
  }
  return true;
}

export function isInCheck(b: Piece[][], color: "w" | "b"): boolean {
  const [kx, ky] = findKing(b, color);
  if (kx < 0) return false;
  return isSquareAttacked(b, kx, ky, color === "w" ? "b" : "w");
}

export interface Castling {
  wK: boolean;
  wQ: boolean;
  bK: boolean;
  bQ: boolean;
}

export function canCastle(
  b: Piece[][],
  color: "w" | "b",
  side: "K" | "Q",
  rights: Castling,
): boolean {
  const row = color === "w" ? 7 : 0;
  const kingRight = (color === "w" ? rights.wK : rights.bK) && side === "K";
  const queenRight = (color === "w" ? rights.wQ : rights.bQ) && side === "Q";
  if (!kingRight && !queenRight) return false;
  if (b[row][4] !== color + "K") return false;
  const enemy: "w" | "b" = color === "w" ? "b" : "w";
  if (isSquareAttacked(b, 4, row, enemy)) return false;
  if (side === "K") {
    if (b[row][5] || b[row][6]) return false;
    if (b[row][7] !== color + "R") return false;
    if (isSquareAttacked(b, 5, row, enemy) || isSquareAttacked(b, 6, row, enemy))
      return false;
  } else {
    if (b[row][1] || b[row][2] || b[row][3]) return false;
    if (b[row][0] !== color + "R") return false;
    if (isSquareAttacked(b, 3, row, enemy) || isSquareAttacked(b, 2, row, enemy))
      return false;
  }
  return true;
}

export function pseudoMoves(
  b: Piece[][],
  x: number,
  y: number,
): { moves: [number, number][]; castles: ("K" | "Q")[] } {
  const p = b[y][x];
  const moves: [number, number][] = [];
  const castles: ("K" | "Q")[] = [];
  if (!p) return { moves, castles };
  const color = p[0] as "w" | "b";
  const kind = p[1];
  const tryAdd = (tx: number, ty: number): void => {
    if (!inBounds(tx, ty)) return;
    const t = b[ty][tx];
    if (!t || t[0] !== color) moves.push([tx, ty]);
  };

  switch (kind) {
    case "P": {
      const dir = color === "w" ? -1 : 1;
      const startRow = color === "w" ? 6 : 1;
      if (inBounds(x, y + dir) && !b[y + dir][x]) {
        moves.push([x, y + dir]);
        if (y === startRow && !b[y + 2 * dir][x]) moves.push([x, y + 2 * dir]);
      }
      for (const dx of [-1, 1]) {
        const tx = x + dx;
        const ty = y + dir;
        if (inBounds(tx, ty)) {
          const t = b[ty][tx];
          if (t && t[0] !== color) moves.push([tx, ty]);
        }
      }
      break;
    }
    case "N":
      [
        [1, 2],
        [2, 1],
        [-1, 2],
        [-2, 1],
        [1, -2],
        [2, -1],
        [-1, -2],
        [-2, -1],
      ].forEach(([dx, dy]) => tryAdd(x + dx, y + dy));
      break;
    case "K":
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          if (dx || dy) tryAdd(x + dx, y + dy);
      break;
    case "R":
    case "B":
    case "Q": {
      const dirs: [number, number][] =
        kind === "R"
          ? [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ]
          : kind === "B"
            ? [
                [1, 1],
                [1, -1],
                [-1, 1],
                [-1, -1],
              ]
            : [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1],
                [1, 1],
                [1, -1],
                [-1, 1],
                [-1, -1],
              ];
      for (const [dx, dy] of dirs) {
        let tx = x + dx;
        let ty = y + dy;
        while (inBounds(tx, ty) && (!b[ty][tx] || b[ty][tx]![0] !== color)) {
          moves.push([tx, ty]);
          if (b[ty][tx]) break;
          tx += dx;
          ty += dy;
        }
      }
      break;
    }
    default:
      break;
  }
  return { moves, castles };
}

export function legalTargets(
  b: Piece[][],
  x: number,
  y: number,
  rights: Castling,
  epTarget: [number, number] | null,
): Move[] {
  const p = b[y][x];
  if (!p) return [];
  const color = p[0] as "w" | "b";
  const out: Move[] = [];
  const { moves } = pseudoMoves(b, x, y);

  for (const [tx, ty] of moves) {
    if (p[1] === "K" && Math.abs(tx - x) === 2) continue;
    const test = cloneBoard(b);
    const moving = test[y][x];
    test[y][x] = null;
    test[ty][tx] = moving;
    if (p[1] === "P" && epTarget && tx === epTarget[0] && ty === epTarget[1]) {
      test[y][tx] = null;
    }
    if (!isInCheck(test, color)) {
      const isPromo = p[1] === "P" && (ty === 0 || ty === 7);
      if (isPromo) {
        for (const promo of ["Q", "R", "B", "N"])
          out.push({ from: [x, y], to: [tx, ty], promo: color + promo });
      } else out.push({ from: [x, y], to: [tx, ty] });
    }
  }

  if (p[1] === "P" && epTarget) {
    const dir = color === "w" ? -1 : 1;
    const adj = [
      [x - 1, y],
      [x + 1, y],
    ];
    for (const [ax] of adj) {
      if (ax === epTarget[0] && y + dir === epTarget[1]) {
        const test = cloneBoard(b);
        test[y][x] = null;
        test[epTarget[1]][epTarget[0]] = p;
        test[y][epTarget[0]] = null;
        if (!isInCheck(test, color))
          out.push({ from: [x, y], to: [epTarget[0], epTarget[1]], ep: true });
      }
    }
  }

  if (p === color + "K" && x === 4 && inBounds(4, color === "w" ? 7 : 0)) {
    for (const side of ["K", "Q"] as const) {
      if (canCastle(b, color, side, rights)) {
        out.push({ from: [x, y], to: [side === "K" ? 6 : 2, y], castle: side });
      }
    }
  }
  return out;
}

export function applyMove(
  b: Piece[][],
  m: Move,
  rights: Castling,
): { board: Piece[][]; ep: [number, number] | null } {
  const out = cloneBoard(b);
  const [fx, fy] = m.from;
  const [tx, ty] = m.to;
  const p = out[fy][fx];
  out[fy][fx] = null;

  let ep: [number, number] | null = null;
  if (m.castle) {
    const row = fy;
    if (m.castle === "K") {
      out[row][6] = p;
      out[row][5] = out[row][7];
      out[row][7] = null;
    } else {
      out[row][2] = p;
      out[row][3] = out[row][0];
      out[row][0] = null;
    }
  } else if (m.ep) {
    out[ty][tx] = p;
    out[fy][tx] = null;
  } else {
    if (p && p[1] === "P" && Math.abs(ty - fy) === 2) ep = [fx, (fy + ty) / 2];
    out[ty][tx] = m.promo ?? p;
  }

  const color = p?.[0] as "w" | "b";
  if (p === color + "K") {
    if (color === "w") {
      rights.wK = false;
      rights.wQ = false;
    } else {
      rights.bK = false;
      rights.bQ = false;
    }
  }
  if (p === color + "R") {
    if (fx === 0) {
      if (color === "w") rights.wQ = false;
      else rights.bQ = false;
    }
    if (fx === 7) {
      if (color === "w") rights.wK = false;
      else rights.bK = false;
    }
  }
  if (out[ty][tx] === color + "R" && (fx === 0 || fx === 7) && fy === (color === "w" ? 7 : 0)) {
    if (fx === 0) {
      if (color === "w") rights.wQ = false;
      else rights.bQ = false;
    } else {
      if (color === "w") rights.wK = false;
      else rights.bK = false;
    }
  }
  return { board: out, ep };
}

export function gameStatus(
  b: Piece[][],
  turn: "w" | "b",
  rights: Castling,
  ep: [number, number] | null,
): "check" | "checkmate" | "stalemate" | "playing" {
  let hasMove = false;
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const p = b[y][x];
      if (!p || p[0] !== turn) continue;
      if (legalTargets(b, x, y, rights, ep).length > 0) hasMove = true;
    }
  const check = isInCheck(b, turn);
  if (check && !hasMove) return "checkmate";
  if (!check && !hasMove) return "stalemate";
  if (check) return "check";
  return "playing";
}
