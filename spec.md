# spec.md — HEXTOPIA 仕様書 (Single Source of Truth)

This file is the contract for what HEXTOPIA is. When code and spec disagree,
the spec wins — fix the code or explicitly change this file (same commit).
Workflow rules live in `CLAUDE.md`. `PLAN.md` is the original one-shot brief,
kept for reference only; anything promoted from it into gameplay must be
written here.

- Stack: Vite + React + TypeScript + react-three-fiber + zustand(immer)
- Deploys to Vercel with zero config. No server, DB, env vars, logins,
  external/remote assets, or CDN fetches. Everything is generated at runtime
  (geometry, canvas textures, names, Web Audio).
- Verification gate: `npm run build` passes AND `npm run simulate` reaches a
  winner on every config.

---

## 1. Screens & flow

`title → setup → game → victory → (rematch | new world | setup | title)`
— never requires a browser refresh.

## 2. Title screen

Must feel alive before any interaction:

- Animated 3D demo island (fixed seed `HEXTOPIA-TITLE`) with slowly
  auto-orbiting camera, atmospheric lighting, fog, sky.
- Ambient life: water, boats, drifting clouds, **rising golden particle
  motes**, and a **flapping bird flock** circling the island.
- Large gold `START GAME` button; `CONTINUE GAME` + `reset save` appear only
  when a valid save exists. Language toggle (EN / 日本語) top-right.
- Interaction feedback: hover plays a sound; START/CONTINUE trigger a
  **launch transition** (build sound + white radial flash + logo zoom-out,
  ~300 ms) before the screen switches.
- Title logo "HEXTOPIA" with gradient, drop shadow, and idle bobbing.

## 3. Setup screen (world configuration)

Must visualize how settings affect the game — not a plain settings form:

- **Map size** small/medium/large (19/37/61 hexes) with a pulsing hex-dot
  preview whose colors derive from the current seed.
- **Rivals** 1–3 NPCs. The full 6-NPC pool is listed; the rivals that will
  actually join (deterministic from seed + count) are highlighted gold, the
  rest dimmed. Tooltip shows personality + tagline.
- **Difficulty** chill / normal / ruthless.
- **Victory target** slider 7–14 VP with an estimated match length.
- **Seed** text field + randomize; same seed ⇒ same world and same rivals.
- **World events** toggle; **chaos modifiers** (Turbo Economy, Friendly
  Robber, Maximum Sheep, NPC Drama) with a warning when ≥2 are active.
- **Live match summary bar** above the footer: hex count, joining rival
  emojis, VP target, estimated minutes, seed, chaos count.
- `GENERATE WORLD` starts immediately (build sound). Language toggle in the
  header.

## 4. Gameplay screen — FROZEN ✅

**The current implementation is the reference and is considered final.**
Do not change its layout, visuals, or interactions without an explicit user
request AND a matching update to this section. Its defining elements:

- 3D board: biome-decorated hex tiles, always-on-top number tokens
  (depthTest off, raised — never buried by decorations), robber piece,
  water/boats/clouds, orbit/zoom/pan camera with soft auto-focus on events.
- Placement: valid spots glow as pulsing always-on-top rings (gold ring =
  high-value corner); edge spots glow as bars; hover shows a ghost preview;
  invisible enlarged hit targets for touch. No floating arrows (removed by
  user preference). Cancel via button + Esc.
- HUD: player chips top (portrait, VP, cards, personality/civ title, turn
  state, threat glow, speech bubbles); resource hand + build cards + roll /
  trade / end-turn bottom; chronicle log bottom-left; round + seed + settings
  top-right; toasts center-top; world-event banner; NPC offer popup with
  countdown.
- Dice ritual: two tumbling dice (decided-before-animation results, physics
  only presents), rare giant dice, skippable via fast mode + watchdog.

## 5. Core rules

- Resources: wood, brick, wheat, sheep, ore. Terrain maps 1:1 (desert none).
- Tokens 2–12 (no 7) with classic pip weights; 6/8 adjacency avoided
  (50 attempts, then accept).
- Setup phase: snake order, 2 settlements + 2 roads each; the 2nd settlement
  grants 1 resource per adjacent tile.
- Costs / VP:
  | Build | Cost | VP | Production |
  |---|---|---|---|
  | Road | 1🪵 1🧱 | — | — |
  | Settlement | 1🪵 1🧱 1🌾 1🐑 | 1 | 1 |
  | City | 2🌾 3🪨 | 2 | 2 |
  | Mega City | 3🪨 2🌾 2🐑 | 3 | 3 |
- Mega City additionally requires ≥6 owned roads; max 1 per player; grants a
  generated civilization title.
- Settlement distance rule (no adjacent vertex); non-setup settlements must
  touch an own road; roads must connect (opponent buildings block).
- Longest road: ≥5 segments, +2 VP, holder keeps ties.
- Dice 7 = robber: mover blocks a tile and steals 1 random card from an
  adjacent rival (no discard rule). Friendly Robber chaos: victim draws a
  consolation card.
- Bank trade 4:1 (3:1 during Trade Festival; sheep 2:1 under Maximum Sheep).
  NPC trades evaluated deterministically (needs/surplus/personality); the UI
  shows an honest interested/unimpressed hint. NPCs may counter-offer the
  human (9 s expiry).
- Victory: first to the configured VP target (7–14, default 10), checked
  after every VP change. Match point is announced.

## 6. NPCs, events, presentation

- 6-NPC pool, personalities: expansionist / hoarder / trader / gambler /
  builder / sleeper. Heuristic AI (no search), personality-shifted.
- Softlock guards: ≤14 AI actions per turn, dice-animation watchdog (4 s),
  setup fallbacks, auto turn advance. The game must never stall.
- World events (optional): resource boom, localized storm, trade festival,
  suspiciously productive sheep — announced with label/desc/duration, ≤2
  rounds each.
- Combo toasts at 3+/5+/7+ resources in one roll and single-resource jackpot
  variants. Presentation only; gains are always logged.
- Near-win: tension vignette + music layer from target−2; match-point toast.
- Victory: confetti overlay, ranked results, useful + absurd statistics,
  rematch (same seed) / new world / setup / title — all without refresh.

## 7. Language (EN / 日本語)

- `settings.lang`, persisted; default `ja` when `navigator.language`
  starts with `ja`, else `en`. Toggles on title, setup, and HUD settings.
- Static UI switches live. Dynamic text (log, toasts, NPC speech, events) is
  generated in the active language at event time; past log lines keep their
  original language.
- Procedural settlement names and civilization titles stay English on
  purpose (absurd proper nouns).
- Implementation: `src/i18n.ts` `[en, ja]` map + `t(key, params)`;
  components use `useT()`; `i18n.ts` must not import the store.

## 8. Persistence & audio

- Auto-save to localStorage after meaningful actions; wiped on game over.
  Restore sanitizes (never mid-animation, clears placement/offers/fx) and
  falls back gracefully on invalid data. Settings persisted separately.
- Audio is 100% procedural Web Audio: distinct pickup tones per resource,
  valid/invalid cues, dice, fanfares, NPC blips, generative ambient music
  with a tension layer. Independent sliders: master / music / fx / NPC
  voices. The game must work fine with audio unavailable or muted.

## 9. Reliability requirements

Install / dev / build / Vercel deploy succeed with zero config; all map
sizes generate; full games reach a winner (human or all-NPC); invalid
placement rejected; turn progression can never permanently stall; restart
and refresh never corrupt state; mobile (≥390 px) layout stays usable.
