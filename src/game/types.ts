// Core game data model. Kept renderer-agnostic: 3D code consumes these,
// never the other way around.

export type ResourceType = "wood" | "brick" | "sheep" | "wheat" | "ore";
export const RESOURCES: ResourceType[] = ["wood", "brick", "sheep", "wheat", "ore"];

// Biome per tile. "desert" produces nothing. "gold" is the chaos Golden Hex.
export type Biome = ResourceType | "desert" | "gold";

export type ResourceBundle = Record<ResourceType, number>;

export interface Tile {
  id: string; // "q,r"
  q: number;
  r: number;
  biome: Biome;
  resource: ResourceType | null; // null for desert; gold resolves to a random resource per production
  number: number | null; // dice number 2..12 (not 7), null for desert
  cornerVertexIds: number[]; // 6 vertex ids, ordered
  cx: number; // world x of center
  cz: number; // world z of center
}

export interface Vertex {
  id: number;
  x: number;
  z: number;
  tileIds: string[]; // tiles touching this vertex (1..3)
  neighborVertexIds: number[]; // via edges
  edgeIds: string[];
  port: PortType | null;
}

export interface Edge {
  id: string; // "a-b" with a<b vertex ids
  a: number;
  b: number;
  tileIds: string[]; // tiles bordering this edge (1..2)
}

export type PortType = ResourceType | "any"; // "any" = 3:1, resource = 2:1

export type BuildingKind = "settlement" | "city" | "megacity";

export interface Building {
  vertexId: number;
  owner: number; // player index
  kind: BuildingKind;
  name: string;
  specialization: Specialization | null;
}

export interface Road {
  edgeId: string;
  owner: number;
}

export type Specialization =
  | "industrial"
  | "trade"
  | "agricultural"
  | "sheep"
  | "research";

export interface BoardGraph {
  radius: number;
  tiles: Record<string, Tile>;
  vertices: Vertex[];
  edges: Record<string, Edge>;
  tileOrder: string[];
}

export type Personality =
  | "expansionist"
  | "hoarder"
  | "trader"
  | "gambler"
  | "defensive"
  | "incompetent";

export interface Player {
  index: number;
  name: string;
  color: string;
  colorName: string;
  isHuman: boolean;
  personality: Personality;
  resources: ResourceBundle;
  victoryPoints: number; // derived-ish but stored for display; recomputed on change
  // emotional / social state
  mood: string;
  grudges: Record<number, number>; // playerIndex -> grudge score
  lastLine: string | null;
}

export type Phase =
  | "setup-place" // initial placement (snake)
  | "roll" // waiting to roll
  | "build" // main action phase
  | "robber-move" // must move robber
  | "robber-steal"
  | "over";

// A single pending placement request from the UI/AI.
export type BuildMode =
  | null
  | { kind: "road" }
  | { kind: "settlement" }
  | { kind: "city" }
  | { kind: "megacity" };

export interface WorldEvent {
  id: string;
  title: string;
  description: string;
  turnsLeft: number;
  affectedTileId?: string;
  affectedBiome?: Biome;
  kind:
    | "boom"
    | "storm"
    | "festival"
    | "market-panic"
    | "meteor"
    | "sheep-surge";
}

export interface ChaosModifiers {
  turbo: boolean;
  friendlyRobber: boolean;
  npcDrama: boolean;
  maxSheep: boolean;
  goldenHex: boolean;
  worldEvents: boolean;
}

export interface GameSettings {
  mapSize: "small" | "medium" | "large";
  npcCount: number;
  victoryTarget: number;
  seed: string;
  chaos: ChaosModifiers;
}

export interface RivalryFlag {
  a: number;
  b: number;
  label: string;
}

export interface DiceState {
  d1: number;
  d2: number;
  rolling: boolean;
  nonce: number; // increments each roll to retrigger animation
  special: string | null; // rare dice event label
}

export interface GameState {
  settings: GameSettings;
  board: BoardGraph;
  players: Player[];
  buildings: Record<number, Building>; // vertexId -> building
  roads: Record<string, Road>; // edgeId -> road
  robberTileId: string | null;

  current: number; // active player index
  phase: Phase;
  turnNumber: number;
  dice: DiceState;

  // setup phase bookkeeping
  setupQueue: number[]; // remaining placements as player indices (snake)
  setupStage: "settlement" | "road";
  setupLastVertex: number | null;

  winner: number | null;
  longestRoadOwner: number | null;
  longestRoadLen: number;

  worldEvents: WorldEvent[];
  rivalries: RivalryFlag[];

  seedInt: number;
  rngCursor: number; // advances so repeated rolls differ deterministically

  log: LogEntry[];
  stats: MatchStats;
}

export interface LogEntry {
  id: number;
  text: string;
  kind: "info" | "good" | "bad" | "epic";
}

export interface MatchStats {
  produced: Record<number, number>;
  trades: number;
  robberMoves: number;
  sevensRolled: number;
  rollCounts: Record<number, number>; // dice total -> times
  biggestProduction: number;
  sheepMobilized: number;
}
