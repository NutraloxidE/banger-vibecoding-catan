import { BuildKind, MatchState, PlayerState, Resource, RESOURCES, TERRAIN_RESOURCE } from './types';

export const COSTS: Record<BuildKind, Partial<Record<Resource, number>>> = {
  road: { wood: 1, brick: 1 },
  settlement: { wood: 1, brick: 1, wheat: 1, sheep: 1 },
  city: { wheat: 2, ore: 3 },
  megacity: { ore: 3, wheat: 2, sheep: 2 },
};

export const VP: Record<'settlement' | 'city' | 'megacity', number> = {
  settlement: 1,
  city: 2,
  megacity: 3,
};

export const MEGA_ROAD_REQ = 6; // roads owned required before a city can go mega
export const LONGEST_ROAD_MIN = 5;

export function canAfford(p: PlayerState, kind: BuildKind): boolean {
  const cost = COSTS[kind];
  return RESOURCES.every((r) => p.resources[r] >= (cost[r] ?? 0));
}

export function payCost(p: PlayerState, kind: BuildKind): void {
  const cost = COSTS[kind];
  for (const r of RESOURCES) p.resources[r] -= cost[r] ?? 0;
}

export function handSize(p: PlayerState): number {
  return RESOURCES.reduce((n, r) => n + p.resources[r], 0);
}

export function roadCount(state: MatchState, pid: number): number {
  return Object.values(state.roads).filter((r) => r.owner === pid).length;
}

export function buildingCount(state: MatchState, pid: number, kind?: 'settlement' | 'city' | 'megacity'): number {
  return Object.values(state.buildings).filter((b) => b.owner === pid && (!kind || b.kind === kind)).length;
}

// --- placement validity -------------------------------------------------

export function validSettlementSpots(state: MatchState, pid: number, setup: boolean): string[] {
  const { board } = state;
  const out: string[] = [];
  for (const v of Object.values(board.vertices)) {
    if (state.buildings[v.id]) continue;
    // distance rule: no building on any adjacent vertex
    if (v.adj.some((a) => state.buildings[a])) continue;
    if (!setup) {
      // must touch own road
      const touches = v.edges.some((e) => state.roads[e]?.owner === pid);
      if (!touches) continue;
    }
    out.push(v.id);
  }
  return out;
}

export function validRoadSpots(state: MatchState, pid: number, anchorVertex?: string | null): string[] {
  const { board } = state;
  const out: string[] = [];
  for (const e of Object.values(board.edges)) {
    if (state.roads[e.id]) continue;
    if (anchorVertex) {
      if (e.a !== anchorVertex && e.b !== anchorVertex) continue;
      out.push(e.id);
      continue;
    }
    // connected via endpoint: own building, or own road through a vertex not blocked by opponent building
    let ok = false;
    for (const vid of [e.a, e.b]) {
      const b = state.buildings[vid];
      if (b && b.owner === pid) { ok = true; break; }
      if (b && b.owner !== pid) continue; // blocked through this vertex
      const v = board.vertices[vid];
      if (v.edges.some((eid) => eid !== e.id && state.roads[eid]?.owner === pid)) { ok = true; break; }
    }
    if (ok) out.push(e.id);
  }
  return out;
}

export function validCitySpots(state: MatchState, pid: number): string[] {
  return Object.values(state.buildings)
    .filter((b) => b.owner === pid && b.kind === 'settlement')
    .map((b) => b.vertex);
}

export function validMegaSpots(state: MatchState, pid: number): string[] {
  if (roadCount(state, pid) < MEGA_ROAD_REQ) return [];
  if (buildingCount(state, pid, 'megacity') >= 1) return []; // one Mega City per civilization
  return Object.values(state.buildings)
    .filter((b) => b.owner === pid && b.kind === 'city')
    .map((b) => b.vertex);
}

export function validSpots(state: MatchState, pid: number, kind: BuildKind): string[] {
  switch (kind) {
    case 'road': return validRoadSpots(state, pid);
    case 'settlement': return validSettlementSpots(state, pid, false);
    case 'city': return validCitySpots(state, pid);
    case 'megacity': return validMegaSpots(state, pid);
  }
}

