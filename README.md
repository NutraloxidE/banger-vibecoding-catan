# HEXFALL — Banger Vibecoding Catan

A chaotic, over-produced **3D hex strategy game** inspired by Catan. Roll the
economy, build a terrible road, ascend a settlement into a glowing **Mega City**,
and blame the sheep. Runs entirely in the browser — no backend, no accounts, no
API keys — and deploys to Vercel with zero configuration.

![hexfall](https://img.shields.io/badge/stack-React%20·%20Three.js%20·%20TypeScript-ffcf4d)

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

Production build & local preview:

```bash
npm run build      # type-checks, then builds to dist/
npm run preview
```

## Deploy to Vercel

This is a standard Vite SPA. Import the repository in Vercel and deploy — the
**Vite** framework preset is auto-detected:

- Build command: `npm run build`
- Output directory: `dist`

No environment variables, secrets, or custom configuration are required.

## How to play

1. **Title → Setup.** Choose map size, number of opponents, victory-point
   target, a seed, and any chaos modifiers. A live board preview updates as you
   tweak settings.
2. **Initial placement.** Each player places two settlements and two roads
   (snake order). Tap the glowing rings and edges.
3. **Take turns.** Roll the dice to produce resources, then build roads,
   settlements, and cities, trade, and end your turn.
4. **Grow your civilization.** Upgrade a settlement to a City, then — with a
   large enough road network — to a **Mega City** worth 4 points.
5. **Win.** First to the victory-point target triggers the victory catastrophe
   and a full match report.

Full mechanics are in **[docs/RULES.md](docs/RULES.md)**.

### Controls

| Action | Desktop | Mobile |
| --- | --- | --- |
| Orbit camera | Left-drag | One-finger drag |
| Zoom | Scroll wheel | Pinch |
| Select / place | Click a glowing ring, edge, or tile | Tap |
| Build | Pick a build button, then tap a highlighted target | Same |
| Cancel placement | **Cancel** button | Same |
| Menu / audio | ☰ (top-right) | Same |

The UI always shows whose turn it is, what action is expected, and why a move is
invalid. NPC speed can be set to Normal / Fast / Turbo in the menu.

## Reliability

- `npm run build` — production build + full TypeScript strict type-check.
- `npm run sim` — headless simulation that plays **22 full games** (varied map
  sizes, player counts, victory targets, and full chaos) to a valid winner,
  proving the turn loop always terminates and never softlocks.

The game also recovers from corrupt saved data, degrades to silence if Web Audio
is unavailable, and wraps the app in an error boundary that offers a clean reset.

## Architecture

Concerns are separated but not over-abstracted:

```
src/
  game/     Rules & state (pure): types, hexGrid, mapGen, rules, gameReducer
  game/ai.ts        NPC decision-making (fast heuristics, personality-driven)
  store/    Zustand store: screens, turn orchestration, FX signals, persistence
  render/   Three.js / react-three-fiber: board, pieces, highlights, dice, camera
  ui/       React HUD: title, setup, top bar, hand, trade, toasts, victory
  fx/       Generated Web Audio engine (no external audio files)
```

- The board is a **pointy-top hex graph**; vertices and edges are derived
  geometrically and de-duplicated by world position.
- All randomness (map, dice, AI) flows from a single **seed**, shown in-game and
  reproducible from the end screen.
- Everything is generated at runtime — geometry, materials, number tokens
  (canvas textures), and audio — so there are **no downloaded assets** to break.

## License

MIT — do whatever you like. Built for fun.
