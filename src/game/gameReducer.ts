// State transitions. Functions mutate a GameState draft in place; the store
// is responsible for cloning the top-level reference so React re-renders.

import {
  COSTS,
  HAND_LIMIT,
  PERSONALITY_INFO,
  PLAYER_COLORS,
  NPC_NAMES,
  emptyBundle,
  VP_FOR,
} from "./constants";
import { generateBoard } from "./mapGen";
import { generateSettlementName, generateCivTitle } from "./names";
import { hashSeed, mulberry32, shuffle } from "./rng";
import type { Rng } from "./rng";
import {
  canAfford,
  computeProduction,
  computeVictoryPoints,
  pay,
  recomputeLongestRoad,
  totalCards,
} from "./rules";
import type {
  Building,
  GameSettings,
  GameState,
  Personality,
  Player,
  ResourceType,
  Specialization,
} from "./types";

let logId = 1;

export function makeStateRng(state: GameState): Rng {
  const seed = (state.seedInt ^ Math.imul(state.rngCursor + 1, 2654435761)) >>> 0;
  state.rngCursor++;
  return mulberry32(seed);
}

export function log(state: GameState, text: string, kind: GameState["log"][number]["kind"] = "info") {
  state.log.unshift({ id: logId++, text, kind });
  if (state.log.length > 60) state.log.length = 60;
}

const PERSONALITIES: Personality[] = [
  "expansionist", "hoarder", "trader", "gambler", "defensive", "incompetent",
];

export function createGame(settings: GameSettings): GameState {
  const seedInt = hashSeed(settings.seed);
  const rng = mulberry32(seedInt);

  const { board, robberTileId } = generateBoard(settings, rng);

  const names = shuffle(rng, NPC_NAMES);
  const personalities = shuffle(rng, PERSONALITIES);
  const players: Player[] = [];
  const totalPlayers = settings.npcCount + 1;
  for (let i = 0; i < totalPlayers; i++) {
    const isHuman = i === 0;
    players.push({
      index: i,
      name: isHuman ? "You" : names[(i - 1) % names.length],
      color: PLAYER_COLORS[i].hex,
      colorName: PLAYER_COLORS[i].name,
      isHuman,
      personality: isHuman ? "expansionist" : personalities[(i - 1) % personalities.length],
      resources: emptyBundle(),
      victoryPoints: 0,
      mood: "ready",
      grudges: {},
      lastLine: null,
    });
  }

  // Snake setup order: 0,1,...,n-1, n-1,...,0
  const order = players.map((p) => p.index);
  const setupQueue = [...order, ...order.slice().reverse()];

  const state: GameState = {
    settings,
    board,
    players,
    buildings: {},
    roads: {},
    robberTileId,
    current: setupQueue[0],
    phase: "setup-place",
    turnNumber: 0,
    dice: { d1: 1, d2: 1, rolling: false, nonce: 0, special: null },
    setupQueue,
    setupStage: "settlement",
    setupLastVertex: null,
    winner: null,
    longestRoadOwner: null,
    longestRoadLen: 0,
    worldEvents: [],
    rivalries: [],
    seedInt,
    rngCursor: 1,
    log: [],
    stats: {
      produced: Object.fromEntries(players.map((p) => [p.index, 0])),
      trades: 0,
      robberMoves: 0,
      sevensRolled: 0,
      rollCounts: {},
      biggestProduction: 0,
      sheepMobilized: 0,
    },
  };
  log(state, `A new world unfurls. Seed: ${settings.seed}`, "epic");
  log(state, `${players[state.current].name} places first.`);
  return state;
}

export function refreshVictoryPoints(state: GameState) {
  for (const p of state.players) p.victoryPoints = computeVictoryPoints(state, p.index);
}

function checkWin(state: GameState) {
  refreshVictoryPoints(state);
  for (const p of state.players) {
    if (p.victoryPoints >= state.settings.victoryTarget) {
      state.winner = p.index;
      state.phase = "over";
      log(state, `${p.name} reaches ${p.victoryPoints} points and WINS.`, "epic");
      return;
    }
  }
}

// ---- Setup placement ----------------------------------------------------

