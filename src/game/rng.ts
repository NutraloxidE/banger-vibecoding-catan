// Deterministic seeded RNG (mulberry32) + string hashing.
// The whole game (map, dice, AI jitter) can be reproduced from a single seed.

export type Rng = () => number;

export function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h >>> 0) || 1;
}

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed: string | number): Rng {
  return mulberry32(typeof seed === "number" ? seed : hashSeed(seed));
}

export function randInt(rng: Rng, minInclusive: number, maxInclusive: number): number {
  return minInclusive + Math.floor(rng() * (maxInclusive - minInclusive + 1));
}

export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function shuffle<T>(rng: Rng, arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Short random seed string for display / new games.
export function randomSeedString(): string {
  const words = [
    "SHEEP", "WHEAT", "ORE", "BRICK", "WOOD", "HEX", "DAVE", "PORT",
    "CHAOS", "GLORY", "BANK", "ROAD", "DOOM", "GRAIN", "STONE", "NEON",
  ];
  const a = words[Math.floor(Math.random() * words.length)];
  const b = Math.floor(Math.random() * 9000 + 1000);
  return `${a}-${b}`;
}
