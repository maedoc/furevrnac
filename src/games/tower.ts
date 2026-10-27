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
  LANE_LEN,
  ROAD_W,
  TOWER_COST,
  TOWER_RANGE,
  TOWER_SLOTS,
  canPlace,
  initState,
  placeTower,
  step,
  type SimState,
} from "./tower-sim";

const TOWER_GLYPH = ["🏹", "💣", "❄️"];
const ENEMY_GLYPH = ["👹", "👹"];

export class TowerGame implements Game {
  readonly id = "tower";
  readonly name = "Ink Bastion";
  readonly blurb = "Guard the road — enemies march toward you.";
  readonly accent = "#d43d2a";

  private sim: SimState = initState();
  private best = 0;
  private overT = 0;

  init(g: GameContext): void {
    this.sim = initState();
    this.best = g.save.get("tower:best", 0);
    this.overT = 0;
  }

  /** pseudo-3D projection: z=0 far (top, narrow), z=LANE_LEN near (bottom, wide) */
  private project(
    g: GameContext,
    x: number,
    z: number,
  ): { sx: number; sy: number; scale: number } {
    const t = Math.min(1, z / LANE_LEN); // 0 far, 1 near
    const topShrink = 0.32;
    const nearW = g.w * 0.94;
    const farW = nearW * topShrink;
    const laneTopY = g.h * 0.16;
    const laneBotY = g.h * 0.94;
    const persp = (1 - t) ** 1.35;
    const laneW = farW + (nearW - farW) * persp;
    const sx = g.w / 2 + (x / (ROAD_W / 2 + 2)) * (laneW / 2);
    const sy = laneTopY + (laneBotY - laneTopY) * persp;
    return { sx, sy, scale: laneW / ROAD_W };
  }

  update(dt: number, g: GameContext): void {
    const s = this.sim;
    const wasOver = s.over;

    const events = g.input.consumeEvents();
    for (const e of events) {
      if (s.over) continue;
      if (e.type !== "tap" && e.type !== "longpress") continue;

      // tower picker bar (bottom)
      const btnW = g.w * 0.26;
      const barY = g.h * 0.985;
      let picked = false;
      for (let i = 0; i < 3; i++) {
        const bx = g.w * 0.5 + (i - 1) * (btnW + 10);
        if (
          e.x > bx - btnW / 2 &&
          e.x < bx + btnW / 2 &&
          e.y > barY - g.h * 0.075
        ) {
          s.selectedTowerKind = i as 0 | 1 | 2;
          picked = true;
          sfx.tap();
        }
      }
      if (picked) continue;

      // placement: find nearest slot by projected y, side by x
      let bestSlot = -1;
      let bestDist = 1e9;
      TOWER_SLOTS.forEach((slot, i) => {
        const p = this.project(g, 0, slot);
        const d = Math.abs(p.sy - e.y);
        if (d < bestDist) {
          bestDist = d;
          bestSlot = i;
        }
      });
      const side: -1 | 1 = e.x < g.w / 2 ? -1 : 1;
      if (bestDist < g.h * 0.09) {
        if (placeTower(s, TOWER_SLOTS[bestSlot], side)) {
          sfx.brick();
          if (navigator.vibrate) navigator.vibrate(12);
        } else sfx.bounce();
      }
    }

    let t = 0;
    while (t < dt) {
      const stepDt = Math.min(1000 / 60, dt - t);
      step(s, stepDt / 1000, Math.random);
      t += stepDt;
    }

    if (s.over && !wasOver) {
      sfx.die();
      if (s.score > this.best) {
        this.best = s.score;
        g.save.set("tower:best", this.best);
      }
    }
    if (s.over) this.overT += dt;
  }

