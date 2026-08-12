import { describe, it, expect } from "vitest"
import { resolveCommentary } from "./resolver"
import type { CommentaryTiers, CommentaryPhase } from "./types"

/**
 * Creates a deterministic RNG that returns values from a predefined sequence.
 */
function makeSequenceRng(values: number[]): () => number {
  let index = 0
  return () => {
    const val = values[index % values.length]
    index++
    return val
  }
}

describe("resolveCommentary", () => {
  const fullTiers: CommentaryTiers = {
    playSpecific: {
      preSnap: ["ps-pre1", "ps-pre2"],
      activePlay: ["ps-active1"],
      outcome: ["ps-outcome1", "ps-outcome2", "ps-outcome3"],
    },
    circumstance: {
      preSnap: ["circ-pre1", "circ-pre2"],
      activePlay: ["circ-active1", "circ-active2"],
      outcome: ["circ-outcome1"],
    },
    default: {
      preSnap: ["def-pre1"],
      activePlay: ["def-active1", "def-active2"],
      outcome: ["def-outcome1", "def-outcome2"],
    },
  }

  describe("tier selection based on rng roll", () => {
    it("selects play-specific tier when roll < 0.6", () => {
      // First call: 0.5 (tier roll < 0.6 → play-specific)
      // Second call: 0.0 (pick index 0 from play-specific preSnap)
      const rng = makeSequenceRng([0.5, 0.0])
      const result = resolveCommentary("preSnap", fullTiers, null, rng)
      expect(result).toBe("ps-pre1")
    })

    it("selects circumstance tier when 0.6 <= roll < 0.9", () => {
      // First call: 0.7 (tier roll → circumstance)
      // Second call: 0.0 (pick index 0)
      const rng = makeSequenceRng([0.7, 0.0])
      const result = resolveCommentary("preSnap", fullTiers, null, rng)
      expect(result).toBe("circ-pre1")
    })

    it("selects default tier when roll >= 0.9", () => {
      // First call: 0.95 (tier roll → default)
      // Second call: 0.0 (pick index 0)
      const rng = makeSequenceRng([0.95, 0.0])
      const result = resolveCommentary("preSnap", fullTiers, null, rng)
      expect(result).toBe("def-pre1")
    })
  })

  describe("cascade on empty tier", () => {
    it("cascades from play-specific to circumstance when play-specific is empty", () => {
      const tiers: CommentaryTiers = {
        playSpecific: {}, // empty for all phases
        circumstance: { preSnap: ["circ-msg"] },
        default: { preSnap: ["def-msg"], activePlay: ["def-active"], outcome: ["def-out"] },
      }
      // Roll < 0.6 → try play-specific → empty → cascade to circumstance
      const rng = makeSequenceRng([0.3, 0.0])
      const result = resolveCommentary("preSnap", tiers, null, rng)
      expect(result).toBe("circ-msg")
    })

    it("cascades from play-specific to default when both play-specific and circumstance are empty", () => {
      const tiers: CommentaryTiers = {
        playSpecific: {},
        circumstance: {},
        default: { preSnap: ["def-msg"], activePlay: ["def-active"], outcome: ["def-out"] },
      }
      // Roll < 0.6 → try play-specific → empty → try circumstance → empty → default
      const rng = makeSequenceRng([0.2, 0.0])
      const result = resolveCommentary("preSnap", tiers, null, rng)
      expect(result).toBe("def-msg")
    })

    it("cascades from circumstance to default when circumstance is empty", () => {
      const tiers: CommentaryTiers = {
        playSpecific: { preSnap: ["ps-msg"] },
        circumstance: {},
        default: { preSnap: ["def-msg"], activePlay: ["def-active"], outcome: ["def-out"] },
      }
      // Roll 0.75 → try circumstance → empty → cascade to default
      const rng = makeSequenceRng([0.75, 0.0])
      const result = resolveCommentary("preSnap", tiers, null, rng)
      expect(result).toBe("def-msg")
    })

    it("cascades when play-specific has empty array for the phase", () => {
      const tiers: CommentaryTiers = {
        playSpecific: { preSnap: [] }, // explicitly empty array
        circumstance: { preSnap: ["circ-fallback"] },
        default: { preSnap: ["def-fallback"], activePlay: ["def-active"], outcome: ["def-out"] },
      }
      const rng = makeSequenceRng([0.1, 0.0])
      const result = resolveCommentary("preSnap", tiers, null, rng)
      expect(result).toBe("circ-fallback")
    })
  })

  describe("uniform message selection", () => {
    it("picks different messages based on rng value", () => {
      // Roll 0.5 → play-specific, then pick index 1 from 2-element array
      const rng = makeSequenceRng([0.5, 0.5])
      const result = resolveCommentary("preSnap", fullTiers, null, rng)
      // Math.floor(0.5 * 2) = 1 → "ps-pre2"
      expect(result).toBe("ps-pre2")
    })

    it("picks last element with high rng value", () => {
      // Roll 0.5 → play-specific outcome (3 items), pick with 0.99
      // Math.floor(0.99 * 3) = 2 → "ps-outcome3"
      const rng = makeSequenceRng([0.5, 0.99])
      const result = resolveCommentary("outcome", fullTiers, null, rng)
      expect(result).toBe("ps-outcome3")
    })
  })

  describe("works for all phases", () => {
    const phases: CommentaryPhase[] = ["preSnap", "activePlay", "outcome"]

    for (const phase of phases) {
      it(`resolves commentary for ${phase} phase`, () => {
        const rng = makeSequenceRng([0.95, 0.0]) // default tier
        const result = resolveCommentary(phase, fullTiers, null, rng)
        expect(result).toBe(fullTiers.default[phase][0])
      })
    }
  })

  describe("does not mutate inputs", () => {
    it("does not modify the tiers object", () => {
      const tiers: CommentaryTiers = {
        playSpecific: { preSnap: ["ps1"] },
        circumstance: { preSnap: ["c1"] },
        default: { preSnap: ["d1"], activePlay: ["d2"], outcome: ["d3"] },
      }
      const tiersSnapshot = JSON.stringify(tiers)
      const rng = makeSequenceRng([0.3, 0.0])
      resolveCommentary("preSnap", tiers, null, rng)
      expect(JSON.stringify(tiers)).toBe(tiersSnapshot)
    })
  })

  describe("outcomeCategory parameter", () => {
    it("accepts outcomeCategory without affecting resolution (reserved for future)", () => {
      const rng = makeSequenceRng([0.95, 0.0])
      const result = resolveCommentary("outcome", fullTiers, "touchdown", rng)
      expect(result).toBe("def-outcome1")
    })

    it("accepts null outcomeCategory", () => {
      const rng = makeSequenceRng([0.95, 0.0])
      const result = resolveCommentary("outcome", fullTiers, null, rng)
      expect(result).toBe("def-outcome1")
    })
  })

  describe("edge cases", () => {
    it("returns empty string when all tiers are empty (safety fallback)", () => {
      const tiers: CommentaryTiers = {
        playSpecific: {},
        circumstance: {},
        default: { preSnap: [], activePlay: [], outcome: [] },
      }
      const rng = makeSequenceRng([0.1, 0.0])
      const result = resolveCommentary("preSnap", tiers, null, rng)
      expect(result).toBe("")
    })

    it("handles boundary rng value of exactly 0.6 (goes to circumstance)", () => {
      const rng = makeSequenceRng([0.6, 0.0])
      const result = resolveCommentary("preSnap", fullTiers, null, rng)
      expect(result).toBe("circ-pre1")
    })

    it("handles boundary rng value of exactly 0.9 (goes to default)", () => {
      const rng = makeSequenceRng([0.9, 0.0])
      const result = resolveCommentary("preSnap", fullTiers, null, rng)
      expect(result).toBe("def-pre1")
    })
  })
})