export function setupPlaceSettlement(state: GameState, vertexId: number) {
  if (state.phase !== "setup-place" || state.setupStage !== "settlement") return;
  const owner = state.current;
  const rng = makeStateRng(state);
  const name = generateSettlementName(rng);
  state.buildings[vertexId] = { vertexId, owner, kind: "settlement", name, specialization: null };
  state.setupStage = "road";
  state.setupLastVertex = vertexId;

  // Second settlement (second pass) grants starting resources.
  const placedCount = Object.values(state.buildings).filter((b) => b.owner === owner).length;
  if (placedCount === 2) {
    const v = state.board.vertices[vertexId];
    for (const tid of v.tileIds) {
      const res = state.board.tiles[tid].resource;
      if (res) state.players[owner].resources[res] += 1;
    }
  }
  log(state, `${state.players[owner].name} founds ${name}.`, "good");
  refreshVictoryPoints(state);
}

export function setupPlaceRoad(state: GameState, edgeId: string) {
  if (state.phase !== "setup-place" || state.setupStage !== "road") return;
  const owner = state.current;
  state.roads[edgeId] = { edgeId, owner };
  state.setupStage = "settlement";
  state.setupLastVertex = null;
  state.setupQueue.shift();

  if (state.setupQueue.length === 0) {
    state.phase = "roll";
    state.current = state.players[0].index;
    state.turnNumber = 1;
    const lr = recomputeLongestRoad(state);
    state.longestRoadOwner = lr.owner;
    state.longestRoadLen = lr.len;
    log(state, `Setup complete. ${state.players[state.current].name}'s turn.`, "epic");
  } else {
    state.current = state.setupQueue[0];
    log(state, `${state.players[state.current].name} places.`);
  }
}

// ---- Dice & production --------------------------------------------------

export interface RollOutcome {
  roll: number;
  activatedTileIds: string[];
  gained: Record<number, Partial<Record<ResourceType, number>>>;
  seven: boolean;
  combos: string[];
}

export function rollDice(state: GameState): RollOutcome | null {
  if (state.phase !== "roll") return null;
  const rng = makeStateRng(state);
  let d1 = 1 + Math.floor(rng() * 6);
  let d2 = 1 + Math.floor(rng() * 6);

  // rare dice spectacle (cosmetic; result stays deterministic once chosen)
  let special: string | null = null;
  const flair = makeStateRng(state)();
  if (flair < 0.05) special = "THE DICE ARE ENORMOUS";
  else if (flair < 0.09) special = "A MYSTERIOUS THIRD DIE APPEARS";
  else if (flair < 0.12) special = "THE DICE CATCH FIRE";

  const roll = d1 + d2;
  state.dice = { d1, d2, rolling: true, nonce: state.dice.nonce + 1, special };
  state.stats.rollCounts[roll] = (state.stats.rollCounts[roll] ?? 0) + 1;

  if (roll === 7) {
    state.stats.sevensRolled++;
    handleSeven(state);
    return { roll, activatedTileIds: [], gained: {}, seven: true, combos: [] };
  }

  const prod = computeProduction(state, roll);
  // resolve gold wildcard picks deterministically
  const gained: Record<number, Partial<Record<ResourceType, number>>> = {};
  for (const key in prod.perPlayer) {
    const owner = Number(key);
    gained[owner] = { ...prod.perPlayer[owner] };
  }
  for (const key in prod.goldPicks) {
    const owner = Number(key);
    const picks = prod.goldPicks[owner];
    const gr = makeStateRng(state);
    for (let i = 0; i < picks.length; i++) {
      const res = (["wood", "brick", "sheep", "wheat", "ore"] as ResourceType[])[
        Math.floor(gr() * 5)
      ];
      gained[owner] ??= {};
      gained[owner][res] = (gained[owner][res] ?? 0) + 1;
    }
  }

  // apply
  let totalThisRoll = 0;
  for (const key in gained) {
    const owner = Number(key);
    for (const res in gained[owner]) {
      const amt = gained[owner][res as ResourceType] ?? 0;
      state.players[owner].resources[res as ResourceType] += amt;
      state.stats.produced[owner] += amt;
      totalThisRoll += amt;
      if (res === "sheep") state.stats.sheepMobilized += amt;
    }
  }
  state.stats.biggestProduction = Math.max(state.stats.biggestProduction, totalThisRoll);

  // combos (feedback flavor derived from the actual event)
  const combos = deriveCombos(prod.activatedTileIds, gained, totalThisRoll);

  const rollDesc = Object.keys(gained).length
    ? `Production! ${totalThisRoll} resources distributed.`
    : `${roll} rolled — nothing produced.`;
  log(state, `${state.players[state.current].name} rolls ${roll}. ${rollDesc}`, totalThisRoll > 0 ? "good" : "info");

  state.phase = "build";
  return { roll, activatedTileIds: prod.activatedTileIds, gained, seven: false, combos };
}

