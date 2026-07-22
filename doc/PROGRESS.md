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
