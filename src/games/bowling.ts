import type { Game, GameContext } from "./types";
import {
  PALETTE,
  inkRect,
  inkText,
  speechBubble,
  speedLines,
  hexWithAlpha,
} from "../engine/style";
import { sfx } from "../engine/sfx";
import {
  LANE_LEN,
  LANE_W,
  initState,
  score,
  standing,
  step,
  throwBall,
  type SimState,
} from "./bowling-sim";

type Phase =
  | "pick"
  | "aim"
  | "rolling"
  | "scoreboard";

export class BowlingGame implements Game {
  readonly id = "bowling";
  readonly name = "Ink Bowling";
  readonly blurb = "Pull down to roll. Ten frames, real pins.";
  readonly accent = "#d43d2a";

  private sim: SimState = initState(1);
  private uiPhase: Phase = "pick";
  private pullStartY = 0;
  private pullY = 0;
  private pulling = false;
  private aimX = 0;
  private bests: Record<string, number> = {};
  private overT = 0;

  init(g: GameContext): void {
    this.bests = g.save.get("bowling:best", {} as Record<string, number>);
    this.uiPhase = "pick";
    this.overT = 0;
  }

  private newGame(players: number): void {
    this.sim = initState(players);
    this.uiPhase = "aim";
    this.aimX = 0;
    this.pullY = 0;
    this.pulling = false;
  }

  // pseudo-3D: lane is a trapezoid, z=0 (bottom, wide) to z=LANE_LEN (top, narrow)
  private project(
    g: GameContext,
    x: number,
    z: number,
  ): { sx: number; sy: number; scale: number } {
    const t = Math.min(1, z / LANE_LEN); // 0 near, 1 far
    const topShrink = 0.35; // far end is 35% of near width
    const nearW = g.w * 0.96;
    const farW = nearW * topShrink;
    const laneTopY = g.h * 0.30;
    const laneBotY = g.h * 0.97;
    const persp = (1 - t) ** 1.35;
    const laneW = farW + (nearW - farW) * persp;
    const sx = g.w / 2 + (x - LANE_W / 2) * (laneW / LANE_W);
    const sy = laneTopY + (laneBotY - laneTopY) * persp;
    return { sx, sy, scale: laneW / LANE_W };
  }

  update(dt: number, g: GameContext): void {
    const events = g.input.consumeEvents();

    if (this.uiPhase === "pick") {
      for (const e of events) {
        if (e.type !== "tap") continue;
        const bw = Math.min(g.w * 0.8, 360);
        const bh = Math.min(g.w, g.h) * 0.11;
        const gap = bh * 0.5;
        const top = g.h * 0.32;
        [1, 2].forEach((players, i) => {
          const y = top + i * (bh + gap);
          if (
            e.x > g.w / 2 - bw / 2 &&
            e.x < g.w / 2 + bw / 2 &&
            e.y > y &&
            e.y < y + bh
          ) {
            this.newGame(players);
            sfx.tap();
          }
        });
      }
      return;
    }

    if (this.sim.gameOver) {
      this.overT += dt;
      for (const e of events) {
        if (e.type === "tap" && this.overT > 600) {
          g.exit();
          return;
        }
      }
      return;
    }

    // aim phase: pull down to charge, release to throw
    if (this.sim.phase === "aim") {
      for (const e of events) {
        if (e.type === "tap" || e.type === "longpress") {
          this.pulling = true;
          this.pullStartY = e.y;
          this.pullY = e.y;
          this.aimX = ((e.x - g.w / 2) / (g.w / 2)) * 0.9;
        } else if (e.type === "drag") {
          this.pullY = e.y;
          this.aimX = Math.max(
            -0.9,
            Math.min(0.9, ((e.x - g.w / 2) / (g.w / 2)) * 0.9),
          );
        }
      }
      if (this.pulling && !g.input.isPointerDown()) {
        // release: compute force from pull distance
        const pull = Math.max(
          0,
          Math.min(1, (this.pullY - this.pullStartY) / (g.h * 0.3)),
        );
        const force = 0.25 + pull * 0.75;
        this.pulling = false;
        this.pullY = 0;
        throwBall(this.sim, { x: this.aimX, force, hook: 0 }, Math.random);
        sfx.move();
        if (navigator.vibrate) navigator.vibrate(15);
      }
    } else {
      for (const e of events) void e;
    }

    // sim stepping
    const prevStanding = standing(this.sim).length;
    const s = this.sim;
    let t = 0;
    while (t < dt) {
      const stepDt = Math.min(1000 / 60, dt - t);
      step(s, stepDt / 1000);
      t += stepDt;
    }
    const nowStanding = standing(s).length;
    if (nowStanding < prevStanding) {
      sfx.brick();
      if (navigator.vibrate) navigator.vibrate(10);
    }

    if (s.gameOver) {
      sfx.win();
      const sc = score(s.scores[s.current]);
      const key = `${s.players}p`;
      if (!this.bests[key] || sc > this.bests[key]) {
        this.bests[key] = sc;
      }
      g.save.set("bowling:best", this.bests);
    }
  }

