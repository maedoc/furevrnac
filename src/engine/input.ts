export type InputEvent =
  | { type: "tap"; x: number; y: number }
  | { type: "swipe"; dir: "up" | "down" | "left" | "right" }
  | { type: "drag"; dx: number; dy: number; x: number; y: number };

export interface Input {
  consumeEvents(): InputEvent[];
  isPointerDown(): boolean;
  pointerPos(): { x: number; y: number };
}

export class TouchInput implements Input {
  private events: InputEvent[] = [];
  private down = false;
  private startX = 0;
  private startY = 0;
  private lastX = 0;
  private lastY = 0;
  private startT = 0;
  private moved = false;

  constructor(private canvas: HTMLCanvasElement) {
    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", (e) => this.onDown(e));
    canvas.addEventListener("pointermove", (e) => this.onMove(e));
    canvas.addEventListener("pointerup", (e) => this.onUp(e));
    canvas.addEventListener("pointercancel", () => this.reset());
  }

  private local(e: PointerEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private onDown(e: PointerEvent): void {
    const p = this.local(e);
    this.down = true;
    this.moved = false;
    this.startX = this.lastX = p.x;
    this.startY = this.lastY = p.y;
    this.startT = performance.now();
  }

  private onMove(e: PointerEvent): void {
    if (!this.down) return;
    const p = this.local(e);
    const dx = p.x - this.lastX;
    const dy = p.y - this.lastY;
    if (Math.abs(dx) + Math.abs(dy) > 2) this.moved = true;
    this.events.push({ type: "drag", dx, dy, x: p.x, y: p.y });
    this.lastX = p.x;
    this.lastY = p.y;
  }

  private onUp(e: PointerEvent): void {
    if (!this.down) return;
    const p = this.local(e);
    const dx = p.x - this.startX;
    const dy = p.y - this.startY;
    const dist = Math.hypot(dx, dy);
    const dt = performance.now() - this.startT;
    if (dist > 30) {
      const dir =
        Math.abs(dx) > Math.abs(dy)
          ? dx > 0
            ? "right"
            : "left"
          : dy > 0
            ? "down"
            : "up";
      this.events.push({ type: "swipe", dir });
    } else if (dt < 600 && !this.moved) {
      this.events.push({ type: "tap", x: p.x, y: p.y });
    }
    this.reset();
  }

  private reset(): void {
    this.down = false;
    this.moved = false;
  }

  consumeEvents(): InputEvent[] {
    const ev = this.events;
    this.events = [];
    return ev;
  }

  isPointerDown(): boolean {
    return this.down;
  }

  pointerPos(): { x: number; y: number } {
    return { x: this.lastX, y: this.lastY };
  }
}
