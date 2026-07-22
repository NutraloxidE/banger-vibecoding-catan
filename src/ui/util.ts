import { Resource } from '../game/types';

export const RES_EMOJI: Record<Resource, string> = {
  wood: '🪵', brick: '🧱', wheat: '🌾', sheep: '🐑', ore: '🪨',
};

export const RES_LABEL: Record<Resource, string> = {
  wood: 'Wood', brick: 'Brick', wheat: 'Wheat', sheep: 'Sheep', ore: 'Ore',
};

export function costChips(cost: Partial<Record<Resource, number>>): string {
  return Object.entries(cost)
    .map(([r, n]) => `${n}${RES_EMOJI[r as Resource]}`)
    .join(' ');
}
