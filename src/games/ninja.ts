import type { Game, GameContext } from "./types";
import {
  PALETTE,
  inkRect,
  inkText,
  speechBubble,
  speedLines,
  halftonePattern,
} from "../engine/style";
import { sfx } from "../engine/sfx";
import {
  FOCUS_SCALE,
  TICK,
  initState,
  step,
  type PlayerInput,
  type SimState,
} from "./ninja-sim";
import { LEVELS } from "./ninja-levels";

interface TrailPt {
  x: number;
  y: number;
  t: number;
}

type Phase = "ready" | "play" | "dead" | "won" | "alldone";

export class NinjaGame implements Game {
  readonly id = "ninja";
  readonly name = "Ink Blade";
  readonly blurb = "Hold left to focus time. Tap right to jump, again to dash.";
  readonly accent = "#d43d2a";

  private levelIdx = 0;
  private sim: SimState | null = null;
  private input: PlayerInput = {
    left: false,
    right: false,
    jump: false,
    dash: null,
    focus: false,
  };
  private jumpBuffer = 0;
  private dashQueue: { x: number; y: number } | null = null;
  private trail: TrailPt[] = [];
  private deathT = 0;
  private winT = 0;
  private phase: Phase = "ready";
  private best: Record<string, number> = {};
  private focusHeld = false;
  private cameraX = 0;

  init(g: GameContext): void {
    this.levelIdx = 0;
    this.best = g.save.get("ninja:best", {});
    this.loadLevel();
    this.phase = "ready";
  }

  private loadLevel(): void {
    this.sim = initState(LEVELS[this.levelIdx]);
    this.trail = [];
    this.input = {
      left: false,
      right: false,
      jump: false,
      dash: null,
      focus: false,
    };
    this.focusHeld = false;
    this.cameraX = LEVELS[this.levelIdx].spawn.x;
    this.deathT = 0;
    this.winT = 0;
  }

  private world(g: GameContext): { scale: number; ox: number; oy: number } {
    const lvl = LEVELS[this.levelIdx];
    const scale = Math.min(g.w / 16, g.h / 12);
    const camX = this.cameraX;
    const ox = g.w / 2 - camX * scale;
    const oy = g.h / 2 - (lvl.bounds.h / 2) * scale;
    return { scale, ox, oy };
  }

  update(dt: number, g: GameContext): void {
    const lvl = LEVELS[this.levelIdx];
    if (!this.sim) return;
    const s = this.sim;

    if (this.phase === "dead") {
      this.deathT += dt;
      if (this.deathT > 700) {
        sfx.tap();
        this.loadLevel();
        this.phase = "play";
      }
      return;
    }
    if (this.phase === "won") {
      this.winT += dt;
      if (this.winT > 1400) {
        if (this.levelIdx + 1 >= LEVELS.length) {
          this.phase = "alldone";
        } else {
          this.levelIdx++;
          this.loadLevel();
          this.phase = "play";
        }
      }
      return;
    }

    const held = g.input.activePointers();
    this.focusHeld = held.some((p) => p.x < g.w * 0.38);

    const events = g.input.consumeEvents();
    for (const e of events) {
      if (e.type === "tap" && this.phase === "ready") {
        this.phase = "play";
        sfx.tap();
        continue;
      }
      if (this.phase !== "play") continue;
      if (e.type === "tap" || e.type === "longpress") {
        if (e.x < g.w * 0.38) {
          continue;
        }
        if (s.player.onGround) {
          this.jumpBuffer = 120;
          sfx.move();
        } else {
          const { scale, ox, oy } = this.world(g);
          const wx = (e.x - ox) / scale;
          const wy = (e.y - oy) / scale;
          const dx = wx - s.player.x;
          const dy = wy - s.player.y;
          if (Math.hypot(dx, dy) > 0.3) this.dashQueue = { x: dx, y: dy };
        }
      } else if (e.type === "drag") {
        if (e.x < g.w * 0.38) continue;
        const { scale, ox, oy } = this.world(g);
        const wx = (e.x - ox) / scale;
        const wy = (e.y - oy) / scale;
        const dx = wx - s.player.x;
        const dy = wy - s.player.y;
        if (Math.hypot(dx, dy) > 0.3) this.dashQueue = { x: dx, y: dy };
      }
    }

    this.input.focus = this.focusHeld;
    this.input.dash = this.dashQueue;
    this.input.jump = this.jumpBuffer > 0 && s.player.onGround;

    if (this.jumpBuffer > 0) this.jumpBuffer -= dt;
    this.dashQueue = null;

    const wasAlive = s.player.alive;
    const wasWon = s.player.won;

    let t = 0;
    while (t < dt) {
      const stepDt = Math.min(TICK * 1000, dt - t);
      step(lvl, s, this.input, stepDt / 1000);
      t += stepDt;
    }

    if (s.player.dashT > 0.17) {
      this.trail.push({ x: s.player.x, y: s.player.y, t: 300 });
      sfx.tap();
    }
    this.trail.forEach((p) => (p.t -= dt));
    this.trail = this.trail.filter((p) => p.t > 0);

    const targetCam = s.player.x + s.player.facing * 3;
    this.cameraX += (targetCam - this.cameraX) * Math.min(1, dt / 120);

    if (wasAlive && !s.player.alive) {
      sfx.die();
      if (navigator.vibrate) navigator.vibrate(60);
      this.phase = "dead";
      return;
    }
    if (!wasWon && s.player.won) {
      const time = s.player.wonT;
      sfx.win();
      const key = String(this.levelIdx);
      if (!this.best[key] || time < this.best[key]) {
        this.best[key] = time;
      }
      this.phase = "won";
      this.winT = 0;
    }
    this.input.jump = false;
  }