  render(g: GameContext): void {
    const { ctx, w, h } = g;
    const sv = Math.min(w, h);

    if (this.uiPhase === "pick") {
      inkText(ctx, "Ink Bowling", w / 2, h * 0.15, sv * 0.07, PALETTE.ink, "900");
      inkText(ctx, "pull down & release to roll", w / 2, h * 0.23, sv * 0.032, PALETTE.gray);
      const bw = Math.min(w * 0.8, 360);
      const bh = sv * 0.11;
      const gap = bh * 0.5;
      const labels = ["one player", "two players"];
      const hints = ["10 frames vs the pins", "10 frames, pass and play"];
      labels.forEach((label, i) => {
        const y = h * 0.32 + i * (bh + gap);
        inkRect(ctx, w / 2 - bw / 2, y, bw, bh, PALETTE.white, PALETTE.ink, 3.5);
        inkText(ctx, label, w / 2, y + bh * 0.38, sv * 0.05, PALETTE.ink, "700");
        inkText(ctx, hints[i], w / 2, y + bh * 0.72, sv * 0.026, PALETTE.gray);
        const best = this.bests[`${i + 1}p`];
        if (best)
          inkText(ctx, `best ${best}`, w / 2, y + bh * 0.9, sv * 0.022, PALETTE.accent);
      });
      return;
    }

    const s = this.sim;

    // lane (trapezoid)
    const nl = this.project(g, 0, 0);
    const nr = this.project(g, LANE_W, 0);
    const fr = this.project(g, LANE_W, LANE_LEN);
    const fl = this.project(g, 0, LANE_LEN);
    ctx.beginPath();
    ctx.moveTo(nl.sx, nl.sy);
    ctx.lineTo(nr.sx, nr.sy);
    ctx.lineTo(fr.sx, fr.sy);
    ctx.lineTo(fl.sx, fl.sy);
    ctx.closePath();
    ctx.fillStyle = PALETTE.wood;
    ctx.fill();
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // lane guides (arrows zone)
    ctx.strokeStyle = hexWithAlpha(PALETTE.ink, 0.2);
    ctx.lineWidth = 1.5;
    for (const frac of [0.15, 0.3, 0.45, 0.55, 0.7, 0.85]) {
      const a = this.project(g, LANE_W * frac, 8);
      const b = this.project(g, LANE_W * frac, 16);
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy);
      ctx.lineTo(b.sx, b.sy);
      ctx.stroke();
    }
    // foul line
    const f1 = this.project(g, 0, 2);
    const f2 = this.project(g, LANE_W, 2);
    ctx.beginPath();
    ctx.moveTo(f1.sx, f1.sy);
    ctx.lineTo(f2.sx, f2.sy);
    ctx.strokeStyle = PALETTE.accent;
    ctx.lineWidth = 2;
    ctx.stroke();

    // pins
    for (const p of s.pins) {
      const pr = this.project(g, p.x, p.z);
      const size = pr.scale * 0.42;
      if (p.up) {
        inkRect(ctx, pr.sx - size / 2, pr.sy - size * 1.5, size, size * 1.6, PALETTE.white, PALETTE.ink, 2);
        // neck band
        ctx.fillStyle = PALETTE.accent;
        ctx.fillRect(pr.sx - size / 2 + 1, pr.sy - size * 1.2, size - 2, size * 0.18);
      } else if (p.fallingT < 0.5) {
        // toppled: lying flat, fading
        ctx.globalAlpha = 1 - p.fallingT * 1.6;
        inkRect(ctx, pr.sx - size, pr.sy - size * 0.5, size * 2, size * 0.55, PALETTE.gray, PALETTE.ink, 1.5);
        ctx.globalAlpha = 1;
      }
    }

