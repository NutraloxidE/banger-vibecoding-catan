// Development-card definitions: the deck composition, the purchase cost, and
// per-kind metadata (icon + whether it's a "crazy" card). Human-readable names
// and descriptions live in i18n (`dev.<kind>` / `dev.<kind>.desc`). The pure
// effects and the buy/play flow live in the store; the AI decisions in ai.ts.

import { DevKind, Resource } from './types';
import { RNG } from './rng';

// Classic Catan cost: 1 ore + 1 wheat + 1 sheep.
export const DEV_CARD_COST: Partial<Record<Resource, number>> = { ore: 1, wheat: 1, sheep: 1 };

// Largest Army: the first player to play this many Knights (and the most)
// claims a +2 VP bonus, mirroring Longest Road.
export const LARGEST_ARMY_MIN = 3;

// The classic set — always in the deck.
const STANDARD_DECK: [DevKind, number][] = [
  ['knight', 14],
  ['victory', 5],
  ['roadBuilding', 2],
  ['yearOfPlenty', 2],
  ['monopoly', 2],
];

// The optional "crazy" cards — shuffled in only when chaos.crazyCards is on.
const CRAZY_DECK: [DevKind, number][] = [
  ['bounty', 3],
  ['plague', 3],
  ['earthquake', 2],
  ['windfall', 3],
];

export const CRAZY_KINDS = new Set<DevKind>(['bounty', 'plague', 'earthquake', 'windfall']);

// Emoji for each card face (labels/descriptions are localized via i18n).
export const DEV_ICON: Record<DevKind, string> = {
  knight: '⚔️',
  victory: '🎓',
  roadBuilding: '🛤️',
  yearOfPlenty: '🌾',
  monopoly: '📈',
  bounty: '💰',
  plague: '🦠',
  earthquake: '🌋',
  windfall: '🎰',
};

// How many resources the player chooses when the card is played (0 = none).
export const DEV_PICKS: Partial<Record<DevKind, number>> = {
  monopoly: 1,
  yearOfPlenty: 2,
  bounty: 3,
};

// Build a deterministic, shuffled deck for a match.
export function buildDevDeck(crazyCards: boolean, rng: RNG): DevKind[] {
  const deck: DevKind[] = [];
  const add = (spec: [DevKind, number][]) => {
    for (const [kind, n] of spec) for (let i = 0; i < n; i++) deck.push(kind);
  };
  add(STANDARD_DECK);
  if (crazyCards) add(CRAZY_DECK);
  return rng.shuffle(deck);
}