// --- production ---------------------------------------------------------

export interface GainMap { [pid: number]: Partial<Record<Resource, number>>; }

export function computeProduction(state: MatchState, total: number): GainMap {
  const gains: GainMap = {};
  const { board, config, worldEvent } = state;
  for (const tile of board.tiles) {
    if (tile.token !== total) continue;
    if (tile.id === state.robberTile) continue;
    if (worldEvent?.kind === 'storm' && worldEvent.tileId === tile.id) continue;
    const res = TERRAIN_RESOURCE[tile.terrain];
    if (!res) continue;
    for (const v of Object.values(board.vertices)) {
      if (!v.tiles.includes(tile.id)) continue;
      const b = state.buildings[v.id];
      if (!b) continue;
      let n = b.kind === 'settlement' ? 1 : b.kind === 'city' ? 2 : 3;
      if (config.chaos.turbo) n += 1;
      if (config.chaos.maximumSheep && res === 'sheep') n += 1;
      if (worldEvent?.kind === 'boom' && worldEvent.resource === res) n += 1;
      if (worldEvent?.kind === 'sheepmania' && res === 'sheep') n += 1;
      const g = (gains[b.owner] ??= {});
      g[res] = (g[res] ?? 0) + n;
      // Golden Hex: this tile also drops 1 wildcard resource per building hit
      if (state.goldenTile != null && tile.id === state.goldenTile) {
        const wild = RESOURCES[Math.floor(Math.random() * RESOURCES.length)];
        g[wild] = (g[wild] ?? 0) + 1;
      }
    }
  }
  return gains;
}

// --- bank trade rate ----------------------------------------------------

// Harbors a player controls (owns a building on an adjacent vertex).
export function ownedPorts(state: MatchState, pid: number) {
  return state.board.ports.filter((p) =>
    p.vertices.some((v) => state.buildings[v]?.owner === pid));
}

// Best harbor rate this player can get when giving `give`.
export function portRate(state: MatchState, pid: number, give: Resource): number {
  let best = 4;
  for (const p of ownedPorts(state, pid)) {
    if (p.kind === 'generic') best = Math.min(best, 3);
    else if (p.kind === give) best = Math.min(best, 2);
  }
  return best;
}

export function bankRate(state: MatchState, give: Resource): number {
  let rate = 4;
  if (state.worldEvent?.kind === 'festival') rate = 3;
  if (state.config.chaos.maximumSheep && give === 'sheep') rate = Math.min(rate, 2);
  // harbors belong to whoever is currently trading (their turn)
  rate = Math.min(rate, portRate(state, state.current, give));
  return rate;
}

// --- longest road -------------------------------------------------------

export function longestRoadLength(state: MatchState, pid: number): number {
  const { board } = state;
  const myEdges = Object.values(state.roads).filter((r) => r.owner === pid).map((r) => r.edge);
  if (myEdges.length === 0) return 0;
  const edgeSet = new Set(myEdges);
  let best = 0;

  const walk = (vertex: string, used: Set<string>): number => {
    // an opponent building on this vertex cuts the path
    const b = state.buildings[vertex];
    if (b && b.owner !== pid) return 0;
    let localBest = 0;
    const v = board.vertices[vertex];
    for (const eid of v.edges) {
      if (!edgeSet.has(eid) || used.has(eid)) continue;
      used.add(eid);
      const e = board.edges[eid];
      const next = e.a === vertex ? e.b : e.a;
      localBest = Math.max(localBest, 1 + walk(next, used));
      used.delete(eid);
    }
    return localBest;
  };

  for (const eid of myEdges) {
    const e = board.edges[eid];
    for (const start of [e.a, e.b]) {
      best = Math.max(best, walk(start, new Set()));
    }
  }
  return best;
}

export function computeVp(state: MatchState, pid: number): number {
  let vp = 0;
  for (const b of Object.values(state.buildings)) {
    if (b.owner === pid) vp += VP[b.kind];
  }
  if (state.longestRoad?.owner === pid) vp += 2;
  if (state.largestArmy?.owner === pid) vp += 2;
  vp += state.players[pid].devVp; // Victory Point cards
  return vp;
}
