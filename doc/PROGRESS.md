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

---

## 2026-07-22 — Bilingual (EN / 日本語) support

### What changed
- New `src/i18n.ts`: `Lang = 'en' | 'ja'`, a single `M` map of `[en, ja]`
  tuples, and `t(key, params?, lang?)` with `{token}` interpolation. Module-
  level `activeLang` mirrors the setting; `setActiveLang()` keeps it in sync.
- New `src/ui/useT.ts` (`useT()` hook + `useLang()`), and `src/ui/LangToggle.tsx`
  (EN / 日本語 segmented control). Toggle appears on the title screen (top-right),
  setup header, and the in-game HUD settings popover.
- `settings.lang` added (persisted; defaults to `ja` if `navigator.language`
  starts with "ja", else `en`). `setSetting('lang', …)` calls `setActiveLang`.
- All static UI switches live. Dynamic game text (log lines, toasts, NPC
  speech, world-event labels) is generated in the active language **at event
  time** via `t()` in `store.ts` / `names.ts` — so switching mid-game affects
  new events + all chrome; already-logged history keeps its original language
  (standard behavior, acceptable).
- NPC speech moved from `names.ts` `LINES` into i18n (`npc.<key>` as
  newline-joined variants; `npcLine()` splits + picks). `PERSONALITY_LABEL`
  removed — components use `t('pers.<p>')`.
- Human player name is translated at display time (`t('player.you')`) in
  TopBar/VictoryScreen so it stays consistent after a live switch, even though
  the stored `player.name` was baked at match creation.

### Deliberately left in English
- Procedural settlement names (e.g. "Grand Brick Point") and civ titles —
  they're absurd brand-like proper nouns; translating fragment-generated names
  naturally is out of scope. They read fine embedded in JA text.

### Verified
- `npm run build` + `npm run simulate` (all 5 configs) pass.
- Playwright: title/setup/HUD in both languages, live switch title→JA and
  in-game JA→EN, localized chronicle log + player chip; `player[0].name`
  reads "あなた" in JA. No page errors.

### Gotchas for next session
- To add a string: add one `M['key'] = [en, ja]` entry in `i18n.ts`; use
  `t('key', {params})` (components via `useT()`; store via imported `t`).
  Localize resource/terrain params with `t('res.'+r)` / `t('terrain.'+x)`
  before interpolating.
- `i18n.ts` must NOT import the store (cycle). The `useT` hook lives in
  `ui/useT.ts` instead.

---

## 2026-07-22 — spec.md SSoT workflow + title/setup polish to PLAN.md spec

### What changed
- **`spec.md` created (repo root) as the Single Source of Truth**; CLAUDE.md
  now mandates the session workflow: read CLAUDE.md → doc/PROGRESS.md →
  spec.md, check whether the request needs a spec change, plan before
  implementing, confirm unclear points with the user, and update
  spec.md + PROGRESS.md when behavior changes.
- **Gameplay screen is spec-frozen** (spec.md §4): current implementation is
  the reference — do not touch without explicit user request + spec update.
- Title/setup screens brought up to the original PLAN.md spec (user said they
  had slightly degraded):
  - Title (`TitleScene.tsx`): added rising golden particle motes (additive
    Points) + a flapping bird flock; START/CONTINUE now play a launch
    transition (build sfx + white flash + logo zoom, ~300 ms) and hover sfx
    (`TitleScreen.tsx`).
  - Setup (`SetupScreen.tsx`): deterministic rival preview — the exact NPCs
    the seed will produce are highlighted gold in the full pool (same RNG
    path as buildMatch); live match summary bar (hexes / rival emojis / VP /
    est. minutes / seed / chaos count); pulsing hex preview with per-dot
    delay; fixed JA button text wrapping (seg-btn nowrap + stacked hex
    count for EN).

### Verified
- `npm run build` passes; Playwright screenshots (EN title with motes+bird,
  EN/JA setup with roster highlight + summary bar) show no errors. Gameplay
  screen untouched.

### Gotchas
- Title-only ambience lives in `TitleScene.tsx` (Motes/Birds) — do NOT add it
  to shared `Ambient.tsx`, which the frozen gameplay screen uses.
- Rival preview must keep using `new RNG(seed + ':players')` + `pickNpcs` so
  it stays truthful to buildMatch.

---

## 2026-07-22 — Title/setup reverted to first-commit atmosphere (user request)