  render(g: GameContext): void {
    const { ctx, w, h } = g;
    const s = this.sim;
    const lvl = LEVELS[this.levelIdx];
    const { scale, ox, oy } = this.world(g);
    const sv = Math.min(w, h);

    ctx.fillStyle = PALETTE.paper;
    ctx.fillRect(0, 0, w, h);

    if (this.input.focus) {
      ctx.save();
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = halftonePattern(ctx);
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    if (s) {
      for (const plat of lvl.platforms) {
        inkRect(
          ctx,
          ox + plat.x * scale,
          oy + plat.y * scale,
          plat.w * scale,
          plat.h * scale,
          PALETTE.white,
          PALETTE.ink,
          3,
        );
      }

      const goal = lvl.goal;
      const gx = ox + goal.x * scale;
      const gy = oy + goal.y * scale;
      ctx.strokeStyle = this.accent;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(gx, gy, goal.w * scale, goal.h * scale, 6);
      ctx.stroke();
      ctx.fillStyle = "rgba(212,61,42,0.2)";
      ctx.fill();
      if (!s.player.won) {
        speedLines(ctx, gx + (goal.w * scale) / 2, gy + (goal.h * scale) / 2, 14, 26, 0.35, 10);
      }

      lvl.hazards.forEach((hz, i) => {
        if (hz.kind === "saw") {
          const c = s.sawPos[i] ?? { x: hz.cx, y: hz.cy };
          const px = ox + c.x * scale;
          const py = oy + c.y * scale;
          const r = hz.r * scale;
          ctx.fillStyle = PALETTE.paper;
          ctx.strokeStyle = PALETTE.ink;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2 + s.worldTime * hz.speed * 2;
            ctx.beginPath();
            ctx.moveTo(px + Math.cos(a) * r * 0.4, py + Math.sin(a) * r * 0.4);
            ctx.lineTo(px + Math.cos(a) * r * 0.95, py + Math.sin(a) * r * 0.95);
            ctx.strokeStyle = this.accent;
            ctx.lineWidth = 2.5;
            ctx.stroke();
          }
          ctx.fillStyle = PALETTE.ink;
          ctx.beginPath();
          ctx.arc(px, py, r * 0.15, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const px = ox + hz.x * scale;
          const py = oy + hz.y * scale;
          inkRect(ctx, px - 8, py - 8, 16, 16, PALETTE.ink, PALETTE.ink, 2);
        }
      });

      for (const bl of s.bullets) {
        const px = ox + bl.x * scale;
        const py = oy + bl.y * scale;
        const r = bl.r * scale;
        ctx.strokeStyle = "rgba(28,27,26,0.35)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px - bl.vx * 0.08 * scale, py - bl.vy * 0.08 * scale);
        ctx.lineTo(px, py);
        ctx.stroke();
        ctx.fillStyle = this.accent;
        ctx.strokeStyle = PALETTE.ink;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      for (const p of this.trail) {
        ctx.globalAlpha = p.t / 300;
        ctx.fillStyle = this.accent;
        ctx.beginPath();
        ctx.arc(ox + p.x * scale, oy + p.y * scale, scale * 0.18 * (p.t / 300), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      const p = s.player;
      const px = ox + p.x * scale;
      const py = oy + p.y * scale;
      const pw = 0.8 * scale;
      const ph = 0.9 * scale;
      ctx.fillStyle = PALETTE.ink;
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(px - pw / 2, py - ph / 2, pw, ph, 4);
      ctx.fill();
      ctx.fillStyle = PALETTE.paper;
      ctx.fillRect(px + (p.facing > 0 ? 0 : -pw / 2 + 1), py - ph * 0.22, pw / 2 - 1, 3);
      const scarfX = px - p.facing * pw * 0.6;
      const scarfWave = Math.sin(s.time * 12) * 3;
      ctx.strokeStyle = this.accent;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px - p.facing * pw * 0.4, py - ph * 0.25);
      ctx.quadraticCurveTo(scarfX, py - ph * 0.25 + scarfWave, scarfX - p.facing * 6, py - ph * 0.2 - scarfWave);
      ctx.stroke();
    }

    ctx.strokeStyle = this.input.focus ? this.accent : PALETTE.gray;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(w * 0.38, h * 0.12);
    ctx.lineTo(w * 0.38, h * 0.9);
    ctx.stroke();
    ctx.setLineDash([]);
    inkText(
      ctx,
      this.input.focus ? "FOCUS" : "hold",
      w * 0.19,
      h * 0.085,
      sv * 0.028,
      this.input.focus ? this.accent : PALETTE.gray,
    );
    inkText(ctx, "jump / dash", w * 0.69, h * 0.085, sv * 0.028, PALETTE.gray);

    inkText(ctx, `${this.levelIdx + 1}/${LEVELS.length} · ${lvl.name}`, w / 2, h * 0.035, sv * 0.03, PALETTE.ink, "700");
    const bestT = this.best[String(this.levelIdx)];
    if (bestT)
      inkText(ctx, `best ${bestT.toFixed(1)}s`, w / 2, h * 0.065, sv * 0.026, PALETTE.gray);

    if (this.phase === "ready") {
      speechBubble(ctx, "tap right to begin", w * 0.69, h * 0.5, sv * 0.045);
      speechBubble(ctx, lvl.name, w / 2, h * 0.3, sv * 0.05);
      inkText(ctx, "hold left = slow time · tap right = jump · tap in air = dash", w / 2, h * 0.38, sv * 0.026, PALETTE.gray);
    }
    if (this.phase === "dead") {
      ctx.fillStyle = "rgba(246,241,231,0.6)";
      ctx.fillRect(0, 0, w, h);
      speechBubble(ctx, "Again!", w / 2, h * 0.45, sv * 0.06);
    }
    if (this.phase === "won") {
      speedLines(ctx, w / 2, h / 2, sv * 0.2, Math.max(w, h) * 0.7, 0.35, 30);
      speechBubble(ctx, `${lvl.name} cleared!`, w / 2, h * 0.42, sv * 0.05);
      inkText(ctx, `${s?.player.wonT.toFixed(1)}s`, w / 2, h * 0.52, sv * 0.04, this.accent);
    }
    if (this.phase === "alldone") {
      ctx.fillStyle = "rgba(246,241,231,0.85)";
      ctx.fillRect(0, 0, w, h);
      speedLines(ctx, w / 2, h / 2, sv * 0.25, Math.max(w, h) * 0.75, 0.5, 36);
      speechBubble(ctx, "All chapters cleared — ninja master!", w / 2, h * 0.45, sv * 0.05);
      inkText(ctx, "tap to return", w / 2, h * 0.58, sv * 0.035, PALETTE.gray);
      if (g.input.consumeEvents().length > 0) g.exit();
    }

    void FOCUS_SCALE;
  }

  teardown(): void {
    this.focusHeld = false;
  }
}
