// A small seeded random generator so one demo visit always produces the same
// people and campaigns - a reload mid-visit must not swap the whole world.

export type Rng = () => number;

// mulberry32: tiny, fast, and good enough for picking names.
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: Rng, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length)];
}

export function int(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function chance(rng: Rng, p: number): boolean {
  return rng() < p;
}

export function shuffle<T>(rng: Rng, list: readonly T[]): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// n distinct items, in a random order.
export function sample<T>(rng: Rng, list: readonly T[], n: number): T[] {
  return shuffle(rng, list).slice(0, n);
}

// A well-formed v4-style id drawn from the seeded generator.
export function uuid(rng: Rng): string {
  const hex = (n: number) => Array.from({ length: n }, () => Math.floor(rng() * 16).toString(16)).join("");
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${(8 + Math.floor(rng() * 4)).toString(16)}${hex(3)}-${hex(12)}`;
}

// An id for something created during the visit (not part of the seed).
export function freshId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return uuid(makeRng(Date.now() ^ Math.floor(Math.random() * 0xffffffff)));
}
