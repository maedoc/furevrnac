# Furevrnac

**The forever almanac — download once, play forever.**

A free, offline-first collection of classic games rendered in a sumi-e manga
ink style, built touch-first. Chiptune blips included — no assets, all
synthesized. No ads, no monetization, no social, no
telemetry. Serve it from GitHub Pages or package it as an iOS/Android app —
after the first load it never needs the network again.

*Furevrnac* = **furever** (forever + 触れる *fureru*, "to touch") +
**(alma)nac** — a tome of games and, someday, useful things.

## Games (Chapter 1 — the classics)

| Game | Controls |
|---|---|
| Ink Snake | Swipe to steer |
| Sumi 2048 | Swipe to merge |
| Ink Breaker | Drag paddle, tap to launch |
| Tetromino Fall | Swipe left/right to move, down to soft drop, up to rotate, tap to hard drop |
| Ink Pong | Drag to rally against the brush AI, first to 5 |
| Mine Panels | Tap to open, hold to flag |
| Ink Chess | Two players, one board — tap a piece, tap a target |
| Ink Checkers | Two players, forced captures, multi-jumps, kings |
| Ink Go | Two players, 9/13/19 board, captures, ko, area scoring |
| Ink Blade | Bullet-time platformer — hold left to slow time, tap right to jump/dash |
| Ink Orchard | Drop and merge fruit — myrtille, cherry, kiwi … watermelon |
| Ink Wings | Flappy-style — tap to flap through brush strokes |
| Whack-a-Brush | 30s of popping ink imps — whack them fast |

## Play

- **Web (GitHub Pages):** <https://maedoc.github.io/furevrnac/>
- **Offline:** add to home screen / install as PWA — the service worker
  caches everything after the first visit.
- **Packaged app (later):** Capacitor wraps the same build for iOS and
  Android; artifacts will be attached to GitHub Releases on version tags.

## Development

```bash
npm install
npm run dev     # local dev server
npm test        # game-logic unit tests
npm run build   # typecheck + production build to dist/
```

## Principles

1. Free forever. Donations welcome, never required.
2. No ads, no tracking, no accounts, no network calls after first load.
3. Touch first, keyboard second, everything works offline.
4. One ink-brush visual language across every chapter.

## License

MIT — see [LICENSE](LICENSE).
