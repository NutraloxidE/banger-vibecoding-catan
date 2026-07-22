# CLAUDE.md

HEXTOPIA — a complete, playable, visually excessive 3D hex strategy game
(Catan-like). Vite + React + TypeScript + react-three-fiber. Deploys to
Vercel with zero configuration (no server, DB, env vars, or external assets).

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
