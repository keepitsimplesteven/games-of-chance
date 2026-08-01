/**
 * Minimal PRNG interface — returns a float in [0, 1).
 * Implementations: SeededRng (deterministic) and SystemRng (Math.random wrapper).
 */
export interface Rng {
  /** Returns next pseudo-random float in [0, 1) */
  next(): number
  /** Returns a random integer in [0, max) */
  nextInt(max: number): number
}

/**
 * xoshiro128** seeded PRNG — fast, small state, good distribution.
 * Deterministic for a given seed.
 */
export class SeededRng implements Rng {
  private state: Uint32Array

  constructor(seed: number) {
    // Initialize state from seed using splitmix32
    this.state = new Uint32Array(4)
    this.state[0] = seed >>> 0
    this.state[1] = (seed + 0x9e3779b9) >>> 0
    this.state[2] = (seed + 0x9e3779b9 * 2) >>> 0
    this.state[3] = (seed + 0x9e3779b9 * 3) >>> 0
  }

  next(): number {
    // xoshiro128** algorithm
    const s = this.state
    const result = Math.imul(s[1] * 5, 7) >>> 0
    const t = s[1] << 9
    s[2] ^= s[0]
    s[3] ^= s[1]
    s[1] ^= s[2]
    s[0] ^= s[3]
    s[2] ^= t
    s[3] = (s[3] << 11) | (s[3] >>> 21)
    return (result >>> 0) / 4294967296
  }

  nextInt(max: number): number {
    return Math.floor(this.next() * max)
  }
}

/**
 * Wrapper around Math.random() for non-deterministic runs.
 */
export class SystemRng implements Rng {
  next(): number {
    return Math.random()
  }

  nextInt(max: number): number {
    return Math.floor(Math.random() * max)
  }
}

/**
 * Factory: creates the appropriate RNG from config.
 * If seed is provided, returns a deterministic SeededRng.
 * Otherwise returns a SystemRng wrapping Math.random.
 */
export function createRng(seed?: number): Rng {
  return seed !== undefined ? new SeededRng(seed) : new SystemRng()
}
