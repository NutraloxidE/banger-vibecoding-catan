import { BoardModel, EdgeNode, MapSize, Port, PortKind, RESOURCES, Terrain, Tile, VertexNode } from './types';
import { RNG } from './rng';
import { portName } from './names';

const SQRT3 = Math.sqrt(3);

export const MAP_RADIUS: Record<MapSize, number> = { small: 2, medium: 3, large: 4 };

export function tileCenter(q: number, r: number): { x: number; z: number } {
  return { x: SQRT3 * (q + r / 2), z: 1.5 * r };
}

function cornerPos(cx: number, cz: number, k: number): { x: number; z: number } {
  const a = (Math.PI / 180) * (60 * k - 30);
  return { x: cx + Math.cos(a), z: cz + Math.sin(a) };
}

const vkey = (x: number, z: number) => `${Math.round(x * 100)},${Math.round(z * 100)}`;

const AXIAL_DIRS: [number, number][] = [
  [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1],
];

// Probability weight of each dice total (pips on classic tokens)
export const TOKEN_WEIGHT: Record<number, number> = {
  2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1,
};

const TOKEN_CYCLE = [6, 8, 5, 9, 4, 10, 3, 11, 2, 12];
const TERRAIN_CYCLE: Terrain[] = ['forest', 'fields', 'pasture', 'hills', 'mountains', 'forest', 'fields', 'pasture', 'hills', 'mountains', 'forest', 'fields', 'pasture'];

export function generateBoard(mapSize: MapSize, seed: string): BoardModel {
  const rng = new RNG(seed + ':board');
  const radius = MAP_RADIUS[mapSize];

  // enumerate axial coords within radius
  const coords: [number, number][] = [];
  for (let q = -radius; q <= radius; q++) {
    const rMin = Math.max(-radius, -q - radius);
    const rMax = Math.min(radius, -q + radius);
    for (let r = rMin; r <= rMax; r++) coords.push([q, r]);
  }

  const tileCount = coords.length;
  const desertCount = radius <= 2 ? 1 : radius === 3 ? 2 : 3;

  // terrain pool: cycle through a balanced list, add deserts, shuffle
  const terrains: Terrain[] = [];
  for (let i = 0; i < tileCount - desertCount; i++) terrains.push(TERRAIN_CYCLE[i % TERRAIN_CYCLE.length]);
  for (let i = 0; i < desertCount; i++) terrains.push('desert');
  const shuffledTerrain = rng.shuffle(terrains);

  // token pool for non-desert tiles
  const tokenPool: number[] = [];
  for (let i = 0; i < tileCount - desertCount; i++) tokenPool.push(TOKEN_CYCLE[i % TOKEN_CYCLE.length]);

  // build tiles; retry token layout to avoid adjacent 6/8 hot spots
  const coordIndex = new Map<string, number>();
  coords.forEach(([q, r], i) => coordIndex.set(`${q},${r}`, i));

  let bestTokens: (number | null)[] = [];
  for (let attempt = 0; attempt < 50; attempt++) {
    const shuffled = rng.shuffle(tokenPool);
    const tokens: (number | null)[] = [];
    let ti = 0;
    for (let i = 0; i < tileCount; i++) {
      tokens.push(shuffledTerrain[i] === 'desert' ? null : shuffled[ti++]);
    }
    // check hot-spot adjacency
    let ok = true;
    outer: for (let i = 0; i < tileCount; i++) {
      const t = tokens[i];
      if (t !== 6 && t !== 8) continue;
      const [q, r] = coords[i];
      for (const [dq, dr] of AXIAL_DIRS) {
        const ni = coordIndex.get(`${q + dq},${r + dr}`);
        if (ni !== undefined) {
          const nt = tokens[ni];
          if (nt === 6 || nt === 8) { ok = false; break outer; }
        }
      }
    }
    bestTokens = tokens;
    if (ok) break;
  }

  const tiles: Tile[] = coords.map(([q, r], i) => {
    const { x, z } = tileCenter(q, r);
    return { id: i, q, r, x, z, terrain: shuffledTerrain[i], token: bestTokens[i] };
  });

  // geometry: vertices + edges deduped by rounded position
  const vertices: Record<string, VertexNode> = {};
  const edges: Record<string, EdgeNode> = {};

  for (const tile of tiles) {
    const cornerIds: string[] = [];
    for (let k = 0; k < 6; k++) {
      const { x, z } = cornerPos(tile.x, tile.z, k);
      const id = vkey(x, z);
      if (!vertices[id]) vertices[id] = { id, x, z, tiles: [], edges: [], adj: [] };
      if (!vertices[id].tiles.includes(tile.id)) vertices[id].tiles.push(tile.id);
      cornerIds.push(id);
    }
    for (let k = 0; k < 6; k++) {
      const a = cornerIds[k];
      const b = cornerIds[(k + 1) % 6];
      const id = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (!edges[id]) {
        const va = vertices[a];
        const vb = vertices[b];
        const x = (va.x + vb.x) / 2;
        const z = (va.z + vb.z) / 2;
        const rot = Math.atan2(-(vb.z - va.z), vb.x - va.x);
        edges[id] = { id, a: a < b ? a : b, b: a < b ? b : a, x, z, rot, tiles: [] };
      }
      if (!edges[id].tiles.includes(tile.id)) edges[id].tiles.push(tile.id);
    }
  }

  for (const e of Object.values(edges)) {
    vertices[e.a].edges.push(e.id);
    vertices[e.b].edges.push(e.id);
    vertices[e.a].adj.push(e.b);
    vertices[e.b].adj.push(e.a);
  }

  const base: BoardModel = { radius, tiles, vertices, edges, ports: [] };
  base.ports = generatePorts(base, seed);
  return base;
}

