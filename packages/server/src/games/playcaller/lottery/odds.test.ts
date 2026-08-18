import { describe, it, expect } from "vitest"
import { DEFAULT_LOTTERY_ODDS, validateOddsTable } from "./odds"
import type { LotteryOddsTable } from "./odds"

describe("DEFAULT_LOTTERY_ODDS", () => {
  it("passes validation", () => {
    expect(validateOddsTable(DEFAULT_LOTTERY_ODDS)).toBe(true)
  })

  it("has 10 rows of 10 columns", () => {
    expect(DEFAULT_LOTTERY_ODDS).toHaveLength(10)
    for (const row of DEFAULT_LOTTERY_ODDS) {
      expect(row).toHaveLength(10)
    }
  })

  it("contains only values between 0 and 1", () => {
    for (const row of DEFAULT_LOTTERY_ODDS) {
      for (const val of row) {
        expect(val).toBeGreaterThanOrEqual(0)
        expect(val).toBeLessThanOrEqual(1)
      }
    }
  })
})

describe("validateOddsTable", () => {
  it("rejects a table with fewer than 10 rows", () => {
    const table: LotteryOddsTable = DEFAULT_LOTTERY_ODDS.slice(0, 9)
    expect(validateOddsTable(table)).toBe(false)
  })

  it("rejects a table with more than 10 rows", () => {
    const table: LotteryOddsTable = [...DEFAULT_LOTTERY_ODDS, DEFAULT_LOTTERY_ODDS[0]]
    expect(validateOddsTable(table)).toBe(false)
  })

  it("rejects a row with fewer than 10 columns", () => {
    const table: LotteryOddsTable = DEFAULT_LOTTERY_ODDS.map((row) => [...row])
    table[3] = table[3].slice(0, 9)
    expect(validateOddsTable(table)).toBe(false)
  })

  it("rejects a table where a row does not sum to ~1.0", () => {
    const table: LotteryOddsTable = DEFAULT_LOTTERY_ODDS.map((row) => [...row])
    table[0] = [0.5, 0.5, 0, 0, 0, 0, 0, 0, 0, 0.5] // sums to 1.5
    expect(validateOddsTable(table)).toBe(false)
  })

  it("rejects a table where a column does not sum to ~1.0", () => {
    const table: LotteryOddsTable = DEFAULT_LOTTERY_ODDS.map((row) => [...row])
    // Increase first column values so they sum well above 1.0
    table[0][0] = 0.9
    table[1][0] = 0.9
    // Fix row sums so only column fails
    table[0][9] = 1.0 - table[0].slice(0, 9).reduce((s, v) => s + v, 0)
    table[1][9] = 1.0 - table[1].slice(0, 9).reduce((s, v) => s + v, 0)
    expect(validateOddsTable(table)).toBe(false)
  })

  it("accepts a valid custom table within tolerance", () => {
    // Uniform distribution: each cell = 0.1
    const table: LotteryOddsTable = Array.from({ length: 10 }, () =>
      Array.from({ length: 10 }, () => 0.1)
    )
    expect(validateOddsTable(table)).toBe(true)
  })
})
