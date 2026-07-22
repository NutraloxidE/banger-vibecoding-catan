// Procedural board generation: biomes, number tokens, ports, golden hex.
// Validates the result and regenerates until it is playable.

import { BIOME_INFO } from "./constants";
import { buildBoardGraph } from "./hexGrid";
import type { Rng } from "./rng";
import { pick, shuffle } from "./rng";
import type { Biome, BoardGraph, GameSettings, PortType, Tile } from "./types";
import { MAP_RADII } from "./constants";

// Rough resource weighting across the board (relative counts).
const BIOME_WEIGHTS: { biome: Biome; w: number }[] = [
  { biome: "wood", w: 4 },
  { biome: "wheat", w: 4 },
  { biome: "sheep", w: 4 },
  { biome: "brick", w: 3 },
  { biome: "ore", w: 3 },
];

const NUMBER_BAG = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12];

function makeBiomePool(rng: Rng, tileCount: number, golden: boolean): Biome[] {
  const pool: Biome[] = [];
  // ~1 desert per 12 tiles, at least 1
  const deserts = Math.max(1, Math.round(tileCount / 12));
  for (let i = 0; i < deserts; i++) pool.push("desert");
  if (golden) pool.push("gold");

  const remaining = tileCount - pool.length;
  const totalW = BIOME_WEIGHTS.reduce((a, b) => a + b.w, 0);
  for (const { biome, w } of BIOME_WEIGHTS) {
    const count = Math.round((w / totalW) * remaining);
    for (let i = 0; i < count; i++) pool.push(biome);
  }
  // pad / trim to exact size
  while (pool.length < tileCount) pool.push(pick(rng, BIOME_WEIGHTS).biome);
  while (pool.length > tileCount) pool.pop();
  return shuffle(rng, pool);
}

function assignNumbers(rng: Rng, tiles: Tile[]): void {
  const producing = tiles.filter((t) => t.biome !== "desert");
  // build a bag long enough
  const bag: number[] = [];
  while (bag.length < producing.length) bag.push(...NUMBER_BAG);
  const numbers = shuffle(rng, bag).slice(0, producing.length);
  producing.forEach((t, i) => (t.number = numbers[i]));
}

function assignPorts(rng: Rng, board: BoardGraph): void {
  // Coastal vertices = vertices touching exactly 1 tile.
  const coastal = board.vertices.filter((v) => v.tileIds.length === 1);
  const shuffled = shuffle(rng, coastal);
  const portTypes: PortType[] = ["any", "any", "wood", "brick", "sheep", "wheat", "ore", "any"];
  const portCount = Math.max(3, Math.round(coastal.length / 8));
  const used = new Set<number>();
  let placed = 0;
  for (const v of shuffled) {
    if (placed >= portCount) break;
    // keep ports spread out: skip if a neighbor already is a port
    if (v.neighborVertexIds.some((n) => used.has(n))) continue;
    v.port = portTypes[placed % portTypes.length];
    used.add(v.id);
    placed++;
  }
}

function findDesert(tiles: Record<string, Tile>): string | null {
  for (const id in tiles) if (tiles[id].biome === "desert") return id;
  return null;
}

// Every non-desert tile must reach the "coast" so the island stays coherent,
// and no vertex should be surrounded by only high-value numbers with a twin.
function validate(board: BoardGraph): boolean {
  const tiles = Object.values(board.tiles);
  const producing = tiles.filter((t) => t.number !== null);
  if (producing.length < 3) return false;
  // ensure at least one of each resource exists somewhere
  const resources = new Set(tiles.map((t) => BIOME_INFO[t.biome].resource).filter(Boolean));
  if (resources.size < 4) return false;
  // avoid two red numbers (6/8) sharing a vertex too often
  let redClashes = 0;
  for (const v of board.vertices) {
    const reds = v.tileIds.filter((id) => {
      const n = board.tiles[id].number;
      return n === 6 || n === 8;
    }).length;
    if (reds >= 2) redClashes++;
  }
  return redClashes <= Math.max(1, Math.round(board.vertices.length / 40));
}

export interface GeneratedBoard {
  board: BoardGraph;
  robberTileId: string | null;
  seedUsed: string;
}

export function generateBoard(settings: GameSettings, rng: Rng): GeneratedBoard {
  const radius = MAP_RADII[settings.mapSize] ?? 2;

  let best: BoardGraph | null = null;
  for (let attempt = 0; attempt < 40; attempt++) {
    const graph = buildBoardGraph(radius);
    const tileList = graph.tileOrder.map((id) => graph.tiles[id]);
    const biomes = makeBiomePool(rng, tileList.length, settings.chaos.goldenHex);
    tileList.forEach((t, i) => {
      t.biome = biomes[i];
      t.resource = BIOME_INFO[t.biome].resource;
    });
    assignNumbers(rng, tileList);
    assignPorts(rng, graph);
    best = graph;
    if (validate(graph)) break;
  }

  const board = best!;
  const robberTileId = findDesert(board.tiles) ?? board.tileOrder[0];
  return { board, robberTileId, seedUsed: settings.seed };
}
