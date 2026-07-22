# HEXTOPIA — banger vibecoding catan

A complete, playable, visually excessive 3D hex strategy game inspired by Catan.
One repository, zero configuration, deploys straight to Vercel.

Settle. Pave. Ascend. Argue with a turtle named Dave about wheat prices.

## Run it

```bash
npm install
npm run dev        # local dev server
npm run build      # production build (dist/)
npm run simulate   # headless AI-vs-AI full-game verification
```

**Deploy to Vercel:** import the repo. That's it — Vercel auto-detects Vite. No server, no database, no env vars, no API keys.

## How to play

Reach the victory-point target (default 10) before your rivals.

| Thing | Cost | Worth |
|---|---|---|
| 🛤 Road | 1🪵 1🧱 | connects your empire; longest chain of 5+ = **+2 VP** |
| 🏠 Settlement | 1🪵 1🧱 1🌾 1🐑 | **1 VP**, produces 1 card per adjacent tile hit |
| 🏙 City | 2🌾 3🪨 | **2 VP**, produces 2 (upgrade a settlement) |
| 🌆 MEGA CITY | 3🪨 2🌾 2🐑 | **3 VP**, produces 3 — needs a city **and 6 roads**, one per player, grants you a civilization title |

### A turn

1. **ROLL THE ECONOMY** — every tile with that number pays everyone adjacent.
2. Rolling a **7** wakes the robber: place it on a tile to block it and steal a card from a neighbor.
3. Build, upgrade, trade (bank at 4:1, rivals at whatever they'll tolerate).
4. **END MY GLORIOUS TURN.**

Settlements must be 2 corners apart from any other settlement, and (after setup) connected to your roads.

### Controls

- **Desktop:** drag to orbit, wheel to zoom, right-drag to pan, hover previews, `Esc` cancels placement, `Space`/`Enter` rolls or ends turn.
- **Mobile:** one-finger orbit, pinch zoom, tap glowing spots to build. Big touch targets throughout.

Valid placements always glow. Gold rings mean statistically juicy corners.

### The rest

- **4 NPC personalities per match** drawn from a pool of 6 unstable characters — they build, trade, block, harass you with offers, and remember your insults out loud.
- **World events** (optional): booms, storms, trade festivals, suspiciously productive sheep.
- **Chaos modifiers** (optional): Turbo Economy, Friendly Robber, Maximum Sheep, NPC Drama.
- **Seeds:** every world shows its seed; reuse it to replay the same map.
- **Auto-save:** the match saves itself after meaningful actions; refresh and continue from the title screen.
- **Audio:** fully procedural Web Audio (no assets). Independent sliders for music / effects / NPC voices. Game works fine muted.

## Architecture

```
src/
  game/     rules, board generation, state machine (zustand), NPC AI — pure TS, no rendering
  scene/    react-three-fiber 3D: tiles, pieces, highlights, dice ritual, ambient life
  ui/       DOM HUD: screens, hand, trade modal, toasts, victory
  audio/    procedural Web Audio engine
scripts/
  simulate.ts   headless full-game verification across configs
```

Game logic is deterministic and headless-testable; the 3D layer only presents it. Dice results are decided before the dice animation plays — physics presents the result, never determines it.

Everything is generated at runtime: geometry, textures (canvas), names, audio. No external assets, no remote fonts, no CDN calls.
