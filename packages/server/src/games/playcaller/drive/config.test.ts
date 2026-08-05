import { describe, it, expect } from "vitest"
import { DEFAULT_PLAY_CONFIG, DEFAULT_PLAY_MATRIX } from "./config"

describe("DEFAULT_PLAY_CONFIG structure", () => {
  it("has exactly 4 offensive plays", () => {
    expect(Object.keys(DEFAULT_PLAY_CONFIG.offensivePlays)).toHaveLength(4)
  })

  it("has exactly 4 defensive plays", () => {
    expect(Object.keys(DEFAULT_PLAY_CONFIG.defensivePlays)).toHaveLength(4)
  })

  describe("offensive play axes and styles", () => {
    it("all offensive plays have valid axis (run or pass)", () => {
      for (const play of Object.values(DEFAULT_PLAY_CONFIG.offensivePlays)) {
        expect(["run", "pass"]).toContain(play.axis)
      }
    })

    it("all offensive plays have valid style (safe or aggressive)", () => {
      for (const play of Object.values(DEFAULT_PLAY_CONFIG.offensivePlays)) {
        expect(["safe", "aggressive"]).toContain(play.style)
      }
    })

    it("covers all 4 axis-style combinations", () => {
      const combinations = Object.values(DEFAULT_PLAY_CONFIG.offensivePlays).map(
        (play) => `${play.axis}-${play.style}`
      )
      expect(combinations).toContain("run-safe")
      expect(combinations).toContain("run-aggressive")
      expect(combinations).toContain("pass-safe")
      expect(combinations).toContain("pass-aggressive")
    })
  })

  describe("offensive play base stats ranges", () => {
    it("all successRate values are between 0 and 1", () => {
      for (const play of Object.values(DEFAULT_PLAY_CONFIG.offensivePlays)) {
        expect(play.successRate).toBeGreaterThanOrEqual(0)
        expect(play.successRate).toBeLessThanOrEqual(1)
      }
    })

    it("all yardageRange.min >= 0", () => {
      for (const play of Object.values(DEFAULT_PLAY_CONFIG.offensivePlays)) {
        expect(play.yardageRange.min).toBeGreaterThanOrEqual(0)
      }
    })

    it("all yardageRange.max >= yardageRange.min", () => {
      for (const play of Object.values(DEFAULT_PLAY_CONFIG.offensivePlays)) {
        expect(play.yardageRange.max).toBeGreaterThanOrEqual(play.yardageRange.min)
      }
    })

    it("all yardageRange.max <= 25", () => {
      for (const play of Object.values(DEFAULT_PLAY_CONFIG.offensivePlays)) {
        expect(play.yardageRange.max).toBeLessThanOrEqual(25)
      }
    })

    it("all criticalSuccessChance values are between 0 and 1", () => {
      for (const play of Object.values(DEFAULT_PLAY_CONFIG.offensivePlays)) {
        expect(play.criticalSuccessChance).toBeGreaterThanOrEqual(0)
        expect(play.criticalSuccessChance).toBeLessThanOrEqual(1)
      }
    })

    it("all criticalFailureChance values are between 0 and 1", () => {
      for (const play of Object.values(DEFAULT_PLAY_CONFIG.offensivePlays)) {
        expect(play.criticalFailureChance).toBeGreaterThanOrEqual(0)
        expect(play.criticalFailureChance).toBeLessThanOrEqual(1)
      }
    })
  })
})

describe("DEFAULT_PLAY_MATRIX structure", () => {
  it("has exactly 16 entries", () => {
    expect(Object.keys(DEFAULT_PLAY_MATRIX)).toHaveLength(16)
  })

  describe("modifier value ranges", () => {
    it("all successRateMod values are between -1 and 1", () => {
      for (const mod of Object.values(DEFAULT_PLAY_MATRIX)) {
        expect(mod.successRateMod).toBeGreaterThanOrEqual(-1)
        expect(mod.successRateMod).toBeLessThanOrEqual(1)
      }
    })

    it("all yardageMinMod values are between -10 and 10", () => {
      for (const mod of Object.values(DEFAULT_PLAY_MATRIX)) {
        expect(mod.yardageMinMod).toBeGreaterThanOrEqual(-10)
        expect(mod.yardageMinMod).toBeLessThanOrEqual(10)
      }
    })

    it("all yardageMaxMod values are between -10 and 10", () => {
      for (const mod of Object.values(DEFAULT_PLAY_MATRIX)) {
        expect(mod.yardageMaxMod).toBeGreaterThanOrEqual(-10)
        expect(mod.yardageMaxMod).toBeLessThanOrEqual(10)
      }
    })

    it("all critSuccessMod values are between -1 and 1", () => {
      for (const mod of Object.values(DEFAULT_PLAY_MATRIX)) {
        expect(mod.critSuccessMod).toBeGreaterThanOrEqual(-1)
        expect(mod.critSuccessMod).toBeLessThanOrEqual(1)
      }
    })

    it("all critFailureMod values are between -1 and 1", () => {
      for (const mod of Object.values(DEFAULT_PLAY_MATRIX)) {
        expect(mod.critFailureMod).toBeGreaterThanOrEqual(-1)
        expect(mod.critFailureMod).toBeLessThanOrEqual(1)
      }
    })
  })
})
