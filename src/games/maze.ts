import type { Game, GameContext } from "./types";
import {
  PALETTE,
  inkRect,
  inkText,
  speechBubble,
  hexWithAlpha,
} from "../engine/style";
import { sfx } from "../engine/sfx";
import {
  BALL_R,
  LEVELS,
  WALL_THICK,
  ballAt,
  step,
  type SimState,
} from "./maze-sim";

type Phase = "ask" | "calibrate" | "play" | "fell" | "won" | "alldone";

interface Orientation {
  beta: number; // front-back
  gamma: number; // left-right
}

export class MazeGame implements Game {
  readonly id = "maze";
  readonly name = "Ink Labyrinth";
  readonly blurb = "Tilt your phone. Guide the ink drop home.";
  readonly accent = "#d43d2a";

  private sim: SimState = ballAt(0, 0, LEVELS[0]);
  private levelIdx = 0;
  private phase: Phase = "ask";
  private orient: Orientation = { beta: 0, gamma: 0 };
  private zero: Orientation = { beta: 0, gamma: 0 };
  private handler: ((e: DeviceOrientationEvent) => void) | null = null;
  private bests: Record<string, number> = {};
  private fellT = 0;
  private wonT = 0;
  private allowed = false;
  private noSensor = false;
  private calHint = 0;

  init(g: GameContext): void {
    this.bests = g.save.get("maze:best", {} as Record<string, number>);
    this.levelIdx = 0;
    this.phase = "ask";
    this.fellT = 0;
    this.wonT = 0;
    this.allowed = false;
    this.noSensor = false;
    this.calHint = 0;
    this.attachSensor();
  }

  private attachSensor(): void {
    this.detachSensor();
    const DOE = window.DeviceOrientationEvent as
      | (typeof DeviceOrientationEvent & {
          requestPermission?: () => Promise<string>;
        })
      | undefined;
    if (!DOE) {
      this.noSensor = true;
      return;
    }
    this.handler = (e: DeviceOrientationEvent): void => {
      this.orient = { beta: e.beta ?? 0, gamma: e.gamma ?? 0 };
    };
    window.addEventListener("deviceorientation", this.handler);
  }

  private detachSensor(): void {
    if (this.handler) {
      window.removeEventListener("deviceorientation", this.handler);
      this.handler = null;
    }
  }

  private async requestAccess(): Promise<void> {
    const DOE = window.DeviceOrientationEvent as
      | (typeof DeviceOrientationEvent & {
          requestPermission?: () => Promise<string>;
        })
      | undefined;
    if (!DOE) {
      this.noSensor = true;
      this.phase = "calibrate";
      return;
    }
    if (typeof DOE.requestPermission === "function") {
      try {
        const res = await DOE.requestPermission();
        this.allowed = res === "granted";
        if (!this.allowed) {
          this.noSensor = true; // fall back to touch
        }
      } catch {
        this.noSensor = true;
      }
    } else {
      this.allowed = true;
    }
    this.phase = "calibrate";
  }

  private startLevel(): void {
    const lvl = LEVELS[this.levelIdx];
    this.sim = ballAt(lvl.start.x, lvl.start.y, lvl);
    this.zero = { ...this.orient };
    this.phase = "play";
  }

  private tiltVector(): { x: number; y: number } {
    // portrait: gamma = left/right, beta = toward/away (screen down)
    const gx = Math.max(-1, Math.min(1, (this.orient.gamma - this.zero.gamma) / 30));
    const by = Math.max(-1, Math.min(1, (this.orient.beta - this.zero.beta) / 30));
    // hold the phone upright-ish: tilting the top away (beta+) = ball rolls up
    return { x: gx, y: -by };
  }

