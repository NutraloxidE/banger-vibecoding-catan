// Deterministic RNG (mulberry32) seeded from a string, used for board
// generation and name generation so a seed reproduces the same world.

export function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h ^= h >>> 16) >>> 0;
}

export class RNG {
  private s: number;
  constructor(seed: string | number) {
    this.s = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);
    if (this.s === 0) this.s = 0x9e3779b9;
  }
  next(): number {
    this.s |= 0;
    this.s = (this.s + 0x6d2b79f5) | 0;
    let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }
  range(min: number, maxInclusive: number): number {
    return min + this.int(maxInclusive - min + 1);
  }
  pick<T>(arr: T[]): T {
    return arr[this.int(arr.length)];
  }
  shuffle<T>(arr: T[]): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
}

export function randomSeedString(): string {
  const words = ['WHEAT', 'SHEEP', 'HEX', 'ORE', 'PORT', 'DAVE', 'MEGA', 'CLAY', 'WOOD', 'BOAT', 'FOG', 'YAM'];
  const w = words[Math.floor(Math.random() * words.length)];
  return `${w}-${Math.floor(Math.random() * 9000 + 1000)}`;
}
