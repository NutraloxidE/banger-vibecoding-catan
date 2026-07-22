import type {
  Biome,
  BuildingKind,
  Personality,
  ResourceBundle,
  ResourceType,
  Specialization,
} from "./types";

export const HEX_SIZE = 1.0; // world radius of a hex (center to corner)

export const BIOME_INFO: Record<
  Biome,
  { label: string; color: string; top: string; resource: ResourceType | null }
> = {
  wood: { label: "Forest", color: "#2f6b32", top: "#3f8c43", resource: "wood" },
  brick: { label: "Hills", color: "#a2542b", top: "#c26a38", resource: "brick" },
  sheep: { label: "Pasture", color: "#7bbf5a", top: "#95d873", resource: "sheep" },
  wheat: { label: "Fields", color: "#d7a12c", top: "#eec24a", resource: "wheat" },
  ore: { label: "Mountains", color: "#6b7280", top: "#889099", resource: "ore" },
  desert: { label: "Desert", color: "#c9b079", top: "#ddc78f", resource: null },
  gold: { label: "Golden Hex", color: "#b8860b", top: "#ffd34d", resource: null },
};

export const RESOURCE_INFO: Record<
  ResourceType,
  { label: string; color: string; icon: string }
> = {
  wood: { label: "Wood", color: "#3f8c43", icon: "🌲" },
  brick: { label: "Brick", color: "#c26a38", icon: "🧱" },
  sheep: { label: "Sheep", color: "#95d873", icon: "🐑" },
  wheat: { label: "Wheat", color: "#eec24a", icon: "🌾" },
  ore: { label: "Ore", color: "#889099", icon: "⛏️" },
};

export const PLAYER_COLORS: { hex: string; name: string }[] = [
  { hex: "#e6484d", name: "Crimson" },
  { hex: "#3d7dff", name: "Cobalt" },
  { hex: "#f5a623", name: "Amber" },
  { hex: "#26c281", name: "Jade" },
  { hex: "#b06bf0", name: "Violet" },
  { hex: "#ff77c8", name: "Fuchsia" },
];

export const COSTS: Record<string, Partial<ResourceBundle>> = {
  road: { wood: 1, brick: 1 },
  settlement: { wood: 1, brick: 1, sheep: 1, wheat: 1 },
  city: { wheat: 2, ore: 3 },
  megacity: { wheat: 3, ore: 3, sheep: 2, brick: 2 },
};

export const VP_FOR: Record<BuildingKind, number> = {
  settlement: 1,
  city: 2,
  megacity: 4,
};

export const LONGEST_ROAD_MIN = 5;
export const LONGEST_ROAD_VP = 2;
export const HAND_LIMIT = 9; // over this on a 7 -> discard half

export const MAP_RADII: Record<string, number> = {
  small: 2, // 19 tiles
  medium: 3, // 37 tiles
  large: 4, // 61 tiles
};

export const emptyBundle = (): ResourceBundle => ({
  wood: 0,
  brick: 0,
  sheep: 0,
  wheat: 0,
  ore: 0,
});

export const PERSONALITY_INFO: Record<
  Personality,
  { label: string; blurb: string; emoji: string }
> = {
  expansionist: { label: "Expansionist", blurb: "Builds roads like it's a religion.", emoji: "🚀" },
  hoarder: { label: "Hoarder", blurb: "Never has fewer than a warehouse of cards.", emoji: "🗃️" },
  trader: { label: "Trade Addict", blurb: "Would trade you their own knee.", emoji: "🤝" },
  gambler: { label: "Chaotic Gambler", blurb: "Strategy is a suggestion.", emoji: "🎲" },
  defensive: { label: "Defensive Builder", blurb: "Turtles up and dares you.", emoji: "🛡️" },
  incompetent: { label: "Apparently Incompetent", blurb: "Mostly harmless. Mostly.", emoji: "🤡" },
};

export const SPECIALIZATION_INFO: Record<
  Specialization,
  { label: string; emoji: string; blurb: string }
> = {
  industrial: { label: "Industrial", emoji: "🏭", blurb: "+1 ore on production hits." },
  trade: { label: "Trade", emoji: "🏛️", blurb: "Bank trades cost one less." },
  agricultural: { label: "Agricultural", emoji: "🌻", blurb: "+1 wheat on production hits." },
  sheep: { label: "Sheep", emoji: "🐏", blurb: "+1 sheep on production hits." },
  research: { label: "Research", emoji: "🔬", blurb: "Extra victory momentum." },
};

export const NPC_NAMES = [
  "Baron von Hexface", "Wooly Magnus", "The Grain Consortium", "Sir Roadsalot",
  "Madame Ore", "Gravel Pete", "The Municipality of Dave", "Countess Sheepwick",
  "Big Brick Energy", "Professor Quarry", "Neo-Pastoral Inc.", "Lord Fencington",
  "Cropzilla", "The Sheep Whisperer", "Concrete Karen", "Duke Loamsbury",
];
