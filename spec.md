# spec.md — HEXFALL 仕様書 (Single Source of Truth)

Game title: **HEXFALL** (renamed from HEXTOPIA by user request; internal
identifiers like localStorage keys and the title-scene seed keep the old
name so existing saves survive).

This file is the contract for what HEXFALL is. When code and spec disagree,
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

## 2. Title screen — first-commit look, FROZEN ✅

**The atmosphere of the repository's first commit (07d9086) is the spec.**
Keep it exactly as-is; the later additions kept are the language toggle, the
periodic background-world regeneration below, and the shared-world environment
settings (next bullet).

- **Environment settings match the gameplay screen** so the title reads as the
  same world, not a separate demo. The title scene uses the gameplay values for
  water level (`GAMEPLAY_WATER_LEVEL`), island sink (`GAMEPLAY_BOARD_SINK`, so
  the coastline dips just below the raised waterline), water drift speed (the
  calmer `0.4` swell), scene lighting (ambient + the warm key light + a cool
  `#a8c8ff` fill directional light), fog (`24`–`60`), sky (`sunPosition
  [60,40,20]`, `rayleigh 1.6`), camera FOV (`48`), and `dpr` (`[1, 1.75]`). The
  title keeps its own identity where it differs on purpose: the slowly
  auto-orbiting (non-interactive) camera and no harbors/docks.

- Animated 3D demo island with slowly auto-orbiting camera, atmospheric
  lighting, fog, sky, water (a cellular-noise / Worley wave surface,
  subdivided mesh (segment count tuned for performance) + a fine third
  noise octave for detailed ripples,
  cel/toon-shaded in hard bands with a crisp foam edge, pastel blue/white
  palette; a second, finer independent Worley field lays a surf-foam lace
  that follows the actual hex-tile coastline — a hexagon-SDF distance field
  over the outer-ring tiles, so the foam hugs the jagged tile edges rather
  than a circle — spreading outward from each tile edge and fading out with
  distance, a distinct wave-break band from the open-water foam), boats,
  drifting clouds. Nothing more (no particles, birds, or launch transitions
  — tried and rejected by the user).
- The demo island uses the same refined tile surface as gameplay: each hex has
  a subtly crowned centre that slopes gently toward its six edges, with a
  narrow, irregular sandy beach band. Pastel biome colours transition into
  sand through a few crisp, faceted colour steps shaped as nested regular
  hexagons parallel to the tile outline (never a circular radial spread), for
  a stylized low-poly look (no realistic grain or wet-sand shading). The
  exposed tile sides are sandy. Each terrain uses three deterministic
  lightness variants arranged across the triangular facets: the exact base
  colour, base `+0.055` HSL lightness, and base `+0.110` HSL lightness. No
  darker-than-base variant is generated. Base colours: forest `#138239`,
  fields `#CBB34F`, mountains `#858892`, pasture `#91BC5E`, hills `#B45D30`,
  and desert `#B45D30`. The title diorama applies the same additional `+0.12`
  HSL lightness lift as gameplay, so both 3D worlds share the deliberately pale
  palette. The setup SVG preview retains the exact unlifted base colours.
- The island starts on a fixed seed (`HEXTOPIA-TITLE`), then every 45s
  regenerates into a freshly, randomly seeded procedural island, hidden
  behind a ~0.9s cover-fade (`src/scene/TitleScene.tsx`) so the background
  world never looks static — same generator (`generateBoard`) the real game
  uses, just never persisted or played on.
- Centered title block: kicker line, "HEXFALL" logo (gradient, drop
  shadow, idle bobbing), subtitle. No vignette behind the block — the
  original near-black radial-gradient read as a stray dark haze distinct
  from the logo's own drop shadow, and was removed by user request.
- Large gold `START GAME` (click sound, starts music); `CONTINUE GAME` +
  `reset save` appear only when a valid save exists; footer tagline.
- Language toggle (EN / 日本語) top-right — the sole permitted overlay.

## 3. Setup screen — "Configure Your World" (初代 design), FROZEN ✅

**Modeled on the user's original first-generation deployment** (reference
screenshots in the 2026-07-22 PROGRESS entry). Single-column, mobile-first
(max-width ~620 px centered on desktop), flat sections with bold headings —
not a card-grid form.

