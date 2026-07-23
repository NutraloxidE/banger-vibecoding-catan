import { MatchState, Resource, RESOURCES, BuildKind, PlayerState, DevKind } from './types';
import { vertexScore, TOKEN_WEIGHT } from './board';
import {
  COSTS, canAfford, validSettlementSpots, validRoadSpots, validCitySpots, validMegaSpots,
  bankRate, handSize, roadCount,
} from './rules';
import { DEV_CARD_COST, LARGEST_ARMY_MIN } from './dev';

export type AiAction =
  | { type: 'build'; kind: BuildKind; spot: string }
  | { type: 'bank'; give: Resource; get: Resource }
  | { type: 'offerHuman'; give: Resource; get: Resource }
  | { type: 'buyDev' }
  | { type: 'playDev'; card: DevKind }
  | { type: 'end' };

const rand = () => Math.random();

function pickBest<T>(items: T[], score: (t: T) => number, noise = 0.3): T | null {
  let best: T | null = null;
  let bestS = -Infinity;
  for (const it of items) {
    const s = score(it) + rand() * noise; // jitter so NPCs differ; large on 'chill' = sloppy picks
    if (s > bestS) { bestS = s; best = it; }
  }
  return best;
}

// How much random noise to add to positional scoring. On 'chill' the jitter is
// big enough to routinely drown out the real value of a corner/road, so the NPC
// settles for clearly worse spots; 'ruthless' plays near-optimally; 'normal'
// keeps a light jitter so rivals still differ.
function pickNoise(state: MatchState): number {
  const d = state.config.difficulty;
  if (d === 'chill') return 7;
  if (d === 'ruthless') return 0.12;
  return 0.3;
}

export function aiSetupVertex(state: MatchState, pid: number): string {
  const spots = validSettlementSpots(state, pid, true);
  const p = state.players[pid];
  const best = pickBest(spots, (v) => {
    let s = vertexScore(state.board, v);
    if (p.personality === 'gambler') s += rand() * 4;
    return s;
  }, pickNoise(state));
  return best ?? spots[0];
}