    // ball
    if (s.ball) {
      const bp = this.project(g, s.ball.x, s.ball.z);
      const br = bp.scale * 0.7 * 0.7;
      ctx.fillStyle = PALETTE.ink;
      ctx.beginPath();
      ctx.arc(bp.sx, bp.sy - br * 0.6, br, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.paper;
      ctx.beginPath();
      ctx.arc(bp.sx - br * 0.25, bp.sy - br * 0.85, br * 0.12, 0, Math.PI * 2);
      ctx.arc(bp.sx + br * 0.15, bp.sy - br * 0.95, br * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }

    // aim overlay: ghost ball + force meter
    if (s.phase === "aim" && !s.gameOver) {
      const bp = this.project(g, LANE_W / 2 + this.aimX * (LANE_W / 2 - 1), 2);
      const br = bp.scale * 0.7 * 0.7;
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = PALETTE.ink;
      ctx.beginPath();
      ctx.arc(bp.sx, bp.sy - br * 0.6, br, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      if (this.pulling) {
        const pull = Math.max(
          0,
          Math.min(1, (this.pullY - this.pullStartY) / (g.h * 0.3)),
        );
        // force meter on the side
        const mx = w * 0.92;
        const mh = h * 0.4;
        const mt = h * 0.3;
        inkRect(ctx, mx - 8, mt, 16, mh, PALETTE.white, PALETTE.ink, 2.5);
        ctx.fillStyle = pull > 0.8 ? PALETTE.accent : PALETTE.ink;
        ctx.fillRect(mx - 6, mt + mh * (1 - pull) + 2, 12, mh * pull - 4);
        inkText(ctx, `${Math.round(pull * 100)}%`, mx, mt + mh + 14, sv * 0.024, PALETTE.gray);
        // trajectory hint line
        ctx.setLineDash([6, 10]);
        ctx.strokeStyle = hexWithAlpha(PALETTE.ink, 0.4);
        ctx.lineWidth = 2;
        const dir = this.project(
          g,
          LANE_W / 2 + this.aimX * (LANE_W / 2 - 1) + this.aimX * 2,
          20,
        );
        ctx.beginPath();
        ctx.moveTo(bp.sx, bp.sy);
        ctx.lineTo(dir.sx, dir.sy);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        inkText(ctx, "pull down & release", w / 2, h * 0.24, sv * 0.03, PALETTE.gray);
      }
    }

    // HUD: scores
    const hudY = h * 0.06;
    s.scores.forEach((frames, pi) => {
      const total = score(frames);
      const label = s.players === 1 ? "" : `P${pi + 1} `;
      const active = pi === s.current;
      inkText(
        ctx,
        `${label}${total}`,
        w * (s.players === 1 ? 0.5 : pi === 0 ? 0.3 : 0.7),
        hudY,
        sv * (active ? 0.05 : 0.04),
        active ? PALETTE.accent : PALETTE.gray,
        active ? "900" : "700",
      );
    });
    inkText(
      ctx,
      `frame ${s.frame + 1}/10 · ball ${s.roll + 1}`,
      w / 2,
      h * 0.115,
      sv * 0.026,
      PALETTE.gray,
    );

    if (s.gameOver) {
      ctx.fillStyle = hexWithAlpha(PALETTE.paper, Math.min(0.85, this.overT / 400));
      ctx.fillRect(0, 0, w, h);
      if (this.overT > 400) {
        speedLines(ctx, w / 2, h / 2, sv * 0.25, Math.max(w, h) * 0.75, 0.5, 36);
        const totals = s.scores.map((f) => score(f));
        const msg =
          s.players === 1
            ? `${totals[0]} points`
            : totals[0] === totals[1]
              ? `A tie at ${totals[0]}!`
              : `Player ${totals[0] > totals[1] ? 1 : 2} wins, ${Math.max(...totals)}–${Math.min(...totals)}!`;
        speechBubble(ctx, msg, w / 2, h * 0.44, sv * 0.05);
        inkText(ctx, "tap to return", w / 2, h * 0.56, sv * 0.035, PALETTE.gray);
      }
    }
  }

  teardown(): void {
    this.pulling = false;
  }
}