function deriveCombos(
  tiles: string[],
  gained: Record<number, Partial<Record<ResourceType, number>>>,
  total: number,
): string[] {
  const out: string[] = [];
  const humanGain = gained[0] ? totalOf(gained[0]) : 0;
  if (tiles.length >= 3) out.push("SUPPLY CHAIN");
  if (humanGain >= 4) out.push("DOUBLE HARVEST");
  if ((gained[0]?.sheep ?? 0) >= 3) out.push("THE SHEEP HAVE SPOKEN");
  if ((gained[0]?.wheat ?? 0) >= 3) out.push("ABSURD WHEAT EVENT");
  if ((gained[0]?.ore ?? 0) >= 3) out.push("INDUSTRIAL INCIDENT");
  if (total >= 8) out.push("PORT ECONOMY");
  return out;
}

function totalOf(b: Partial<Record<ResourceType, number>>): number {
  return (["wood", "brick", "sheep", "wheat", "ore"] as ResourceType[]).reduce(
    (a, k) => a + (b[k] ?? 0),
    0,
  );
}

function handleSeven(state: GameState) {
  log(state, `Seven! The robber stirs.`, "bad");
  // discard for anyone over the hand limit
  for (const p of state.players) {
    const t = totalCards(p.resources);
    if (t > HAND_LIMIT) {
      let toDiscard = Math.floor(t / 2);
      const order: ResourceType[] = ["sheep", "wood", "brick", "wheat", "ore"];
      while (toDiscard > 0) {
        const res = order.find((r) => p.resources[r] > 0);
        if (!res) break;
        p.resources[res]--;
        toDiscard--;
      }
      log(state, `${p.name} discards to ${totalCards(p.resources)} cards.`, "bad");
    }
  }
  state.phase = "robber-move";
}

// ---- Robber -------------------------------------------------------------

export function moveRobber(state: GameState, tileId: string): number[] {
  if (state.phase !== "robber-move") return [];
  if (tileId === state.robberTileId) return [];
  state.robberTileId = tileId;
  state.stats.robberMoves++;
  log(state, `Robber moves to ${state.board.tiles[tileId].id}.`, "bad");

  const tile = state.board.tiles[tileId];
  const victims = new Set<number>();
  for (const vid of tile.cornerVertexIds) {
    const b = state.buildings[vid];
    if (b && b.owner !== state.current && totalCards(state.players[b.owner].resources) > 0) {
      victims.add(b.owner);
    }
  }
  const list = [...victims];
  if (list.length === 0) {
    state.phase = "build";
    return [];
  }
  state.phase = "robber-steal";
  return list;
}

export function stealFrom(state: GameState, victim: number) {
  if (state.phase !== "robber-steal") return;
  const vres = state.players[victim].resources;
  const available: ResourceType[] = [];
  (["wood", "brick", "sheep", "wheat", "ore"] as ResourceType[]).forEach((r) => {
    for (let i = 0; i < vres[r]; i++) available.push(r);
  });
  if (available.length > 0) {
    const rng = makeStateRng(state);
    const res = available[Math.floor(rng() * available.length)];
    vres[res]--;
    state.players[state.current].resources[res]++;
    // grudge!
    const g = state.players[victim].grudges;
    g[state.current] = (g[state.current] ?? 0) + 2;
    if (state.settings.chaos.friendlyRobber) {
      // consolation
      state.players[victim].resources.sheep += 1;
    }
    log(state, `${state.players[state.current].name} steals from ${state.players[victim].name}.`, "bad");
  }
  state.phase = "build";
}

