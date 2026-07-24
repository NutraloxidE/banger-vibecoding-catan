# AGENTS.md

HEXFALL (formerly HEXTOPIA) — a complete, playable, visually excessive 3D hex strategy game
(Catan-like). Vite + React + TypeScript + react-three-fiber. Deploys to
Vercel with zero configuration (no server, DB, env vars, or external assets).

## Development workflow — `spec.md` is the Single Source of Truth

Follow this order at the start of EVERY session / task:

1. **Read `AGENTS.md`** (this file) — conventions and commands.
2. **Read `doc/PROGRESS.md`** — catch up on what was done, what is in
   flight, and known issues.
3. **Read `spec.md`** and check the request against it:
   - If the request changes behavior, visuals, or rules → the spec must
     change too. Update `spec.md` in the same commit as the code.
   - If the request contradicts the spec, or the spec is silent on the
     point, decide whether a spec change is needed BEFORE coding.
   - When spec and code disagree, `spec.md` is the truth — fix the code
     (or explicitly change the spec).
4. **Write an implementation plan before implementing.** Confirm unclear
   or ambiguous points with the user instead of guessing.
5. After finishing: update `spec.md` if behavior changed, then append a
   dated entry to `doc/PROGRESS.md`.

Note: `spec.md` describes WHAT the game is (the contract); `PLAN.md` is the
original one-shot brief kept for reference; `doc/PROGRESS.md` is the session
log. The gameplay screen is spec-frozen — see the freeze note in `spec.md`.

## Change discipline — do not break what you were not asked to touch

Loose, fast "vibe" editing has repeatedly damaged things the request never
mentioned (frozen screens got redesigned; shared code changed one surface
and silently altered another). Treat every task as **surgical**: change the
smallest set of things that satisfies the request, and nothing else.

1. **Scope to the request.** Do not "improve", polish, refactor, restyle,
   rename, or reorganize anything the task did not ask for. If you spot
   something worth changing, propose it to the user — do not do it silently
   in the same edit.
2. **Frozen surfaces are off-limits by default.** Anything marked FROZEN in
   `spec.md` (currently the gameplay screen, title, and setup screens) must
   not change in look, layout, or behavior without an explicit user request
   AND a matching `spec.md` update in the same commit. "It looked better to
   me" is not a request.
3. **Check the blast radius before editing shared code.** Some things are
   consumed by many surfaces — e.g. `game/store.ts`, `game/types.ts`,
   `i18n.ts` keys, `scene/Ambient.tsx`, and shared CSS classes
   (`.btn`, `.seg`/`.seg-btn`, etc.). Before touching one, enumerate every
   consumer and confirm the change is safe for all of them. When only one
   surface needs to differ, prefer a screen-local copy over mutating the
   shared primitive.
4. **Smallest reversible diff wins.** Additive and scoped beats broad
   rewrites. If a rewrite is genuinely needed, say so and keep unrelated
   behavior byte-for-byte identical.
5. **Prove you did no collateral damage.** After any change, `npm run build`
   and `npm run simulate` must still pass, and you must re-check the
   surfaces near your change — especially frozen ones — (screenshot them)
   to confirm they are unchanged. Regressions you introduce are your
   responsibility to catch, not the user's.

## Progress & handoff — READ AND UPDATE `doc/PROGRESS.md`

**At the start of a session:** read `doc/PROGRESS.md` first to catch up on
what has been done, what is in flight, and known issues.

**At the end of a session (or after finishing a meaningful chunk of work):**
append your progress and anything you want to hand off to the next session to
`doc/PROGRESS.md`. Add a new dated entry — do not overwrite or delete older
entries; the file is an append-only log. Include:

- What changed this session (features, fixes, refactors)
- Current state (what works, what is verified)
- Known issues / anything left unfinished
- Suggested next steps and any context the next session would otherwise
  have to rediscover (gotchas, decisions, dead ends)

Keep entries concise but specific enough that a cold-start session can
continue without re-deriving context.

## Commands

```bash
npm install
npm run dev        # local dev server
npm run build      # tsc typecheck + vite production build
npm run simulate   # headless AI-vs-AI full-game verification across configs
```

Before considering work done: `npm run build` must pass and `npm run
simulate` must reach a winner on every config.

## Architecture

```
src/
  game/     rules, board generation, state machine (zustand), NPC AI — pure TS, headless-testable
  scene/    react-three-fiber 3D: tiles, pieces, highlights, dice ritual, ambient life
  ui/       DOM HUD: screens, hand, trade modal, toasts, victory
  audio/    procedural Web Audio engine (no assets)
scripts/
  simulate.ts   headless full-game verification
```

- Game logic is deterministic and lives entirely in `src/game`; the 3D/UI
  layers only present it. Dice results are decided in the store before the
  animation plays — physics presents the result, never determines it.
- `src/game/store.ts` is the state machine. `aiTick()` (driven by an interval
  in `App.tsx`) runs NPC turns, cleanup, and softlock watchdogs.
- Everything is generated at runtime: geometry, canvas textures, names, audio.
  No external/remote assets — keep it that way (Vercel + CSP friendly).

## Conventions

- Keep the game reliably completable: any chaotic/random system must have a
  timeout or fallback and must never softlock turn progression (see the
  watchdogs in `aiTick`).
- Do not add required manual setup, servers, env vars, or downloaded assets.
- Match the surrounding code style; prefer small, readable changes.
