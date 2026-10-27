import { PALETTE } from "./style";

const KEY = "furevrnac:theme";
export type ThemeMode = "auto" | "light" | "dark";

let mode: ThemeMode = "auto";
let mq: MediaQueryList | null = null;

export function isDark(): boolean {
  if (mode === "auto") return mq?.matches ?? false;
  return mode === "dark";
}

export function currentMode(): ThemeMode {
  return mode;
}

function readPref(): ThemeMode {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === "light" || raw === "dark" || raw === "auto") return raw;
  } catch {
    /* storage unavailable */
  }
  return "auto";
}

export function applyTheme(): void {
  const dark = isDark();
  if (dark) {
    Object.assign(PALETTE, {
      paper: "#191714",
      ink: "#ece5d8",
      accent: "#e05540",
      gray: "#7d766a",
      white: "#23211d",
      tint1: "#2b2823",
      tint2: "#4a4438",
      tint3: "#6b5a3c",
      wood: "#3a3227",
    });
  } else {
    Object.assign(PALETTE, {
      paper: "#f6f1e7",
      ink: "#1c1b1a",
      accent: "#d43d2a",
      gray: "#b8b2a8",
      white: "#fffdf8",
      tint1: "#e8e0d0",
      tint2: "#eed9c4",
      tint3: "#e8b98a",
      wood: "#e8dcbf",
    });
  }
  document.body.style.background = PALETTE.paper;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", PALETTE.paper);
}

export function initTheme(): void {
  mode = readPref();
  try {
    mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", () => {
      if (mode === "auto") applyTheme();
    });
  } catch {
    mq = null;
  }
  applyTheme();
}

export function cycleTheme(): void {
  mode = isDark() ? "light" : "dark";
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* storage unavailable */
  }
  applyTheme();
}