Order, top to bottom:

1. Header row: `← Back` button, `Configure Your World` heading, language
   toggle at the right.
2. **World Preset** — a custom dropdown that bundles the chaos modifiers into
   escalating flavors; **Banger** is the default. The trigger shows the active
   preset; opening it reveals a styled floating menu where each preset is a row
   (emoji + name + short description), the active one gold-highlighted with a
   ✓. Picking one applies its full set of toggles below (a caption under the
   dropdown describes the selection); tweaking any individual modifier
   afterward shows a "Custom" label on the trigger. The presets:
   - 🌾 **Normal** — really just plain Catan: every chaos modifier and
     World Events off, and the classic Traditional Numbers + Ports layout on.
   - 🔥 **Banger** (default) — pleasantly weird: World Events + NPC Drama on.
   - 💥 **BANGER CORE** — a bit weirder: Banger + Golden Hex + Crazy Cards.
   - 🌋 **BANGER MAXXING** — every chaos element maxed: all modifiers on.
3. **Live map preview** — an SVG render of the *exact* board the current
   seed + size will generate: terrain-colored pointy-top hexes with number
   tokens (red for 6/8, desert blank). Caption `Live preview · seed XXX`.
   When Golden Hex is enabled the chosen tile is outlined gold with a ✨.
4. **Map Size** — segmented control, each option label + `N Tiles`
   sublabel; the selected option is a solid gold pill.
5. **Board Layout** — a 2-column grid of toggle cards (same style as the
   Chaos Modifiers): 🔢 Traditional Numbers and ⚓ Traditional Ports. When on,
   the board uses the classic Catan layout instead of the procedural one
   (see §5); the live preview reflects Traditional Numbers. The World Preset
   drives these too: **Normal** turns both on (plain Catan is the classic
   layout); every other preset turns both off. Tweaking either card by hand
   drops the preset to "Custom" (like the Chaos Modifiers). Default (Banger)
   is both off.
6. **Opponents: N** — slider 1–3 with player-color dots below
   (you + N rivals).
7. **Difficulty** — chill / normal / ruthless in the same segmented style.
8. **Victory Points: N** — slider 7–20 with a caption: ≤8 "Quick
   skirmish", 9–11 "Standard game", ≥12 "Long march".
9. **Seed** — text input + 🎲 randomize. Same seed ⇒ same world, same
   rivals, same golden tile.
10. **Chaos Modifiers** — a 2-column grid of toggle cards (emoji, bold
    name, short description; gold border when active): ⚡ Turbo Economy,
    🌪️ World Events, ✨ Golden Hex, 🥺 Friendly Robber, 🎭 NPC Drama,
    🐑 Maximum Sheep, 🃏 Crazy Cards. Warning box when ≥2 economy-affecting
    modifiers are active. The **World Preset** selector (item 2) is a
    shortcut over exactly these toggles plus the Board Layout pair (item 5).
11. **Rival personality chips** — one pill per joining rival
    (emoji + personality label; deterministic from the seed).
12. Full-width gold `GENERATE WORLD →` button (build sound, starts
    immediately).

## 4. Gameplay screen — FROZEN ✅

**The current implementation is the reference and is considered final.**
Do not change its layout, visuals, or interactions without an explicit user
request AND a matching update to this section. Its defining elements:

