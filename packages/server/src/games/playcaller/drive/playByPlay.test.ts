import { describe, it, expect } from "vitest"
import { generatePlayByPlay, DEFAULT_TEMPLATES } from "./playByPlay"
import type { PlayByPlayTemplates } from "./playByPlay"
import type { PlayByPlayInput } from "./playByPlay"

/**
 * Unit tests for play-by-play text generation.
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5
 */
describe("playByPlay", () => {
  describe("each outcome type produces correct template-based text", () => {
    it("success outcome produces a string from the success templates", () => {
      const input: PlayByPlayInput = {
        outcome: "success",
        yardsGained: 5,
        offensivePlay: "run-safe",
        defensivePlay: "pass-safe",
      }
      const result = generatePlayByPlay(input)
      const possibleTexts = DEFAULT_TEMPLATES.success.map((t) =>
        t.replace(/\{yards\}/g, "5")
      )
      expect(possibleTexts).toContain(result)
    })

    it("critical_success outcome produces a string from the critical_success templates", () => {
      const input: PlayByPlayInput = {
        outcome: "critical_success",
        yardsGained: 12,
        offensivePlay: "pass-aggressive",
        defensivePlay: "run-safe",
      }
      const result = generatePlayByPlay(input)
      const possibleTexts = DEFAULT_TEMPLATES.critical_success.map((t) =>
        t.replace(/\{yards\}/g, "12")
      )
      expect(possibleTexts).toContain(result)
    })

    it("incomplete_pass outcome produces one of the incomplete_pass templates", () => {
      const input: PlayByPlayInput = {
        outcome: "incomplete_pass",
        yardsGained: 0,
        offensivePlay: "pass-safe",
        defensivePlay: "pass-aggressive",
      }
      const result = generatePlayByPlay(input)
      const possibleTexts = DEFAULT_TEMPLATES.incomplete_pass.map((t) =>
        t.replace(/\{yards\}/g, "0")
      )
      expect(possibleTexts).toContain(result)
    })

    it("tackle_for_loss outcome produces the correct template with yards", () => {
      const input: PlayByPlayInput = {
        outcome: "tackle_for_loss",
        yardsGained: -3,
        offensivePlay: "run-aggressive",
        defensivePlay: "run-aggressive",
      }
      const result = generatePlayByPlay(input)
      const possibleTexts = DEFAULT_TEMPLATES.tackle_for_loss.map((t) =>
        t.replace(/\{yards\}/g, "3")
      )
      expect(possibleTexts).toContain(result)
    })

    it("interception outcome produces an interception template", () => {
      const input: PlayByPlayInput = {
        outcome: "interception",
        yardsGained: 0,
        offensivePlay: "pass-aggressive",
        defensivePlay: "pass-aggressive",
      }
      const result = generatePlayByPlay(input)
      const possibleTexts = DEFAULT_TEMPLATES.interception.map((t) =>
        t.replace(/\{yards\}/g, "0")
      )
      expect(possibleTexts).toContain(result)
    })

    it("fumble outcome produces a fumble template", () => {
      const input: PlayByPlayInput = {
        outcome: "fumble",
        yardsGained: 0,
        offensivePlay: "run-safe",
        defensivePlay: "run-safe",
      }
      const result = generatePlayByPlay(input)
      const possibleTexts = DEFAULT_TEMPLATES.fumble.map((t) =>
        t.replace(/\{yards\}/g, "0")
      )
      expect(possibleTexts).toContain(result)
    })
  })

  describe("yardage placeholder replacement", () => {
    it("when yardsGained=7, the text should contain '7'", () => {
      const input: PlayByPlayInput = {
        outcome: "success",
        yardsGained: 7,
        offensivePlay: "run-safe",
        defensivePlay: "pass-safe",
      }
      const result = generatePlayByPlay(input)
      expect(result).toContain("7")
    })

    it("when yardsGained=-2 (tackle for loss), the text should contain '2' (absolute value)", () => {
      const input: PlayByPlayInput = {
        outcome: "tackle_for_loss",
        yardsGained: -2,
        offensivePlay: "run-aggressive",
        defensivePlay: "run-safe",
      }
      const result = generatePlayByPlay(input)
      expect(result).toContain("2")
    })
  })

  describe("custom templates override defaults", () => {
    it("uses custom template instead of DEFAULT_TEMPLATES", () => {
      const customTemplates: PlayByPlayTemplates = {
        success: ["Custom success with {yards} yards!"],
        critical_success: ["Custom critical {yards} yard bomb!"],
        incomplete_pass: ["Custom incomplete!"],
        tackle_for_loss: ["Custom TFL for {yards}!"],
        interception: ["Custom INT!"],
        fumble: ["Custom fumble!"],
      }

      const input: PlayByPlayInput = {
        outcome: "success",
        yardsGained: 4,
        offensivePlay: "run-safe",
        defensivePlay: "pass-safe",
      }
      const result = generatePlayByPlay(input, customTemplates)
      expect(result).toBe("Custom success with 4 yards!")
    })

    it("uses custom critical_success template", () => {
      const customTemplates: PlayByPlayTemplates = {
        success: ["Custom success {yards}"],
        critical_success: ["BOOM! {yards} yards to the house!"],
        incomplete_pass: ["Nope!"],
        tackle_for_loss: ["Stopped for {yards}!"],
        interception: ["Picked!"],
        fumble: ["Stripped!"],
      }

      const input: PlayByPlayInput = {
        outcome: "critical_success",
        yardsGained: 18,
        offensivePlay: "pass-aggressive",
        defensivePlay: "run-safe",
      }
      const result = generatePlayByPlay(input, customTemplates)
      expect(result).toBe("BOOM! 18 yards to the house!")
    })
  })

  describe("determinism", () => {
    it("calling generatePlayByPlay twice with the same inputs produces the same output", () => {
      const input: PlayByPlayInput = {
        outcome: "success",
        yardsGained: 6,
        offensivePlay: "pass-safe",
        defensivePlay: "run-aggressive",
      }
      const result1 = generatePlayByPlay(input)
      const result2 = generatePlayByPlay(input)
      expect(result1).toBe(result2)
    })

    it("determinism holds for all outcome types", () => {
      const outcomes: PlayByPlayInput[] = [
        { outcome: "success", yardsGained: 4, offensivePlay: "run-safe", defensivePlay: "pass-safe" },
        { outcome: "critical_success", yardsGained: 15, offensivePlay: "pass-aggressive", defensivePlay: "run-safe" },
        { outcome: "incomplete_pass", yardsGained: 0, offensivePlay: "pass-safe", defensivePlay: "pass-safe" },
        { outcome: "tackle_for_loss", yardsGained: -2, offensivePlay: "run-aggressive", defensivePlay: "run-safe" },
        { outcome: "interception", yardsGained: 0, offensivePlay: "pass-aggressive", defensivePlay: "pass-aggressive" },
        { outcome: "fumble", yardsGained: 0, offensivePlay: "run-safe", defensivePlay: "run-aggressive" },
      ]

      for (const input of outcomes) {
        const result1 = generatePlayByPlay(input)
        const result2 = generatePlayByPlay(input)
        expect(result1).toBe(result2)
      }
    })
  })
})
