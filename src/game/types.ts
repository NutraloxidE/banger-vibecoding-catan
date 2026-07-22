export type Terrain = 'forest' | 'hills' | 'fields' | 'pasture' | 'mountains' | 'desert';
export type Resource = 'wood' | 'brick' | 'wheat' | 'sheep' | 'ore';

export const RESOURCES: Resource[] = ['wood', 'brick', 'wheat', 'sheep', 'ore'];

export const TERRAIN_RESOURCE: Record<Terrain, Resource | null> = {
  forest: 'wood',
  hills: 'brick',
  fields: 'wheat',
  pasture: 'sheep',
  mountains: 'ore',
  desert: null,
};

export interface Tile {
  id: number;
  q: number;
  r: number;
  x: number;
  z: number;
  terrain: Terrain;
  token: number | null; // 2-12, never 7, null for desert
}

export interface VertexNode {
  id: string;
  x: number;
  z: number;
  tiles: number[]; // adjacent tile ids
  edges: string[]; // adjacent edge ids
  adj: string[]; // adjacent vertex ids
}

export interface EdgeNode {
  id: string;
  a: string; // vertex id
  b: string; // vertex id
  x: number;
  z: number;
  rot: number; // rotation.y for a box aligned along the edge
  tiles: number[];
}

export interface BoardModel {
  radius: number;
  tiles: Tile[];
  vertices: Record<string, VertexNode>;
  edges: Record<string, EdgeNode>;
}

export type BuildKind = 'road' | 'settlement' | 'city' | 'megacity';

export interface Building {
  vertex: string;
  owner: number;
  kind: 'settlement' | 'city' | 'megacity';
  name: string;
}

export interface Road {
  edge: string;
  owner: number;
}

export type Personality = 'expansionist' | 'hoarder' | 'trader' | 'gambler' | 'builder' | 'sleeper';
export type Difficulty = 'chill' | 'normal' | 'ruthless';
export type MapSize = 'small' | 'medium' | 'large';

export interface ChaosFlags {
  turbo: boolean;
  friendlyRobber: boolean;
  maximumSheep: boolean;
  drama: boolean;
  goldenHex: boolean;
}

export interface MatchConfig {
  mapSize: MapSize;
  npcCount: number; // 1..3
  difficulty: Difficulty;
  targetVp: number;
  seed: string;
  worldEvents: boolean;
  chaos: ChaosFlags;
}

export interface PlayerStats {
  produced: number;
  producedBy: Record<Resource, number>;
  tradesBank: number;
  tradesNpc: number;
  roadsBuilt: number;
  settlementsBuilt: number;
  citiesBuilt: number;
  megasBuilt: number;
  timesRobbed: number;
  robberiesDone: number;
  biggestHarvest: number;
  tradesRejected: number;
}

export interface PlayerState {
  id: number;
  name: string;
  emoji: string;
  color: string;
  isNpc: boolean;
  personality: Personality;
  resources: Record<Resource, number>;
  vp: number;
  mood: string;
  speech: string | null;
  speechAt: number;
  civTitle: string | null; // gained on mega city
  stats: PlayerStats;
}

export type Phase = 'setup' | 'roll' | 'dice' | 'robber' | 'main' | 'gameover';

export interface WorldEvent {
  kind: 'boom' | 'storm' | 'festival' | 'sheepmania';
  label: string;
  desc: string;
  resource?: Resource;
  tileId?: number;
  untilRound: number;
}

export interface Fx {
  id: number;
  kind: 'burst' | 'ring' | 'mega';
  x: number;
  z: number;
  color: string;
  born: number;
}

export interface Toast {
  id: number;
  text: string;
  sub?: string;
  kind: 'combo' | 'info' | 'event' | 'warn';
  born: number;
  ttl: number;
}

export interface NpcOffer {
  from: number;
  give: Resource; // NPC gives this
  giveN: number;
  get: Resource; // NPC wants this from you
  getN: number;
  line: string;
  expiresAt: number;
}

export interface Placement {
  kind: BuildKind;
  spots: string[];
}

export interface MatchState {
  config: MatchConfig;
  board: BoardModel;
  players: PlayerState[];
  buildings: Record<string, Building>; // by vertex id
  roads: Record<string, Road>; // by edge id
  current: number;
  phase: Phase;
  round: number;
  turnCount: number;
  // setup phase
  setupQueue: number[];
  setupIdx: number;
  setupStage: 'settlement' | 'road';
  setupLastVertex: string | null;
  // dice
  dice: [number, number] | null;
  diceStartedAt: number;
  diceGiant: boolean;
  // robber
  robberTile: number;
  // Golden Hex chaos modifier: id of the wildcard-producing tile (null = off)
  goldenTile: number | null;
  // interaction
  placement: Placement | null;
  hoverSpot: string | null;
  npcOffer: NpcOffer | null;
  // world
  worldEvent: WorldEvent | null;
  longestRoad: { owner: number; length: number } | null;
  // presentation
  log: string[];
  fx: Fx[];
  focus: { x: number; z: number; at: number } | null;
  spectacle: number;
  aiActionsThisTurn: number;
  winner: number | null;
  rollCounts: number[];
  matchPointAnnounced: boolean;
}