- 3D board: biome-decorated hex tiles with a subtly crowned centre and a mild
  outward slope; every tile transitions through a narrow, irregular,
  pastel sand-beach band at its edge using crisp triangular low-poly colour
  facets arranged in nested regular-hex bands parallel to the tile outline
  (not circular radial bands), rather than realistic grain/wet shading, with
  sandy exposed sides. Each terrain's facets use three deterministic
  base-or-lighter variants (exact base, `+0.055`, `+0.110` HSL lightness;
  never darker than base): forest `#138239`, fields `#CBB34F`, mountains
  `#858892`, pasture `#91BC5E`, hills `#B45D30`, desert `#B45D30`
  — then both the gameplay and title renderers add a further `+0.12` HSL
  lightness lift to every top facet and the sandy tile side for deliberately
  pale, strongly pastel 3D worlds. The setup SVG preview retains the base
  palette
  (the six shared edge/corner anchors keep their original height so roads,
  buildings, and harbors remain aligned); always-on-top number tokens
  (depthTest off, raised — never buried by decorations), robber piece,
  water (a cellular-noise / Worley wave surface — the sea plane is a
  subdivided mesh (segment count tuned for performance) vertex-displaced by
  an animated 3-octave Worley
  height field; cel/toon-shaded in hard bands from the field's gradient
  with a crisp specular glint and a hard-edged foam line where the cells
  meet, in a light pastel blue/white palette; a fine, independent Worley
  field lays a shoreline surf-foam lace along the ACTUAL tile silhouette
  (a hexagon-SDF distance field over the outer-ring/coastal tiles, so the
  foam follows the jagged hex tile edges, not a circle) that spreads
  outward from each tile edge and fades with distance, distinct
  from the open-water cell-border foam; raised on the gameplay
  screen so the island + docks sit IN the sea rather than floating above
  it, and on the gameplay screen the whole board (tiles + everything riding
  on the tile tops — decorations, tokens, robber, buildings, highlights,
  production FX) is lowered a little so the coastline dips just below the
  waterline instead of hovering above the surf-foam ring; the docks/boats and
  the water are not lowered, and the coastal bridge nodes drop with the shore
  so the piers still meet it — the frozen title keeps the original sea level
  and board height; the cell drift runs at
  a slightly slower time frequency than the title screen's water for a calmer
  swell)/boats (slightly
  enlarged for presence; kept well offshore so they
  read as open-water vessels and don't visually merge with the harbor docks)/
  clouds, orbit/zoom/pan camera. Scene lighting (ambient + both directional
  lights) is a touch brighter than the title screen's so tiles/pieces/docks
  read closer to the water's brightness instead of looking dim next to it.
  with soft auto-focus on events. (Desktop: WASD glides the view horizontally
  along the ground relative to the camera's facing direction — W forward,
  S back, A/D strafe — and takes precedence over auto-focus while held; the
  target is clamped to the playfield so the board can't be lost.)
  (Amendment: when the Golden Hex modifier is on, the golden tile carries a
  static gold ring so the wildcard tile is identifiable.)
  (Amendment: coastal harbors render as small docks with a hanging "N:1"
  sign out on the water. Each dock is a solid wooden landing platform (乗り場)
  standing on four support pilings (足場) that sink into the water. All docks
  share a consistent local frame (island side vs. open-water side): two
  mooring bollards sit on the seaward edge, and a small **moored rowboat**
  (open hull, benches, short mast with a furled beige sail) sits just off that
  edge, tied to the bollards by two taut ropes — so every harbor reads as a
  distinct boat AND dock, never one merged silhouette. The boat is held at a
  fixed height by its mooring ropes to the dock (it does not track the sea
  level, so the ropes always meet the bollards) and only bobs slightly, seated
  in the sea through the swell (no air gap) with its hull walls clearly above
  the waterline; the free-floating owner's buoy does ride the sea surface.
  A barrel + crate of dockside cargo sit on the deck. The sign hangs from a
  raised mast at one end of the platform — high enough that it clears the deck
  planking — faces the island, sways gently in the breeze, and is
  large enough to read the rate + resource from the default camera, reading
  correctly (non-mirrored) from either side. Two wooden plank bridges (with
  side rails + corner posts) span from the platform's island-side edge (not
  its center, so they never cut through the sign) up to the two coastal nodes
  the harbor serves, so it reads at a glance which corners connect; a claimed
  harbor shows a ring + buoy in the owner's color (the buoy floats beside the
  moored boat; buoy bobs and boat rocks gently while the pier stays fixed). Hovering a dock shows
  its name and rate. As the camera orbits toward a near top-down view — where
  the vertical signs go edge-on — a dedicated flat, screen-facing DOM badge
  fades in over each harbor showing its trade ratio ("🪵 2:1" / "⚓ 3:1",
  border tinted to the owner's color when claimed); the badges fade back out
  as the view returns to the default/low angles.)
- Placement: valid spots glow as pulsing always-on-top rings (gold ring =
  high-value corner); edge spots glow as bars; hover shows a ghost preview;
  invisible enlarged hit targets for touch. No floating arrows (removed by
  user preference). Cancel via button + Esc.
- HUD: player chips top (portrait, VP, resource-card count, held dev-card count,
  🛣️ longest-road / ⚔️ largest-army badges, personality/civ title, turn state,
  threat glow, speech bubbles); resource hand + build cards + a dev-card row
  (buy button with deck-remaining count + playable/held held-card buttons) +
  roll / trade / end-turn bottom; chronicle log bottom-left; round + seed +
  settings top-right; toasts center-top; world-event banner; NPC offer popup
  with countdown.
  (Amendment: development cards — the dev-card row lets the human buy a card and
  play a held one; playing a card that needs a target opens the robber phase
  (Knight/Earthquake), a free-road placement (Road Building), or a resource-pick
  overlay (Monopoly/Year of Plenty/Treasure Haul). While a card is mid-play the
  UI shows its name + effect description and a **Cancel card** button; canceling
  before it resolves (robber not yet placed, no resource chosen, no free road
  placed) returns the card to hand and un-spends the turn's card play. A Knight
  only counts toward Largest Army once its robber is actually placed. NPCs
  resolve their own cards atomically. See §5 for the rules.)
- Dice ritual: two tumbling dice (decided-before-animation results, physics
  only presents), rare giant dice, skippable via fast mode + watchdog.

## 5. Core rules

- Resources: wood, brick, wheat, sheep, ore. Terrain maps 1:1 (desert none).
- Tokens 2–12 (no 7) with classic pip weights; 6/8 adjacency avoided
  (50 attempts, then accept).
- **Traditional Numbers** (Board Layout toggle, default off): instead of the
  random token layout, lay the classic Catan number sequence
  (5,2,6,3,8,10,9,12,11,4,8,10,9,4,5,6,3,11) over the land tiles in an
  outer→inner spiral, skipping the desert. On the 19-tile (small) board this
  reproduces the standard layout exactly; larger boards cycle the same
  sequence for the same feel. The seed rotates/reflects the classic board
  (picking among spiral starts/directions that keep 6/8 apart) rather than
  randomizing the numbers.
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
- **Development cards** (classic set, always available): bought for 1🪨 1🌾 1🐑,
  drawn from a per-match deterministic shuffled deck (seed `+':dev'`). Standard
  deck = 14 Knight, 5 Victory Point, 2 Road Building, 2 Year of Plenty, 2
  Monopoly. When the deck is empty, buying is unavailable. A card cannot be
  played the same turn it is bought, and at most one card is played per turn.
  - **Knight**: enter the robber phase (move + steal 1). Playing 3+ Knights (and
    the most) grants **Largest Army** = +2 VP, mirroring Longest Road (holder
    keeps ties).
  - **Victory Point**: +1 VP, applied immediately on draw (not a playable card).
  - **Road Building**: place 2 roads for free.
  - **Year of Plenty**: take any 2 resources from the bank.
  - **Monopoly**: name a resource; take all of it from every other player.
- **Crazy Cards** (chaos modifier `crazyCards`, off by default): when on, extra
  "unhinged" cards are shuffled into the deck (3 Treasure Haul, 3 Plague, 2
  Earthquake, 3 Wild Gamble):
  - **Treasure Haul** 💰: take any 3 resources from the bank.
  - **Plague** 🦠: every opponent discards 2 random resource cards.
  - **Earthquake** 🌋: move the robber and steal 1 from EVERY adjacent rival.
  - **Wild Gamble** 🎰: ~2/3 chance to gain 5 random resources, else lose up to 4.
- Dice 7 = robber: mover blocks a tile and steals 1 random card from an
  adjacent rival (no discard rule). Friendly Robber chaos: victim draws a
  consolation card.
- Golden Hex (chaos): one token tile, picked deterministically from the
  seed, additionally drops 1 random ("wildcard") resource per building hit
  whenever it produces. Announced in the log at match start.
- **Harbors / ports** (always on, standard Catan): generated on coastal edges
  (edges touching one tile), placed **evenly around the entire coast** (so
  harbors ring the whole island — no bare side), never sharing a vertex. The
  ring is rotated by a per-seed anchor. Per board there is (room permitting)
  one 2:1 harbor per resource + several generic 3:1 harbors (kinds randomized);
  count scales with the coastline (~4–9). A player
  controls a harbor while owning a building (settlement/city/megacity) on
  either of its two vertices, and then trades at that harbor's rate:
  generic = 3 identical → 1 any; resource = 2 of that resource → 1 any.
  `bankRate` returns the best rate available to the current trader (harbor
  vs. festival vs. Maximum Sheep vs. the 4:1 base).
  **Traditional Ports** (Board Layout toggle, default off): reproduces the
  real board's harbor ring. Harbors are placed **evenly around the entire
  coast** (never crammed into one arc), never sharing a vertex, and **anchored
  to the number-token frame** — harbor #0 sits nearest token tile "A" and the
  ring follows the token spiral's winding direction, so the harbor↔numbered-
  tile relationship matches the physical board instead of rotating on its own
  (when Traditional Numbers is off, the ring uses a stable per-seed
  orientation). Kinds run in the printed clockwise sequence — 3:1, wheat 2:1,
  ore 2:1, 3:1, sheep 2:1, 3:1, brick 2:1, wood 2:1, 3:1 (on the 19-tile board
  exactly the standard 9 harbors: 4 generic + one of each resource); longer
  coasts cycle the same sequence. Off = the default procedural harbors (same
  even ring, but per-seed rotation + randomized kinds).
  Flavor: each harbor gets a themed generated name; **claiming a harbor**
  (first settlement on a harbor vertex) fires a HARBOR WELCOME toast + a
  one-time +1 welcome card. Harbor vertices are worth extra in the AI/
  placement-hint scoring. Old saves (pre-harbor) simply have no harbors.
- Bank trade 4:1 (3:1 during Trade Festival; sheep 2:1 under Maximum Sheep).
  NPC trades evaluated deterministically (needs/surplus/personality); the UI
  shows an honest interested/unimpressed hint. NPCs may counter-offer the
  human (9 s expiry).
  Trade modal UX: a "Your resources" strip shows the human's current holdings
  of all five resources at the top (both tabs), and each give/receive picker
  button carries an owned-count badge so the player always sees what they hold
  while trading. On phones the modal fits the viewport and the NPC give/receive
  columns stack vertically instead of overflowing.
- Victory: first to the configured VP target (7–20, default 10), checked
  after every VP change. Match point is announced.

## 6. NPCs, events, presentation

- 6-NPC pool, personalities: expansionist / hoarder / trader / gambler /
  builder / sleeper. Heuristic AI (no search), personality-shifted.
- Difficulty scales NPC competence, not just their pool. **chill** rivals play
  deliberately badly: heavy positional noise makes them settle for clearly worse
  corners/roads, they frequently loaf a turn instead of building, they sometimes
  fritter a surplus away on a random bank trade, they block a near-random robber
  tile without hunting the leader, and they are easily talked into lopsided
  trades. **normal** keeps a light jitter; **ruthless** plays near-optimally
  (denial bonuses, minimal noise, tighter trades). Games stay completable at
  every level (softlock guards unchanged).
- Softlock guards: ≤14 AI actions per turn, dice-animation watchdog (4 s),
  setup fallbacks, auto turn advance. The game must never stall.
- World events (toggled via the 🌪️ World Events chaos card): resource boom,
  localized storm, trade festival, suspiciously productive sheep — announced
  with label/desc/duration, ≤2 rounds each.
- Combo toasts at 3+/5+/7+ resources in one roll and single-resource jackpot
  variants. Presentation only; gains are always logged. When a toast belongs to
  a specific player (production combos, mega city, road dominance, harbor
  welcome, match point, robber), the gold/red frame shows that player's color
  as thin bars on its inner left/right edges, so it's clear whose event it is.
- Near-win: tension vignette + music layer from target−2; match-point toast.
- Victory: confetti overlay, ranked results, useful + absurd statistics
  (including Largest Army and development cards bought), rematch (same seed) /
  new world / setup / title — all without refresh.

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
The UI font stack appends color-emoji fonts (Segoe UI Emoji / Apple Color
Emoji / Noto) so newer glyphs — notably 🪵 wood and 🪨 ore (Unicode 13) —
resolve to an emoji font on desktop instead of rendering as tofu boxes.
