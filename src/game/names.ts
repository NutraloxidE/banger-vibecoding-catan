import { Personality, Difficulty } from './types';
import { RNG } from './rng';

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

export const PERSONALITY_LABEL: Record<Personality, string> = {
  expansionist: 'Aggressive Expansionist',
  hoarder: 'Resource Hoarder',
  trader: 'Trade Addict',
  gambler: 'Chaotic Gambler',
  builder: 'Defensive Builder',
  sleeper: 'Apparently Incompetent',
};

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

// short NPC lines
export const LINES = {
  buildRoad: ['Another road. Another destiny.', 'Pavement is power.', 'This road is personal.', 'I simply love asphalt.'],
  buildSettlement: ['A humble beginning.', 'This land chose me.', 'Zoning approved.', 'Home sweet hex.'],
  buildCity: ['Urbanization!', 'Behold: verticality.', 'My skyline grows.', 'Property values rising.'],
  buildMega: ['WITNESS ME.', 'The board is mine now.', 'This changes everything.', 'I am become city.'],
  tradeAccept: ['Deal. No refunds.', 'Pleasure doing business.', 'You need this more than me. Suspicious.', 'Fine. FINE.'],
  tradeReject: ['Absolutely not.', 'Insulting.', 'My cards stay with me.', 'I would rather starve.', 'Ha. No.'],
  robbed: ['I will remember this.', 'MY CARDS.', 'Unbelievable.', 'This is economic violence.'],
  robbing: ['Nothing personal.', 'The robber and I are friends.', 'Taxation time.', 'I needed that more.'],
  goodRoll: ['The dice love me today.', 'As predicted.', 'Harvest season, baby.', 'Cha-ching.'],
  badRoll: ['The dice are broken.', 'I demand a recount.', 'Statistically offensive.', '...'],
  nearWin: ['Almost... almost...', 'Can you feel it? The winning?', 'Start writing my speech.'],
  threatened: ['Someone stop them.', 'This is fine. THIS IS FINE.', 'We must unite against the leader.'],
  offer: ['Psst. A once-in-a-lifetime deal.', 'I am feeling generous. Regrettably.', 'Business proposal. Very legitimate.', 'You look like you need this.'],
};

export function npcLine(rng: RNG, key: keyof typeof LINES): string {
  return rng.pick(LINES[key]);
}

export function pickNpcs(rng: RNG, count: number, difficulty: Difficulty): NpcDef[] {
  const pool = rng.shuffle(NPC_POOL);
  return pool.slice(0, count);
}
