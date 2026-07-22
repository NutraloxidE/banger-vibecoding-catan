// Pure rules: what can be placed where, what things cost, what a roll produces.
// No rendering, no randomness except where a passed-in Rng is used.

import { COSTS, LONGEST_ROAD_MIN, VP_FOR } from "./constants";
import type {
  BoardGraph,
  Building,
  GameState,
  ResourceBundle,
  ResourceType,
  Road,
} from "./types";

export function canAfford(res: ResourceBundle, cost: Partial<ResourceBundle>): boolean {
  return (Object.keys(cost) as ResourceType[]).every((k) => res[k] >= (cost[k] ?? 0));
}

export function pay(res: ResourceBundle, cost: Partial<ResourceBundle>): ResourceBundle {
  const out = { ...res };
  (Object.keys(cost) as ResourceType[]).forEach((k) => (out[k] -= cost[k] ?? 0));
  return out;
}

export function gain(res: ResourceBundle, add: Partial<ResourceBundle>): ResourceBundle {
  const out = { ...res };
  (Object.keys(add) as ResourceType[]).forEach((k) => (out[k] += add[k] ?? 0));
  return out;
}

export function totalCards(res: ResourceBundle): number {
  return res.wood + res.brick + res.sheep + res.wheat + res.ore;
}

export const cost = (k: keyof typeof COSTS) => COSTS[k];

// ---- Placement validity -------------------------------------------------

export function ownRoadsTouchingVertex(state: GameState, vertexId: number, owner: number): boolean {
  const v = state.board.vertices[vertexId];
  return v.edgeIds.some((eid) => state.roads[eid]?.owner === owner);
}

// Vertices where `owner` may place a settlement.
export function validSettlementVertices(state: GameState, owner: number, setup: boolean): number[] {
  const out: number[] = [];
  for (const v of state.board.vertices) {
    if (state.buildings[v.id]) continue; // occupied
    // distance rule: no adjacent occupied vertex
    if (v.neighborVertexIds.some((n) => state.buildings[n])) continue;
    if (!setup) {
      // must connect to own road
      if (!ownRoadsTouchingVertex(state, v.id, owner)) continue;
    }
    out.push(v.id);
  }
  return out;
}

// Edges where `owner` may place a road.
export function validRoadEdges(state: GameState, owner: number, setupFromVertex?: number): string[] {
  const out: string[] = [];
  for (const eid in state.board.edges) {
    if (state.roads[eid]) continue; // occupied
    const e = state.board.edges[eid];
    if (setupFromVertex !== undefined) {
      if (e.a === setupFromVertex || e.b === setupFromVertex) out.push(eid);
      continue;
    }
    // connected to own road or own building at either endpoint,
    // and not passing "through" an enemy settlement (Catan rule, simplified:
    // a road can extend from a vertex only if you own it or it's empty)
    const endpoints = [e.a, e.b];
    const connected = endpoints.some((vid) => {
      const b = state.buildings[vid];
      if (b && b.owner === owner) return true;
      if (b && b.owner !== owner) return false; // blocked by enemy building
      // else empty vertex: connected if an own road touches it
      return ownRoadsTouchingVertex(state, vid, owner);
    });
    if (connected) out.push(eid);
  }
  return out;
}

export function validCityVertices(state: GameState, owner: number): number[] {
  return Object.values(state.buildings)
    .filter((b) => b.owner === owner && b.kind === "settlement")
    .map((b) => b.vertexId);
}

// Mega city requires a city + a meaningful road network + resource diversity.
export function validMegacityVertices(state: GameState, owner: number): number[] {
  const roadLen = longestRoadForPlayer(state.board, state.roads, owner);
  const netOk = roadLen >= 4;
  if (!netOk) return [];
  return Object.values(state.buildings)
    .filter((b) => b.owner === owner && b.kind === "city")
    .map((b) => b.vertexId);
}

// ---- Production ---------------------------------------------------------

export interface ProductionResult {
  perPlayer: Record<number, Partial<ResourceBundle>>;
  activatedTileIds: string[];
  totalCards: number;
  goldPicks: Record<number, ResourceType[]>;
}

