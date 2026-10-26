import { TouchInput } from "./engine/input";
import { createSave } from "./engine/save";
import { PALETTE } from "./engine/style";
import { GAMES } from "./games";
import type { Game, GameContext } from "./games/types";
import { HomeScreen } from "./ui/home";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const input = new TouchInput(canvas);
const save = createSafeStorage();
const home = new HomeScreen();
home.setGames(GAMES);

let w = 0;
let h = 0;
let current: Game | null = null;
let last = 0;

function createSafeStorage() {
  try {
    return createSave(window.localStorage);
  } catch {
    return createSave(memoryStorage());
  }
}

function memoryStorage(): Storage {
  const mem = new Map<string, string>();
  return {
    get length() {
      return mem.size;
    },
    clear: () => mem.clear(),
    getItem: (k) => mem.get(k) ?? null,
    key: (i) => [...mem.keys()][i] ?? null,
    removeItem: (k) => void mem.delete(k),
    setItem: (k, v) => void mem.set(k, String(v)),
  } as Storage;
}

function resize(): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.parentElement!.getBoundingClientRect();
  w = rect.width;
  h = rect.height;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  home.layout(w, h, GAMES);
}

function gameContext(): GameContext {
  return {
    ctx,
    input,
    save,
    w,
    h,
    exit: () => {
      current?.teardown();
      current = null;
      home.layout(w, h, GAMES);
    },
  };
}

function frame(t: number): void {
  const dt = Math.min(t - last, 100);
  last = t;
  ctx.fillStyle = PALETTE.paper;
  ctx.fillRect(0, 0, w, h);

  if (current) {
    const g = gameContext();
    current.update(dt, g);
    if (current) current.render(g);
  } else {
    home.update(dt, {
      w,
      h,
      input,
      games: GAMES,
      onOpen: (game) => {
        current = game;
        game.init(gameContext());
      },
    });
    home.render(ctx, w, h);
  }
requestAnimationFrame(frame);
}

function start(): void {
  last = performance.now();
  requestAnimationFrame(frame);
}

window.addEventListener("resize", resize);
window.addEventListener("orientationchange", () => setTimeout(resize, 150));
resize();
start();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      /* offline mode unavailable — app still works */
    });
  });
}