### What changed
- User clarified: "最初のワンショット" meant **the repo's first commit
  (07d9086)**, not the PLAN.md spec. Title + setup screens reverted to that
  exact atmosphere; the previous session's additions (particle motes, bird
  flock, launch flash transition, seed-based rival highlighting, match
  summary bar, hex pulse, seg-btn nowrap tweaks) were all REMOVED.
- Kept: bilingual i18n (a separately requested feature) — the language
  toggle top-right is the only visual addition over the first commit.
  Unused i18n keys (setup.joining/sumHexes/sumMin) removed.
- `spec.md` §2/§3 rewritten: title + setup are now **spec-frozen to the
  first-commit look**, with explicit "tried and rejected" notes so future
  sessions don't re-add the same flourishes. Gameplay screen untouched.

### Verified
- Build passes; Playwright screenshots of title + setup match the first
  commit's originals (except the lang toggle). No page errors.

### Lesson for next session
- All three screens are now frozen to spec. Do not "improve" title/setup
  visuals again without an explicit user request + spec.md change.

---

## 2026-07-22 — Rename to HEXFALL

### What changed
- Game title renamed **HEXTOPIA → HEXFALL** per user request: title-screen
  logo, index.html <title>, spec.md, README, CLAUDE.md. Title screen is
  otherwise untouched; setup menu stays the first-commit version (already
  restored last entry — the user's "初代" reference at
  banger-vibecoding-catan.vercel.app matches it).