export function autoRobber(state: GameState) {
  // pick a tile with most enemy buildings, not the current robber tile
  let bestTile = state.robberTileId;
  let bestScore = -1;
  for (const tid of state.board.tileOrder) {
    if (tid === state.robberTileId) continue;
    const tile = state.board.tiles[tid];
    let score = 0;
    for (const vid of tile.cornerVertexIds) {
      const b = state.buildings[vid];
      if (b && b.owner !== state.current) score += b.kind === "settlement" ? 1 : 2;
    }
    if (score > bestScore) {
      bestScore = score;
      bestTile = tid;
    }
  }
  const victims = moveRobber(state, bestTile!);
  if (state.phase === "robber-steal" && victims.length > 0) {
    stealFrom(state, victims[Math.floor(makeStateRng(state)() * victims.length)]);
  }
}

// ---- Building -----------------------------------------------------------

export function buildRoad(state: GameState, edgeId: string): boolean {
  const owner = state.current;
  if (!canAfford(state.players[owner].resources, COSTS.road)) return false;
  state.players[owner].resources = pay(state.players[owner].resources, COSTS.road);
  state.roads[edgeId] = { edgeId, owner };
  const lr = recomputeLongestRoad(state);
  const prev = state.longestRoadOwner;
  state.longestRoadOwner = lr.owner;
  state.longestRoadLen = lr.len;
  if (lr.owner === owner && prev !== owner) {
    log(state, `${state.players[owner].name} seizes the Longest Road! (+2)`, "epic");
  }
  log(state, `${state.players[owner].name} builds a terrible road.`, "good");
  checkWin(state);
  return true;
}

export function buildSettlement(state: GameState, vertexId: number): boolean {
  const owner = state.current;
  if (!canAfford(state.players[owner].resources, COSTS.settlement)) return false;
  state.players[owner].resources = pay(state.players[owner].resources, COSTS.settlement);
  const rng = makeStateRng(state);
  const name = generateSettlementName(rng);
  state.buildings[vertexId] = { vertexId, owner, kind: "settlement", name, specialization: null };
  log(state, `${state.players[owner].name} founds ${name}.`, "good");
  checkWin(state);
  return true;
}

export function buildCity(state: GameState, vertexId: number): boolean {
  const owner = state.current;
  const b = state.buildings[vertexId];
  if (!b || b.owner !== owner || b.kind !== "settlement") return false;
  if (!canAfford(state.players[owner].resources, COSTS.city)) return false;
  state.players[owner].resources = pay(state.players[owner].resources, COSTS.city);
  b.kind = "city";
  // assign a specialization based on adjacent biomes
  b.specialization = pickSpecialization(state, vertexId);
  log(state, `${b.name} rises into a CITY. ${state.players[owner].name}'s skyline grows.`, "epic");
  checkWin(state);
  return true;
}

export function buildMegacity(state: GameState, vertexId: number): boolean {
  const owner = state.current;
  const b = state.buildings[vertexId];
  if (!b || b.owner !== owner || b.kind !== "city") return false;
  if (!canAfford(state.players[owner].resources, COSTS.megacity)) return false;
  state.players[owner].resources = pay(state.players[owner].resources, COSTS.megacity);
  b.kind = "megacity";
  const rng = makeStateRng(state);
  const title = generateCivTitle(rng);
  state.players[owner].mood = "ascendant";
  log(state, `${b.name} becomes a MEGA CITY — the ${title} of ${state.players[owner].name}!`, "epic");
  checkWin(state);
  return true;
}

