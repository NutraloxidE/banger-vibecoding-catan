// Headless full-game simulation: NPCs play the human's moves too.
// Verifies that a complete match reaches a winner without softlocks,
// across several map sizes and configs. Run with: npm run simulate

import { useGame } from '../src/game/store';
import { MatchConfig, MapSize, Difficulty } from '../src/game/types';
import {
  aiSetupVertex, aiSetupRoad, aiMainAction, aiRobberChoice,
  aiDevMonopolyResource, aiDevGainResources, aiFreeRoadSpot,
} from '../src/game/ai';
import { validRoadSpots, bankRate } from '../src/game/rules';

function playHumanLikeNpc() {
  const s = useGame.getState();
  const g = s.game!;
  if (g.current !== 0 || g.players[0].isNpc) return false;

  if (g.phase === 'setup') {
    if (g.setupStage === 'settlement') {
      const v = aiSetupVertex(g, 0);
      s.clickVertex(v);
    } else {
      const spots = validRoadSpots(g, 0, g.setupLastVertex);
      const e = g.setupLastVertex ? aiSetupRoad(g, 0, g.setupLastVertex) : spots[0];
      s.clickEdge(e);
    }
    return true;
  }
  if (g.phase === 'roll') { s.rollDice(); return true; }
  if (g.phase === 'dice') { s.finishDice(); return true; }
  if (g.phase === 'robber') {
    const c = aiRobberChoice(g, 0);
    s.clickTile(c.tile);
    return true;
  }
  if (g.phase === 'main') {
    // resolve a pending dev-card resource prompt (Monopoly / Year of Plenty / Treasure Haul)
    if (g.devPrompt) {
      const res = g.devPrompt.card === 'monopoly'
        ? aiDevMonopolyResource(g, 0)
        : aiDevGainResources(g, 0, 1)[0];
      s.resolveDevPrompt(res);
      return true;
    }
    // place a free road granted by the Road Building card
    if (g.placement?.kind === 'road' && g.freeRoads > 0) {
      const spot = aiFreeRoadSpot(g, 0);
      if (spot) s.clickEdge(spot); else s.cancelPlacement();
      return true;
    }
    const action = aiMainAction(g, 0);
    if (action.type === 'build') {
      s.startPlacement(action.kind);
      const g2 = useGame.getState().game!;
      if (g2.placement?.spots.includes(action.spot)) {
        if (action.kind === 'road') s.clickEdge(action.spot);
        else s.clickVertex(action.spot);
      } else {
        s.cancelPlacement();
        s.endTurn();
      }
    } else if (action.type === 'buyDev') {
      s.buyDevCard();
    } else if (action.type === 'playDev') {
      const idx = g.players[0].devCards.findIndex((c) => c.kind === action.card && c.boughtOnTurn !== g.turnCount);
      if (idx >= 0) s.playDevCard(idx); else s.endTurn();
    } else if (action.type === 'bank') {
      s.bankTrade(action.give, action.get);
    } else {
      s.endTurn();
    }
    return true;
  }
  return false;
}

function runOne(label: string, config: MatchConfig): boolean {
  useGame.getState().newGame(config);
  let steps = 0;
  const MAX_STEPS = 60000;

  while (steps++ < MAX_STEPS) {
    const s = useGame.getState();
    const g = s.game!;
    if (g.winner !== null) {
      const w = g.players[g.winner];
      console.log(`✅ ${label}: ${w.name} wins with ${w.vp} VP — ${g.turnCount} turns, ${g.round} rounds, ${steps} steps`);
      return true;
    }
    if (g.phase === 'dice') {
      // skip the animation delay in headless mode
      useGame.setState((st) => { if (st.game) st.game.diceStartedAt = 0; });
    }
    if (g.current === 0) {
      playHumanLikeNpc();
    } else {
      s.aiTick();
      // aiTick may be waiting on speech-clear timing only; force dice through
      const g2 = useGame.getState().game!;
      if (g2.phase === 'dice') s.finishDice();
    }
  }
  const g = useGame.getState().game!;
  console.error(`❌ ${label}: NO WINNER after ${MAX_STEPS} steps. phase=${g.phase} turn=${g.turnCount} round=${g.round} vp=${g.players.map((p) => p.vp).join(',')}`);
  return false;
}

const base: MatchConfig = {
  mapSize: 'medium', npcCount: 3, difficulty: 'normal', targetVp: 10,
  seed: 'SIM-1', worldEvents: true,
  chaos: { turbo: false, friendlyRobber: false, maximumSheep: false, drama: false, goldenHex: false, crazyCards: false },
  traditionalNumbers: false, traditionalPorts: false,
};

const runs: [string, MatchConfig][] = [
  ['small/2npc/chill', { ...base, mapSize: 'small', npcCount: 2, difficulty: 'chill', seed: 'SIM-SMALL' }],
  ['medium/3npc/normal', { ...base, seed: 'SIM-MED' }],
  ['large/3npc/ruthless', { ...base, mapSize: 'large', difficulty: 'ruthless', seed: 'SIM-LARGE', targetVp: 12 }],
  ['turbo+sheep+crazy chaos', { ...base, seed: 'SIM-CHAOS', chaos: { turbo: true, friendlyRobber: true, maximumSheep: true, drama: true, goldenHex: true, crazyCards: true } }],
  ['1npc/vp8', { ...base, mapSize: 'small', npcCount: 1, targetVp: 8, seed: 'SIM-DUEL' }],
  ['crazy-cards/medium', { ...base, seed: 'SIM-CRAZY', chaos: { turbo: false, friendlyRobber: false, maximumSheep: false, drama: false, goldenHex: false, crazyCards: true } }],
  ['traditional/small', { ...base, mapSize: 'small', npcCount: 2, seed: 'SIM-TRAD', traditionalNumbers: true, traditionalPorts: true }],
  ['traditional/large', { ...base, mapSize: 'large', seed: 'SIM-TRAD-L', targetVp: 12, traditionalNumbers: true, traditionalPorts: true }],
];

let allOk = true;
for (const [label, cfg] of runs) {
  try {
    if (!runOne(label, cfg)) allOk = false;
  } catch (err) {
    console.error(`❌ ${label}: threw`, err);
    allOk = false;
  }
}
if (!allOk) {
  (globalThis as any).process?.exit?.(1);
  throw new Error('simulation failed');
}
console.log('\nAll simulations completed with winners. The loop is sound.');
