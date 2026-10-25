export const PALETTE = {
  paper: "#f6f1e7",
  ink: "#1c1b1a",
  accent: "#d43d2a",
  gray: "#b8b2a8",
  white: "#fffdf8",
} as const;

export const FONT_STACK = `"Zen Maru Gothic", "Hiragino Sans", "Segoe UI", system-ui, sans-serif`;

export function setFont(
  ctx: CanvasRenderingContext2D,
  size: number,
  weight = "700",
): void {
  ctx.font = `${weight} ${size}px ${FONT_STACK}`;
}

export function inkRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string = PALETTE.paper,
  stroke: string = PALETTE.ink,
  lw = 3,
): void {
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();
}

export function inkText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string = PALETTE.ink,
  weight = "700",
  align: CanvasTextAlign = "center",
): void {
  setFont(ctx, size, weight);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}

export function speechBubble(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
): void {
  setFont(ctx, size);
  const w = ctx.measureText(text).width + size * 0.9;
  const h = size * 1.7;
  ctx.fillStyle = PALETTE.white;
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - size * 0.4, y + h / 2 - 2);
  ctx.lineTo(x - size * 0.7, y + h / 2 + size * 0.4);
  ctx.lineTo(x - size * 0.1, y + h / 2 - 2);
  ctx.fillStyle = PALETTE.white;
  ctx.fill();
  ctx.strokeStyle = PALETTE.ink;
  ctx.beginPath();
  ctx.moveTo(x - size * 0.4, y + h / 2);
  ctx.lineTo(x - size * 0.7, y + h / 2 + size * 0.4);
  ctx.lineTo(x - size * 0.1, y + h / 2);
  ctx.stroke();
  inkText(ctx, text, x, y, size);
}

let halftone: CanvasPattern | null = null;

export function halftonePattern(ctx: CanvasRenderingContext2D): CanvasPattern {
  if (halftone) return halftone;
  const c = document.createElement("canvas");
  c.width = 8;
  c.height = 8;
  const hctx = c.getContext("2d")!;
  hctx.fillStyle = PALETTE.gray;
  hctx.beginPath();
  hctx.arc(4, 4, 1.4, 0, Math.PI * 2);
  hctx.fill();
  halftone = ctx.createPattern(c, "repeat")!;
  return halftone;
}

export function speedLines(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  inner: number,
  outer: number,
  alpha = 0.5,
  count = 28,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 2;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.sin(i * 7.3) * 0.05;
    const len = outer * (0.6 + ((i * 37) % 41) / 100);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
    ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.restore();
}

export function inkSplash(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  alpha = 0.8,
): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = PALETTE.ink;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + r;
    const d = r * (1.1 + (i % 3) * 0.35);
    ctx.beginPath();
    ctx.ellipse(
      x + Math.cos(a) * d,
      y + Math.sin(a) * d,
      r * 0.32,
      r * 0.18,
      a,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(x, y, r * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
