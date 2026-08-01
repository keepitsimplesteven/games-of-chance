import { describe, it, expect } from "vitest"
import { SeededRng, SystemRng, createRng } from "./rng"

describe("SeededRng", () => {
  it("produces values in [0, 1)", () => {
    const rng = new SeededRng(42)
    for (let i = 0; i < 100; i++) {
      const val = rng.next()
      expect(val).toBeGreaterThanOrEqual(0)
      expect(val).toBeLessThan(1)
    }
  })

  it("produces deterministic sequences for the same seed", () => {
    const rng1 = new SeededRng(123)
    const rng2 = new SeededRng(123)
    for (let i = 0; i < 50; i++) {
      expect(rng1.next()).toBe(rng2.next())
    }
  })

  it("produces different sequences for different seeds", () => {
    const rng1 = new SeededRng(1)
    const rng2 = new SeededRng(2)
    const seq1 = Array.from({ length: 10 }, () => rng1.next())
    const seq2 = Array.from({ length: 10 }, () => rng2.next())
    expect(seq1).not.toEqual(seq2)
  })

  it("nextInt returns integers in [0, max)", () => {
    const rng = new SeededRng(99)
    for (let i = 0; i < 100; i++) {
      const val = rng.nextInt(10)
      expect(Number.isInteger(val)).toBe(true)
      expect(val).toBeGreaterThanOrEqual(0)
      expect(val).toBeLessThan(10)
    }
  })

  it("nextInt(1) always returns 0", () => {
    const rng = new SeededRng(7)
    for (let i = 0; i < 20; i++) {
      expect(rng.nextInt(1)).toBe(0)
    }
  })
})

describe("SystemRng", () => {
  it("produces values in [0, 1)", () => {
    const rng = new SystemRng()
    for (let i = 0; i < 100; i++) {
      const val = rng.next()
      expect(val).toBeGreaterThanOrEqual(0)
      expect(val).toBeLessThan(1)
    }
  })

  it("nextInt returns integers in [0, max)", () => {
    const rng = new SystemRng()
    for (let i = 0; i < 100; i++) {
      const val = rng.nextInt(5)
      expect(Number.isInteger(val)).toBe(true)
      expect(val).toBeGreaterThanOrEqual(0)
      expect(val).toBeLessThan(5)
    }
  })
})

describe("createRng", () => {
  it("returns SeededRng when seed is provided", () => {
    const rng = createRng(42)
    expect(rng).toBeInstanceOf(SeededRng)
  })

  it("returns SystemRng when no seed is provided", () => {
    const rng = createRng()
    expect(rng).toBeInstanceOf(SystemRng)
  })

  it("returns SystemRng when seed is undefined", () => {
    const rng = createRng(undefined)
    expect(rng).toBeInstanceOf(SystemRng)
  })

  it("handles seed of 0 as a valid seed", () => {
    const rng = createRng(0)
    expect(rng).toBeInstanceOf(SeededRng)
  })
})
