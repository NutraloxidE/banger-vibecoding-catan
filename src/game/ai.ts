import { MatchState, Resource, RESOURCES, BuildKind, PlayerState } from './types';
import { vertexScore, TOKEN_WEIGHT } from './board';
import {
  COSTS, canAfford, validSettlementSpots, validRoadSpots, validCitySpots, validMegaSpots,
  bankRate, handSize, roadCount,
} from './rules';

export type AiAction =
  | { type: 'build'; kind: BuildKind; spot: string }
  | { type: 'bank'; give: Resource; get: Resource }
  | { type: 'offerHuman'; give: Resource; get: Resource }
  | { type: 'end' };

const rand = () => Math.random();

function pickBest<T>(items: T[], score: (t: T) => number): T | null {
  let best: T | null = null;
  let bestS = -Infinity;
  for (const it of items) {
    const s = score(it) + rand() * 0.3; // tiny jitter so NPCs differ
    if (s > bestS) { bestS = s; best = it; }
  }
  return best;
}

export function aiSetupVertex(state: MatchState, pid: number): string {
  const spots = validSettlementSpots(state, pid, true);
  const p = state.players[pid];
  const best = pickBest(spots, (v) => {
    let s = vertexScore(state.board, v);
    if (p.personality === 'gambler') s += rand() * 4;
    return s;
  });
  return best ?? spots[0];
}

export function aiSetupRoad(state: MatchState, pid: number, anchor: string): string {
  const spots = validRoadSpots(state, pid, anchor);
  const best = pickBest(spots, (eid) => {
    const e = state.board.edges[eid];
    const far = e.a === anchor ? e.b : e.a;
    return vertexScore(state.board, far);
  });
  return best ?? spots[0];
}

// what resources are missing for a build kind
function missingFor(p: PlayerState, kind: BuildKind): Resource[] {
  const cost = COSTS[kind];
  const out: Resource[] = [];
  for (const r of RESOURCES) {
    const need = (cost[r] ?? 0) - p.resources[r];
    for (let i = 0; i < need; i++) out.push(r);
  }
  return out;
}

function surplus(p: PlayerState, protectKind: BuildKind): Resource | null {
  const cost = COSTS[protectKind];
  let best: Resource | null = null;
  let bestN = 0;
  for (const r of RESOURCES) {
    const spare = p.resources[r] - (cost[r] ?? 0);
    if (spare > bestN) { bestN = spare; best = r; }
  }
  return best;
}

// Decide the NPC's current savings goal
function currentGoal(state: MatchState, pid: number): BuildKind {
  const p = state.players[pid];
  const cities = validCitySpots(state, pid);
  const megas = validMegaSpots(state, pid);
  if (megas.length > 0) return 'megacity';
  if (cities.length > 0 && (p.personality !== 'expansionist' || rand() < 0.5)) return 'city';
  const spots = validSettlementSpots(state, pid, false);
  if (spots.length > 0) return 'settlement';
  return 'road';
}