export function computeProduction(state: GameState, roll: number): ProductionResult {
  const perPlayer: Record<number, Partial<ResourceBundle>> = {};
  const activatedTileIds: string[] = [];
  const goldPicks: Record<number, ResourceType[]> = {};
  let total = 0;

  const boomBiome = state.worldEvents.find((e) => e.kind === "boom")?.affectedBiome;
  const stormTile = state.worldEvents.find((e) => e.kind === "storm")?.affectedTileId;

  for (const tileId of state.board.tileOrder) {
    const tile = state.board.tiles[tileId];
    if (tile.number !== roll) continue;
    if (state.robberTileId === tileId) continue; // robber blocks
    if (stormTile === tileId) continue; // storm blocks

    activatedTileIds.push(tileId);
    for (const vid of tile.cornerVertexIds) {
      const b = state.buildings[vid];
      if (!b) continue;
      const amount = b.kind === "settlement" ? 1 : b.kind === "city" ? 2 : 3;
      let boost = 0;
      if (boomBiome && tile.biome === boomBiome) boost += 1;

      let resource = tile.resource;
      if (tile.biome === "gold") {
        // wildcard: owner gets to pick — AI/human handled at apply time;
        // here we just tag it as sheep-ish default and record a gold pick slot.
        resource = null;
      }

      perPlayer[b.owner] ??= {};
      if (resource) {
        perPlayer[b.owner][resource] = (perPlayer[b.owner][resource] ?? 0) + amount + boost;
        total += amount + boost;
        // specialization bonuses
        if (b.specialization === "industrial") {
          perPlayer[b.owner].ore = (perPlayer[b.owner].ore ?? 0) + 1;
          total += 1;
        } else if (b.specialization === "agricultural") {
          perPlayer[b.owner].wheat = (perPlayer[b.owner].wheat ?? 0) + 1;
          total += 1;
        } else if (b.specialization === "sheep") {
          perPlayer[b.owner].sheep = (perPlayer[b.owner].sheep ?? 0) + 1;
          total += 1;
        }
      } else {
        // gold hex wildcard, resolved by caller
        goldPicks[b.owner] ??= [];
        for (let i = 0; i < amount + boost; i++) goldPicks[b.owner].push("wheat");
      }
    }
  }
  return { perPlayer, activatedTileIds, totalCards: total, goldPicks };
}

// ---- Victory points -----------------------------------------------------

export function computeVictoryPoints(state: GameState, player: number): number {
  let vp = 0;
  for (const b of Object.values(state.buildings)) {
    if (b.owner === player) vp += VP_FOR[b.kind];
  }
  if (state.longestRoadOwner === player) vp += 2;
  return vp;
}

// ---- Longest road -------------------------------------------------------

export function longestRoadForPlayer(
  board: BoardGraph,
  roads: Record<string, Road>,
  owner: number,
): number {
  // Build adjacency of the player's road network over vertices.
  const ownEdges = Object.values(roads).filter((r) => r.owner === owner);
  if (ownEdges.length === 0) return 0;
  const adj = new Map<number, { to: number; eid: string }[]>();
  for (const r of ownEdges) {
    const e = board.edges[r.edgeId];
    if (!adj.has(e.a)) adj.set(e.a, []);
    if (!adj.has(e.b)) adj.set(e.b, []);
    adj.get(e.a)!.push({ to: e.b, eid: e.id });
    adj.get(e.b)!.push({ to: e.a, eid: e.id });
  }
  let best = 0;
  const dfs = (v: number, used: Set<string>, len: number) => {
    best = Math.max(best, len);
    for (const nb of adj.get(v) ?? []) {
      if (used.has(nb.eid)) continue;
      used.add(nb.eid);
      dfs(nb.to, used, len + 1);
      used.delete(nb.eid);
    }
  };
  for (const start of adj.keys()) dfs(start, new Set(), 0);
  return best;
}

export function recomputeLongestRoad(state: GameState): {
  owner: number | null;
  len: number;
} {
  let owner: number | null = state.longestRoadOwner;
  let bestLen = 0;
  const lengths: Record<number, number> = {};
  for (const p of state.players) {
    lengths[p.index] = longestRoadForPlayer(state.board, state.roads, p.index);
    if (lengths[p.index] > bestLen) bestLen = lengths[p.index];
  }
  if (bestLen < LONGEST_ROAD_MIN) return { owner: null, len: bestLen };
  // current holder keeps it on ties
  if (owner !== null && lengths[owner] === bestLen) return { owner, len: bestLen };
  const leaders = state.players.filter((p) => lengths[p.index] === bestLen);
  owner = leaders.length === 1 ? leaders[0].index : owner ?? leaders[0].index;
  return { owner, len: bestLen };
}

export function playerBuildingCount(state: GameState, owner: number, kind: Building["kind"]): number {
  return Object.values(state.buildings).filter((b) => b.owner === owner && b.kind === kind).length;
}
