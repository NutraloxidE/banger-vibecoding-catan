// Headless full-game simulation. Drives every player (including player 0) with
// the NPC AI to prove the game loop always terminates in a winner and never
// softlocks. Not shipped in the app bundle — a dev reliability check.

import { createGame, rollDice, endTurn, stealFrom, refreshVictoryPoints } from "../src/game/gameReducer";
import { aiSetupPlace, aiBuildPhase, aiMoveRobber } from "../src/game/ai";
import type { GameSettings } from "../src/game/types";

function base(seed: string): GameSettings {
  return {
    mapSize: "small",
    npcCount: 3,
    victoryTarget: 10,
    seed,
    chaos: {
      turbo: false,
      friendlyRobber: false,
      npcDrama: true,
      maxSheep: false,
      goldenHex: false,
      worldEvents: true,
    },
  };
}

function runOne(settings: GameSettings): {
  ok: boolean;
  winner: number | null;
  turns: number;
  steps: number;
  note: string;
} {
  const g = createGame(settings);
  let steps = 0;
  const MAX = 60000;
  while (g.phase !== "over" && steps < MAX) {
    steps++;
    switch (g.phase) {
      case "setup-place":
        aiSetupPlace(g);
        break;
      case "roll":
        rollDice(g);
        break;
      case "robber-move":
        aiMoveRobber(g);
        break;
      case "robber-steal": {
        const victim = g.players.findIndex((p) => p.index !== g.current);
        stealFrom(g, victim);
        break;
      }
      case "build":
        aiBuildPhase(g);
        endTurn(g);
        break;
      default:
        return { ok: false, winner: null, turns: g.turnNumber, steps, note: `stuck phase ${g.phase}` };
    }
  }
  refreshVictoryPoints(g);
  if (g.phase !== "over") {
    return { ok: false, winner: null, turns: g.turnNumber, steps, note: "did not finish (cap hit)" };
  }
  // sanity: winner really has >= target
  const w = g.players[g.winner!];
  const valid = w.victoryPoints >= g.settings.victoryTarget;
  return { ok: valid, winner: g.winner, turns: g.turnNumber, steps, note: valid ? "ok" : "winner below target" };
}

const configs: GameSettings[] = [];
// vary seeds, sizes, player counts, targets, chaos
const seeds = ["ALPHA", "BRAVO", "CHARLIE", "DELTA", "ECHO", "FOX", "GOLF", "HOTEL", "SHEEP-1234", "DAVE-9"];
for (const seed of seeds) configs.push(base(seed));
for (const size of ["small", "medium", "large"] as const) {
  const c = base(`SIZE-${size}`);
  c.mapSize = size;
  configs.push(c);
}
for (const n of [2, 3, 4, 5]) {
  const c = base(`NPC-${n}`);
  c.npcCount = n;
  configs.push(c);
}
for (const t of [6, 8, 12, 15]) {
  const c = base(`VP-${t}`);
  c.victoryTarget = t;
  configs.push(c);
}
// full chaos
{
  const c = base("CHAOS-MAX");
  c.chaos = { turbo: true, friendlyRobber: true, npcDrama: true, maxSheep: true, goldenHex: true, worldEvents: true };
  c.mapSize = "medium";
  c.npcCount = 4;
  configs.push(c);
}

let pass = 0;
let fail = 0;
let maxTurns = 0;
let maxSteps = 0;
const failures: string[] = [];
for (const c of configs) {
  const r = runOne(c);
  maxTurns = Math.max(maxTurns, r.turns);
  maxSteps = Math.max(maxSteps, r.steps);
  if (r.ok) pass++;
  else {
    fail++;
    failures.push(`seed=${c.seed} size=${c.mapSize} npc=${c.npcCount} vp=${c.victoryTarget} → ${r.note} (turns=${r.turns}, steps=${r.steps})`);
  }
}

console.log(`\n=== SIM RESULTS ===`);
console.log(`configs: ${configs.length}  PASS: ${pass}  FAIL: ${fail}`);
console.log(`max turns in a game: ${maxTurns}  max steps: ${maxSteps}`);
if (failures.length) {
  console.log(`\nFAILURES:`);
  failures.forEach((f) => console.log("  - " + f));
  process.exit(1);
} else {
  console.log(`\nAll games reached a valid winner with no softlocks. ✅`);
}
