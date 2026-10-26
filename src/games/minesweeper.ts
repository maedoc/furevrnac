import type { Game, GameContext } from "./types";
import { PALETTE, inkRect, inkText, speechBubble, speedLines } from "../engine/style";
import { sfx } from "../engine/sfx";

const SIZE = 10;
const MINES = 14;

type Cell = {
  mine: boolean;
  open: boolean;
  flagged: boolean;
  count: number;
};

export class MinesweeperGame implements Game {
  readonly id = "minesweeper";
  readonly name = "Mine Panels";
  readonly blurb = "Tap to open, hold to flag.";
  readonly accent = "#d43d2a";

  private cells: Cell[][] = [];
  private started = false;
  private state: "play" | "dead" | "clear" = "play";
  private best = 0;
  private time = 0;

  init(g: GameContext): void {
    this.cells = Array.from({ length: SIZE }, () =>
      Array.from({ length: SIZE }, () => ({
        mine: false,
        open: false,
        flagged: false,
        count: 0,
      })),
    );
    this.started = false;
    this.state = "play";
    this.time = 0;
    this.best = g.save.get("minesweeper:best", 0);
  }

  private placeMines(sx: number, sy: number): void {
    let placed = 0;
    while (placed < MINES) {
      const x = Math.floor(Math.random() * SIZE);
      const y = Math.floor(Math.random() * SIZE);
      if (this.cells[y][x].mine) continue;
      if (Math.abs(x - sx) <= 1 && Math.abs(y - sy) <= 1) continue;
      this.cells[y][x].mine = true;
      placed++;
    }
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const ny = y + dy;
            const nx = x + dx;
            if (
              ny >= 0 &&
              ny < SIZE &&
              nx >= 0 &&
              nx < SIZE &&
              this.cells[ny][nx].mine
            )
              n++;
          }
        this.cells[y][x].count = n;
      }
    }
  }

  private floodOpen(x: number, y: number): void {
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
    const c = this.cells[y][x];
    if (c.open || c.flagged) return;
    c.open = true;
    if (c.count === 0 && !c.mine) {
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++)
          if (dx || dy) this.floodOpen(x + dx, y + dy);
    }
  }

  update(dt: number, g: GameContext): void {
    if (this.state === "play" && this.started) this.time += dt;
    const size = Math.min(g.w * 0.94, g.h * 0.8);
    const cell = size / SIZE;
    const ox = (g.w - size) / 2;
    const oy = (g.h - size) / 2 + g.h * 0.02;

    for (const e of g.input.consumeEvents()) {
      if (e.type !== "tap" && e.type !== "longpress") continue;
      const gx = Math.floor((e.x - ox) / cell);
      const gy = Math.floor((e.y - oy) / cell);
      const onGrid = gx >= 0 && gx < SIZE && gy >= 0 && gy < SIZE;
      if (e.type === "tap" && onGrid && this.state === "play") {
        if (!this.started) {
          this.placeMines(gx, gy);
          this.started = true;
        }
        const c = this.cells[gy][gx];
        if (c.flagged || c.open) continue;
        if (c.mine) {
          c.open = true;
          this.state = "dead";
          this.cells.forEach((row) => row.forEach((cc) => { if (cc.mine) cc.open = true; }));
          sfx.boom();
          if (navigator.vibrate) navigator.vibrate([60, 40, 120]);
        } else {
          this.floodOpen(gx, gy);
          sfx.tap();
          if (this.isClear()) {
            this.state = "clear";
            sfx.win();
            const secs = Math.round(this.time / 1000);
            if (this.best === 0 || secs < this.best) {
              this.best = secs;
              g.save.set("minesweeper:best", this.best);
            }
          }
        }
      } else if (e.type === "longpress" && onGrid && this.state === "play") {
        const c = this.cells[gy][gx];
        if (!c.open) {
          c.flagged = !c.flagged;
          sfx.flag();
        }
      } else if (e.type === "tap" && this.state !== "play") {
        g.exit();
        return;
      }
    }
  }

  private isClear(): boolean {
    return this.cells.every((row) =>
      row.every((c) => c.open || c.mine),
    );
  }

  render(g: GameContext): void {
    const { ctx, w, h } = g;
    const s = Math.min(w, h);
    const size = Math.min(w * 0.94, h * 0.8);
    const cell = size / SIZE;
    const ox = (w - size) / 2;
    const oy = (h - size) / 2 + h * 0.02;

    inkRect(ctx, ox - 5, oy - 5, size + 10, size + 10, PALETTE.white, PALETTE.ink, 4);

    const colors = ["", "#6b675f", "#2e6b4f", "#d43d2a", "#8a5a2a", "#2a5a8a", "#5a2a8a", "#1c1b1a", "#1c1b1a"];

    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const c = this.cells[y][x];
        const px = ox + x * cell;
        const py = oy + y * cell;
        if (c.open) {
          inkRect(ctx, px + 1.5, py + 1.5, cell - 3, cell - 3, c.mine ? this.accent : PALETTE.paper, PALETTE.gray, 1.5);
          if (c.mine) {
            ctx.fillStyle = PALETTE.ink;
            ctx.beginPath();
            ctx.arc(px + cell / 2, py + cell / 2, cell * 0.22, 0, Math.PI * 2);
            ctx.fill();
          } else if (c.count > 0) {
            inkText(ctx, String(c.count), px + cell / 2, py + cell / 2, cell * 0.5, colors[c.count], "900");
          }
        } else {
          inkRect(ctx, px + 1.5, py + 1.5, cell - 3, cell - 3, c.flagged ? "#eed9c4" : PALETTE.white, PALETTE.ink, 2);
          if (c.flagged) {
            ctx.fillStyle = this.accent;
            ctx.beginPath();
            ctx.moveTo(px + cell * 0.38, py + cell * 0.25);
            ctx.lineTo(px + cell * 0.72, py + cell * 0.5);
            ctx.lineTo(px + cell * 0.38, py + cell * 0.75);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = PALETTE.ink;
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }
      }
    }

    const flags = this.cells.flat().filter((c) => c.flagged).length;
    inkText(ctx, `⚑ ${MINES - flags}`, w / 2, h * 0.055, s * 0.045, this.accent);
    inkText(ctx, `${Math.round(this.time / 1000)}s  best ${this.best || "—"}`, w / 2, h * 0.955, s * 0.032, PALETTE.gray);

    if (this.state === "dead" || this.state === "clear") {
      ctx.fillStyle = "rgba(246,241,231,0.85)";
      ctx.fillRect(0, 0, w, h);
      speedLines(ctx, w / 2, h / 2, s * 0.25, Math.max(w, h) * 0.75, 0.5, 36);
      speechBubble(
        ctx,
        this.state === "clear" ? "Field swept!" : "Boom — ink everywhere",
        w / 2,
        h / 2,
        s * 0.055,
      );
      inkText(ctx, "tap to return", w / 2, h * 0.62, s * 0.035, PALETTE.gray);
    }
  }

  teardown(): void {}
}
