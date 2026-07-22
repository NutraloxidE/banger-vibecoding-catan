// Pointy-top hex grid on the XZ plane (y is up in 3D).
// Vertices and edges are derived geometrically and de-duplicated by rounded
// world position, which keeps the combinatorics simple and robust.

import { HEX_SIZE } from "./constants";
import type { BoardGraph, Edge, Tile, Vertex } from "./types";

export function axialToWorld(q: number, r: number): { x: number; z: number } {
  const x = HEX_SIZE * Math.sqrt(3) * (q + r / 2);
  const z = HEX_SIZE * 1.5 * r;
  return { x, z };
}

// Corner i of a pointy-top hex, angle = 60*i - 30 degrees.
function corner(cx: number, cz: number, i: number): { x: number; z: number } {
  const angle = (Math.PI / 180) * (60 * i - 30);
  return { x: cx + HEX_SIZE * Math.cos(angle), z: cz + HEX_SIZE * Math.sin(angle) };
}

const key = (x: number, z: number) => `${Math.round(x * 1000)}:${Math.round(z * 1000)}`;

// Tiles of a hexagon-shaped board of the given radius.
function hexBoardCoords(radius: number): { q: number; r: number }[] {
  const out: { q: number; r: number }[] = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      const s = -q - r;
      if (Math.abs(q) <= radius && Math.abs(r) <= radius && Math.abs(s) <= radius) {
        out.push({ q, r });
      }
    }
  }
  return out;
}

export function buildBoardGraph(radius: number): Omit<BoardGraph, "tiles"> & {
  tiles: Record<string, Tile>;
} {
  const coords = hexBoardCoords(radius);

  const vertexByKey = new Map<string, number>();
  const vertices: Vertex[] = [];
  const tiles: Record<string, Tile> = {};
  const tileOrder: string[] = [];

  const getVertex = (x: number, z: number): number => {
    const k = key(x, z);
    let id = vertexByKey.get(k);
    if (id === undefined) {
      id = vertices.length;
      vertexByKey.set(k, id);
      vertices.push({
        id,
        x,
        z,
        tileIds: [],
        neighborVertexIds: [],
        edgeIds: [],
        port: null,
      });
    }
    return id;
  };

  const edges: Record<string, Edge> = {};
  const edgeId = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);

  for (const { q, r } of coords) {
    const id = `${q},${r}`;
    const { x: cx, z: cz } = axialToWorld(q, r);
    const cornerVertexIds: number[] = [];
    for (let i = 0; i < 6; i++) {
      const c = corner(cx, cz, i);
      cornerVertexIds.push(getVertex(c.x, c.z));
    }
    const tile: Tile = {
      id,
      q,
      r,
      biome: "desert",
      resource: null,
      number: null,
      cornerVertexIds,
      cx,
      cz,
    };
    tiles[id] = tile;
    tileOrder.push(id);

    // register vertex<->tile, and the 6 edges of this hex
    for (let i = 0; i < 6; i++) {
      const va = cornerVertexIds[i];
      const vb = cornerVertexIds[(i + 1) % 6];
      if (!vertices[va].tileIds.includes(id)) vertices[va].tileIds.push(id);
      const eid = edgeId(va, vb);
      let edge = edges[eid];
      if (!edge) {
        edge = { id: eid, a: Math.min(va, vb), b: Math.max(va, vb), tileIds: [] };
        edges[eid] = edge;
        vertices[va].neighborVertexIds.push(vb);
        vertices[vb].neighborVertexIds.push(va);
        vertices[va].edgeIds.push(eid);
        vertices[vb].edgeIds.push(eid);
      }
      if (!edge.tileIds.includes(id)) edge.tileIds.push(id);
    }
  }

  return { radius, tiles, vertices, edges, tileOrder };
}

// Two vertices are "settlement-adjacent" if directly connected by an edge.
export function isVertexAdjacent(board: BoardGraph, a: number, b: number): boolean {
  return board.vertices[a].neighborVertexIds.includes(b);
}