  update(dt: number, g: GameContext): void {
    const lvl = LEVELS[this.levelIdx];

    if (this.phase === "ask") {
      for (const e of g.input.consumeEvents()) {
        if (e.type === "tap") {
          void this.requestAccess();
        }
      }
      return;
    }
    if (this.phase === "calibrate") {
      for (const e of g.input.consumeEvents()) {
        if (e.type === "tap") {
          this.startLevel();
          sfx.tap();
        }
      }
      this.calHint += dt;
      return;
    }
    if (this.phase === "fell") {
      this.fellT += dt;
      if (this.fellT > 900) {
        this.startLevel();
      }
      return;
    }
    if (this.phase === "won") {
      this.wonT += dt;
      if (this.wonT > 1500) {
        if (this.levelIdx + 1 >= LEVELS.length) {
          this.phase = "alldone";
        } else {
          this.levelIdx++;
          this.startLevel();
        }
      }
      return;
    }
    if (this.phase === "alldone") {
      for (const e of g.input.consumeEvents()) {
        if (e.type === "tap") {
          this.detachSensor();
          g.exit();
          return;
        }
      }
      return;
    }

    // playing: feed tilt into the sim
    const s = this.sim;
    if (this.noSensor) {
      // touch fallback: drag = virtual tilt
      for (const e of g.input.consumeEvents()) {
        if (e.type === "drag" || e.type === "tap") {
          s.tilt = {
            x: Math.max(-1, Math.min(1, (e.x - g.w / 2) / (g.w / 3))),
            y: Math.max(-1, Math.min(1, (e.y - g.h / 2) / (g.h / 3))),
          };
        }
      }
      if (!g.input.isPointerDown()) {
        s.tilt = { x: s.tilt.x * 0.9, y: s.tilt.y * 0.9 };
      }
    } else {
      s.tilt = this.tiltVector();
    }

    const wasOver = s.over;
    const wasWon = s.won;
    let t = 0;
    while (t < dt) {
      const stepDt = Math.min(1000 / 60, dt - t);
      step(s, stepDt / 1000, lvl);
      t += stepDt;
    }
    if (!wasOver && s.over) {
      sfx.die();
      if (navigator.vibrate) navigator.vibrate(60);
      this.phase = "fell";
      this.fellT = 0;
    }
    if (!wasWon && s.won) {
      sfx.win();
      const key = String(this.levelIdx);
      const time = Math.round(s.wonT * 10) / 10;
      if (!this.bests[key] || time < this.bests[key]) {
        this.bests[key] = time;
        g.save.set("maze:best", this.bests);
      }
      this.phase = "won";
      this.wonT = 0;
    }
  }

  private geo(g: GameContext): { scale: number; ox: number; oy: number } {
    const lvl = LEVELS[this.levelIdx];
    const scale = Math.min(
      (g.w * 0.94) / lvl.cols,
      (g.h * 0.8) / lvl.rows,
    );
    return {
      scale,
      ox: (g.w - lvl.cols * scale) / 2,
      oy: (g.h - lvl.rows * scale) / 2 + g.h * 0.02,
    };
  }

