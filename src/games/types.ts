import type { Input } from "../engine/input";
import type { Save } from "../engine/save";

export interface GameContext {
  ctx: CanvasRenderingContext2D;
  input: Input;
  save: Save;
  w: number;
  h: number;
  exit: () => void;
}

export interface Game {
  readonly id: string;
  readonly name: string;
  readonly blurb: string;
  readonly accent: string;
  init(g: GameContext): void;
  update(dt: number, g: GameContext): void;
  render(g: GameContext): void;
  teardown(): void;
}
