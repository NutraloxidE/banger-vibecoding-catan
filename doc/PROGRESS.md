# PROGRESS

Append-only handoff log. Newest entry at the bottom. See `CLAUDE.md` for the
update convention. Each session: read this first, and add a new dated entry
before you finish.

---

## 2026-07-22 — Initial build + highlight polish

### What was built
Complete game from an empty repo (`HEXTOPIA`), per `PLAN.md`:

- **Stack:** Vite + React + TypeScript + react-three-fiber + zustand (immer).
  Zero-config Vercel deploy; no server/DB/env/assets.
- **Full loop:** animated title → world-config screen → seeded procedural hex
  board → snake-order initial placement → turns (dice ritual → production →
  robber on 7 → build/trade) → victory screen with stats → rematch/new world
  without a page refresh.
- **Civilization tiers:** settlement → city → **MEGA CITY** (requires a city +
  6 roads owned, one per player, grants a generated civ title + beacon).
- **Longest-road** bonus; **bank + NPC trading** with acceptance hints and NPC
  counter-offers (countdown); **6 NPC personalities** with heuristic AI, speech
  bubbles, moods.
- **World events**, **4 chaos modifiers**, combo toasts, near-win tension.
- Procedural everything: canvas textures, generated settlement names, Web Audio
  synth SFX/music. **Auto-save** to localStorage with graceful recovery.
- **Mobile** layout + touch targets; desktop keyboard shortcuts.
- **Softlock guards:** per-turn AI action caps, dice-animation watchdog,
  fallback turn advance, save sanitization on restore (all in
  `store.ts::aiTick` and `loadMatch`).

### Verified
- `npm run build` passes (tsc + vite).
- `npm run simulate` reaches a winner on all 5 configs (small/medium/large,
  chill/normal/ruthless, chaos, 1-NPC duel).
- Playwright drove the real built app in Chromium: full game to victory via the
  live UI with zero page errors; screenshotted title, setup, placement,
  dice mid-tumble, trade modal, victory, restart-without-refresh, save/reload
  restore, and mobile (390×844).
- `window.__game` exposes the zustand store for headless/browser testing
  (harmless in prod; used by the Playwright scripts).

### Follow-up polish this session
- Fixed placement highlights getting **buried** in terrain decorations: markers
  now render with `depthTest`/`depthWrite` off + high `renderOrder` so they're
  always on top (`src/scene/Highlights.tsx`).
- Briefly added floating arrow markers, then **removed them** per feedback —
  the always-on-top rings alone read cleanly. (Gold ring = high-value corner.)

### Known issues / notes
- Bundle is ~1.08 MB (three.js). Fine for now; could code-split later if desired.
- No online multiplayer / backend by design (out of scope per PLAN.md).
- Branch in use: `claude/new-session-o62gcs`.

### Suggested next steps (optional, deferred for scope)
- Rivalry statuses (`TRADE WAR`, `BORDER DISPUTE`, …) — data hooks exist in
  NPC stats but not surfaced.
- More world-event variety and ports/harbor trading.
- Consider chunk-splitting the three.js bundle if build-size matters.

---

## 2026-07-22 — Token visibility fix

### What changed
- **Number tokens (dice probability tokens) were getting buried** in tile
  decorations (trees/mountains). Fixed in `src/scene/Tiles.tsx`: the token disc
  + number face now render always-on-top (`depthTest`/`depthWrite` off, high
  `renderOrder` = `TOKEN_RENDER_ORDER`), and the token group was raised from
  y=0.03 to y=0.12 so it reads as a floating label.
- Same always-on-top technique as the placement highlights (`Highlights.tsx`) —
  if more world-space labels get buried later, reuse this pattern.

### Verified
- `npm run build` passes. Playwright screenshots at wide / zoomed / low-angle
  views confirm every token is legible over forests and mountains; no page
  errors.