  render(g: GameContext): void {
    const { ctx, w, h } = g;
    const sv = Math.min(w, h);
    const lvl = LEVELS[this.levelIdx];

    ctx.fillStyle = PALETTE.paper;
    ctx.fillRect(0, 0, w, h);

    if (this.phase === "ask") {
      inkText(ctx, "Ink Labyrinth", w / 2, h * 0.15, sv * 0.07, PALETTE.ink, "900");
      inkText(ctx, "Tilt your phone to steer the ink drop.", w / 2, h * 0.26, sv * 0.03, PALETTE.gray);
      inkText(ctx, "Avoid the holes. Reach the well.", w / 2, h * 0.3, sv * 0.03, PALETTE.gray);
      const bw = Math.min(w * 0.8, 360);
      const bh = sv * 0.1;
      inkRect(ctx, w / 2 - bw / 2, h * 0.42, bw, bh, PALETTE.white, PALETTE.ink, 3.5);
      inkText(ctx, "tap to allow motion", w / 2, h * 0.42 + bh / 2, sv * 0.04, PALETTE.ink, "700");
      inkText(
        ctx,
        "(iOS will ask for Motion & Orientation access)",
        w / 2,
        h * 0.42 + bh + sv * 0.04,
        sv * 0.024,
        PALETTE.gray,
      );
      return;
    }

    if (this.phase === "calibrate") {
      inkText(ctx, "Hold your phone naturally", w / 2, h * 0.3, sv * 0.04, PALETTE.ink, "700");
      inkText(ctx, "this position becomes 'flat'", w / 2, h * 0.36, sv * 0.028, PALETTE.gray);
      const bw = Math.min(w * 0.8, 360);
      const bh = sv * 0.1;
      const pulse = 0.5 + 0.5 * Math.sin(this.calHint * 0.005);
      inkRect(ctx, w / 2 - bw / 2, h * 0.5, bw, bh, PALETTE.white, PALETTE.accent, 3.5);
      inkText(ctx, "tap to start", w / 2, h * 0.5 + bh / 2, sv * 0.04 + pulse * 2, PALETTE.accent, "700");
      if (this.noSensor)
        inkText(ctx, "no motion sensor — touch steering will be used", w / 2, h * 0.68, sv * 0.026, PALETTE.gray);
      return;
    }

    const { scale, ox, oy } = this.geo(g);

    // board
    inkRect(ctx, ox - 6, oy - 6, lvl.cols * scale + 12, lvl.rows * scale + 12, PALETTE.white, PALETTE.ink, 4);

    // goal well
    const gx = ox + (lvl.goal.x + 0.5) * scale;
    const gy = oy + (lvl.goal.y + 0.5) * scale;
    ctx.strokeStyle = PALETTE.accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(gx, gy, scale * 0.4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = hexWithAlpha(PALETTE.accent, 0.2);
    ctx.fill();

    // holes
    for (const hole of lvl.holes) {
      const hx = ox + hole.x * scale;
      const hy = oy + hole.y * scale;
      ctx.fillStyle = PALETTE.ink;
      ctx.beginPath();
      ctx.arc(hx, hy, hole.r * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = hexWithAlpha(PALETTE.ink, 0.4);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(hx, hy, hole.r * scale + 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // walls: sketchy ink strokes
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineCap = "round";
    for (const wall of lvl.walls) {
      const x1 = ox + wall.x * scale;
      const y1 = oy + wall.y * scale;
      const x2 = ox + (wall.vertical ? wall.x : wall.x + wall.w) * scale;
      const y2 = oy + (wall.vertical ? wall.y + wall.w : wall.y) * scale;
      // main stroke with slight wobble for the sketch look
      ctx.lineWidth = Math.max(4, WALL_THICK * scale);
      ctx.beginPath();
      ctx.moveTo(x1 + 1.5, y1 - 1);
      ctx.lineTo(x2 + 1.5, y2 + 1);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(x1 - 2, y1 + 2);
      ctx.lineTo(x2 - 2, y2 - 1.5);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // ball: an ink drop
    const s = this.sim;
    const bx = ox + s.x * scale;
    const by = oy + s.y * scale;
    ctx.fillStyle = PALETTE.ink;
    ctx.beginPath();
    ctx.arc(bx, by, BALL_R * scale, 0, Math.PI * 2);
    ctx.fill();
    // drop highlight
    ctx.fillStyle = hexWithAlpha("#ffffff", 0.35);
    ctx.beginPath();
    ctx.arc(bx - BALL_R * scale * 0.3, by - BALL_R * scale * 0.3, BALL_R * scale * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // HUD
    inkText(ctx, `${this.levelIdx + 1}/${LEVELS.length} · ${lvl.name}`, w / 2, h * 0.035, sv * 0.03, PALETTE.ink, "700");
    const best = this.bests[String(this.levelIdx)];
    inkText(
      ctx,
      best ? `best ${best}s · falls ${s.falls}` : `falls ${s.falls}`,
      w / 2,
      h * 0.065,
      sv * 0.025,
      PALETTE.gray,
    );

    if (this.phase === "fell") {
      ctx.fillStyle = hexWithAlpha(PALETTE.paper, 0.7);
      ctx.fillRect(0, 0, w, h);
      speechBubble(ctx, "Splash! Try again", w / 2, h * 0.45, sv * 0.05);
    }
    if (this.phase === "won") {
      speechBubble(
        ctx,
        `${lvl.name} cleared — ${s.wonT.toFixed(1)}s`,
        w / 2,
        h * 0.42,
        sv * 0.045,
      );
    }
    if (this.phase === "alldone") {
      ctx.fillStyle = hexWithAlpha(PALETTE.paper, 0.85);
      ctx.fillRect(0, 0, w, h);
      speechBubble(ctx, "The labyrinth is yours! 🎉", w / 2, h * 0.44, sv * 0.05);
      inkText(ctx, "tap to return", w / 2, h * 0.56, sv * 0.035, PALETTE.gray);
    }
  }

  teardown(): void {
    this.detachSensor();
  }
}
