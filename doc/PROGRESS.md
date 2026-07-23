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
