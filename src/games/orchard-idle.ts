import type { Game, GameContext } from "./types";
import {
  PALETTE,
  inkRect,
  inkText,
  speechBubble,
} from "../engine/style";
import { sfx } from "../engine/sfx";
import {
  FERT_COST,
  GROWTH_ICONS,
  TAPPER_COST,
  TREE_COST,
  buyFertilizer,
  buyTapper,
  buyTree,
  catchUp,
  initState,
  production,
  tap,
  type OrchardState,
} from "./orchard-idle-sim";

const KEY = "orchard:state";

export class OrchardIdleGame implements Game {
  readonly id = "orchard";
  readonly name = "Ink Orchard Idle";
  readonly blurb = "A quiet grove that grows while you're away.";
  readonly accent = "#3f7a3a";

  private state: OrchardState = initState(0);
  private welcomeT = 0;
  private awayGain = 0;
  private popups: { x: number; y: number; t: number; text: string }[] = [];
  private treeShake = 0;

  init(g: GameContext): void {
    // load persisted state or start fresh, then catch up offline time
    const saved = g.save.get<OrchardState | null>(KEY, null);
    if (saved) Object.assign((this.state = initState(0)), saved);
    else this.state = initState(0);
    this.awayGain = catchUp(this.state, Date.now());
    this.welcomeT = this.awayGain > 1 ? 2600 : 0;
    this.popups = [];
    this.treeShake = 0;
  }

  update(dt: number, g: GameContext): void {
    const s = this.state;
    const gain = catchUp(s, Date.now());
    void gain;
    if (this.welcomeT > 0) this.welcomeT -= dt;
    if (this.treeShake > 0) this.treeShake -= dt;

    for (const e of g.input.consumeEvents()) {
      if (e.type !== "tap" && e.type !== "longpress") continue;
      const sv = Math.min(g.w, g.h);

      // shop buttons
      const buys: [string, () => boolean, () => number][] = [
        ["🌳", () => buyTree(s), () => TREE_COST(s.trees)],
        ["💧", () => buyTapper(s), () => TAPPER_COST(s.tappers)],
        ["✨", () => buyFertilizer(s), () => FERT_COST(s.fertilizers)],
      ];
      let hitShop = false;
      buys.forEach(([glyph, buy, cost], i) => {
        const bw = g.w * 0.8;
        const bh = sv * 0.09;
        const y = g.h * 0.58 + i * (bh + bh * 0.35);
        if (
          e.x > g.w / 2 - bw / 2 &&
          e.x < g.w / 2 + bw / 2 &&
          e.y > y &&
          e.y < y + bh
        ) {
          if (buy()) {
            sfx.eat();
            this.popups.push({
              x: g.w / 2,
              y: y - 10,
              t: 700,
              text: "+1",
            });
          } else sfx.bounce();
          hitShop = true;
        }
        void glyph;
        void cost;
      });
      if (hitShop) continue;

      // tap the tree
      const tx = g.w / 2;
      const ty = g.h * 0.3;
      if (Math.hypot(e.x - tx, e.y - ty) < sv * 0.22) {
        const burst = tap(s);
        this.treeShake = 200;
        sfx.tap();
        if (navigator.vibrate) navigator.vibrate(8);
        this.popups.push({
          x: e.x,
          y: e.y,
          t: 800,
          text: `+${Math.floor(burst)}`,
        });
      }
    }

    for (const p of this.popups) p.t -= dt;
    this.popups = this.popups.filter((p) => p.t > 0);

    // persist every few seconds (cheap: every update throttled)
    this.saveT -= dt;
    if (this.saveT <= 0) {
      this.saveT = 2000;
      g.save.set(KEY, this.state);
    }
  }

  private saveT = 2000;

  render(g: GameContext): void {
    const { ctx, w, h } = g;
    const s = this.state;
    const sv = Math.min(w, h);

    ctx.fillStyle = PALETTE.paper;
    ctx.fillRect(0, 0, w, h);

    const stage = Math.min(4, Math.floor(s.trees / 8));
    void stage;
    const icon = GROWTH_ICONS[Math.min(4, Math.floor(s.trees / 8))];
    const iconSize = sv * 0.3;
    const shake = this.treeShake > 0 ? Math.sin(this.treeShake * 0.06) * 4 : 0;
    ctx.font = `${Math.round(iconSize)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(icon, w / 2 + shake, h * 0.3);

    // ink counter
    inkText(ctx, `🖋️ ${Math.floor(s.ink)}`, w / 2, h * 0.08, sv * 0.06, PALETTE.ink, "900");
    inkText(
      ctx,
      `+${production(s).toFixed(1)}/s · ${s.trees} trees`,
      w / 2,
      h * 0.125,
      sv * 0.026,
      PALETTE.gray,
    );

    // shop
    const items: [string, string, () => number, boolean][] = [
      ["🌳", "plant a tree", () => TREE_COST(s.trees), s.ink >= TREE_COST(s.trees)],
      ["💧", "ink dripper (4/s)", () => TAPPER_COST(s.tappers), s.ink >= TAPPER_COST(s.tappers)],
      ["✨", "fertilizer (+50%)", () => FERT_COST(s.fertilizers), s.ink >= FERT_COST(s.fertilizers)],
    ];
    const bw = w * 0.8;
    const bh = sv * 0.09;
    items.forEach(([glyph, label, cost, ok], i) => {
      const y = h * 0.58 + i * (bh + bh * 0.35);
      inkRect(
        ctx,
        w / 2 - bw / 2,
        y,
        bw,
        bh,
        ok ? PALETTE.white : PALETTE.paper,
        ok ? PALETTE.ink : PALETTE.gray,
        2.5,
      );
      ctx.font = `${Math.round(bh * 0.6)}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = ok ? PALETTE.ink : PALETTE.gray;
      ctx.fillText(glyph, w / 2 - bw / 2 + bh * 0.3, y + bh / 2);
      inkText(ctx, label, w / 2 - bw * 0.22, y + bh / 2, sv * 0.026, ok ? PALETTE.ink : PALETTE.gray, "700", "left");
      inkText(ctx, `${Math.floor(cost())}`, w / 2 + bw * 0.38, y + bh / 2, sv * 0.03, ok ? PALETTE.accent : PALETTE.gray, "900");
    });

    for (const p of this.popups) {
      ctx.globalAlpha = Math.min(1, p.t / 300);
      inkText(ctx, p.text, p.x, p.y - (800 - p.t) * 0.04, sv * 0.03, PALETTE.accent, "900");
      ctx.globalAlpha = 1;
    }

    if (this.welcomeT > 0 && this.awayGain > 1) {
      speechBubble(
        ctx,
        `While you were away: +${Math.floor(this.awayGain)} ink`,
        w / 2,
        h * 0.42,
        sv * 0.036,
      );
    }
    inkText(ctx, "tap the tree!", w / 2, h * 0.45, sv * 0.024, PALETTE.gray);
  }

  teardown(): void {}
}
