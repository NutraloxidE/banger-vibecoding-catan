// NPC decision-making. Fast heuristics over expensive search. Every function
// is bounded so an NPC turn can never hang the game.

import { COSTS } from "./constants";
import {
  affordable,
  autoRobber,
  bankTrade,
  buildCity,
  buildMegacity,
  buildRoad,
  buildSettlement,
  log,
  makeStateRng,
  setupPlaceRoad,
  setupPlaceSettlement,
} from "./gameReducer";
import { canAfford } from "./rules";
import {
  validCityVertices,
  validMegacityVertices,
  validRoadEdges,
  validSettlementVertices,
} from "./rules";
import type { GameState, ResourceType } from "./types";

const NPC_LINES: Record<string, string[]> = {
  build: ["Infrastructure!", "A modest empire.", "Watch this.", "For the economy.", "Mine now."],
  trade: ["Deal?", "You need this.", "Generous of me.", "The bank owes me."],
  rob: ["Nothing personal.", "Tax season.", "I'll take that.", "The robber and I are friends."],
  idle: ["Hmm.", "Interesting.", "I'm planning something terrible.", "Unreasonably proud of one road."],
};

export function pips(n: number | null): number {
  if (n === null) return 0;
  return 6 - Math.abs(7 - n);
}

export function vertexScore(state: GameState, vertexId: number): number {
  const v = state.board.vertices[vertexId];
  let score = 0;
  const seen = new Set<string>();
  for (const tid of v.tileIds) {
    const t = state.board.tiles[tid];
    score += pips(t.number);
    if (t.resource && !seen.has(t.resource)) {
      seen.add(t.resource);
      score += 1.5; // diversity bonus
    }
    if (t.biome === "gold") score += 4;
  }
  if (v.port) score += v.port === "any" ? 1 : 2;
  return score;
}

function jitter(state: GameState, amount: number): number {
  return (makeStateRng(state)() - 0.5) * 2 * amount;
}

export function aiSetupPlace(state: GameState) {
  const p = state.players[state.current];
  if (state.setupStage === "settlement") {
    const options = validSettlementVertices(state, state.current, true);
    if (options.length === 0) {
      // extreme fallback: pick any empty vertex
      const any = state.board.vertices.find((v) => !state.buildings[v.id]);
      if (any) setupPlaceSettlement(state, any.id);
      return;
    }
    const noise = p.personality === "incompetent" ? 6 : p.personality === "gambler" ? 4 : 1.2;
    const best = options
      .map((id) => ({ id, s: vertexScore(state, id) + jitter(state, noise) }))
      .sort((a, b) => b.s - a.s)[0];
    setupPlaceSettlement(state, best.id);
  } else {
    const from = state.setupLastVertex!;
    const edges = validRoadEdges(state, state.current, from);
    if (edges.length === 0) {
      const anyEdge = Object.keys(state.board.edges).find((e) => !state.roads[e]);
      if (anyEdge) setupPlaceRoad(state, anyEdge);
      return;
    }
    // road toward the best neighboring vertex
    const best = edges
      .map((eid) => {
        const e = state.board.edges[eid];
        const other = e.a === from ? e.b : e.a;
        return { eid, s: vertexScore(state, other) + jitter(state, 1) };
      })
      .sort((a, b) => b.s - a.s)[0];
    setupPlaceRoad(state, best.eid);
  }
}

export function aiMoveRobber(state: GameState) {
  autoRobber(state);
  maybeSay(state, "rob");
}

// Attempt to convert surplus into a needed resource via the bank.
function tradeToward(state: GameState, cost: Partial<Record<ResourceType, number>>): boolean {
  const owner = state.current;
  const res = state.players[owner].resources;
  const need: ResourceType[] = [];
  (Object.keys(cost) as ResourceType[]).forEach((k) => {
    const deficit = (cost[k] ?? 0) - res[k];
    for (let i = 0; i < deficit; i++) need.push(k);
  });
  if (need.length === 0) return false;
  // find a resource we have a big surplus of
  const all: ResourceType[] = ["wood", "brick", "sheep", "wheat", "ore"];
  let traded = false;
  for (const want of need) {
    const give = all
      .filter((r) => !(cost[r] && res[r] <= (cost[r] ?? 0)))
      .sort((a, b) => res[b] - res[a])[0];
    if (give && res[give] >= 4 && give !== want) {
      if (bankTrade(state, give, want)) traded = true;
    }
  }
  return traded;
}

