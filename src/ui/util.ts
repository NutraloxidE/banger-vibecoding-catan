import { Resource } from '../game/types';

export const RES_EMOJI: Record<Resource, string> = {
  wood: '🪵', brick: '🧱', wheat: '🌾', sheep: '🐑', ore: '🪨',
};

export function costChips(cost: Partial<Record<Resource, number>>): string {
  return Object.entries(cost)
    .map(([r, n]) => `${n}${RES_EMOJI[r as Resource]}`)
    .join(' ');
}
