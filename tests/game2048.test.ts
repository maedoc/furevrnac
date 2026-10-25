import { describe, it, expect } from "vitest";
import { move, newGrid, addRandomTile } from "../src/games/game2048";

describe("2048 logic", () => {
  it("slides a row left and merges equal tiles", () => {
    const grid = newGrid();
    grid[0] = [2, 2, null, null];
    const res = move(grid, "left");
    expect(res.moved).toBe(true);
    expect(grid[0]).toEqual([4, null, null, null]);
    expect(res.gained).toBe(4);
  });

  it("does not move a settled grid", () => {
    const grid = newGrid();
    grid[0] = [2, 4, 2, 4];
    grid[1] = [4, 2, 4, 2];
    grid[2] = [2, 4, 2, 4];
    grid[3] = [4, 2, 4, 2];
    expect(move(grid, "left").moved).toBe(false);
    expect(move(grid, "right").moved).toBe(false);
    expect(move(grid, "up").moved).toBe(false);
    expect(move(grid, "down").moved).toBe(false);
  });

  it("moves in all four directions", () => {
    for (const dir of ["left", "right", "up", "down"] as const) {
      const grid = newGrid();
      grid[1][1] = 2;
      expect(move(grid, dir).moved).toBe(true);
      const [y, x] = { left: [1, 0], right: [1, 3], up: [0, 1], down: [3, 1] }[dir];
      expect(grid[y][x]).toBe(2);
    }
  });

  it("adds a tile only onto empty cells", () => {
    const grid = newGrid();
    grid[0][0] = 2;
    addRandomTile(grid);
    const nonEmpty = grid.flat().filter((v) => v !== null);
    expect(nonEmpty.length).toBe(2);
    expect(grid[0][0]).toBe(2);
  });
});
