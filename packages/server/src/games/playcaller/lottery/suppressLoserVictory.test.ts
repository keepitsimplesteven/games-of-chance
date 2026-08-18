import { describe, it, expect } from "vitest"
import { suppressLoserVictory } from "./suppressLoserVictory"
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

/** Creates a drive state where offense is the predetermined loser */
function driveWhereOffenseIsLoser(): {
  state: DriveState
  predeterminedWinner: string
} {
  return {
    state: {
      offensePlayerId: "loser-player",
      defensePlayerId: "winner-player",
      yardLine: 25,
      down: 1,
      yardsToGo: 10,
      playHistory: [],
      isComplete: false,
      completion: null,
    },
    predeterminedWinner: "winner-player", // defense is winner → offense is loser
  }
}

/** Creates a drive state where defense is the predetermined loser */
function driveWhereDefenseIsLoser(): {
  state: DriveState
  predeterminedWinner: string
} {
  return {
    state: {
      offensePlayerId: "winner-player",
      defensePlayerId: "loser-player",
      yardLine: 25,
      down: 1,
      yardsToGo: 10,
      playHistory: [],
      isComplete: false,
      completion: null,
    },
    predeterminedWinner: "winner-player", // offense is winner → defense is loser
  }
}

/** Creates a 4th down state where defense is the predetermined loser */
function fourthDownDefenseIsLoser(yardsToGo = 5): {
  state: DriveState
  predeterminedWinner: string
} {
  return {
    state: {
      offensePlayerId: "winner-player",
      defensePlayerId: "loser-player",
      yardLine: 40,
      down: 4,
      yardsToGo,
      playHistory: [],
      isComplete: false,
      completion: null,
    },
    predeterminedWinner: "winner-player",
  }
}

