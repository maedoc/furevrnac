export type InputEvent =
  | { type: "tap"; x: number; y: number }
  | { type: "longpress"; x: number; y: number }
  | { type: "swipe"; dir: "up" | "down" | "left" | "right" }
  | { type: "drag"; dx: number; dy: number; x: number; y: number };

export interface Input {
  consumeEvents(): InputEvent[];
  isPointerDown(): boolean;
  pointerPos(): { x: number; y: number };
  activePointers(): { x: number; y: number; id: number }[];
}

const LONGPRESS_MS = 420;
const MOVE_TOLERANCE = 12;

export class TouchInput implements Input {
  private events: InputEvent[] = [];
  private down = false;
  private pointers = new Map<number, { x: number; y: number }>();
  private startX = 0;
  private startY = 0;
  private lastX = 0;
  private lastY = 0;
  private startT = 0;
  private moved = false;
  private holdTimer = 0;

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
    this.pointers.set(e.pointerId, p);
    this.moved = false;
    this.startX = this.lastX = p.x;
    this.startY = this.lastY = p.y;
    this.startT = performance.now();
    this.holdTimer = window.setTimeout(() => {
      if (
        this.down &&
        !this.moved &&
        Math.hypot(this.lastX - this.startX, this.lastY - this.startY) <
          MOVE_TOLERANCE
      ) {
        this.events.push({ type: "longpress", x: this.lastX, y: this.lastY });
        this.moved = true;
      }
    }, LONGPRESS_MS);
  }

  private onMove(e: PointerEvent): void {
    if (!this.down) return;
    const p = this.local(e);
    this.pointers.set(e.pointerId, p);
    const dx = p.x - this.lastX;
    const dy = p.y - this.lastY;
    if (
      !this.moved &&
      Math.hypot(p.x - this.startX, p.y - this.startY) > MOVE_TOLERANCE
    ) {
      this.moved = true;
      window.clearTimeout(this.holdTimer);
    }
    if (this.moved) this.events.push({ type: "drag", dx, dy, x: p.x, y: p.y });
    this.lastX = p.x;
    this.lastY = p.y;
  }

  private onUp(e: PointerEvent): void {
    this.pointers.delete(e.pointerId);
    if (!this.down) return;
    window.clearTimeout(this.holdTimer);
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
    this.pointers.clear();
    window.clearTimeout(this.holdTimer);
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

  activePointers(): { x: number; y: number; id: number }[] {
    return [...this.pointers.entries()].map(([id, p]) => ({
      x: p.x,
      y: p.y,
      id,
    }));
  }
}