function pickSpecialization(state: GameState, vertexId: number): Specialization {
  const v = state.board.vertices[vertexId];
  const counts: Record<string, number> = {};
  for (const tid of v.tileIds) {
    const res = state.board.tiles[tid].resource;
    if (res) counts[res] = (counts[res] ?? 0) + 1;
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const map: Record<string, Specialization> = {
    ore: "industrial",
    wheat: "agricultural",
    sheep: "sheep",
    wood: "research",
    brick: "trade",
  };
  return map[best ?? "wheat"] ?? "trade";
}

// ---- Trading ------------------------------------------------------------

export function bankRate(state: GameState, owner: number, give: ResourceType): number {
  // check ports owned by this player
  let rate = 4;
  for (const b of Object.values(state.buildings)) {
    if (b.owner !== owner) continue;
    const port = state.board.vertices[b.vertexId].port;
    if (port === "any") rate = Math.min(rate, 3);
    if (port === give) rate = Math.min(rate, 2);
    if (b.specialization === "trade") rate = Math.min(rate, rate - 1);
  }
  // hostile market chaos already folded into world events elsewhere
  return Math.max(2, rate);
}

export function bankTrade(state: GameState, give: ResourceType, want: ResourceType): boolean {
  const owner = state.current;
  const rate = bankRate(state, owner, give);
  if (state.players[owner].resources[give] < rate) return false;
  if (give === want) return false;
  state.players[owner].resources[give] -= rate;
  state.players[owner].resources[want] += 1;
  state.stats.trades++;
  log(state, `${state.players[owner].name} trades ${rate} ${give} → 1 ${want}.`);
  return true;
}

// ---- Turn flow ----------------------------------------------------------

export function endTurn(state: GameState) {
  if (state.phase === "over") return;
  // world events tick
  tickWorldEvents(state);
  detectRivalries(state);

  const n = state.players.length;
  state.current = (state.current + 1) % n;
  state.phase = "roll";
  if (state.current === 0) state.turnNumber++;
  state.players[state.current].lastLine = null;
  log(state, `— ${state.players[state.current].name}'s turn —`);

  // chance of a world event
  maybeSpawnWorldEvent(state);
}

function tickWorldEvents(state: GameState) {
  for (const e of state.worldEvents) e.turnsLeft--;
  const expired = state.worldEvents.filter((e) => e.turnsLeft <= 0);
  for (const e of expired) log(state, `${e.title} has ended.`);
  state.worldEvents = state.worldEvents.filter((e) => e.turnsLeft > 0);
}

function maybeSpawnWorldEvent(state: GameState) {
  if (!state.settings.chaos.worldEvents) return;
  if (state.worldEvents.length > 0) return;
  const rng = makeStateRng(state);
  if (rng() > 0.22) return;
  const kinds = ["boom", "storm", "festival", "market-panic", "sheep-surge"] as const;
  const kind = kinds[Math.floor(rng() * kinds.length)];
  const tiles = state.board.tileOrder;
  const tile = tiles[Math.floor(rng() * tiles.length)];
  const biomes: ResourceType[] = ["wood", "brick", "sheep", "wheat", "ore"];
  const biome = biomes[Math.floor(rng() * biomes.length)];
  const evMap = {
    boom: { title: "RESOURCE BOOM", description: `${biome} tiles yield +1 this round.`, affectedBiome: biome },
    storm: { title: "STORM", description: `A tile is battered and produces nothing.`, affectedTileId: tile },
    festival: { title: "FESTIVAL", description: `The board is festive. Morale rises.` },
    "market-panic": { title: "MARKET PANIC", description: `Bank rates wobble. Trade carefully.` },
    "sheep-surge": { title: "SUSPICIOUSLY PRODUCTIVE SHEEP", description: `Sheep are... concerning this round.`, affectedBiome: "sheep" as ResourceType },
  } as const;
  const info = evMap[kind];
  state.worldEvents.push({
    id: `ev-${state.turnNumber}-${Math.floor(rng() * 999)}`,
    title: info.title,
    description: info.description,
    turnsLeft: 3,
    kind,
    affectedTileId: "affectedTileId" in info ? info.affectedTileId : undefined,
    affectedBiome: "affectedBiome" in info ? (info.affectedBiome as any) : undefined,
  });
  log(state, `WORLD EVENT: ${info.title} — ${info.description}`, "epic");
}

function detectRivalries(state: GameState) {
  const flags: GameState["rivalries"] = [];
  const labels = ["TRADE WAR", "BORDER DISPUTE", "PERSONAL FOR SOME REASON", "THE SHEEP INCIDENT", "ROAD-BASED HATRED"];
  for (let a = 0; a < state.players.length; a++) {
    for (let b = a + 1; b < state.players.length; b++) {
      const g = (state.players[a].grudges[b] ?? 0) + (state.players[b].grudges[a] ?? 0);
      if (g >= 3) {
        flags.push({ a, b, label: labels[(a + b) % labels.length] });
      }
    }
  }
  state.rivalries = flags;
}

// Utility used by UI and AI
export function affordable(state: GameState, kind: keyof typeof COSTS, owner: number): boolean {
  return canAfford(state.players[owner].resources, COSTS[kind]);
}

export { VP_FOR, PERSONALITY_INFO };
export type { Building };