  render(g: GameContext): void {
    const { ctx, w, h } = g;
    const s = this.sim;
    const sv = Math.min(w, h);

    ctx.fillStyle = PALETTE.paper;
    ctx.fillRect(0, 0, w, h);

    // road trapezoid
    const nl = this.project(g, -ROAD_W / 2 - 2, LANE_LEN);
    const nr = this.project(g, ROAD_W / 2 + 2, LANE_LEN);
    const fr = this.project(g, ROAD_W / 2 + 2, 0);
    const fl = this.project(g, -ROAD_W / 2 - 2, 0);
    ctx.beginPath();
    ctx.moveTo(nl.sx, nl.sy);
    ctx.lineTo(nr.sx, nr.sy);
    ctx.lineTo(fr.sx, fr.sy);
    ctx.lineTo(fl.sx, fl.sy);
    ctx.closePath();
    ctx.fillStyle = PALETTE.tint1;
    ctx.fill();
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 3;
    ctx.stroke();

    // depth guides along the road (slot markers)
    ctx.font = `${Math.round(sv * 0.02)}px "Apple Color Emoji", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const slot of TOWER_SLOTS) {
      for (const side of [-1, 1] as const) {
        const p = this.project(g, side * (ROAD_W / 2 + 0.8), slot);
        if (canPlace(s, slot, side)) {
          ctx.globalAlpha = s.gold >= TOWER_COST[s.selectedTowerKind] ? 0.5 : 0.2;
          ctx.fillText("➕", p.sx, p.sy);
          ctx.globalAlpha = 1;
        }
      }
    }

    // the player's gate at the near end
    const gate = this.project(g, 0, LANE_LEN - 0.5);
    ctx.font = `${Math.round(gate.scale * 1.1)}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    ctx.fillText("🏯", w / 2, gate.sy);

    // towers
    for (const tw of s.towers) {
      const p = this.project(g, tw.side * (ROAD_W / 2 + 0.8), tw.z);
      // range hint
      ctx.strokeStyle = hexWithAlpha(PALETTE.ink, 0.1);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, TOWER_RANGE[tw.kind] * p.scale * 0.12, 0, Math.PI * 2);
      ctx.stroke();
      const size = Math.min(p.scale * 0.8, sv * 0.075);
      ctx.font = `${Math.round(size)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      ctx.fillText(TOWER_GLYPH[tw.kind], p.sx, p.sy);
    }

    // enemies: bigger as they approach
    for (const e of s.enemies) {
      const p = this.project(g, (Math.sin(e.z * 1.7) * 0.8), e.z);
      const size = Math.min(p.scale * 0.55, sv * 0.06) * (0.55 + 0.45 * (e.z / LANE_LEN));
      ctx.font = `${Math.round(size)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      ctx.fillText(ENEMY_GLYPH[e.kind], p.sx, p.sy);
      // hp bar
      const bw = size * 1.2;
      ctx.fillStyle = hexWithAlpha(PALETTE.paper, 0.8);
      ctx.fillRect(p.sx - bw / 2, p.sy - size * 0.75, bw, 4);
      ctx.fillStyle = PALETTE.accent;
      ctx.fillRect(p.sx - bw / 2, p.sy - size * 0.75, bw * (e.hp / e.maxHp), 4);
      if (e.slowT > 0) {
        ctx.strokeStyle = "#5a9ad0";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, size * 0.62, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // shots as small ink dots
    for (const sh of s.shots) {
      const z = sh.z + (sh.tz - sh.z) * Math.min(1, sh.t);
      const p = this.project(g, sh.x, z);
      ctx.fillStyle = sh.tower === 2 ? "#5a9ad0" : PALETTE.accent;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // HUD
    inkText(ctx, `💰 ${Math.floor(s.gold)}`, w * 0.2, h * 0.045, sv * 0.036, PALETTE.ink, "900");
    inkText(
      ctx,
      s.betweenWaves ? `wave ${s.wave + 1} in ${Math.ceil(s.waveT)}s` : `wave ${s.wave} · ${s.enemies.length} foes`,
      w * 0.5,
      h * 0.045,
      sv * 0.03,
      PALETTE.ink,
    );
    inkText(ctx, `🧠 ${s.lives}`, w * 0.8, h * 0.045, sv * 0.036, PALETTE.accent, "900");

    // tower picker
    const btnW = w * 0.26;
    const barY = h * 0.985;
    for (let i = 0; i < 3; i++) {
      const bx = w * 0.5 + (i - 1) * (btnW + 10);
      const selected = s.selectedTowerKind === i;
      const affordable = s.gold >= TOWER_COST[i];
      inkRect(
        ctx,
        bx - btnW / 2,
        barY - h * 0.075,
        btnW,
        h * 0.06,
        selected ? PALETTE.tint2 : PALETTE.white,
        selected ? PALETTE.accent : PALETTE.ink,
        selected ? 3 : 2,
      );
      ctx.font = `${Math.round(sv * 0.03)}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = affordable ? PALETTE.ink : PALETTE.gray;
      ctx.fillText(TOWER_GLYPH[i], bx - btnW * 0.22, barY - h * 0.045);
      inkText(ctx, `${TOWER_COST[i]}`, bx + btnW * 0.16, barY - h * 0.045, sv * 0.026, affordable ? PALETTE.ink : PALETTE.gray);
    }

    if (s.over) {
      ctx.fillStyle = hexWithAlpha(PALETTE.paper, Math.min(0.85, this.overT / 400));
      ctx.fillRect(0, 0, w, h);
      if (this.overT > 400) {
        speechBubble(ctx, `The gate falls — wave ${s.wave}`, w / 2, h * 0.44, sv * 0.05);
        inkText(ctx, `score ${s.score}  best ${this.best}`, w / 2, h * 0.52, sv * 0.035, PALETTE.gray);
        inkText(ctx, "tap to return", w / 2, h * 0.6, sv * 0.032, PALETTE.gray);
        if (this.overT > 800 && g.input.consumeEvents().length > 0) g.exit();
      }
    }
  }

  teardown(): void {}
}