// Ports sit on coastal edges (edges touching exactly one tile). Catan-style:
// 4-ish generic 3:1 harbors + one 2:1 harbor per resource, spaced around the
// coast and never sharing a vertex (so each harbor's two vertices are its own).
export function generatePorts(board: BoardModel, seed: string): Port[] {
  const rng = new RNG(seed + ':ports');
  const coastal = Object.values(board.edges).filter((e) => e.tiles.length === 1);
  if (coastal.length === 0) return [];

  // walk the coast in angular order so picks spread evenly around the ring
  const ordered = coastal
    .map((e) => ({ e, ang: Math.atan2(e.z, e.x) }))
    .sort((a, b) => a.ang - b.ang);

  const target = Math.max(4, Math.min(9, Math.round(coastal.length / 2.4)));
  const usedV = new Set<string>();
  const picked: EdgeNode[] = [];
  const minGap = ((2 * Math.PI) / target) * 0.6;

  let lastAng = -Infinity;
  for (const { e, ang } of ordered) {
    if (picked.length >= target) break;
    if (usedV.has(e.a) || usedV.has(e.b)) continue;
    if (ang - lastAng < minGap) continue;
    picked.push(e); usedV.add(e.a); usedV.add(e.b); lastAng = ang;
  }
  // top up (ignoring the spacing gap, still no shared vertices) if short
  if (picked.length < target) {
    for (const { e } of ordered) {
      if (picked.length >= target) break;
      if (usedV.has(e.a) || usedV.has(e.b)) continue;
      picked.push(e); usedV.add(e.a); usedV.add(e.b);
    }
  }

  // kinds: one 2:1 per resource first (if room), then generic 3:1, shuffled
  const kinds: PortKind[] = [];
  const resPool = rng.shuffle([...RESOURCES]);
  for (let i = 0; i < picked.length; i++) kinds.push(i < resPool.length ? resPool[i] : 'generic');
  const finalKinds = rng.shuffle(kinds);

  return picked.map((e, i) => {
    const kind = finalKinds[i];
    const len = Math.hypot(e.x, e.z) || 1;
    const ox = e.x / len, oz = e.z / len; // outward from board center
    const off = 0.6;
    const nrng = new RNG(seed + ':portname:' + e.id);
    return {
      id: e.id,
      edge: e.id,
      vertices: [e.a, e.b] as [string, string],
      x: e.x + ox * off,
      z: e.z + oz * off,
      angle: Math.atan2(oz, ox),
      kind,
      rate: kind === 'generic' ? 3 : 2,
      name: portName(nrng, kind),
    };
  });
}

// Golden Hex chaos modifier: deterministic pick so the setup preview can
// show the exact tile the match will use.
export function pickGoldenTile(board: BoardModel, seed: string): number | null {
  const rng = new RNG(seed + ':golden');
  const candidates = board.tiles.filter((t) => t.token !== null);
  if (candidates.length === 0) return null;
  return rng.pick(candidates).id;
}

export function desertTileId(board: BoardModel): number {
  const d = board.tiles.find((t) => t.terrain === 'desert');
  return d ? d.id : 0;
}

// Score a vertex by production probability + resource diversity (used by AI + placement hints)
export function vertexScore(board: BoardModel, vertexId: string): number {
  const v = board.vertices[vertexId];
  if (!v) return 0;
  let score = 0;
  const seen = new Set<string>();
  for (const tid of v.tiles) {
    const t = board.tiles[tid];
    if (t.token) score += TOKEN_WEIGHT[t.token] ?? 0;
    if (t.terrain !== 'desert') seen.add(t.terrain);
  }
  // harbor-adjacent corners are strategically valuable — nudge AI + hints
  if (board.ports.some((p) => p.vertices.includes(vertexId))) score += 2;
  return score + seen.size * 0.6;
}
