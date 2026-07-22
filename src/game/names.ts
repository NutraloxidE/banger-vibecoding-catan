import { Personality, Difficulty, PortKind } from './types';
import { RNG } from './rng';
import { t } from '../i18n';

export interface NpcDef {
  name: string;
  emoji: string;
  personality: Personality;
  tagline: string;
}

export const NPC_POOL: NpcDef[] = [
  { name: 'Baron Vex', emoji: '🦅', personality: 'expansionist', tagline: 'Claims land he has never seen.' },
  { name: 'Marla Grain', emoji: '🐿️', personality: 'hoarder', tagline: 'Has never willingly spent a card.' },
  { name: 'Fennick', emoji: '🦊', personality: 'trader', tagline: 'Will trade you your own resources.' },
  { name: 'Lucky Odds', emoji: '🎲', personality: 'gambler', tagline: 'Believes in the dice. The dice do not believe in him.' },
  { name: 'Brickerton', emoji: '🦫', personality: 'builder', tagline: 'Emotionally attached to infrastructure.' },
  { name: 'Dave', emoji: '🐢', personality: 'sleeper', tagline: 'Seems harmless. Historically devastating.' },
];

export const PLAYER_COLORS = ['#ff5d6c', '#3fa7ff', '#ffb347', '#7ed957'];

const PRE = ['New', 'Port', 'Greater', 'Neo', 'West West', 'Hyper', 'Old', 'Fort', 'Saint', 'Lower', 'Upper', 'Grand', 'Mega', 'East', 'Deep', 'Royal'];
const MID = ['Grain', 'Hex', 'Wheat', 'Stone', 'Corn', 'Sheep', 'Forest', 'Quarry', 'Clay', 'Ore', 'Mill', 'Harbor', 'Wool', 'Timber', 'Brick', 'Meadow'];
const SUF = ['City', 'District', 'Heaven', 'Capital', 'Logistics Zone', 'Village', 'Hollow', 'Junction', 'Landing', 'Depot', 'Commons', 'Flats', 'Point', 'Works', 'Borough'];
const WEIRD = ['The Municipality of Dave', 'Sheepopolis', 'Wheatropolis', 'Bricktown Prime', 'General Hexpital', 'Yieldsburg', 'Ore Blimey', 'Cul-de-Sackville', 'Gravel Gulch', 'Fiscal Meadows'];

export function settlementName(rng: RNG): string {
  if (rng.chance(0.12)) return rng.pick(WEIRD);
  const parts: string[] = [];
  if (rng.chance(0.7)) parts.push(rng.pick(PRE));
  parts.push(rng.pick(MID));
  parts.push(rng.pick(SUF));
  return parts.join(' ');
}

const CIV_KIND = ['City-State', 'Corporation', 'Republic', 'Collective', 'Syndicate', 'Dominion', 'Cooperative', 'Cult', 'Conglomerate', 'Emirate'];
const CIV_OF = ['Eternal Wheat', 'the Sacred Hexagon', 'Applied Sheep', 'Infinite Gravel', 'Vertical Living', 'Unstoppable Commerce', 'Quiet Expansion', 'the Long Road', 'Aggressive Zoning', 'Compound Interest'];

export function civTitle(rng: RNG): string {
  return `${rng.pick(CIV_KIND)} of ${rng.pick(CIV_OF)}`;
}

// Harbor names — themed by what they trade. Proper nouns, kept English
// (same convention as settlement names).
const PORT_NAMES: Record<PortKind, string[]> = {
  generic: ['The Free Port', 'Open Wharf', 'Anything-Goes Docks', 'The Bargain Pier', 'Duty-Free Landing', 'Miscellany Bay'],
  wood: ['Timber Wharf', 'The Lumber Docks', 'Splinter Bay', 'Sawdust Landing'],
  brick: ['Kiln Docks', 'The Clay Quay', 'Brickmouth Harbor', 'Mortar Pier'],
  wheat: ['Grain Pier', 'The Breadbasket Docks', 'Mill Landing', 'Chaff Harbor'],
  sheep: ['The Wool Exchange', 'Fleece Wharf', 'Baa Harbor', 'Mutton Quay'],
  ore: ['Ore Harbor', 'The Iron Jetty', 'Gravel Quay', 'Slag Landing'],
};

export function portName(rng: RNG, kind: PortKind): string {
  return rng.pick(PORT_NAMES[kind]);
}

// NPC speech line categories. The actual phrases live in i18n (`npc.<key>`)
// as newline-joined variants, so they follow the active language.
export type NpcLineKey =
  | 'buildRoad' | 'buildSettlement' | 'buildCity' | 'buildMega'
  | 'tradeAccept' | 'tradeReject' | 'robbed' | 'robbing'
  | 'goodRoll' | 'badRoll' | 'nearWin' | 'threatened' | 'offer';

export function npcLine(rng: RNG, key: NpcLineKey): string {
  const variants = t(`npc.${key}`).split('\n');
  return rng.pick(variants);
}

export function pickNpcs(rng: RNG, count: number, difficulty: Difficulty): NpcDef[] {
  const pool = rng.shuffle(NPC_POOL);
  return pool.slice(0, count);
}