export function aiBuildPhase(state: GameState) {
  const p = state.players[state.current];
  const personality = p.personality;
  let actions = 0;
  const MAX = 12; // hard bound

  const tryMegacity = () => {
    const spots = validMegacityVertices(state, state.current);
    if (spots.length && affordable(state, "megacity", state.current)) {
      return buildMegacity(state, spots[0]);
    }
    return false;
  };
  const tryCity = () => {
    const spots = validCityVertices(state, state.current);
    if (spots.length && affordable(state, "city", state.current)) {
      // upgrade the highest-value settlement
      const best = spots
        .map((id) => ({ id, s: vertexScore(state, id) }))
        .sort((a, b) => b.s - a.s)[0];
      return buildCity(state, best.id);
    }
    return false;
  };
  const trySettlement = () => {
    const spots = validSettlementVertices(state, state.current, false);
    if (spots.length && affordable(state, "settlement", state.current)) {
      const best = spots
        .map((id) => ({ id, s: vertexScore(state, id) }))
        .sort((a, b) => b.s - a.s)[0];
      return buildSettlement(state, best.id);
    }
    return false;
  };
  const tryRoad = (towardExpansion: boolean) => {
    if (!affordable(state, "road", state.current)) return false;
    const edges = validRoadEdges(state, state.current);
    if (!edges.length) return false;
    if (towardExpansion) {
      // pick a road whose far endpoint could someday host a settlement
      const scored = edges
        .map((eid) => {
          const e = state.board.edges[eid];
          const s = Math.max(vertexScore(state, e.a), vertexScore(state, e.b));
          return { eid, s: s + jitter(state, 0.5) };
        })
        .sort((a, b) => b.s - a.s);
      return buildRoad(state, scored[0].eid);
    }
    return buildRoad(state, edges[0]);
  };

  // priority ladder varies by personality
  while (actions < MAX) {
    let did = false;
    switch (personality) {
      case "hoarder":
        did = tryMegacity() || tryCity() || trySettlement();
        break;
      case "defensive":
        did = tryMegacity() || tryCity() || trySettlement() || tryRoad(false);
        break;
      case "expansionist":
        did = trySettlement() || tryRoad(true) || tryCity() || tryMegacity();
        break;
      case "trader":
        did =
          tryMegacity() ||
          tryCity() ||
          trySettlement() ||
          (tradeToward(state, COSTS.settlement) && trySettlement()) ||
          (tradeToward(state, COSTS.city) && tryCity()) ||
          tryRoad(true);
        break;
      case "gambler":
        did =
          makeStateRng(state)() < 0.5
            ? trySettlement() || tryRoad(true) || tryCity()
            : tryCity() || tryRoad(true) || trySettlement();
        break;
      case "incompetent":
        // usually builds roads to nowhere, occasionally a scary optimal move
        if (makeStateRng(state)() < 0.2) did = tryCity() || trySettlement();
        else did = tryRoad(false) || trySettlement() || tryCity();
        break;
    }

    // traders and anyone stuck will try a bank trade to unblock a city/settlement
    if (!did && personality !== "hoarder") {
      const beforeTrade = snapshotResources(state);
      let progressed = false;
      if (canProgressTo(state, "city")) progressed = tradeToward(state, COSTS.city) && tryCity();
      if (!progressed && canProgressTo(state, "settlement"))
        progressed = tradeToward(state, COSTS.settlement) && trySettlement();
      did = progressed;
      if (!did) restoreLog(state, beforeTrade); // no-op guard
    }

    if (!did) break;
    actions++;
  }
  maybeSay(state, actions > 0 ? "build" : "idle");
}

function snapshotResources(state: GameState) {
  return JSON.stringify(state.players[state.current].resources);
}
function restoreLog(_state: GameState, _snap: string) {
  /* intentionally a no-op: trades already logged; guard kept for clarity */
}

function canProgressTo(state: GameState, kind: "city" | "settlement"): boolean {
  if (kind === "city") return validCityVertices(state, state.current).length > 0;
  return validSettlementVertices(state, state.current, false).length > 0;
}

function maybeSay(state: GameState, kind: keyof typeof NPC_LINES) {
  const p = state.players[state.current];
  if (p.isHuman) return;
  const rng = makeStateRng(state);
  if (rng() < 0.6) {
    const lines = NPC_LINES[kind];
    p.lastLine = lines[Math.floor(rng() * lines.length)];
  }
}

// Decide whether an NPC accepts a proposed trade (used by human->NPC trade).
export function npcAcceptsTrade(
  state: GameState,
  npc: number,
  give: Record<ResourceType, number>, // what human gives npc
  want: Record<ResourceType, number>, // what human wants from npc
): boolean {
  const res = state.players[npc].resources;
  // must be able to pay
  const all: ResourceType[] = ["wood", "brick", "sheep", "wheat", "ore"];
  if (!all.every((r) => res[r] >= (want[r] ?? 0))) return false;
  const giveVal = all.reduce((a, r) => a + (give[r] ?? 0), 0);
  const wantVal = all.reduce((a, r) => a + (want[r] ?? 0), 0);
  const personality = state.players[npc].personality;
  const grudge = state.players[npc].grudges[state.current] ?? 0;
  let threshold = wantVal; // baseline fair
  if (personality === "trader") threshold = wantVal - 0.5;
  if (personality === "hoarder") threshold = wantVal + 1;
  if (personality === "defensive") threshold = wantVal + 0.5;
  threshold += grudge * 0.5; // grudges make them demand more
  const accept = giveVal >= threshold;
  if (accept) {
    state.players[npc].lastLine = "Fine. Deal.";
  } else {
    state.players[npc].lastLine = grudge > 0 ? "After what you did? No." : "Insulting.";
  }
  return accept;
}

export function humanNpcTrade(
  state: GameState,
  npc: number,
  give: Record<ResourceType, number>,
  want: Record<ResourceType, number>,
): boolean {
  if (!npcAcceptsTrade(state, npc, give, want)) return false;
  const human = state.current;
  const all: ResourceType[] = ["wood", "brick", "sheep", "wheat", "ore"];
  for (const r of all) {
    state.players[human].resources[r] -= give[r] ?? 0;
    state.players[npc].resources[r] += give[r] ?? 0;
    state.players[human].resources[r] += want[r] ?? 0;
    state.players[npc].resources[r] -= want[r] ?? 0;
  }
  state.stats.trades++;
  log(state, `${state.players[human].name} trades with ${state.players[npc].name}.`, "good");
  return true;
}

export { canAfford };