describe("suppressLoserVictory", () => {
  describe("pass-through (no suppression needed)", () => {
    it("passes through when predetermined winner would win (offense=winner scores TD)", () => {
      const { state, predeterminedWinner } = driveWhereDefenseIsLoser()
      state.yardLine = 5

      const result = suppressLoserVictory(
        state,
        "success",
        10, // would score TD — but offense IS the winner, so no suppression
        predeterminedWinner,
        createFixedRng([0.5]),
        DEFAULT_PLAY_CONFIG,
        DEFAULT_PLAY_MATRIX,
        "run-safe",
        "pass-safe"
      )

      expect(result.outcome).toBe("success")
      expect(result.yardsGained).toBe(10)
    })

    it("passes through when defense wins via INT and defense IS the winner", () => {
      const { state, predeterminedWinner } = driveWhereOffenseIsLoser()

      const result = suppressLoserVictory(
        state,
        "interception",
        0,
        predeterminedWinner,
        createFixedRng([0.5]),
        DEFAULT_PLAY_CONFIG,
        DEFAULT_PLAY_MATRIX,
        "pass-aggressive",
        "pass-safe"
      )

      expect(result.outcome).toBe("interception")
      expect(result.yardsGained).toBe(0)
    })

    it("passes through normal success when no suppression scenario applies", () => {
      const { state, predeterminedWinner } = driveWhereDefenseIsLoser()

      const result = suppressLoserVictory(
        state,
        "success",
        4,
        predeterminedWinner,
        createFixedRng([0.5]),
        DEFAULT_PLAY_CONFIG,
        DEFAULT_PLAY_MATRIX,
        "run-safe",
        "pass-safe"
      )

      expect(result.outcome).toBe("success")
      expect(result.yardsGained).toBe(4)
    })
  })

  describe("offense-loser TD suppression (Case 1)", () => {
    it("suppresses touchdown when offense is loser and yards would reach endzone", () => {
      const { state, predeterminedWinner } = driveWhereOffenseIsLoser()
      state.yardLine = 5

      // RNG that produces small yardage (well below yardLine of 5)
      const rng = createFixedRng([0.1, 0.5, 0.1]) // success, no crit, small yardage

      const result = suppressLoserVictory(
        state,
        "critical_success",
        10, // would score TD
        predeterminedWinner,
        rng,
        DEFAULT_PLAY_CONFIG,
        DEFAULT_PLAY_MATRIX,
        "run-safe",
        "pass-safe"
      )

      // Should not allow TD
      expect(state.yardLine - result.yardsGained).toBeGreaterThan(0)
    })

    it("uses fallback (yardLine - 1) when all re-rolls would also score", () => {
      const { state, predeterminedWinner } = driveWhereOffenseIsLoser()
      state.yardLine = 1 // Only 1 yard to endzone — almost impossible to not score

      // RNG that always produces successful outcomes (high yardage)
      // Using 0 for success roll (always success), 0 for crit (always crit),
      // 0.99 for bonus (max yards)
      const rng = createFixedRng([0.0, 0.0, 0.99])

      const result = suppressLoserVictory(
        state,
        "success",
        5, // would score
        predeterminedWinner,
        rng,
        DEFAULT_PLAY_CONFIG,
        DEFAULT_PLAY_MATRIX,
        "run-safe",
        "pass-safe"
      )

      // Fallback: yardLine - 1 = 0 yards gained
      expect(result.yardsGained).toBe(0)
      expect(result.outcome).toBe("success")
    })
  })

  describe("defense-loser turnover suppression (Case 2)", () => {
    it("suppresses interception when defense is loser", () => {
      const { state, predeterminedWinner } = driveWhereDefenseIsLoser()

      // RNG producing a success outcome (no interception/fumble)
      const rng = createIncrementingRng(0.1, 0.15)

      const result = suppressLoserVictory(
        state,
        "interception",
        0,
        predeterminedWinner,
        rng,
        DEFAULT_PLAY_CONFIG,
        DEFAULT_PLAY_MATRIX,
        "pass-aggressive",
        "pass-safe"
      )

      expect(result.outcome).not.toBe("interception")
      expect(result.outcome).not.toBe("fumble")
    })

    it("suppresses fumble when defense is loser", () => {
      const { state, predeterminedWinner } = driveWhereDefenseIsLoser()

      const rng = createIncrementingRng(0.1, 0.15)

      const result = suppressLoserVictory(
        state,
        "fumble",
        0,
        predeterminedWinner,
        rng,
        DEFAULT_PLAY_CONFIG,
        DEFAULT_PLAY_MATRIX,
        "run-aggressive",
        "pass-safe"
      )

      expect(result.outcome).not.toBe("interception")
      expect(result.outcome).not.toBe("fumble")
    })

    it("re-rolled outcome can be any valid non-turnover result", () => {
      const { state, predeterminedWinner } = driveWhereDefenseIsLoser()

      // Use an RNG that will produce a successful play
      // successRoll = 0.1 < modifiedSuccessRate → success path
      // critRoll = 0.9 → no crit → normal success
      // yardageRoll = 0.5 → mid-range yards
      const rng = createFixedRng([0.1, 0.9, 0.5])

      const result = suppressLoserVictory(
        state,
        "interception",
        0,
        predeterminedWinner,
        rng,
        DEFAULT_PLAY_CONFIG,
        DEFAULT_PLAY_MATRIX,
        "pass-safe",
        "pass-safe"
      )

      // Should be a valid non-turnover outcome
      expect(["success", "critical_success", "incomplete_pass", "tackle_for_loss"]).toContain(
        result.outcome
      )
    })

    it("on 4th down, re-roll must also satisfy yardsToGo requirement", () => {
      const { state, predeterminedWinner } = fourthDownDefenseIsLoser(3)

      // Force an outcome that gains enough yards
      // successRoll = 0.1 → success
      // critRoll = 0.9 → normal
      // yardageRoll = 0.9 → high-end range
      const rng = createFixedRng([0.1, 0.9, 0.9])

      const result = suppressLoserVictory(
        state,
        "interception",
        0,
        predeterminedWinner,
        rng,
        DEFAULT_PLAY_CONFIG,
        DEFAULT_PLAY_MATRIX,
        "run-safe",
        "pass-safe"
      )

      expect(result.outcome).not.toBe("interception")
      expect(result.outcome).not.toBe("fumble")
      expect(result.yardsGained).toBeGreaterThanOrEqual(3)
    })

    it("uses fallback on 4th down when all re-rolls fail", () => {
      const { state, predeterminedWinner } = fourthDownDefenseIsLoser(5)

      // RNG that always produces interceptions (always fail → always crit fail → pass axis = INT)
      // successRoll = 0.99 > any success rate → failure path
      // critFailRoll = 0.0 < any critFailure → critical failure
      // For pass-aggressive axis = "pass" → interception
      const rng = createFixedRng([0.99, 0.0])

      const result = suppressLoserVictory(
        state,
        "interception",
        0,
        predeterminedWinner,
        rng,
        DEFAULT_PLAY_CONFIG,
        DEFAULT_PLAY_MATRIX,
        "pass-aggressive",
        "pass-safe"
      )

      // Fallback on 4th down: force first down
      expect(result.outcome).toBe("success")
      expect(result.yardsGained).toBe(5) // yardsToGo
    })

    it("uses incomplete_pass fallback on non-4th down when all re-rolls are turnovers", () => {
      const { state, predeterminedWinner } = driveWhereDefenseIsLoser()
      state.down = 2 // non-4th down

      // RNG that always produces interceptions
      const rng = createFixedRng([0.99, 0.0])

      const result = suppressLoserVictory(
        state,
        "fumble",
        0,
        predeterminedWinner,
        rng,
        DEFAULT_PLAY_CONFIG,
        DEFAULT_PLAY_MATRIX,
        "pass-aggressive",
        "pass-safe"
      )

      // Fallback on non-4th-down: safe incomplete pass
      expect(result.outcome).toBe("incomplete_pass")
      expect(result.yardsGained).toBe(0)
    })
  })

  describe("defense-loser turnover-on-downs suppression (Case 3)", () => {
    it("suppresses turnover on downs when gain < yardsToGo on 4th down", () => {
      const { state, predeterminedWinner } = fourthDownDefenseIsLoser(5)

      // RNG that produces enough yards on re-roll
      // successRoll = 0.1 → success
      // critRoll = 0.9 → normal
      // yardageRoll = 0.99 → max yards
      const rng = createFixedRng([0.1, 0.9, 0.99])

      const result = suppressLoserVictory(
        state,
        "success",
        2, // gain of 2 < yardsToGo of 5 → turnover on downs
        predeterminedWinner,
        rng,
        DEFAULT_PLAY_CONFIG,
        DEFAULT_PLAY_MATRIX,
        "run-safe",
        "pass-safe"
      )

      expect(result.yardsGained).toBeGreaterThanOrEqual(5)
    })

    it("does NOT trigger on non-4th down even if gain < yardsToGo", () => {
      const { state, predeterminedWinner } = driveWhereDefenseIsLoser()
      state.down = 2
      state.yardsToGo = 10

      const rng = createFixedRng([0.5])

      const result = suppressLoserVictory(
        state,
        "success",
        3, // less than yardsToGo, but it's only 2nd down
        predeterminedWinner,
        rng,
        DEFAULT_PLAY_CONFIG,
        DEFAULT_PLAY_MATRIX,
        "run-safe",
        "pass-safe"
      )

      // Should pass through — no suppression on non-4th down for short gains
      expect(result.outcome).toBe("success")
      expect(result.yardsGained).toBe(3)
    })

    it("forces yardsToGo when play max cannot reach first-down marker", () => {
      const { state, predeterminedWinner } = fourthDownDefenseIsLoser(20)

      // run-safe vs run-safe: base max = 6, with modifier probably still < 20
      const rng = createFixedRng([0.5])

      const result = suppressLoserVictory(
        state,
        "tackle_for_loss",
        -2, // gain of -2 < yardsToGo of 20
        predeterminedWinner,
        rng,
        DEFAULT_PLAY_CONFIG,
        DEFAULT_PLAY_MATRIX,
        "run-safe",
        "run-safe"
      )

      // modifiedMax for run-safe vs run-safe is well below 20, so should force
      expect(result.outcome).toBe("success")
      expect(result.yardsGained).toBe(20) // forced to yardsToGo
    })
  })
})
