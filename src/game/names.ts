// Procedural settlement-name generator. Names lean serious-but-ridiculous.
import type { Rng } from "./rng";
import { pick } from "./rng";

const PREFIX = [
  "New", "Greater", "Port", "Neo", "West", "Old", "Upper", "Lower",
  "Fort", "Saint", "Grand", "Hyper", "North", "East",
];
const CORE = [
  "Grain", "Hexagon", "Wheat", "Stone", "Corn", "Sheep", "Forest", "Quarry",
  "Brick", "Ore", "Loam", "Pasture", "Timber", "Gravel", "Dave", "Mutton",
  "Harvest", "Anvil", "Cobble", "Fenn",
];
const SUFFIX = [
  "City", "District", "Heaven", "Capital", "Village", "Logistics Zone",
  "Municipality", "Holdings", "Commons", "Reach", "Point", "Junction",
  "Works", "Exchange", "Township",
];

export function generateSettlementName(rng: Rng): string {
  const roll = rng();
  const core = pick(rng, CORE);
  if (roll < 0.18) return `The Municipality of ${pick(rng, ["Dave", "Greg", "Susan", "Todd", "Hex"])}`;
  if (roll < 0.36) return `${pick(rng, PREFIX)} ${core}`;
  if (roll < 0.72) return `${pick(rng, PREFIX)} ${core} ${pick(rng, SUFFIX)}`;
  return `${core} ${pick(rng, SUFFIX)}`;
}

const CIV_TITLES = [
  "City-State", "Free Republic", "Trade Corporation", "Wool Cult",
  "Grain Syndicate", "Hex Federation", "Sovereign Quarry", "People's Pasture",
];

export function generateCivTitle(rng: Rng): string {
  return pick(rng, CIV_TITLES);
}
