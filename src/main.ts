import { TouchInput } from "./engine/input";
import { createSave } from "./engine/save";
import { PALETTE } from "./engine/style";
import { initTheme } from "./engine/theme";
import { GAMES } from "./games";
import type { Game, GameContext } from "./games/types";
import { HomeScreen } from "./ui/home";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const input = new TouchInput(canvas);
const save = createSafeStorage();
const home = new HomeScreen();
initTheme();

function recentGames(): typeof GAMES {
  let times: Record<string, number> = {};
  try {
    times = save.get("lastPlayed", {} as Record<string, number>);
  } catch {
    times = {};
  }
  const order = (g: (typeof GAMES)[number]): number => times[g.id] ?? 0;
  return [...GAMES].sort((a, b) => order(b) - order(a));
}
let orderedGames = recentGames();
home.setGames(orderedGames);

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
  home.layout(w, h, orderedGames);
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
      orderedGames = recentGames();
      home.setGames(orderedGames);
      home.layout(w, h, orderedGames);
    },
  };
}

function frame(t: number): void {
  const dt = Math.min(t - last, 100);
  last = t;
  fitIfNeeded();
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
      games: orderedGames,
      onOpen: (game) => {
        const times = save.get("lastPlayed", {} as Record<string, number>);
        times[game.id] = Date.now();
        save.set("lastPlayed", times);
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

function fitIfNeeded(): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = Math.round(w * dpr);
  const ch = Math.round(h * dpr);
  if (cw !== canvas.width || ch !== canvas.height) resize();
}
window.addEventListener("resize", resize);
window.addEventListener("orientationchange", () => setTimeout(resize, 150));
// iOS: the visual viewport resizes after toolbars/URL bar settle
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", resize);
}
// belt and suspenders: re-fit on any first drift (warm-cache paints
// often measure before Safari settles the viewport)
document.addEventListener("visibilitychange", resize);
window.addEventListener("pageshow", resize);
resize();
setInterval(fitIfNeeded, 500);
start();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      // Recovery: if a previous service worker is stuck serving a page
      // whose bundles were purged, unregister everything and reload once.
      const reg = await navigator.serviceWorker.getRegistration();
      const key = "furevrnac:sw-ok";
      if (reg) {
        const res = await fetch("sw.js", { cache: "no-store" });
        if (!res.ok && !sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, "1");
          await reg.unregister();
          location.reload();
          return;
        }
        sessionStorage.removeItem(key);
      }
      await navigator.serviceWorker.register("sw.js");
    } catch {
      /* offline mode unavailable — app still works */
    }
  });
}