export function aiSetupRoad(state: MatchState, pid: number, anchor: string): string {
  const spots = validRoadSpots(state, pid, anchor);
  const best = pickBest(spots, (eid) => {
    const e = state.board.edges[eid];
    const far = e.a === anchor ? e.b : e.a;
    return vertexScore(state.board, far);
  }, pickNoise(state));
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

// Does this tile touch a building owned by `pid`? (Is the robber hurting us?)
function tileTouchesPlayer(state: MatchState, tileId: number, pid: number): boolean {
  for (const v of Object.values(state.board.vertices)) {
    if (v.tiles.includes(tileId) && state.buildings[v.id]?.owner === pid) return true;
  }
  return false;
}

// Which single resource should Monopoly grab — the one opponents hold the most of.
export function aiDevMonopolyResource(state: MatchState, pid: number): Resource {
  let best: Resource = RESOURCES[0];
  let bestN = -1;
  for (const r of RESOURCES) {
    let n = 0;
    for (const q of state.players) if (q.id !== pid) n += q.resources[r];
    if (n > bestN) { bestN = n; best = r; }
  }
  return best;
}

// Which resources to draw from the bank (Year of Plenty / Treasure Haul):
// fill toward the current build goal, then top up the scarcest holdings.
export function aiDevGainResources(state: MatchState, pid: number, count: number): Resource[] {
  const p = state.players[pid];
  const missing = missingFor(p, currentGoal(state, pid));
  const out: Resource[] = [];
  for (let i = 0; i < count; i++) {
    if (missing.length > 0) out.push(missing.shift()!);
    else out.push([...RESOURCES].sort((a, b) => p.resources[a] - p.resources[b])[0]);
  }
  return out;
}

// Best free road spot for the Road Building card.
export function aiFreeRoadSpot(state: MatchState, pid: number): string | null {
  const spots = validRoadSpots(state, pid);
  if (spots.length === 0) return null;
  return pickBest(spots, (eid) => {
    const e = state.board.edges[eid];
    let s = 0;
    for (const vid of [e.a, e.b]) if (!state.buildings[vid]) s = Math.max(s, vertexScore(state.board, vid));
    return s;
  }, pickNoise(state)) ?? spots[0];
}

// Choose a held development card worth playing this turn (or null to hold).
function aiChooseDevPlay(state: MatchState, pid: number): DevKind | null {
  if (state.devCardPlayedThisTurn) return null;
  const p = state.players[pid];
  const playable = p.devCards.filter((c) => c.boughtOnTurn !== state.turnCount);
  if (playable.length === 0) return null;
  const kinds = new Set(playable.map((c) => c.kind));
  const missing = missingFor(p, currentGoal(state, pid));

  // Monopoly — grab a resource opponents are hoarding
  if (kinds.has('monopoly')) {
    const res = aiDevMonopolyResource(state, pid);
    let total = 0;
    for (const q of state.players) if (q.id !== pid) total += q.resources[res];
    if (total >= 3) return 'monopoly';
  }
  // Treasure Haul / Year of Plenty — cash in to complete a build
  if (kinds.has('bounty') && missing.length > 0 && missing.length <= 3) return 'bounty';
  if (kinds.has('yearOfPlenty') && missing.length > 0 && missing.length <= 2) return 'yearOfPlenty';
  // Road Building — expand / chase the longest road
  if (kinds.has('roadBuilding') && validRoadSpots(state, pid).length > 0) {
    if (p.personality === 'expansionist' || p.personality === 'builder' || rand() < 0.5) return 'roadBuilding';
  }
  // Knight — kick the robber off our land, hunt the leader, or chase Largest Army
  if (kinds.has('knight')) {
    const hurtsUs = tileTouchesPlayer(state, state.robberTile, pid);
    const nearArmy = p.knightsPlayed >= LARGEST_ARMY_MIN - 1;
    if (hurtsUs || nearArmy || rand() < 0.35) return 'knight';
  }
  // Earthquake (crazy) — shake cards from every neighbor
  if (kinds.has('earthquake')) {
    const anyCards = state.players.some((q) => q.id !== pid && handSize(q) > 0);
    if (anyCards && rand() < 0.6) return 'earthquake';
  }
  // Plague (crazy) — worthwhile when rivals are card-rich
  if (kinds.has('plague')) {
    let oppCards = 0;
    for (const q of state.players) if (q.id !== pid) oppCards += handSize(q);
    if (oppCards >= 6) return 'plague';
  }
  // Windfall (crazy) — gamblers can't resist
  if (kinds.has('windfall') && (p.personality === 'gambler' || rand() < 0.3)) return 'windfall';

  return null;
}

// Should the NPC spend a spare ore/wheat/sheep on a development card?
function aiWantBuyDev(state: MatchState, pid: number): boolean {
  if (state.devDeck.length === 0) return false;
  const p = state.players[pid];
  if (!RESOURCES.every((r) => p.resources[r] >= (DEV_CARD_COST[r] ?? 0))) return false;
  if (p.personality === 'hoarder' && rand() < 0.7) return false;
  const spare = (p.resources.ore - 1) + (p.resources.wheat - 1) + (p.resources.sheep - 1);
  let chance = 0.12 + Math.min(0.4, spare * 0.06);
  if (state.config.difficulty === 'ruthless') chance += 0.1;
  if (state.config.difficulty === 'chill') chance -= 0.05;
  if (p.personality === 'gambler') chance += 0.12;
  return rand() < chance;
}

export function aiMainAction(state: MatchState, pid: number): AiAction {
  const p = state.players[pid];
  const diff = state.config.difficulty;
  const lazy = diff === 'chill';
  const sharp = diff === 'ruthless';

  const noise = pickNoise(state);

  // sleeper personality: often does nothing... then strikes
  if (p.personality === 'sleeper' && rand() < (lazy ? 0.35 : 0.15)) return { type: 'end' };

  // chill rivals are lazy and easily distracted — they often just faff about a
  // turn and sit on their cards instead of pressing an advantage they could
  // clearly build on
  if (lazy && rand() < 0.28) return { type: 'end' };

  // Play a beneficial development card (resource cards feed the build below)
  const devPlay = aiChooseDevPlay(state, pid);
  if (devPlay) return { type: 'playDev', card: devPlay };

  // 1) Mega city
  const megaSpots = validMegaSpots(state, pid);
  if (megaSpots.length > 0 && canAfford(p, 'megacity')) {
    const spot = pickBest(megaSpots, (v) => vertexScore(state.board, v), noise);
    if (spot) return { type: 'build', kind: 'megacity', spot };
  }

  // 2) City
  const citySpots = validCitySpots(state, pid);
  if (citySpots.length > 0 && canAfford(p, 'city')) {
    const spot = pickBest(citySpots, (v) => vertexScore(state.board, v), noise);
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
    }, noise);
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
        }, noise);
        if (spot) return { type: 'build', kind: 'road', spot };
      }
    }
  }

  // 4.5) Buy a development card with spare ore/wheat/sheep
  if (aiWantBuyDev(state, pid)) return { type: 'buyDev' };

  // 5) Bank trade toward goal
  const goal = currentGoal(state, pid);
  const missing = missingFor(p, goal);

  // chill rivals sometimes fritter a fat surplus away on a random resource they
  // don't even need — a purely wasteful trade a sharper player would never make
  if (lazy && rand() < 0.25) {
    let dump: Resource | null = null;
    for (const r of RESOURCES) {
      if (p.resources[r] >= bankRate(state, r) + 2 && (dump === null || p.resources[r] > p.resources[dump])) dump = r;
    }
    if (dump) {
      const options = RESOURCES.filter((r) => r !== dump);
      const get = options[Math.floor(rand() * options.length)];
      return { type: 'bank', give: dump, get };
    }
  }

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
  // chill rivals block a fairly random tile and don't bother hunting the leader
  const lazy = state.config.difficulty === 'chill';
  const noise = lazy ? 8 : 0;
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
    if (touchesLeader && !lazy) score += 5;
    score += rand() * noise;
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
  if (state.config.difficulty === 'chill') value += 1.2; // easily talked into bad deals
  if (state.config.difficulty === 'ruthless') value -= 0.3;
  // never help someone at match point
  const proposer = state.players[state.current];
  if (proposer.vp >= state.config.targetVp - 1) value -= 5;

  return value > 0;
}
