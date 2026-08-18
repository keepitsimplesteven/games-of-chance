import { describe, it, expect } from "vitest"
import { resolveLotteryDown } from "./lotteryDriveResolver"
import { DEFAULT_PLAY_CONFIG, DEFAULT_PLAY_MATRIX } from "../drive/config"
import type { DriveState } from "../drive/types"

// --- Helpers ---

function createFixedRng(values: number[]): () => number {
  let i = 0
  return () => values[i++ % values.length] ?? 0
}

function createIncrementingRng(start = 0.1, step = 0.1): () => number {
  let value = start
  return () => {
    const v = value
    value = (value + step) % 1
    return v
  }
}

function baseDriveState(overrides: Partial<DriveState> = {}): DriveState {
  return {
    offensePlayerId: "playerA",
    defensePlayerId: "playerB",
    yardLine: 25,
    down: 1,
    yardsToGo: 10,
    playHistory: [],
    isComplete: false,
    completion: null,
    ...overrides,
  }
}

describe("resolveLotteryDown", () => {
  describe("no suppression needed", () => {
    it("returns natural result when no winning outcome for the loser", () => {
      const state = baseDriveState()
      // RNG that produces a short gain (well below TD range from yardLine 25)
      // resolveDown will use: successRoll, critRoll, yardageRoll
      // suppressLoserVictory will see a normal gain and pass it through
      const rng = createIncrementingRng(0.1, 0.15)

      const { state: newState, result } = resolveLotteryDown(
        state,
        "run-safe",
        "pass-safe",
        rng,
        DEFAULT_PLAY_CONFIG,
        DEFAULT_PLAY_MATRIX,
        "playerA" // offense is the winner
      )

      // Should produce a valid result without suppression
      expect(newState.isComplete).toBe(false)
      expect(newState.playHistory.length).toBe(1)
      expect(result.offensivePlay).toBe("run-safe")
      expect(result.defensivePlay).toBe("pass-safe")
    })

    it("allows predetermined winner (offense) to score a touchdown", () => {
      const state = baseDriveState({ yardLine: 3 })
      // RNG that produces a big gain (TD from 3 yards)
      // successRoll = 0.05 → success, critRoll = 0.01 → crit, bonusRoll = 0.99 → max yards
      const rng = createFixedRng([0.05, 0.01, 0.99])

      const { state: newState, result } = resolveLotteryDown(
        state,
        "run-aggressive",
        "pass-safe",
        rng,
        DEFAULT_PLAY_CONFIG,
        DEFAULT_PLAY_MATRIX,
        "playerA" // offense is the winner — TD is allowed
      )

      expect(newState.isComplete).toBe(true)
      expect(newState.completion?.endingType).toBe("touchdown")
      expect(newState.completion?.winner).toBe("playerA")
    })

    it("allows predetermined winner (defense) to get an interception", () => {
      const state = baseDriveState()
      // RNG that produces an interception: successRoll = 0.99 → failure, critFailRoll = 0.0 → crit fail
      // For pass-aggressive: axis="pass" → interception
      const rng = createFixedRng([0.99, 0.0])

      const { state: newState, result } = resolveLotteryDown(
        state,
        "pass-aggressive",
        "pass-safe",
        rng,
        DEFAULT_PLAY_CONFIG,
        DEFAULT_PLAY_MATRIX,
        "playerB" // defense is the winner — INT is allowed
      )

      expect(newState.isComplete).toBe(true)
      expect(newState.completion?.endingType).toBe("interception")
      expect(newState.completion?.winner).toBe("playerB")
    })
  })

  describe("suppression cases", () => {
    it("suppresses touchdown when offense is the loser", () => {
      const state = baseDriveState({ yardLine: 3 })
      // RNG for resolveDown: successRoll=0.05 → success, critRoll=0.01 → crit, bonusRoll=0.99 → big gain → TD
      // RNG for suppression re-rolls: should produce a smaller gain
      // After resolveDown consumes 3 values, suppression gets remaining values
      const rng = createFixedRng([
        // resolveDown: TD scenario
        0.05, 0.01, 0.99,
        // suppressLoserVictory re-roll: low success, no crit, small yards
        0.1, 0.9, 0.1,
      ])

      const { state: newState, result } = resolveLotteryDown(
        state,
        "run-aggressive",
        "pass-safe",
        rng,
        DEFAULT_PLAY_CONFIG,
        DEFAULT_PLAY_MATRIX,
        "playerB" // defense is the winner → offense is the loser
      )

      // Should NOT be a touchdown
      expect(newState.completion?.endingType).not.toBe("touchdown")
      // Yard line should still be > 0
      expect(newState.yardLine).toBeGreaterThan(0)
    })

    it("suppresses interception when defense is the loser", () => {
      const state = baseDriveState()
      // resolveDown produces interception: successRoll=0.99 → fail, critFail=0.0 → crit fail, axis=pass → INT
      // suppression re-roll produces a success: successRoll=0.1, critRoll=0.9, yardageRoll=0.5
      const rng = createFixedRng([
        0.99, 0.0, // resolveDown: interception
        0.1, 0.9, 0.5, // suppression: normal success
      ])

      const { state: newState, result } = resolveLotteryDown(
        state,
        "pass-aggressive",
        "pass-safe",
        rng,
        DEFAULT_PLAY_CONFIG,
        DEFAULT_PLAY_MATRIX,
        "playerA" // offense is the winner → defense is the loser
      )

      // Should NOT be interception or fumble
      expect(result.outcome).not.toBe("interception")
      expect(result.outcome).not.toBe("fumble")
      expect(newState.isComplete).toBe(false)
    })

    it("suppresses turnover on downs when defense is the loser", () => {
      const state = baseDriveState({
        down: 4,
        yardsToGo: 5,
        yardLine: 40,
      })
      // resolveDown: successRoll=0.1 → success, critRoll=0.9 → no crit, yardageRoll=0.1 → small gain (~1-2 yards, < 5)
      // suppression re-roll: bigger gain (successRoll=0.1, critRoll=0.9, yardageRoll=0.99 → max yards)
      const rng = createFixedRng([
        0.1, 0.9, 0.1, // resolveDown: small gain < 5
        0.1, 0.9, 0.99, // suppression: large gain >= 5
      ])

      const { state: newState, result } = resolveLotteryDown(
        state,
        "run-safe",
        "pass-safe",
        rng,
        DEFAULT_PLAY_CONFIG,
        DEFAULT_PLAY_MATRIX,
        "playerA" // offense is the winner → defense is the loser
      )

      // Should have converted the first down, not turned over
      expect(newState.completion?.endingType).not.toBe("turnover_on_downs")
      expect(result.yardsGained).toBeGreaterThanOrEqual(5)
    })

    it("reconstructs DriveState correctly after suppression", () => {
      const state = baseDriveState({ yardLine: 3, down: 2, yardsToGo: 3 })
      // resolveDown: TD (success, crit, big gain)
      // suppression: normal success with gain of yardLine - 1 = 2 yards (fallback)
      // Use RNG that always produces big gains so fallback kicks in
      const rng = createFixedRng([0.05, 0.01, 0.99])

      const { state: newState, result } = resolveLotteryDown(
        state,
        "run-aggressive",
        "pass-safe",
        rng,
        DEFAULT_PLAY_CONFIG,
        DEFAULT_PLAY_MATRIX,
        "playerB" // defense is the winner → offense is the loser
      )

      // After suppression with fallback (yardsGained = yardLine - 1 = 2):
      // yardLine should be 3 - 2 = 1
      // Since gain of 2 < yardsToGo of 3, advance down
      expect(newState.yardLine).toBe(1)
      expect(newState.down).toBe(3) // was down 2, gain < yardsToGo → advance to 3
      expect(newState.yardsToGo).toBe(1) // 3 - 2 = 1
      expect(newState.playHistory.length).toBe(1)
      expect(newState.playHistory[0].down).toBe(2) // original down
      expect(newState.playHistory[0].yardLine).toBe(3) // original yard line
      expect(newState.playHistory[0].resultingYardLine).toBe(1)
      expect(result.playByPlayText).toBeDefined()
      expect(result.playByPlayText.length).toBeGreaterThan(0)
    })
  })

  describe("drive completion via suppression", () => {
    it("allows first down conversion when corrected yards exceed yardsToGo", () => {
      const state = baseDriveState({
        down: 4,
        yardsToGo: 5,
        yardLine: 40,
      })
      // resolveDown: small run loss (failure → tackle for loss)
      // suppression: forces a gain >= yardsToGo
      const rng = createFixedRng([
        0.99, 0.9, 0.5, // resolveDown: fail → no crit fail → tackle for loss (-2 yards)
        0.1, 0.9, 0.99, // suppression: success, high yardage
      ])

      const { state: newState, result } = resolveLotteryDown(
        state,
        "run-safe",
        "pass-safe",
        rng,
        DEFAULT_PLAY_CONFIG,
        DEFAULT_PLAY_MATRIX,
        "playerA" // offense is the winner → 4th down failure would hand win to loser defense
      )

      // Should convert to first down
      expect(newState.down).toBe(1)
      expect(result.yardsGained).toBeGreaterThanOrEqual(5)
    })
  })
})