export function aiMainAction(state: MatchState, pid: number): AiAction {
  const p = state.players[pid];
  const diff = state.config.difficulty;
  const lazy = diff === 'chill';
  const sharp = diff === 'ruthless';

  // sleeper personality: often does nothing... then strikes
  if (p.personality === 'sleeper' && rand() < (lazy ? 0.35 : 0.15)) return { type: 'end' };

  // 1) Mega city
  const megaSpots = validMegaSpots(state, pid);
  if (megaSpots.length > 0 && canAfford(p, 'megacity')) {
    const spot = pickBest(megaSpots, (v) => vertexScore(state.board, v));
    if (spot) return { type: 'build', kind: 'megacity', spot };
  }

  // 2) City
  const citySpots = validCitySpots(state, pid);
  if (citySpots.length > 0 && canAfford(p, 'city')) {
    const spot = pickBest(citySpots, (v) => vertexScore(state.board, v));
    if (spot) return { type: 'build', kind: 'city', spot };
  }

  // 3) Settlement
  const settleSpots = validSettlementSpots(state, pid, false);
  if (settleSpots.length > 0 && canAfford(p, 'settlement')) {
    const spot = pickBest(settleSpots, (v) => {
      let s = vertexScore(state.board, v) * 1.5;
      if (sharp) {
        // bonus for denying spots opponents could reach
        const vv = state.board.vertices[v];
        const nearOpp = vv.edges.some((e) => {
          const r = state.roads[e];
          return r && r.owner !== pid;
        });
        if (nearOpp) s += 3;
      }
      return s;
    });
    if (spot) return { type: 'build', kind: 'settlement', spot };
  }

  // 4) Road (toward good frontier), capped so NPCs don't pave the whole ocean
  const myRoads = roadCount(state, pid);
  const roadCap = p.personality === 'expansionist' || p.personality === 'builder' ? 18 : 13;
  if (canAfford(p, 'road') && myRoads < roadCap) {
    const wantRoad =
      settleSpots.length === 0 || p.personality === 'expansionist' || p.personality === 'builder' || rand() < 0.4;
    if (wantRoad) {
      const roadSpots = validRoadSpots(state, pid);
      if (roadSpots.length > 0) {
        const spot = pickBest(roadSpots, (eid) => {
          const e = state.board.edges[eid];
          let s = 0;
          for (const vid of [e.a, e.b]) {
            if (!state.buildings[vid]) s = Math.max(s, vertexScore(state.board, vid));
          }
          return s;
        });
        if (spot) return { type: 'build', kind: 'road', spot };
      }
    }
  }

  // 5) Bank trade toward goal
  const goal = currentGoal(state, pid);
  const missing = missingFor(p, goal);
  if (missing.length > 0 && missing.length <= 2 && p.personality !== 'hoarder') {
    const give = surplus(p, goal);
    const want = missing[0];
    if (give && give !== want) {
      const rate = bankRate(state, give);
      const cost = COSTS[goal];
      if (p.resources[give] - (cost[give] ?? 0) >= rate) {
        return { type: 'bank', give, get: want };
      }
    }
  }

  // 6) Occasionally propose a trade to the human
  const human = state.players[0];
  if (!human.isNpc && missing.length > 0 && !state.npcOffer) {
    const want = missing[0];
    const dramaBoost = state.config.chaos.drama ? 0.15 : 0;
    const traderBoost = p.personality === 'trader' ? 0.2 : 0;
    if (human.resources[want] > 0 && rand() < 0.14 + dramaBoost + traderBoost) {
      const give = surplus(p, goal);
      if (give && give !== want && p.resources[give] > 1) {
        return { type: 'offerHuman', give, get: want };
      }
    }
  }

  return { type: 'end' };
}

// Robber: place on highest-value tile adjacent to the strongest opponent, never adjacent to self
export function aiRobberChoice(state: MatchState, pid: number): { tile: number; victim: number | null } {
  const { board } = state;
  const leaderId = state.players
    .filter((pl) => pl.id !== pid)
    .sort((a, b) => b.vp - a.vp)[0]?.id ?? (pid === 0 ? 1 : 0);

  let bestTile = -1;
  let bestScore = -Infinity;
  let bestVictim: number | null = null;

  for (const tile of board.tiles) {
    if (tile.id === state.robberTile) continue;
    let touchesSelf = false;
    let victim: number | null = null;
    let score = tile.token ? TOKEN_WEIGHT[tile.token] ?? 0 : -2;
    let touchesLeader = false;
    for (const v of Object.values(board.vertices)) {
      if (!v.tiles.includes(tile.id)) continue;
      const b = state.buildings[v.id];
      if (!b) continue;
      if (b.owner === pid) touchesSelf = true;
      else {
        if (handSize(state.players[b.owner]) > 0) victim = b.owner;
        if (b.owner === leaderId) touchesLeader = true;
      }
    }
    if (touchesSelf) continue;
    if (victim === null) score -= 4;
    if (touchesLeader) score += 5;
    if (score > bestScore) { bestScore = score; bestTile = tile.id; bestVictim = victim; }
  }

  if (bestTile === -1) {
    // fallback: any tile that's not the current one
    const t = board.tiles.find((t) => t.id !== state.robberTile);
    return { tile: t ? t.id : 0, victim: null };
  }
  return { tile: bestTile, victim: bestVictim };
}

// Would this NPC accept a trade: give `giveN` of `give` (from proposer) for `getN` of `get` (from NPC)?
export function aiEvaluateTrade(
  state: MatchState, npcId: number,
  theyGive: Resource, theyGiveN: number,
  theyGet: Resource, theyGetN: number,
): boolean {
  const p = state.players[npcId];
  if (p.resources[theyGet] < theyGetN) return false;
  const goal = currentGoal(state, npcId);
  const missing = missingFor(p, goal);
  const cost = COSTS[goal];

  let value = 0;
  // value of what we receive
  value += theyGiveN * (missing.includes(theyGive) ? 2.2 : 0.8);
  // cost of what we give away
  const spare = p.resources[theyGet] - (cost[theyGet] ?? 0);
  value -= theyGetN * (spare >= theyGetN ? 0.9 : 2.5);

  if (p.personality === 'trader') value += 0.6;
  if (p.personality === 'hoarder') value -= 1.0;
  if (state.config.difficulty === 'chill') value += 0.4;
  if (state.config.difficulty === 'ruthless') value -= 0.3;
  // never help someone at match point
  const proposer = state.players[state.current];
  if (proposer.vp >= state.config.targetVp - 1) value -= 5;

  return value > 0;
}
