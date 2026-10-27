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
  PATH,
  TOWER_COST,
  TOWER_RANGE,
  canPlace,
  initState,
  pathPos,
  placeTower,
  step,
  type SimState,
} from "./tower-sim";

const TOWER_GLYPH = ["🏹", "💣", "❄️"];
const ENEMY_GLYPH = ["👹", "👹"];

export class TowerGame implements Game {
  readonly id = "tower";
  readonly name = "Ink Bastion";
  readonly blurb = "Place towers, defend the scroll road.";
  readonly accent = "#d43d2a";

  private sim: SimState = initState();
  private best = 0;
  private overT = 0;
  private dragGhost: { x: number; y: number } | null = null;

  init(g: GameContext): void {
    this.sim = initState();
    this.best = g.save.get("tower:best", 0);
    this.overT = 0;
    this.dragGhost = null;
  }

  private geo(g: GameContext): { scale: number; ox: number; oy: number } {
    const scale = Math.min(g.w / 11, (g.h * 0.78) / 8);
    return {
      scale,
      ox: (g.w - 10 * scale) / 2,
      oy: g.h * 0.16,
    };
  }

  update(dt: number, g: GameContext): void {
    const s = this.sim;
    const wasOver = s.over;
    const { scale, ox, oy } = this.geo(g);

    const events = g.input.consumeEvents();
    for (const e of events) {
      if (s.over) continue;
      if (e.type === "tap" || e.type === "longpress") {
        // tower-kind picker buttons at bottom; otherwise try place
        const sv = Math.min(g.w, g.h);
        const barY = g.h * 0.97;
        const btnW = g.w * 0.28;
        let pickedKind = false;
        TOWER_GLYPH.forEach((_gl, i) => {
          const bx = g.w * 0.5 + (i - 1) * (btnW + 12);
          if (
            e.x > bx - btnW / 2 &&
            e.x < bx + btnW / 2 &&
            e.y > barY - sv * 0.045
          ) {
            s.selectedTowerKind = i as 0 | 1 | 2;
            pickedKind = true;
            sfx.tap();
          }
        });
        if (pickedKind) continue;
        // grid placement
        const gx = Math.round((e.x - ox) / scale - 0.5) + 0.5;
        const gy = Math.round((e.y - oy) / scale - 0.5) + 0.5;
        if (placeTower(s, gx, gy)) {
          sfx.brick();
          if (navigator.vibrate) navigator.vibrate(12);
        } else {
          sfx.bounce();
        }
      } else if (e.type === "drag") {
        const gx = Math.round((e.x - ox) / scale - 0.5) + 0.5;
        const gy = Math.round((e.y - oy) / scale - 0.5) + 0.5;
        this.dragGhost = { x: gx, y: gy };
      }
    }
    if (!g.input.isPointerDown()) this.dragGhost = null;

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
    const { scale, ox, oy } = this.geo(g);
    const sx = (x: number): number => ox + x * scale;
    const sy = (y: number): number => oy + y * scale;

    ctx.fillStyle = PALETTE.paper;
    ctx.fillRect(0, 0, w, h);

    // field border
    inkRect(ctx, sx(0) - scale * 0.2, sy(0) - scale * 0.2, 10 * scale + scale * 0.4, 7 * scale + scale * 0.4, PALETTE.paper, PALETTE.ink, 3);

    // path (thick ink dashes)
    ctx.strokeStyle = PALETTE.tint1;
    ctx.lineWidth = scale * 0.7;
    ctx.lineCap = "round";
    ctx.beginPath();
    PATH.forEach(([x, y], i) => {
      if (i === 0) ctx.moveTo(sx(x + 0.5), sy(y + 0.5));
      else ctx.lineTo(sx(x + 0.5), sy(y + 0.5));
    });
    ctx.stroke();
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    PATH.forEach(([x, y], i) => {
      if (i === 0) ctx.moveTo(sx(x + 0.5), sy(y + 0.5));
      else ctx.lineTo(sx(x + 0.5), sy(y + 0.5));
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // tower ranges (subtle)
    for (const tw of s.towers) {
      ctx.strokeStyle = hexWithAlpha(PALETTE.ink, 0.12);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(sx(tw.x + 0.5), sy(tw.y + 0.5), TOWER_RANGE[tw.kind] * scale, 0, Math.PI * 2);
      ctx.stroke();
    }

    // ghost placement
    if (this.dragGhost && canPlace(s, this.dragGhost.x, this.dragGhost.y) && s.gold >= TOWER_COST[s.selectedTowerKind]) {
      const p = this.dragGhost;
      ctx.globalAlpha = 0.5;
      ctx.font = `${Math.round(scale)}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(TOWER_GLYPH[s.selectedTowerKind], sx(p.x + 0.5), sy(p.y + 0.5));
      ctx.globalAlpha = 1;
    }

    // towers
    ctx.font = `${Math.round(scale * 1.1)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const tw of s.towers) {
      ctx.fillText(TOWER_GLYPH[tw.kind], sx(tw.x + 0.5), sy(tw.y + 0.5));
    }

    // enemies + hp bars
    for (const e of s.enemies) {
      const p = pathPos(e);
      ctx.font = `${Math.round(scale * 1.0)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      ctx.fillText(ENEMY_GLYPH[e.kind], sx(p.x + 0.5), sy(p.y + 0.5));
      const bw = scale * 0.8;
      ctx.fillStyle = hexWithAlpha(PALETTE.paper, 0.8);
      ctx.fillRect(sx(p.x + 0.5) - bw / 2, sy(p.y + 0.5) - scale * 0.75, bw, 4);
      ctx.fillStyle = PALETTE.accent;
      ctx.fillRect(
        sx(p.x + 0.5) - bw / 2,
        sy(p.y + 0.5) - scale * 0.75,
        (bw * e.hp) / e.maxHp,
        4,
      );
    }

    // shots
    for (const sh of s.shots) {
      const x = sh.x + (sh.tx - sh.x) * sh.t;
      const y = sh.y + (sh.ty - sh.y) * sh.t;
      ctx.fillStyle = sh.tower === 2 ? "#5a9ad0" : PALETTE.accent;
      ctx.beginPath();
      ctx.arc(sx(x + 0.5), sy(y + 0.5), scale * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }

    // HUD
    inkText(ctx, `💰 ${Math.floor(s.gold)}`, w * 0.2, h * 0.05, sv * 0.038, PALETTE.ink, "900");
    inkText(
      ctx,
      s.betweenWaves ? `wave ${s.wave + 1} in ${Math.ceil(s.waveT)}s` : `wave ${s.wave}`,
      w * 0.5,
      h * 0.05,
      sv * 0.032,
      PALETTE.ink,
    );
    inkText(ctx, `🧠 ${s.lives}`, w * 0.8, h * 0.05, sv * 0.038, PALETTE.accent, "900");

    // tower picker bar
    const barY = h * 0.97;
    const btnW = w * 0.28;
    TOWER_GLYPH.forEach((_gl, i) => {
      const bx = w * 0.5 + (i - 1) * (btnW + 12);
      const selected = s.selectedTowerKind === i;
      const affordable = s.gold >= TOWER_COST[i];
      inkRect(
        ctx,
        bx - btnW / 2,
        barY - sv * 0.045,
        btnW,
        sv * 0.062,
        selected ? PALETTE.tint2 : PALETTE.white,
        selected ? PALETTE.accent : PALETTE.ink,
        selected ? 3 : 2,
      );
      ctx.font = `${Math.round(sv * 0.032)}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = affordable ? PALETTE.ink : PALETTE.gray;
      ctx.fillText(TOWER_GLYPH[i], bx - btnW * 0.2, barY - sv * 0.014);
      inkText(ctx, `${TOWER_COST[i]}`, bx + btnW * 0.18, barY - sv * 0.014, sv * 0.026, affordable ? PALETTE.ink : PALETTE.gray);
    });

    if (s.over) {
      ctx.fillStyle = hexWithAlpha(PALETTE.paper, Math.min(0.85, this.overT / 400));
      ctx.fillRect(0, 0, w, h);
      if (this.overT > 400) {
        speechBubble(ctx, `The bastion falls — wave ${s.wave}`, w / 2, h * 0.44, sv * 0.05);
        inkText(ctx, `score ${s.score}  best ${this.best}`, w / 2, h * 0.52, sv * 0.035, PALETTE.gray);
        inkText(ctx, "tap to return", w / 2, h * 0.6, sv * 0.032, PALETTE.gray);
        if (this.overT > 800 && g.input.consumeEvents().length > 0) g.exit();
      }
    }
  }

  teardown(): void {
    this.dragGhost = null;
  }
}
