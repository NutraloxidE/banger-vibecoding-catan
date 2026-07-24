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

---

## 2026-07-22 — Two-sided harbor sign + slightly larger boats

### What changed
- **Harbor sign text no longer mirrors when viewed from behind**
  (`src/scene/Ports.tsx`): the single `DoubleSide` plane (which showed
  reversed text on its back face) is replaced by two coincident `FrontSide`
  planes rotated 180° apart, so each side shows non-mirrored text. Back-face
  culling means only the side facing the camera draws — no z-fighting.
- **Boats slightly enlarged** (`src/scene/Ambient.tsx`): the boat group now
  renders at `scale={1.35}` for a bit more presence on the water. Scale is set
  as a prop; `useFrame` only touches position/rotation, so animation is
  unaffected.
- Frozen gameplay screen: both on explicit user request; spec §4 updated in
  the same commit (harbor amendment note + boats "slightly enlarged").

### Verified
- `npm run build` passes; `npm run simulate` reaches a winner on all 5 configs.
- Render-only changes (no game logic touched). No Playwright this session
  (not installed); sign two-sidedness and boat scale validated by inspection.

---

## 2026-07-22 — WASD camera panning (desktop)

### What changed
- **Desktop WASD movement** (`src/scene/CameraRig.tsx`): W/S/A/D now glide the
  view horizontally across the ground, relative to the camera's facing
  direction (forward is the camera direction flattened onto the XZ plane;
  A/D strafe along its perpendicular). Both `camera.position` and the
  OrbitControls `target` translate by the same delta, so the orbit
  relationship is preserved (it's a pan, not a rotate).
  - Speed scales with zoom distance so it feels consistent near/far.
  - Target is clamped to `boardRadius*2.4+4` so you can't lose the board.
  - Keys are ignored while a form field (input/textarea/select/
    contentEditable) is focused; `blur` clears held keys (no stuck-key drift).
  - While any WASD key is held, manual steering takes precedence over the
    event auto-focus lerp.
- No conflict with existing shortcuts (Esc / Space / Enter in `App.tsx`).
- Frozen gameplay screen: added on explicit user request; spec §4 camera
  bullet updated in the same commit.

### Verified
- `npm run build` passes; `npm run simulate` reaches a winner on all 5 configs
  (camera-only change; simulate is headless so unaffected). Manual key mapping
  and vector math validated by inspection; no Playwright this session.

---

## 2026-07-22 — Trade modal UX (mobile fit + own-inventory) + emoji fallback

### What changed (all UI-layer, per explicit user request)
- **Mobile trade modal no longer overflows / feels cramped**
  (`src/styles.css` mobile `@media (max-width:760px)` block): modal widened to
  `96vw` with reduced padding; the NPC tab's `.trade-cols` give/receive grid
  (previously two 5-emoji pickers side-by-side → horizontal overflow on phones)
  now **stacks vertically**, the middle arrow rotates 90° (↕), and rival-target
  buttons wrap 2-up with `white-space: normal`.
- **You can now see what you own while trading** (`src/ui/TradeModal.tsx`):
  - New "Your resources" strip (`.trade-inventory`) under the modal head, shown
    on **both** tabs — all five resources with live counts (empty ones dimmed).
  - Each give/receive picker button (`ResPicker`) now shows an **owned-count
    badge** (`.res-pick-have`) under the emoji, so you never over-commit a
    resource you don't have. New i18n key `trade.yourResources` (en/ja).
- **🪵 wood / 🪨 ore emoji sometimes blank on desktop** — fixed by appending a
  color-emoji font stack to `--font-display` in `:root` (`--font-emoji` =
  Segoe UI Emoji / Apple Color Emoji / Noto Color Emoji / Segoe UI Symbol /
  Noto Emoji). These are Unicode-13 glyphs; the old stack (Trebuchet/Verdana,
  system-ui, sans-serif) gave no emoji fallback, so Windows browsers could
  render tofu. Latin text still uses Trebuchet/Verdana (emoji only fill
  per-glyph gaps). Covers every DOM emoji (hand, cost chips, trade, etc.).

### Verified
- `npm run build` + all 5 `npm run simulate` configs pass.
- Playwright (pre-installed Chromium via `executablePath`): trade modal
  screenshotted at 390×844 (JA) and 1280×800 (EN), bank + NPC tabs, with a
  forced main-phase human hand (4🪵 1🧱 3🌾 0🐑 2🪨). Mobile fits the viewport
  on both tabs, "Your resources" strip + per-button owned badges render, NPC
  columns stacked; desktop unbroken; zero page errors. (Emoji all render on
  Linux Chromium via Noto; the font fix targets Windows desktops specifically.)

### Notes / scope
- Only `src/ui/TradeModal.tsx`, `src/styles.css`, `src/i18n.ts` (+ spec/
  progress) touched. The trade-modal internals aren't part of the frozen
  §4 gameplay layout; spec §5 (trade UX) and §9 (emoji fallback) updated in
  the same commit.
- Playwright was installed as a throwaway to screenshot, then reverted out of
  `package.json`/`package-lock.json` — it is NOT a committed dependency.

---

## 2026-07-22 — Player-color edge bars on event toasts

### What changed (explicit user request)
- Dopamine event toasts (gold combo / red warn frames) were ambiguous about
  **whose** event they announced. Now, when a toast belongs to a specific
  player, its frame shows that player's color as thin glowing bars on the
  inner left + right edges (matches the player-chip colors at the top).
- `Toast` gained an optional `color?: string` (`src/game/types.ts`);
  `addToastTo(..., ttl, color?)` threads it through (`src/game/store.ts`).
  Wired at the player-specific sites: production combos (3+/5+/7+ and
  single-resource jackpots), mega-city rise, road dominance, harbor welcome,
  match point (warn), and the human's robber-awakens (warn). Toasts with no
  owning player (world-generated, world events, generic warnings) stay
  bar-less.
- Render: `src/ui/Overlays.tsx` adds class `toast-owned` + inline `--pc` when
  `color` is set; `src/styles.css` `.toast` is now `position: relative` with
  `.toast-owned::before/::after` color bars (extra horizontal padding to make
  room). No change to bar-less toasts.

### Verified
- `npm run build` + all 5 `npm run simulate` configs pass.
- Playwright (900×700): forced a gold combo (human = pink), a red MATCH POINT
  (Dave = blue), and a plain WORLD EVENT (no color). Bars render in the exact
  chip colors on combo/warn; the event toast has none. Zero page errors.

### Notes / scope
- Frozen §4 gameplay HUD touched on explicit request; spec §6 (presentation)
  updated in the same commit. Only types/store/Overlays/styles changed.

---

## 2026-07-23 — Raise Victory Points ceiling (14 → 20)

### What changed
- Setup screen VP slider max raised from 14 to 20 (`src/ui/SetupScreen.tsx`,
  one attribute). Min (7), default (10), and the caption thresholds are
  unchanged — ≥12 still reads "Long march" across the extended range.
- `spec.md` updated in the same commit: setup §6 and the Victory rule now say
  the target range is 7–20 (was 7–14).

### Verified
- `npm run build` + all 5 `npm run simulate` configs pass.
- Extra check: drove full headless games at `targetVp: 20` on large / medium /
  small boards with the human-NPC driver — each reaches a real winner with
  20 VP (large ~535 steps, medium ~610, small ~1880), so a high target is
  achievable and does not softlock turn progression.

### Notes / scope
- Frozen setup screen touched on explicit user request; matching `spec.md`
  update shipped in the same commit. Only the slider `max` and two spec lines
  changed — no other setup control, caption logic, or store code altered.

---

## 2026-07-23 — Difficulty actually changes NPC competence (chill = dumber)

### What changed (user request: 低難易度でもっとバカで非効率な選択に)
Before, `difficulty` barely affected play — every positional pick used the same
`rand()*0.3` jitter, and `chill` only nudged the sleeper personality + trade
leniency. Now `chill` rivals play deliberately badly, all in `src/game/ai.ts`:
- **`pickNoise(state)` helper** (chill 7 / normal 0.3 / ruthless 0.12) fed into a
  new `noise` param on `pickBest`. The big chill jitter routinely drowns out
  `vertexScore`, so setup settlements/roads AND in-game mega/city/settlement/road
  picks land on clearly worse spots.
- **Laziness:** chill NPCs `end` the turn ~28% of the time even when they could
  build (sit on cards), on top of the existing sleeper skip.
- **Wasteful bank trade:** chill NPCs ~25% of turns dump a fat surplus
  (≥ rate+2) into a *random* resource they don't need, before the goal-directed
  trade logic.
- **Sloppy robber:** `aiRobberChoice` adds `rand()*8` noise on chill and drops
  the +5 leader-hunt bonus → near-random tile, no leader targeting.
- **Exploitable trades:** chill acceptance bonus 0.4 → 1.2 (easily talked into
  lopsided deals in the trade modal).
`normal`/`ruthless` behavior is unchanged (ruthless keeps denial bonus + minimal
noise + tighter trades).

### Verified
- `npm run build` passes.
- `npm run simulate` reaches a winner on all 5 configs, run 4×. Chill games are
  visibly slower/less efficient now (~25–31 rounds vs ~17 for normal) but always
  finish well within the step cap (~230–303 steps). Softlock guards untouched.
- spec.md §6 amended to document difficulty-scaled competence.

### Gotchas
- Only `src/game/ai.ts` (logic) + spec/progress touched — no frozen screen, no
  shared store/types/CSS. `chill` noise (7) is tuned to the ~0–18 `vertexScore`
  range; if `vertexScore` is rescaled later, revisit `pickNoise`.

---

## 2026-07-23 — Development cards (classic set) + optional Crazy Cards

### What changed (user request: 一般的なカタンの発展カード + クレイジー版のトグル)
Added a full development-card system — a new core mechanic — plus a chaos toggle
for extra "crazy" cards.

- **New `src/game/dev.ts`**: deck composition, `DEV_CARD_COST` (1🪨1🌾1🐑),
  `buildDevDeck(crazyCards, rng)` (deterministic shuffle from seed `+':dev'`),
  `DEV_ICON`, `DEV_PICKS`, `LARGEST_ARMY_MIN`. Standard deck = 14 Knight / 5
  Victory / 2 Road Building / 2 Year of Plenty / 2 Monopoly.
- **Types** (`types.ts`): `DevKind`, `DevCard`, `DevPrompt`; `ChaosFlags.crazyCards`;
  per-player `devCards[] / devVp / knightsPlayed`; match `devDeck /
  devCardPlayedThisTurn / freeRoads / devPrompt / robberSource / largestArmy`;
  stats `devCardsBought / knightsPlayed`.
- **Rules**: `computeVp` now adds `devVp` + Largest Army (+2 VP). `store.ts` gains
  `buyDevCard / playDevCard / resolveDevPrompt` (human) and, for the AI,
  `resolveDevInline` (atomic). Effects: knight (→robber, credits Largest Army),
  Victory (auto +1 VP on draw, not a held card), Road Building (2 free roads via
  `freeRoads` + free `applyBuild`), Year of Plenty / Monopoly / Treasure Haul
  (`devPrompt` pick overlay for human, heuristic picks for AI), plus the crazy
  cards: Plague (all rivals discard 2), Earthquake (robber steals from ALL
  adjacent rivals — routed through `moveRobberTo` via `robberSource`), Wild
  Gamble (~2/3 jackpot / else loss). `updateLargestArmy` mirrors longest road.
  One card per turn; can't play the turn it's bought (`boughtOnTurn` vs turnCount).
- **AI** (`ai.ts`): new actions `buyDev` / `playDev`; `aiChooseDevPlay`,
  `aiWantBuyDev`, and exported target-pickers `aiDevMonopolyResource /
  aiDevGainResources / aiFreeRoadSpot`. NPCs buy with spare ore/wheat/sheep and
  play cards heuristically (knight to kick the robber / hunt leader / chase army,
  monopoly on hoarded resources, resource cards to finish a build, gamblers love
  Wild Gamble).
- **UI**: BottomBar dev-card row (buy button w/ deck count + playable/held cards)
  + Monopoly/YoP/Treasure resource-pick overlay + free-road banner; TopBar ⚔️
  Largest Army badge + 🎴 held-card count; SetupScreen 🃏 Crazy Cards chaos card;
  VictoryScreen Largest Army + dev-cards-bought stats. New CSS `.dev-row/.dev-buy/
  .dev-card/.dev-prompt/.dev-pick` (+ mobile). i18n `dev.*` / `g.dev*` / `chaos.crazy`
  / `top.*ArmyTip` / `stat.largestArmy*` / `stat.devCards*` (en/ja).
- **Migration**: `loadMatch` backfills all new fields (old saves get a fresh
  standard deck, empty hands, no army).
- **spec.md** §3/§4/§5/§6 updated in the same commit.

### Verified
- `npm run build` + `npm run simulate` pass (added a `crazy-cards/medium` config
  and turned crazy on in the chaos run); ran the sim 4× — every config reaches a
  real winner (~130–405 steps), no softlocks. The simulate human (player 0) now
  exercises the real human code paths: buyDev, playDev, `devPrompt` resolution,
  free-road placement, and knight/earthquake robber.
- Playwright (throwaway install, pre-installed headless_shell) screenshotted:
  setup screen with the 🃏 Crazy Cards card (frozen 初代 design intact); in-game
  HUD with the dev-card buy button + hand (Knight/Monopoly/YoP/Wild Gamble
  playable, Road Building dimmed "next turn") + ⚔️ army badge; the Monopoly
  resource-pick overlay. Zero page errors. Playwright reverted out of
  package.json (NOT a committed dep).

### Gotchas / notes
- NPCs resolve dev cards **inline** (atomic turn) via `resolveDevInline`; the
  **human** uses phases/prompts (`playDevCard` → robber phase / `devPrompt` /
  free-road placement). Earthquake vs knight steal behavior is switched inside
  `moveRobberTo` on `g.robberSource` (cleared at start of that fn + on turn end).
- Victory Point cards apply VP immediately on draw (public), so a bought VP card
  can be the winning point — `doBuyDevCard` calls `checkWinner`.
- Standard dev cards are ALWAYS on (core); the toggle only adds crazy cards.

---

## 2026-07-23 — Dev-card play: cancel + in-play effect description

### What changed (user request: カード使用のキャンセル + 選択中の解説)
Playing a development card is now cancelable and shows what the card does while
you're choosing.

- **Deferred, reversible effects.** A card being played interactively is held in
  new `MatchState.pendingDevCard` (returned to hand on cancel). Irreversible
  effects are deferred until the interactive step completes:
  - **Knight** no longer credits Largest Army at play time — `creditKnight` moved
    into `moveRobberTo` (fires only when `robberSource==='knight'` and the robber
    is actually placed). So canceling before placement fully returns the card and
    grants no knight.
  - **Monopoly / Year of Plenty / Treasure Haul** already applied only on pick
    completion; `resolveDevPrompt` now also clears `pendingDevCard`.
  - **Road Building** clears `pendingDevCard` when the 2nd free road lands; it's
    reversible only before the first free road (`freeRoads===2`) — after one road
    is placed, cancel forfeits the remainder and keeps the card spent.
  - **Plague / Windfall** are instant (no target) — nothing to cancel.
- **`cancelDevCard()` store action** (+ module `cancelPendingDev`): restores the
  card, un-sets `devCardPlayedThisTurn`, and clears devPrompt/placement/freeRoads/
  robberSource, reverting `phase` robber→main. Logs `g.devCancel`.
- **UI.** The Monopoly/YoP/Treasure overlay now has a header (icon + name), the
  card's effect description, the chosen-so-far chips, and a **Cancel card**
  button. The card-triggered robber phase shows a `.dev-active` box (name +
  description + "tap a tile or cancel" + Cancel). The free-road banner shows the
  Road Building description and its cancel routes through `cancelDevCard`.
- i18n: `g.devCancel`, `dev.cancel`, `dev.robberInfo`. New CSS `.dev-active*`,
  `.dev-prompt-head`, `.dev-prompt-chosen`, `.placement-desc`. `loadMatch`
  backfills `pendingDevCard`; `advanceTurn` resets it.

### Verified
- `npm run build` + `npm run simulate` pass (4×; deferred knight credit still
  produces winners incl. via Largest Army).
- Headless store test (throwaway tsx): monopoly play→cancel returns the card &
  un-spends the turn; knight play leaves knights=0 until the robber is placed
  (then =1), cancel keeps knights=0 & returns the card; YoP mid-pick grants no
  resources and cancel restores everything.
- Playwright (throwaway, headless_shell): screenshotted the Year-of-Plenty
  overlay (name + "Take any 2 resources" + "1 left to choose" + chosen 🌾 +
  Cancel) and the Knight robber phase (name + desc + "tap a tile or cancel" +
  Cancel). Zero page errors. Playwright reverted out of package.json.

### Notes
- `moveRobberTo` is the single commit point for card-triggered robbers (dice-7
  robber has `robberSource===null` → no knight credit, not cancelable). NPC
  knight/earthquake go through the same path via `resolveDevInline`.

---

## 2026-07-23 — World presets (Normal / Banger / CORE / MAXXING)

### What changed (user request: ワールド作成プリセットを選べるように)
Added a **World Preset** selector to the setup screen — a one-tap shortcut that
bundles the existing chaos modifiers into escalating flavors. Purely a UI-layer
convenience over the same `MatchConfig`; no store/types/rules/simulate changes.

- **`src/ui/SetupScreen.tsx`**: new `PRESETS` map + `matchPreset()` helper.
  A 2×2 `.preset-grid` of single-select cards inserted right after the header
  (before the live map preview). Selecting one calls `applyPreset()`, which sets
  all seven flag `useState`s (`worldEvents` + the six `chaos` toggles). The
  active preset is *derived* from current flag values each render, so tweaking
  any individual Chaos Modifier card afterward drops to an unhighlighted
  "Custom" state (a caption notes this). Presets:
  - 🌾 **Normal** — every modifier + World Events OFF (plain Catan).
  - 🔥 **Banger** (default) — World Events + NPC Drama on (== the prior default).
  - 💥 **BANGER CORE** — Banger + Golden Hex + Crazy Cards.
  - 🌋 **BANGER MAXXING** — all seven flags on.
- **`src/i18n.ts`**: `setup.preset`, `preset.{normal,banger,core,maxxing}` (+`D`
  descriptions), `preset.customD` (en/ja).
- **`src/styles.css`**: `.preset-grid` / `.preset-card(.on)` / `.preset-emoji` /
  `.preset-name` / `.preset-desc` / `.preset-custom` (modeled on `.chaos-card`).
- **`spec.md` §3** rewritten (new item 2 = World Preset; list renumbered; §3.9
  notes the preset is a shortcut over the Chaos Modifier toggles).

### Verified
- `npm run build` + all 6 `npm run simulate` configs pass (simulate builds
  `MatchConfig` directly, unaffected by the UI presets).
- Playwright (throwaway, reverted out of package.json): setup screen at 412×915.
  Banger highlighted by default; selecting MAXXING lights all chaos cards +
  the live preview gains the Golden Hex ring/✨ + warn-box reads "5 chaos
  modifiers active"; Normal clears them. Zero page errors.

### Notes / scope
- Frozen setup screen touched on explicit user request; matching `spec.md`
  update shipped in the same commit. The preset just drives the existing
  toggles — no new mechanic, and the Chaos Modifier cards stay fully editable
  (that's what produces the "Custom" state).

### Follow-up same day — preset is a dropdown (user request: プルダウンで)
- Swapped the 2×2 `.preset-grid` cards for a native `<select className="preset-select">`
  (custom gold chevron via inline SVG `background-image`, `appearance:none`).
  Options are the four presets; a disabled "🎛️ Custom" option appears + is shown
  selected only when flags match no preset. A `.preset-desc` caption under the
  dropdown shows the active preset's (or Custom's) description. `applyPreset`
  now fires from the select's `onChange`. `matchPreset`/`PRESETS`/`PRESET_EMOJI`
  unchanged. New i18n `preset.custom`. CSS: `.preset-grid/.preset-card/.preset-emoji/
  .preset-name/.preset-custom` removed, `.preset-select` added, `.preset-desc` kept.
  spec.md §3 item 2 reworded (grid → dropdown). Build + all 6 sims pass;
  Playwright confirms the dropdown defaults to 🔥 Banger, selecting 🌋 BANGER
  MAXXING lights the preview's Golden Hex — zero page errors.

### Follow-up same day — custom dropdown + styled options panel (user request)
- A native `<select>` can't style its options popup (browsers draw it natively),
  so replaced it with a self-contained **`PresetDropdown`** component in
  `SetupScreen.tsx`: a gold-accented trigger button + a floating `.preset-menu`
  (closes on outside `mousedown` / Esc via a `useRef` + `useEffect`). Each menu
  row shows emoji + name + short description; the active preset is gold-tinted
  with a ✓, the caret badge flips 180° when open. Trigger shows "🎛️ Custom"
  when flags match no preset. No store/logic touched — `applyPreset`/`matchPreset`/
  `PRESETS` unchanged; the component just drives the same flag setters.
- CSS: `.preset-select*` rules removed; added `.preset-dd/.preset-trigger/
  .preset-caret/.preset-menu/.preset-opt*` (+ `presetPop` keyframes). `.preset-desc`
  kept. spec.md §3 item 2 reworded (native dropdown → custom menu with ✓ rows).
- Build + all 6 sims pass; Playwright screenshotted the open menu (4 rows,
  Banger checked), option hover, and post-pick collapsed state — zero page errors.

---

## 2026-07-23 — Traditional Catan board layout (numbers + ports)

### What changed (user request: トラディショナルなカタンの数字配置・港配置を選択可能に)
Added two **Board Layout** toggles that swap the procedural board for the
classic Catan layout — independent of the World Preset, so they combine with
any preset (Normal included). Confirmed via AskUserQuestion: two separate
toggles, applied "traditional-style" across all map sizes (small = exact).

- **`src/game/board.ts`**:
  - `generateBoard(mapSize, seed, layout?)` gains an optional `BoardLayout`
    (`{ traditionalNumbers, traditionalPorts }`). TitleScene's 2-arg call is
    unaffected (layout optional → title board byte-for-byte unchanged).
  - **Traditional numbers**: `traditionalTokens()` lays the classic A–R
    sequence `[5,2,6,3,8,10,9,12,11,4,8,10,9,4,5,6,3,11]` over the land tiles
    in an outer→inner angular spiral, skipping the desert (not counted). Seed
    picks among spiral starts (outer-ring tile × ±dir) that keep 6/8 apart, so
    a seed rotates/reflects the classic board rather than randomizing numbers.
    Larger boards cycle the sequence. Extracted `noAdjacentHotspots()` helper.
  - **Traditional ports**: `generatePorts(board, seed, traditional?)` — same
    evenly-spaced coastal edges, but kinds = `traditionalPortKinds()`: one 2:1
    per resource spread evenly + generic 3:1 filling the rest (19-tile board =
    the standard 9 harbors: 4 generic + one of each resource).
- **Types**: new `BoardLayout` interface; `MatchConfig` gains flat
  `traditionalNumbers` / `traditionalPorts` (NOT in ChaosFlags — board layout,
  not economy chaos; presets don't touch them).
- **`src/game/store.ts`**: `buildMatch` threads the two flags into
  `generateBoard`; `loadMatch` backfills `config.traditional*` (old saves keep
  their already-generated board).
- **`src/ui/SetupScreen.tsx`**: new "Board Layout" section (reuses
  `.chaos-grid`/`.chaos-card`) with 🔢 Traditional Numbers + ⚓ Traditional
  Ports, placed right after Map Size. State prefilled from `lastConfig`;
  threaded into the config + the live `MapPreview` (so the preview reflects
  traditional numbers).
- **`src/i18n.ts`**: `setup.layout`, `layout.numbers(D)`, `layout.ports(D)` (en/ja).
- **`scripts/simulate.ts`**: base config gets the two flags (false); added
  `traditional/small` + `traditional/large` runs with both on.
- **spec.md** §3 (setup order: new Board Layout item, list renumbered) and §5
  (Traditional Numbers + Traditional Ports rules) updated in the same commit.

### Verified
- `npm run build` + all 8 `npm run simulate` configs pass (incl. the two new
  traditional runs → real winners, no softlocks).
- Correctness script (5 seeds, small board): every seed reproduces the exact
  classic 18-token multiset, **no** adjacent 6/8, exactly 9 ports (4 generic +
  one 2:1 of each of wood/brick/wheat/sheep/ore); seed still rotates the board
  (control random layout differs).
- Playwright (throwaway, headless_shell, 412×915): setup screen with both
  Board Layout toggles on — section renders after Map Size, gold borders,
  frozen screen otherwise intact, zero page errors. Playwright reverted out of
  package.json (NOT a committed dep).

### Notes / scope
- Frozen setup screen touched on explicit user request; matching spec update
  shipped in the same commit.

### Follow-up same day — presets drive Board Layout (user request: 通常プリセットでON、他はOFF)
- The two Board Layout toggles are now part of the World Preset (they were
  independent in the first pass). `PresetFlags` gained `traditionalNumbers` /
  `traditionalPorts`; **Normal** sets both **on** (plain Catan = the classic
  layout), Banger / CORE / MAXXING set both **off**. `applyPreset` sets the two
  states and `matchPreset` compares them, so hand-toggling either card drops
  the preset to "Custom" (same as the Chaos Modifiers). No store/rules/board
  changes — purely the SetupScreen preset wiring. spec.md §3 items 2/5/10
  updated in the same commit.
- Verified: build passes; Playwright (throwaway, headless_shell, 412×915) —
  default=Banger both off, picking Normal lights both cards + the preview shows
  the classic spiral (trigger reads 🌾 Normal), MAXXING both off, then toggling
  a card by hand flips the trigger to 🎛️ Custom; zero page errors. Playwright
  reverted out of package.json.

---

## 2026-07-23 — Harbor ratio sign faces up when camera is near top-down

### What changed
- `src/scene/Ports.tsx`: the hanging "N:1" harbor sign now tilts flat to face
  upward as the camera orbits toward an overhead view, so the trade ratio stays
  readable when looking (nearly) straight down. Previously the vertical sign
  went edge-on and unreadable from above.
- Implementation: each `PortDock`'s `useFrame` reads the camera's world
  direction; `elevation = -dir.y` (0 = horizontal view, 1 = straight down). A
  `THREE.MathUtils.smoothstep(elevation, 0.65, 0.92)` factor `t` drives the
  sign group's `rotation.x` from `0` (vertical) to `-π/2` (flat, front face up).
  A shared module-level `camDir` scratch vector avoids per-frame allocation.
- `spec.md` §4 (frozen gameplay screen) harbor amendment updated to describe
  the tilt (explicit user request + matching spec change, per CLAUDE.md).

### Why the default/frozen view is provably unchanged
- Default camera is `[7,9,9]` looking at origin → view dir downward component
  `9/√211 ≈ 0.62`, below the `0.65` lower threshold. `smoothstep` clamps to
  exactly `0` at/below its min, so `rotation.x = 0` at the default angle and all
  lower (more horizontal) angles — the sign is byte-for-byte the prior look.
  The tilt engages only when the user deliberately orbits toward overhead.

### Verified
- `npm run build` passes (tsc + vite).
- `npm run simulate` reaches a winner on all 8 configs.
- Note: no live top-down screenshot this session (Playwright not installed);
  the default-view invariance is guaranteed by the threshold math above.

---

## 2026-07-23 (2) — Harbor rate: dedicated top-down UI (replaces sign tilt)

### What changed (supersedes the earlier same-day tilt entry)
- Reverted the sign-tilt approach. Per user follow-up, the harbor trade rate is
  now surfaced through a **dedicated UI** instead of reorienting the 3D sign.
- `src/scene/Ports.tsx`: each harbor renders a flat, screen-facing DOM badge
  (drei `<Html>`) reading its ratio ("🪵 2:1" / "⚓ 3:1"), border-tinted to the
  owner's color when claimed. The badges fade in only when the camera is near
  top-down (where the vertical 3D signs go edge-on) and fade back out otherwise.
  `Ports()` runs one `useFrame` reading the camera's downward view component and
  toggles a `topDown` boolean with hysteresis (on >0.8, off <0.68) to avoid
  flicker; the flag is passed to every `PortDock`. The 3D signs are unchanged.
- `src/styles.css`: new `.port-rate-badge` (+ `.on`) — opacity/scale transition,
  `pointer-events: none`. Modeled on `.name-tag`.
- `spec.md` §4 harbor amendment updated to describe the badge behavior.

### Why the default/frozen view is unchanged
- Default camera `[7,9,9]` → downward component ≈ 0.62, below the 0.68 off
  threshold, so `topDown` is false and every badge stays at opacity 0
  (pointer-events none). The badges are DOM overlays only — the 3D scene is
  untouched at every angle.

### Verified
- `npm run build` + `npm run simulate` (all 8 configs) pass.
- Playwright (throwaway, reverted from package.json), 1280×800, traditional
  ports: default view = 9 badges rendered / 0 shown (screenshot matches the
  prior frozen look); after orbiting to top-down = 9/9 badges faded in and
  readable over each harbor; zero page errors.

---

## 2026-07-23 (3) — Harbor→node bridges (which corners a harbor serves)

### What changed (user request: 港がどのノードと繋がってるか橋のモデルで分かりやすく)
- `src/scene/Ports.tsx`: each harbor now draws **two wooden plank bridges**
  spanning from its water-side dock up to the two coastal nodes (vertices) it
  serves — a V-shape that makes it obvious at a glance which corners can use
  the harbor. New `Bridge` subcomponent: deck (`boxGeometry` sized to the
  dock→node distance) + two side rails + four corner posts, in the existing
  dock wood palette (`woodMat`/`postMat`). Oriented in **world space** via a
  quaternion (`setFromUnitVectors(X_AXIS, dir)`) so the deck both heads toward
  the node and rises from the low dock (`y≈0.12`) to the higher tile-top node
  (`y=0.3`).
- Wiring: `Ports()` now also selects `board.vertices`; for each port it maps
  `port.vertices` → world positions and renders a `Bridge` per node alongside
  the existing `PortDock`. Bridges live at the top-level (unrotated) world
  group, not inside the yaw-rotated dock group. Purely presentational — no
  trade math / game logic touched.
- `spec.md` §4 harbor amendment updated in the same commit (frozen gameplay
  screen changed on explicit user request).

### Verified
- `npm run build` + all 8 `npm run simulate` configs pass (render-only change;
  simulate is headless so unaffected).
- Playwright (throwaway `--no-save`, pre-installed Chromium, 1280×820):
  traditional-ports match — bridges render from each dock to both its coastal
  nodes with visible rails/posts/buoy; low-angle close-up confirms the V-shape
  reaching the two corners; zero page errors. Playwright NOT added to
  package.json (verified `git status` shows only Ports.tsx + docs/spec).

### Notes / scope
- Only `src/scene/Ports.tsx` (+ spec/progress) touched. The `Bridge` deck/rail
  geometries are created per-port via inline `<boxGeometry>` (length is stable
  per port, so no per-frame churn); corner-post geometry is a shared module
  const. If vertex/dock Y levels change, update `DOCK_Y`/`NODE_Y` in `Ports()`.

### Follow-up same day — fix bridge roll on steep/short spans (user report)
- The first pass oriented each `Bridge` with `Quaternion.setFromUnitVectors(X,
  dir)` — the **shortest-arc** rotation. When a span rose from the low dock to
  the higher node with any sideways component, that shortest arc introduced an
  unwanted **roll about the deck's long axis**, so short/steep bridges looked
  twisted. Fixed by building an **explicit orthonormal basis** instead: X =
  heading (dock→node, incl. slope), Z = `cross(X, worldUp)` normalized (the
  horizontal width axis, so the deck never rolls), Y = `cross(Z, X)` (deck up);
  quaternion via `Matrix4.makeBasis(x,y,z)`. Near-vertical guard falls back to
  a fixed Z if `cross(X,up)` degenerates (our bridges are never that steep).
  Deck now always lies flat-top regardless of span length/slope.
- Verified: `npm run build` passes; Playwright close-ups (same seed as before)
  confirm every bridge deck is flat, fanning in a clean V from dock to both
  nodes, no twist; zero page errors. Only `Ports.tsx` touched.

---

## 2026-07-23 — Traditional ports: ring the whole coast, anchored to the token frame

### What changed (user request: トラディショナル港の位置・繋がり方を本物のカタンに合わせて洗練。数字トークン=Aの位置と回転方向・港種の標準順・間隔で。写真の赤丸は拾い画像で無関係)
The Traditional Ports layout had a real bug: `generatePorts` picked coastal
edges with a **greedy angular walk** that stopped the instant it reached the
target count, so it never wrapped around — on the 19-tile board ~1/3 of the
coast (the bottom arc) got **zero harbors**. It also assigned kinds with an
independent RNG, so ports rotated separately from the numbers. Confirmed with
the user (AskUserQuestion): make traditional ports **fixed to the number-token
frame**.

All in `src/game/board.ts` (only file touched):
- **`traditionalTokens` now returns `{ tokens, frame }`** where `frame =
  { startAng, dir }` is the chosen spiral start (tile "A"'s angle + winding
  direction). `generateBoard` captures it as `portFrame` and threads it into
  `generatePorts(base, seed, traditionalPorts, portFrame)`.
- **New `pickTraditionalPorts(ordered, target, frame)`**: selects coastal
  edges **evenly around the full coast** (slot `k` = `round(k*n/target)` edges
  from the A-anchored start, walked in the token `dir`), with a shared-vertex
  guard that steps along if a slot collides. Kinds run in the printed
  clockwise sequence `TRADITIONAL_PORT_ORDER = [generic, wheat, ore, generic,
  sheep, generic, brick, wood, generic]` (cycled for longer coasts). Harbor #0
  sits nearest A, so the harbor↔numbered-tile relationship reproduces the real
  board (seed → rotation/reflection of the same canonical layout).
- **`generatePorts`** now branches: traditional → `pickTraditionalPorts`;
  procedural (default board) → the **unchanged** greedy angular walk + shuffled
  kinds (moved verbatim into the `else` branch — default boards are byte-for-
  byte identical). When Traditional Ports is on but Traditional Numbers is off
  (no token frame), a deterministic per-seed frame (`seed+':portframe'`) keeps
  the ring's orientation stable.
- Removed the old `traditionalPortKinds` (superseded).
- `spec.md` §5 Traditional Ports rewritten to match, same commit.

### Verified
- `npm run build` + all 8 `npm run simulate` configs pass (incl. the two
  traditional runs → real winners).
- Inspection script (small/medium/large × several seeds): traditional boards
  now have **no shared vertices**, **max angular gap ~40–49°** (ideal 40° for 9
  ports; was ~110°+ empty arc before), and the kind sequence is always the
  canonical cycle (rotated or mirrored per seed, matching the token winding).
- Playwright (throwaway, pre-installed Chromium at
  `/opt/pw-browsers/chromium-1194`, reverted out of package.json): traditional
  small board, top-down — **9 docks/badges ring the entire coast** including
  the previously-empty bottom; zero page errors. `git status` shows only
  `board.ts` + spec/progress.

### Gotchas / notes
- Frozen gameplay screen changed on explicit user request; matching spec update
  shipped in the same commit. Render path (`Ports.tsx`) untouched — this is
  purely which coastal edges get harbors + their kinds.
- The token↔port alignment relies on `traditionalTokens` returning the SAME
  `frame` used to lay the numbers. If the token spiral's start logic changes,
  the ports follow automatically (they read the returned frame).

### Follow-up same day — procedural (default) ports ring the whole coast too

User: 「トラディショナルじゃなくてもこれくらい分散するようにしたい。現状一面
だけなにもない面がある」. The even-ring fix from the previous entry only applied
to the traditional branch; the default board still used the greedy angular
walk, so it left one bare side. Fixed by sharing the even-distribution picker
across both layouts (`src/game/board.ts` only):
- Renamed `pickTraditionalPorts` → **`pickEvenPortEdges`** and reduced it to
  edge selection (returns `EdgeNode[]`; no longer assigns kinds). Both branches
  of `generatePorts` now call it.
- **Traditional** branch: anchor = token frame (or per-seed when numbers off);
  kinds = `TRADITIONAL_PORT_ORDER` cycled (unchanged behavior).
- **Procedural** branch: anchor = per-seed frame (`seed+':portframe'`, random
  `startAng` + random `dir`), so the ring rotates/mirrors per seed; kinds =
  the same one-2:1-per-resource + generic set, shuffled (unchanged kind logic —
  only the positions changed to the even ring).
- Net: default boards now have harbors evenly around the full coast (no bare
  side) while keeping randomized kinds and per-seed variety.
- `spec.md` §5 harbor paragraphs updated (default harbors are now the even
  ring; traditional "off" note reworded).

### Verified (follow-up)
- `npm run build` + all 8 `npm run simulate` configs pass.
- Inspection (procedural, no layout; small/medium/large × 5 seeds): **no shared
  vertices**, **max angular gap ~41–49°** (was a ~110°+ empty arc), kinds still
  randomized and the ring's start rotates per seed.
- Playwright (throwaway, reverted): default board top-down — 9 docks/badges
  ring the entire coast, no bare side; zero page errors.

### Note / scope
- Frozen gameplay screen (default board) changed on explicit user request;
  matching `spec.md` update in the same commit. Only `board.ts` + spec/progress
  touched; render path (`Ports.tsx`) untouched.

---

## 2026-07-23 — Harbor landing platform (乗り場・足場) at the dock

### What changed (user request: 船と橋がつながる箇所に港の乗り場・足場を追加してビジュアルを洗練)
- `src/scene/Ports.tsx`: each harbor's thin bobbing plank is replaced by a
  **solid wooden landing platform (乗り場)** where the two plank bridges
  converge and a ship would berth. The platform is a static box deck
  (`landingGeo` 0.48×0.08×0.42, top at `PLATFORM_TOP=0.14`) with three deck
  planking seams, **four support pilings (足場)** (`pilingGeo`, one per corner)
  sinking into the water, and **two mooring bollards** (`bollardGeo`) on the
  water-facing edge. The mast + hanging "N:1" sign now stand on this platform
  at the **same world height/orientation as before** (post `y=0.36`, arm
  `0.66`, sign `0.4`) — only difference is they no longer bob.
- **Bobbing split**: the whole dock used to bob; now the pier structure is
  static (so it aligns with the static bridges) and only the **buoy** bobs on
  the water (its own `buoyRef` group; `useFrame` moved to just the buoy).
- `Ports()` `DOCK_Y` now `= PLATFORM_TOP` (was 0.12) so the bridge dock-ends
  land on the platform deck. Removed the now-unused `plankGeo`. Owner ring
  moved to the platform top (`y=PLATFORM_TOP+0.01`, radius bumped to fit the
  wider deck). Hover name-tag, top-down rate badge, trade math — all untouched.
- `spec.md` §4 harbor amendment updated in the same commit (frozen gameplay
  screen changed on explicit user request).

### Verified
- `npm run build` + all 8 `npm run simulate` configs pass (render-only change;
  simulate is headless so logic is unaffected).
- Playwright (throwaway `--no-save`, pre-installed Chromium at
  `/opt/pw-browsers/chromium-1194`, reverted out of package.json): traditional
  small board — default view shows the harbor ring intact; a low-angle zoomed
  close-up confirms each harbor now has a wooden landing deck on visible
  pilings with the mast/sign standing on it, bridges landing on the deck, and
  the red buoy floating beside it. Zero page errors on every shot.

### Notes / scope
- Only `src/scene/Ports.tsx` (+ spec/progress) touched — no game logic, no
  shared store/types/CSS. Geometry-only refinement; the sign's height,
  orientation and two-sided readability are preserved. If tile-top/dock Y
  levels change, keep `PLATFORM_TOP` (deck top) == `DOCK_Y` (bridge start).

---

## 2026-07-23 — Boats kept offshore (stop merging with harbor docks)

### What changed (user request: 船がドックと一体化してるので船をもう少し離して)
- The circling ambient boats orbit at a constant world radius far outside the
  harbor docks, but at low/zoomed camera angles a near-side boat (at the
  waterline) projected right onto a coastal dock and read as "merged" with it.
  Pushed the boats further offshore so they clearly separate from the docks.
- `src/scene/Ambient.tsx`: `Ambient` gains an optional `boatDistance?: number`
  prop; the inner boat orbit `worldR = boatDistance ?? boardRadius * 1.9 + 3`
  (the `??` keeps the **default = the original formula**). The outer boat stays
  `worldR + 1.6`.
- `src/scene/GameScene.tsx`: passes `boatDistance={boardRadius * 2.5 + 5}` — so
  the gameplay boats move out (small board 11.55→16.25 inner radius, docks at
  ~4.9), clearing the coast at low angles.
- **Frozen title screen unchanged**: `TitleScene.tsx` renders `<Ambient
  boardRadius={6.3} />` with **no** `boatDistance`, so it falls back to the
  original formula → title boats byte-for-byte identical (verified). Ambient's
  only two consumers are GameScene + TitleScene.
- `spec.md` §4 boats bullet updated in the same commit (frozen gameplay screen
  changed on explicit user request).

### Verified
- `npm run build` passes (render-only change; `npm run simulate` unaffected —
  headless, no ambient scene — left from the prior harbor entry, all 8 green).
- Playwright (throwaway `--no-save`, reverted out of package.json): same
  low-angle traditional-small view that previously showed a boat sitting on the
  left "2:1" dock now shows that dock clear, with the boat riding higher/further
  out on open water; title screen screenshot unchanged. Zero page errors.

### Notes / scope
- Only `src/scene/Ambient.tsx` + `src/scene/GameScene.tsx` (+ spec/progress)
  touched. `boatDistance` is additive/optional so the shared `Ambient` stays
  safe for the title screen. If boats ever look too far on huge boards, tune the
  `boardRadius * 2.5 + 5` in GameScene (title is independent).

---

## 2026-07-24 — Harbor rework: moored boat + consistent dock frame + bridge fix

### What changed (user screenshot: まだボートとドックが一体化 → ボートとドックっぽくして)
The user's close-up showed the REAL problem: the dock itself read as a
boat/dock hybrid — the big square sign looked like a sail on a hull, and a
bridge deck sliced right through the sign. Two root causes found and fixed,
all in `src/scene/Ports.tsx`:

1. **Dock yaw was inconsistent per coast side (latent bug).** The old
   `yaw = port.angle + π` does NOT face a chosen local axis inward — the
   mapping flips with the port's angular position, so asymmetric dock parts
   (bollards, buoy) landed on random sides. Invisible while the dock was
   symmetric; fatal once it wasn't. New `yaw = 3π/2 − port.angle` maps the
   dock-local frame consistently: **+z = toward island, −z = open water,
   ±x = along the coast**. Sign faces the island everywhere.
2. **Bridges started at the platform CENTER**, so their decks cut across the
   landing and through the sign. Each bridge `from` is now offset 0.2 from
   the port center toward its node — decks land on the platform's island-side
   edge, never crossing the middle.
3. **A real moored boat** (`MooredBoat`): open rowboat hull (flat base + low
   walls + two benches) with a short mast and a furled beige sail, floating
   just off the seaward edge, tied to the two edge bollards by taut ropes.
   Gently bobs and rocks (`useFrame` on its own group). This makes "boat" and
   "dock" two clearly separate silhouettes.
4. **Flavor**: hanging sign sways softly (rotation.z sine); a barrel + crate
   of dockside cargo on the deck; bollards moved to the seaward edge (where
   the boat ties up); buoy repositioned beside the boat.

### Verified
- `npm run build` + all 8 `npm run simulate` configs pass.
- Playwright (throwaway `--no-save`, reverted): traditional small board —
  default view + low-angle + deep-zoom + 3/4 orbit: every harbor shows
  sign-on-mast at one end facing the island, V-bridges landing on the deck
  edge (no sign clipping), moored boat with furled sail + ropes on the sea
  side, buoy beside it; orientation consistent around the whole coast. Zero
  page errors on every shot.

### Notes / scope
- Only `src/scene/Ports.tsx` (+ spec/progress) touched. Render-only.
- The dock-local frame contract is now: **+z island / −z sea / ±x coast**
  (see the yaw comment in `PortDock`). Anything added to the dock must use it.
- If `vertexScore`/board Y levels change, bridge `from` offset (0.2) assumes
  the platform half-depth 0.21.

---

## 2026-07-24 — Harbor polish: raise sign, lower boat/buoy, raise sea level

### What changed (user: 旗が沈んでる→上げて / 舟とボールが浮きすぎ→少し低く / 水位が低すぎて不自然に浮く→上げて)
Three coupled height tweaks. Root cause of the "floating" look: the island
base is at y=0 but the sea sat at y=−0.16, so the whole island (and the harbor
boat/buoy, which sat even higher at y≈0.02–0.05) hovered above the water.

1. **Sea level raised — gameplay only.** `src/scene/Ambient.tsx`: `Water` gains
   a `level` prop (default `DEFAULT_WATER_LEVEL = −0.16`); both the surface mesh
   and the dark underlayer (`level − 0.14`) follow it. `Ambient` gains a
   `waterLevel` prop (same −0.16 default) threaded to `Water`. New exported
   `GAMEPLAY_WATER_LEVEL = −0.03` (island base ≈ 0, so the coastline now just
   meets the sea). `src/scene/GameScene.tsx` passes it. **Frozen title
   unchanged**: `TitleScene` calls `<Ambient boardRadius={6.3} />` with no
   `waterLevel` → default −0.16 (verified byte-for-byte).
2. **Circling boats follow the sea.** The ambient `Boat` now takes a `baseY`
   and floats at `waterLevel + 0.11` (preserves the old −0.05 freeboard at the
   title's −0.16 level; lifts with the raised gameplay sea so they don't sink).
3. **Harbor boat + buoy lowered to the waterline.** `src/scene/Ports.tsx`
   imports `GAMEPLAY_WATER_LEVEL` and derives `BOAT_Y = level − 0.01`,
   `BUOY_Y = level + 0.02` (used for both the static position and the bob
   baseline). Net: the moored boat's hull now sits at the sea surface and the
   buoy rides half-submerged — the "little lower" the user asked for is small
   in absolute terms (~0.06) because the sea coming up does most of the work.
4. **Sign raised clear of the deck.** Mast post `y 0.36→0.42` (top now 0.78),
   arm `0.66→0.76`, sign group `0.4→0.50` (bottom 0.24, ~0.10 above the deck
   top at 0.14) so the flag no longer dips into the planking.

### Verified
- `npm run build` + all 8 `npm run simulate` configs pass (render-only).
- Playwright (throwaway `--no-save`, reverted): traditional small board,
  default + low-angle close-ups — island/docks now sit in the sea (coastline
  meets water, no floating cliff), signs hang high & clear of the deck, moored
  boat + red buoy ride at the waterline; **title screen screenshot unchanged**.
  Zero page errors.

### Notes / scope
- `Ambient.tsx` is shared with the frozen title — the water/boat changes are
  gated behind props that default to the original values, so only the gameplay
  screen (which passes `waterLevel`/`boatDistance`) is affected.
- Harbor boat/buoy heights are tied to `GAMEPLAY_WATER_LEVEL` via the imported
  constant, so re-tuning the sea level moves them together. If the island base
  (hex prism at y=0) ever changes, revisit `GAMEPLAY_WATER_LEVEL`.

---

## 2026-07-24 — Harbor boat: bigger, seated lower (no bob-float), ropes re-pinned

### What changed (user: 揺れると浮きすぎる時ある / 船もうちょっとだけでかく / 紐がズレないよう注意)
The moored boat sometimes lifted into an air gap during the bob, because its
rest height put the hull bottom slightly ABOVE the sea's rest level and its own
bob (±0.015, out of phase with the sea's ±0.03 swell) pushed it higher. Fixed
in `src/scene/Ports.tsx` (only file touched):
- **Seated lower + calmer.** `BOAT_Y = GAMEPLAY_WATER_LEVEL − 0.055` (was
  −0.01), so the hull bottom rests ~0.025 below the sea surface; bob amplitude
  cut 0.015→0.005 and roll 0.03→0.02. The boat now stays in the water through
  the swell instead of floating, while its hull still shows above the line.
- **A little bigger.** Hull + rigging wrapped in a `<group scale={1.2}>`
  (`BOAT_SCALE`). The **ropes are kept OUTSIDE that scale** (siblings of the
  scaled group) so scaling can't drag their ends off the bollards.
- **Ropes re-pinned to the bollards.** Because the boat dropped, the ropes were
  recomputed for the new depth: `ropeGeo` length 0.31→0.32, position
  `[±0.1, 0.185, 0.215]→[±0.1, 0.222, 0.22]`, rotation.x `−0.36→−0.478`. Their
  far ends land at boat-space `[±0.1, 0.295, 0.36]`, i.e. exactly the seaward
  bollards `[±0.1, PLATFORM_TOP+0.07, −0.16]` (verified by the endpoint math).
  With the tiny bob the boat barely moves, so the ropes stay pinned.

### Verified
- `npm run build` + all 8 `npm run simulate` configs pass (render-only).
- Playwright (throwaway `--no-save`, reverted): traditional small board — very
  low, deep-zoom close-ups across several bob phases show the boat holding a
  steady waterline (no lift/air gap), the larger hull reading clearly, and the
  two ropes spanning hull→bollards on the seaward side. Default + seaward-side
  views clean. Zero page errors.

### Notes / scope
- Only `src/scene/Ports.tsx` (+ spec/progress). `Ambient.tsx` untouched this
  round, so the frozen title screen is unaffected by definition.
- Rope geometry is hand-tuned to `BOAT_Y` + `BOAT_SCALE` + the bollard position.
  If any of those change, recompute the rope length/position/rotation so the far
  end still lands on `[±0.1, PLATFORM_TOP+0.07, −0.16]` (dock-local).

---

## 2026-07-24 — Buoy bob calmed (stop it rising above the water)

### What changed (user: ボールがうえに行き過ぎるときがある → 周波数/amp ちょい低く)
The harbor buoy occasionally rose above the sea surface at the top of its bob
(its peak sat higher than the water's trough). Calmed the bob in
`src/scene/Ports.tsx` (one line): amplitude `0.03→0.015` and frequency
`1.4→1.1` in the buoy's `useFrame`. Peak rest height drops from `BUOY_Y+0.03`
(0.02) to `BUOY_Y+0.015` (0.005), so the buoy now sits steadily at the
waterline through the swell. `BUOY_Y` unchanged.

### Verified
- `npm run build` + all 8 `npm run simulate` configs pass (render-only).
- Playwright (throwaway, reverted): deep-zoom close-ups across 8 bob phases show
  the buoy holding a steady waterline (no lift-off). Zero page errors.

### Notes / scope
- Only `src/scene/Ports.tsx` touched (a single animation line). Spec §4 already
  describes a gently-bobbing buoy accurately, so no spec change was needed.

---

## 2026-07-24 — Sea level nudged up slightly + moored boat decoupled from it

### What changed (user: 海の水位若干だけ上げて)
- Raised the gameplay sea level a touch: `GAMEPLAY_WATER_LEVEL −0.03 → −0.02`
  (`src/scene/Ambient.tsx`), so the coastline/island sits a hair lower in the
  sea. The free-floating buoy and the circling ambient boats follow it (they're
  derived from the constant), staying at the waterline.
- **Decoupled the moored harbor boat from the sea level** to protect the rope
  alignment (the user's recurring concern). Previously `BOAT_Y =
  GAMEPLAY_WATER_LEVEL − 0.055`, so raising the sea lifted the boat and dragged
  the rope far-ends off the fixed dock bollards. Now `BOAT_Y = −0.085` (a fixed
  constant == the old value at the −0.03 level), matching the real "boat held by
  taut ropes to a fixed dock" model: the boat stays put and the sea just laps a
  little higher on its hull. **Ropes are byte-for-byte unchanged and still land
  on the bollards.**

### Verified
- `npm run build` + all 8 `npm run simulate` configs pass (render-only).
- Playwright (throwaway, reverted): default view shows the island sitting
  slightly lower in a higher sea; harbor close-up confirms the boat a touch more
  submerged (hull still above the line) with its ropes still meeting the
  bollards. Zero page errors. Spec §4 updated (boat now moored at a fixed
  height, not sea-tracking).

### Notes / scope
- `Ambient.tsx` change is the shared water level, but gated behind the
  `waterLevel` prop → frozen title still uses `DEFAULT_WATER_LEVEL −0.16`,
  unaffected. Harbor boat height is now an absolute constant; only the buoy +
  ambient boats track `GAMEPLAY_WATER_LEVEL`. If the sea level is nudged again,
  the boat/ropes need no change; only reconsider `BOAT_Y` if the boat looks too
  submerged.

---

## 2026-07-24 — Boat enlarged + raised (it looked submerged after the sea raise)

### What changed (user: 舟が水没するので大きさを少し上げてから位置を上げて)
After the sea level went up (−0.03→−0.02) with the boat pinned at a fixed
height, the hull sat too deep. Per request, made the boat bigger AND raised it
(`src/scene/Ports.tsx` only):
- `BOAT_SCALE 1.2 → 1.35` (a little larger).
- `BOAT_Y −0.085 → −0.072` (raised ~0.013) so the hull walls sit clearly above
  the −0.02 sea surface again — no longer submerged.
- **Ropes recomputed** for the new height + scale (raising the boat would
  otherwise pull the rope ends off the fixed bollards): `ropeGeo` length
  0.32→0.30, position `[±0.1, 0.222, 0.22]→[±0.1, 0.2235, 0.224]`, rotation.x
  `−0.478→−0.4064`. Far ends land at boat-space `[±0.1, 0.282, 0.36]` == the
  seaward bollards `[±0.1, PLATFORM_TOP+0.07, −0.16]` (verified by the endpoint
  math and screenshots).

### Verified
- `npm run build` + all 8 `npm run simulate` configs pass (render-only).
- Playwright (throwaway, reverted): deep-zoom close-ups across 5 bob phases —
  the larger boat holds a steady waterline with its hull walls above the surface
  (not submerged, no lift-off), and both ropes still meet the bollards. Zero
  page errors. Spec §4 wording updated (hull walls above the waterline).

### Notes / scope
- Only `src/scene/Ports.tsx` (+ spec/progress). The rope constants are tuned to
  `BOAT_Y` + `BOAT_SCALE` + the fixed bollard `[±0.1, PLATFORM_TOP+0.07, −0.16]`
  — change any of those three and recompute length/position/rotation so the far
  end still lands on the bollard.

---

## 2026-07-24 — Cellular-noise (Worley) wave surface on the water

### What changed (user request: 水面に波を作ってほしい、セルラーノイズで)
Replaced the flat, whole-plane-bobbing sea with a real rippling surface driven
by cellular (Worley) noise. All in `src/scene/Water` (`src/scene/Ambient.tsx`);
shared by both the title (frozen) and gameplay (frozen) screens — done on
explicit user request with a matching spec update.

- **Geometry:** the sea plane was a fan `circleGeometry` (48 seg) with **no
  interior vertices**, so it could only bob as a whole. Swapped to a subdivided
  `RingGeometry(0.01, radius*6, 120, 44)` — keeps the circular silhouette but
  its concentric phi-segments give interior vertices to displace.
- **Shader:** new `THREE.ShaderMaterial` with inline GLSL (`WATER_VERT` /
  `WATER_FRAG`). Vertex shader computes a 2-octave animated Worley height field
  (`cellular()` returns F1/F2; feature points drift with `uTime`) over **world
  XZ**, displaces `position.z` (local +Z → world up after the −90° X rotation),
  and derives a per-vertex normal from the field gradient (neighbor samples).
  Fragment shader does diffuse + a specular glint (light dir = scene key light
  [10,18,6]) and paints foam (`uColorCrest`) where cells border (F2−F1 small),
  biased toward crests. Colors chosen to sit near the old `#1c6ba0`
  (deep `#0e5482` / shallow `#2a86be` / foam `#c6e6f4`), `transparent`
  opacity 0.93 preserved. `uTime` advanced in `useFrame`.
- Removed the old per-frame whole-plane vertical bob (the in-shader swell
  replaces it). The darker `#0c3f63` underlayer circle is unchanged. Raycast
  still disabled (never blocks input). Boats/clouds/Ports untouched.
- `spec.md` §2 (title) and §4 (gameplay) water descriptions updated in the same
  commit.

### Verified
- `npm run build` (tsc + vite) passes; `npm run simulate` reaches a winner on
  all 8 configs (render-only change; simulate is headless).
- Playwright (throwaway install, pre-installed Chromium, reverted out of
  package.json — `git status` shows only `Ambient.tsx` + spec/progress):
  title screen renders the animated Worley waves with foam crests and specular
  glints over the sea; **zero page errors**, so the shader compiles and runs in
  WebGL. Gameplay uses the identical `Water` component (only the sea level
  differs), so it inherits the same surface.

### Gotchas / notes
- `Water` is shared by title + gameplay; there is no per-screen wave toggle —
  changing the shader changes both. Both are frozen, so only touch on explicit
  request + spec update.
- Cellular displacement REQUIRES interior vertices — do not revert the sea to
  `circleGeometry` (a fan has none). If you rescale the board, the ring already
  tracks `radius`; retune `amp`/frequency in `WATER_VERT` if the swell reads too
  strong/weak. `cameraPosition` in the frag shader is a three built-in uniform.

---

## 2026-07-24 (2) — Water: higher resolution, pastel palette, toon shading

### What changed (user request: もっと解像度高くして 色を薄くしてパステリーな感じでトゥーン)
Follow-up to the same-day Worley wave surface, refining its look per user
feedback. All in `src/scene/Ambient.tsx` (`Water`), same shared component as
before (title + gameplay, both frozen, changed on explicit request).

- **Resolution:** `RingGeometry` bumped 120×44 → 200×72 segments (finer mesh
  to carry the displacement). Added a **third, finer noise octave**
  (`cellular(w * 1.15 + 11.0)`, weight 0.12) on top of the existing two, so the
  wave pattern reads with more small-scale ripple detail; normal-sample epsilon
  tightened 0.4 → 0.25 to resolve the finer bumps. Base amplitude trimmed
  0.17 → 0.16 to offset the added octave's extra height.
- **Pastel palette:** `uColorDeep` `#0e5482`→`#a3d3ec`, `uColorShallow`
  `#2a86be`→`#dcf1f8`, `uColorCrest` `#c6e6f4`→`#ffffff` (bright, lighter,
  lower-saturation blues); opacity 0.93→0.9. Underlayer circle color
  `#0c3f63`→`#7bb0cf` to match (avoids a harsh dark ring showing through the
  now-light, semi-transparent surface at the edges).
- **Toon/cel shading (fragment shader):** diffuse term quantized to 4 hard
  bands (`floor(diff*4+0.5)/4`) instead of a continuous gradient; specular
  swapped from a smooth `pow` falloff to a binary `step` (crisp glint, no
  soft highlight); depth-based deep/shallow color mix quantized to 3 bands;
  foam border changed from a soft `smoothstep` blend to a hard `step` edge
  (no gradient) — the whole surface now reads as flat-shaded cel bands with
  crisp foam lines instead of a smooth PBR-ish gradient.

### Verified
- `npm run build` passes; `npm run simulate` reaches a winner on all 8 configs
  (render-only change).
- Playwright (throwaway install + preview server, both reverted — `git status`
  shows only `Ambient.tsx` + spec/progress): title screen screenshots (two,
  ~1.5s apart) show a light pastel-blue/white toon sea with a visibly finer,
  hard-edged cellular pattern and animated foam lines; zero page errors.

### Notes
- Same gotcha as the first Worley entry: `Water` is shared by title + gameplay,
  no per-screen toggle. `spec.md` §2/§4 updated in the same commit to describe
  the resolution/palette/toon changes.

---

## 2026-07-24 — Gameplay visual polish: calmer water drift + brighter scene lighting

### What changed
Two small, user-requested tweaks scoped to the gameplay screen only (§4,
FROZEN):

- **Water noise drift frequency, slightly slower.** `Water` (`Ambient.tsx`)
  now takes a `driftSpeed` prop (`uDriftSpeed` uniform) controlling the
  `sin(uTime * uDriftSpeed + ...)` cell-drift term in `WATER_VERT`. Default is
  `0.55` (byte-for-byte the original constant), so the frozen title screen —
  which calls `<Ambient boardRadius={6.3} />` with no override — is
  unaffected. `GameScene.tsx` passes `GAMEPLAY_WATER_DRIFT_SPEED = 0.4` via a
  new `waterDriftSpeed` prop threaded through `Ambient` → `Water`, giving the
  gameplay sea a calmer swell without touching the title's water.
- **Gameplay scene lighting, slightly brighter.** `GameScene.tsx`'s
  `ambientLight`/`directionalLight` intensities bumped a touch (0.75→0.85,
  1.35→1.5, 0.3→0.35) so `MeshStandardMaterial`-lit tiles/pieces/docks read
  closer to the water's brightness (the water shader has its own hardcoded
  toon lighting, untouched by scene lights, so it reads brighter than the
  rest of the board did before this). `TitleScene.tsx` has its own separate
  light values and was not touched.

### Verified
- `npm run build` and `npm run simulate` (all 8 configs) pass.
- Playwright screenshots: title screen unchanged (frozen reference intact);
  gameplay screen renders correctly with the calmer water and brighter
  tiles/pieces; before/after comparison confirmed the water shader (unlit by
  scene lights) was already the brightest element relative to tiles.

### Notes
- `spec.md` §4 updated in the same commit per the frozen-surface rule.
- Gotcha carried forward from the two Worley entries above: `Water` is shared
  by title + gameplay. This session added a per-screen prop (`driftSpeed`,
  mirroring the existing `level` prop pattern) instead of editing the shared
  shader constant directly, specifically to keep the frozen title screen
  byte-for-byte identical.

---

## 2026-07-24 — Title screen background world now regenerates periodically

### What changed
User explicitly asked for the title screen's background world to also be
"generated" (it already was, via `generateBoard`, but on a fixed seed
`HEXTOPIA-TITLE` — same island every load). Confirmed with the user via
`AskUserQuestion` which behavior they wanted: periodic switch to a new
random island (vs. one random island per page load) — they chose periodic
switch.

- `src/scene/TitleScene.tsx`: island seed is now React state, starting at
  the original `HEXTOPIA-TITLE`. Every 45s (`WORLD_SWITCH_MS`) it swaps to
  a freshly random seed (`HEXTOPIA-TITLE-<random>`), hidden behind a 0.9s
  cover-fade (`FADE_MS`) so the swap never pops mid-frame. Camera orbit,
  lighting, water, and everything else is untouched.
- `src/styles.css`: added `.title-scene-fade` / `.title-scene-fade-covered`,
  a title-screen-local overlay (matches the scene's fog/sky color
  `#9cc4de`) — not touching the shared `.scene-bg` class also used by the
  gameplay screen.
- `spec.md` §2 updated in the same commit per the frozen-surface rule: the
  title screen is still "first-commit look, FROZEN", but now documents the
  fixed-seed start + 45s randomized regeneration as an explicitly kept
  addition (alongside the language toggle).

### Verified
- `npm run build` and `npm run simulate` (all 8 configs) pass.
- Playwright: loaded the dev build, screenshotted the title screen, waited
  ~46s (one full switch + fade cycle), screenshotted again — the island
  layout is visibly different (different resource/number-token
  arrangement) after the fade, with zero console/page errors across the
  wait.

### Notes / gotchas
- `Tiles` already takes `seed` as a prop and re-keys cleanly on change; no
  internal caching issues swapping seeds at runtime.
- Kept the *first* island on the exact original fixed seed so the very
  first frame a user sees is unchanged from before — only later swaps use
  random seeds.

---

## 2026-07-24 — Title screen vignette recolored, then fully removed

### What changed
User reported a black haze behind the title text, distinct from the logo's
drop shadow. Traced it to `.title-overlay`'s `background: radial-gradient(...)`
in `src/styles.css` — a dark vignette behind the title block/buttons, present
since the first commit.

- First pass: asked the user remove-vs-recolor; they chose recolor. Changed
  the vignette from near-black `rgba(4,10,18,0.55)` to `rgba(16,30,46,0.55)`
  (the same navy as `--panel-lite` elsewhere in the UI).
- Follow-up: user asked to try removing it outright ("一旦黒いもや消してみて").
  Deleted the `background` line from `.title-overlay` entirely — no vignette
  behind the title block now, logo drop-shadow filter untouched.

### Verified
- `npm run build` and `npm run simulate` (all 8 configs) pass after the
  removal.
- Playwright screenshot confirms the vignette is gone and the logo's own
  drop shadow is unaffected.

### Notes
- `spec.md` §2 updated in the same commit per the frozen-surface rule (now
  describes no vignette, replacing the earlier recolor note).

---

## 2026-07-24 — Shoreline surf foam at the tile/water contact line

### What changed (user request: タイルと海の間、波打ち際の接点から外側に広がり外に向けて薄くなる細かいセルラーノイズ)
`src/scene/Ambient.tsx` (`Water`, shared by the frozen title + gameplay
screens — same shared-component pattern as every prior water-shader change):

- **Vertex shader**: new `uniform float uRadius` (the island/coast radius,
  same value already used to size the sea ring geometry) and a new varying
  `vShoreDist = length(worldXZ) - uRadius` — signed distance outward from the
  land/water contact ring, computed once per vertex and interpolated.
- **Fragment shader**: a second, independent, higher-frequency Worley field
  (`shoreCellular`, own `shoreHash2`, frequency ×3.4 vs. the swell's ×0.18–
  ×1.15) samples `vWorldPos.xz` to produce a fine surf-lace pattern
  (`step(F2-F1, 0.2)`), gated by a `shoreBand` factor: `smoothstep(-0.08,
  0.06, vShoreDist)` (off well inside the island, on right at/after the
  coast) × `1 - smoothstep(0, uShoreWidth, vShoreDist)` (fades to 0 by
  `uShoreWidth` units outward). Mixed into the existing toon-shaded color
  with `uColorCrest` (the same white used for the open-water cell-border
  foam) — a distinct, finer lace anchored exactly at the coastline instead
  of scattered wherever Worley cells border in open water.
- **`Water` component**: added `uRadius`/`uShoreWidth` uniforms
  (`uShoreWidth = radius * 0.16`), kept in sync via a `useEffect` on
  `[mat, radius]` — same pattern already used for `uDriftSpeed`, so the
  shader material itself is still created once (`useMemo(..., [])`).
- No JS uniform wiring needed for `uTime`/`uDriftSpeed` in the new fragment
  function — three.js `ShaderMaterial` shares one `uniforms` object across
  both shader stages, so declaring the existing uniform names in the
  fragment shader was enough to reuse the vertex shader's animated drift.

### Verified
- `npm run build` passes; `npm run simulate` reaches a winner on all 8
  configs (render-only change).
- Playwright (throwaway `npm install -D playwright --no-save` against a
  `vite preview` server, both reverted after — `git status` shows only
  `Ambient.tsx` + spec/progress): title screen and a freshly generated
  gameplay board both show a fine white lace band hugging the coastline,
  fading to nothing a short distance out over open water; the existing
  open-water cell-border foam, board layout, HUD, and tokens are visually
  unchanged; zero page errors on either screen.

### Notes / scope
- Only `Ambient.tsx` (+ spec/progress) touched — no geometry, camera, HUD,
  or game-logic changes. Frozen title + gameplay screens both changed (this
  shader has no per-screen toggle, per the established pattern from every
  prior Worley/water entry above); `spec.md` §2 and §4 updated in the same
  commit.
- If the coast ever stops being well-approximated by `boardRadius` (e.g. a
  non-circular island shape), `uShoreWidth`'s `radius * 0.16` heuristic and
  the `vShoreDist` radial-distance math would need revisiting — currently
  matches the same `radius` value already trusted for boat/dock placement
  elsewhere.