- Internal identifiers intentionally NOT renamed (noted in spec.md):
  localStorage keys `hextopia-*` (keeps existing saves) and the title-scene
  seed `HEXTOPIA-TITLE` (keeps the title island's exact shape).
- Note: vercel.app is blocked by this environment's network policy (403),
  so the live site could not be viewed directly this session.

### Verified
- Build passes; screenshot shows the HEXFALL logo with the unchanged
  first-commit title/setup screens. No page errors.

---

## 2026-07-22 — Setup menu rebuilt as the 初代 "Configure Your World" design

### What changed
- User shared mobile screenshots of their original first-generation
  deployment (banger-vibecoding-catan.vercel.app) — THAT is the "初代"
  setup menu they wanted. Full redesign of `SetupScreen.tsx` to match:
  single-column mobile-first layout, `← Back` + "Configure Your World"
  header (+ compact lang toggle), **live SVG preview of the real board**
  (terrain colors + tokens, red 6/8), gold-pill Map Size segmented control
  with tile-count sublabels, Opponents slider + player-color dots,
  Victory Points slider with quick/standard/long captions, seed row,
  **chaos modifiers as a 2-column toggle-card grid** (gold border when on),
  rival personality chips (deterministic from seed), full-width gold
  `GENERATE WORLD →`.
- **Golden Hex implemented as a real mechanic** (the 初代 menu has the card;
  no fake buttons allowed): `chaos.goldenHex` flag → `pickGoldenTile()`
  (RNG `seed+':golden'`, shared by preview + buildMatch) → the tile drops
  +1 random wildcard resource per building hit when it produces
  (`rules.ts::computeProduction`); gold ring marks the tile in 3D
  (documented as a §4 amendment); announced in the log at match start.
  Old saves migrate (`goldenTile ??= null`).
- World Events moved from a checkbox into the 🌪️ chaos card (same flag).
  Difficulty kept as a segmented row (the 初代 design had no difficulty
  control; ours is preserved in matching style).
- spec.md §3 rewritten to this design; §5/§6 document Golden Hex.

### Verified
- Build + all 5 simulations pass (chaos config now enables goldenHex).
- Playwright: mobile (412×915) matches the reference screenshots (preview,
  gold segmented control, chaos cards, chips, generate button); desktop JA
  clean; Golden Hex flows into a real match (goldenTile set, log line,
  ring). No page errors.

### Gotchas
- The setup preview MUST keep using `generateBoard(mapSize, seed)` and
  `pickGoldenTile(board, seed)` — identical code paths to `buildMatch` — so
  the preview stays a promise, not an illustration.
- `.seg`/`.seg-btn` CSS still used by TradeModal tabs; the setup screen now
  uses `.size-seg`/`.size-btn` and `.chaos-card` instead.

---

## 2026-07-22 — Change-discipline guardrail added to CLAUDE.md

### What changed
- Docs only. Added a **"Change discipline — do not break what you were not
  asked to touch"** section to `CLAUDE.md` (right after the SSoT workflow).
  Abstracts the recurring failure mode this session — loose "vibe" edits
  that redesigned frozen screens or changed shared code and silently broke
  another surface — into 5 general rules: (1) scope strictly to the request,
  (2) FROZEN surfaces off-limits without explicit request + spec update,
  (3) blast-radius check before editing shared code (store/types/i18n/
  Ambient/shared CSS classes), (4) smallest reversible diff, (5) prove no
  collateral damage (build + simulate + screenshot near the change).
- No code touched; build/sim status unchanged from previous entry.

---

## 2026-07-22 — Harbors / ports (standard Catan trade discount + flavor)

### What changed
- Added standard Catan **harbors** (always on). New `Port`/`PortKind` types +
  `board.ports: Port[]`. `generatePorts(board, seed)` (in `board.ts`, called
  by `generateBoard`) picks coastal edges (tiles.length===1), spaced by angle
  around the coast with no shared vertices, ~4–9 per board; assigns one 2:1
  harbor per resource (room permitting) + generic 3:1 for the rest.
- Trade math: `rules.ts` gains `ownedPorts()` + `portRate()`; `bankRate()`
  now takes `min(base/festival/maxSheep, portRate(state.current))`. Because
  the trade modal, `bankTrade`, and NPC bank trades all already call
  `bankRate`, the discount flows everywhere with no caller changes.
- Presentation: new `scene/Ports.tsx` renders a dock + hanging "N:1" sign
  (canvas texture `portSignTexture`) out on the water per harbor; owner-color
  ring + buoy when claimed; hover name tag. Added `<Ports/>` to GameScene.
  TradeModal bank tab shows a "⚓ Your harbors" chip list.
- Flavor (my spin): themed harbor names (`names.ts::portName`, English proper
  nouns like settlement names); **claiming a harbor** (first settlement on a
  harbor vertex — `store.ts::claimPorts`, called from main + setup builds)
  gives a HARBOR WELCOME toast + one-time +1 welcome card + NPC speech.
  Harbor vertices get +2 in `vertexScore` so AI + gold-ring hints value them.
- Migration: `loadMatch` sets `g.board.ports ??= []` (old saves = no harbors).
- spec.md §4 amended (dock visuals) and §5 documents the harbor rules; sim
  config unchanged (ports always on).

### Verified
- `npm run build` + all 5 `npm run simulate` configs pass.
- Playwright: 9 harbors on a medium board (one 2:1 per resource + 4 generic);
  human claiming a harbor logs the welcome + gets a card; trade modal shows
  wood at 3:1 (via generic port) with the "Your harbors" chips 🐑2:1 / ⚓3:1;
  docks visible on the coast; no page errors.

### Gotchas
- `board.ts` now imports `names.ts` (portName) → `i18n.ts`. Safe (names never
  imports board). Don't introduce a board→…→board cycle.
- Harbors are NOT drawn in the setup screen's SVG preview (that screen is the
  frozen 初代 design — left untouched on purpose).

---

## 2026-07-22 — Harbor sign enlarged for readability

### What changed
- Coastal harbor signs were small and their "N:1" rate text was hard to read
  from the default camera. Enlarged the hanging sign so the rate + resource
  emoji read at a glance (`src/scene/Ports.tsx`, `src/scene/textures.ts`):
  - `signGeo` plane 0.32 → 0.52; `armGeo` 0.28 → 0.4 (wider to hold the sign);
    `postGeo` mast 0.5 → 0.72 tall, and post/arm/sign repositioned so the
    taller sign hangs from the arm (top y≈0.66) and clears the dock plank
    (bottom y≈0.14, plank at y=0) — no dip into the water.
  - `portSignTexture` canvas 128 → 256 with 2× drawing coords + larger fonts
    (rate `bold 104px`, emoji `100px`) so the bigger plane stays crisp.
- Frozen gameplay screen: changed on explicit user request; spec §4 harbor
  amendment updated in the same commit.

### Verified
- `npm run build` passes; `npm run simulate` reaches a winner on all 5 configs.
- No Playwright screenshot this session (not installed; a full 3D-scene
  navigation harness to frame one coastal harbor is disproportionate to a
  geometry-scale tweak). Change is purely dimensional; mast geometry validated
  by inspection. Nothing else in `Ports.tsx` / `textures.ts` touched.
