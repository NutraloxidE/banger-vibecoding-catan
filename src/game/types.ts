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

// A harbor. `generic` = trade any 3 identical resources for 1 (3:1);
// a Resource kind = trade 2 of that resource for 1 of anything (2:1).
// Usable by a player who owns a building on either adjacent vertex.
export type PortKind = 'generic' | Resource;

export interface Port {
  id: string;
  edge: string; // the coastal edge this harbor sits on
  vertices: [string, string]; // the two vertices that can use it
  x: number; // dock position, pushed out into the water
  z: number;
  angle: number; // outward facing angle (for orienting the dock)
  kind: PortKind;
  rate: number; // 3 for generic, 2 for a resource port
  name: string; // generated harbor name
}

export interface BoardModel {
  radius: number;
  tiles: Tile[];
  vertices: Record<string, VertexNode>;
  edges: Record<string, EdgeNode>;
  ports: Port[];
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

// Development cards. The first five are the classic Catan set (always in the
// deck). The rest are the optional "crazy" cards, shuffled in only when the
// chaos.crazyCards modifier is on.
export type DevKind =
  | 'knight' | 'victory' | 'roadBuilding' | 'yearOfPlenty' | 'monopoly'
  | 'bounty' | 'plague' | 'earthquake' | 'windfall';

export interface DevCard {
  kind: DevKind;
  boughtOnTurn: number; // turnCount at purchase — cannot be played the same turn
}

export interface ChaosFlags {
  turbo: boolean;
  friendlyRobber: boolean;
  maximumSheep: boolean;
  drama: boolean;
  goldenHex: boolean;
  crazyCards: boolean;
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
  devCardsBought: number;
  knightsPlayed: number;
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
  devCards: DevCard[]; // held, unplayed development cards
  devVp: number; // hidden victory points from Victory Point cards
  knightsPlayed: number; // for Largest Army
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
  color?: string; // owning player's color — shown as bars on the frame's inner edges
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

// A pending resource choice created by playing a development card
// (Monopoly picks 1, Year of Plenty picks 2, Treasure Haul picks 3).
export interface DevPrompt {
  card: DevKind;
  need: number;
  picks: Resource[];
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
  // when the robber phase was triggered by a played card (else null = dice 7)
  robberSource: 'knight' | 'earthquake' | null;
  // Golden Hex chaos modifier: id of the wildcard-producing tile (null = off)
  goldenTile: number | null;
  // development cards
  devDeck: DevKind[]; // remaining deck (top = index 0), built at match start
  devCardPlayedThisTurn: boolean; // at most one dev card played per turn
  freeRoads: number; // free roads still to place (Road Building card)
  devPrompt: DevPrompt | null; // pending resource choice from a played card
  // interaction
  placement: Placement | null;
  hoverSpot: string | null;
  npcOffer: NpcOffer | null;
  // world
  worldEvent: WorldEvent | null;
  longestRoad: { owner: number; length: number } | null;
  largestArmy: { owner: number; count: number } | null;
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
