import { describe, it, expect } from "vitest"
import { createDriveState, resolveDown, isDriveComplete } from "./engine"
import { DEFAULT_PLAY_CONFIG, DEFAULT_PLAY_MATRIX } from "./config"
import {
  InvalidPlayError,
  DriveCompleteError,
  InvalidPlayerError,
  InvalidSeedError,
} from "./types"
import type { DriveState, OffensivePlayId, DefensivePlayId } from "./types"

// --- Helper: controlled RNG ---

function createFixedRng(values: number[]): () => number {
  let i = 0
  return () => values[i++] ?? 0
}

// --- Convenience: fresh drive state (playerA=offense because seedA > seedB) ---

function freshDrive(): DriveState {
  return createDriveState("offense-player", "defense-player", 100, 1)
}

describe("resolveDown — roll outcomes", () => {
  // ─────────────────────────────────────────────────────────────
  // 1. Controlled RNG success roll (rng always returns 0.5)
  // ─────────────────────────────────────────────────────────────
  describe("controlled RNG success roll", () => {
    it("run-safe with rng=0.5 succeeds (0.5 < 0.70 base success rate)", () => {
      const state = freshDrive()
      // run-safe vs pass-safe → mismatched axis, successRateMod = +0.05 → modified = 0.75
      // Roll 0.5 < 0.75 → success path
      // critSuccessChance = 0.08 + 0.03 = 0.11, roll 0.5 >= 0.11 → normal success
      // yardage: min=2-1=1, max=5+1=6 → 1 + 0.5*(6-1) = 1+2.5 = 3.5 → rounds to 4
      const rng = createFixedRng([0.5, 0.5, 0.5])
      const { result } = resolveDown(
        state,
        "run-safe",
        "pass-safe",
        rng,
        DEFAULT_PLAY_CONFIG,
        DEFAULT_PLAY_MATRIX
      )

      expect(result.outcome).toBe("success")
      expect(result.yardsGained).toBeGreaterThan(0)
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 2. Critical success
  // ─────────────────────────────────────────────────────────────
  describe("critical success", () => {
    it("produces yards in 100-120% of modified max", () => {
      const state = freshDrive()
      // run-aggressive vs pass-safe: mismatched axis
      // successRateMod = +0.05 → modified success = 0.60
      // critSuccessMod = +0.04 → modified crit success = 0.16
      // yardageMaxMod = +2 → modified max = 12
      // yardageMinMod = -1 → modified min = 2
      //
      // Roll sequence:
      // 1) success roll: 0.1 < 0.60 → success
      // 2) crit success roll: 0.05 < 0.16 → critical success
      // 3) bonus yardage roll: 0.8 → max + 0.8 * (max * 0.20) = 12 + 0.8*2.4 = 12 + 1.92 → round = 14
      const rng = createFixedRng([0.1, 0.05, 0.8])
      const { result } = resolveDown(
        state,
        "run-aggressive",
        "pass-safe",
        rng,
        DEFAULT_PLAY_CONFIG,
        DEFAULT_PLAY_MATRIX
      )

      expect(result.outcome).toBe("critical_success")
      // Modified max = 10 + 2 = 12
      // Expected: 100-120% of 12 → 12 to 14 (rounded)
      expect(result.yardsGained).toBeGreaterThanOrEqual(12)
      expect(result.yardsGained).toBeLessThanOrEqual(Math.round(12 * 1.2))
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 3. Incomplete pass
  // ─────────────────────────────────────────────────────────────
  describe("incomplete pass", () => {
    it("pass play failure (non-critical) yields outcome=incomplete_pass, yards=0", () => {
      const state = freshDrive()
      // pass-safe vs pass-safe: matched axis
      // successRateMod = -0.08 → modified success = 0.57
      // critFailureMod = +0.03 → modified crit failure = 0.09
      //
      // Roll sequence:
      // 1) success roll: 0.9 >= 0.57 → failure
      // 2) crit failure roll: 0.5 >= 0.09 → no crit failure → incomplete pass
      const rng = createFixedRng([0.9, 0.5])
      const { result } = resolveDown(
        state,
        "pass-safe",
        "pass-safe",
        rng,
        DEFAULT_PLAY_CONFIG,
        DEFAULT_PLAY_MATRIX
      )

      expect(result.outcome).toBe("incomplete_pass")
      expect(result.yardsGained).toBe(0)
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 4. Tackle for loss
  // ─────────────────────────────────────────────────────────────
  describe("tackle for loss", () => {
    it("run play failure (non-critical) yields outcome=tackle_for_loss, yards between -3 and -1", () => {
      const state = freshDrive()
      // run-safe vs run-safe: matched axis
      // successRateMod = -0.08 → modified success = 0.62
      // critFailureMod = +0.03 → modified crit failure = 0.08
      //
      // Roll sequence:
      // 1) success roll: 0.9 >= 0.62 → failure
      // 2) crit failure roll: 0.5 >= 0.08 → no crit failure → tackle for loss
      // 3) loss roll: 0.5 → -(1 + 0.5*2) = -(2) → -2
      const rng = createFixedRng([0.9, 0.5, 0.5])
      const { result } = resolveDown(
        state,
        "run-safe",
        "run-safe",
        rng,
        DEFAULT_PLAY_CONFIG,
        DEFAULT_PLAY_MATRIX
      )

      expect(result.outcome).toBe("tackle_for_loss")
      expect(result.yardsGained).toBeGreaterThanOrEqual(-3)
      expect(result.yardsGained).toBeLessThanOrEqual(-1)
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 5. Interception
  // ─────────────────────────────────────────────────────────────
  describe("interception", () => {
    it("pass play critical failure yields interception, drive complete, defense wins", () => {
      const state = freshDrive()
      // pass-aggressive vs pass-aggressive: matched aggressive axis
      // successRateMod = -0.10 → modified success = 0.35
      // critFailureMod = +0.08 → modified crit failure = 0.20
      //
      // Roll sequence:
      // 1) success roll: 0.9 >= 0.35 → failure
      // 2) crit failure roll: 0.05 < 0.20 → critical failure → interception (pass axis)
      const rng = createFixedRng([0.9, 0.05])
      const { state: newState, result } = resolveDown(
        state,
        "pass-aggressive",
        "pass-aggressive",
        rng,
        DEFAULT_PLAY_CONFIG,
        DEFAULT_PLAY_MATRIX
      )

      expect(result.outcome).toBe("interception")
      expect(result.yardsGained).toBe(0)
      expect(newState.isComplete).toBe(true)
      expect(newState.completion).not.toBeNull()
      expect(newState.completion!.endingType).toBe("interception")
      expect(newState.completion!.winner).toBe("defense-player")
      expect(newState.completion!.loser).toBe("offense-player")
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 6. Fumble
  // ─────────────────────────────────────────────────────────────
  describe("fumble", () => {
    it("run play critical failure yields fumble, drive complete, defense wins", () => {
      const state = freshDrive()
      // run-aggressive vs run-aggressive: matched aggressive axis
      // successRateMod = -0.10 → modified success = 0.45
      // critFailureMod = +0.08 → modified crit failure = 0.16
      //
      // Roll sequence:
      // 1) success roll: 0.9 >= 0.45 → failure
      // 2) crit failure roll: 0.05 < 0.16 → critical failure → fumble (run axis)
      const rng = createFixedRng([0.9, 0.05])
      const { state: newState, result } = resolveDown(
        state,
        "run-aggressive",
        "run-aggressive",
        rng,
        DEFAULT_PLAY_CONFIG,
        DEFAULT_PLAY_MATRIX
      )

      expect(result.outcome).toBe("fumble")
      expect(result.yardsGained).toBe(0)
      expect(newState.isComplete).toBe(true)
      expect(newState.completion).not.toBeNull()
      expect(newState.completion!.endingType).toBe("fumble")
      expect(newState.completion!.winner).toBe("defense-player")
      expect(newState.completion!.loser).toBe("offense-player")
    })
  })
})

describe("resolveDown — complete drive scenarios", () => {
  // ─────────────────────────────────────────────────────────────
  // 7. Complete drive: 3 successful plays → touchdown
  // ─────────────────────────────────────────────────────────────
  describe("3 successful plays → touchdown", () => {
    it("reaches touchdown from yardLine=25 with sufficient yards each play", () => {
      // Use run-aggressive vs pass-aggressive (mismatched): successRateMod +0.05, maxMod +3
      // Modified: success=0.60, min=2, max=13, critSuccess=0.17, critFailure=0.05
      // Strategy: always crit success to get big yards
      // Play 1: success(0.1<0.60), critSuccess(0.01<0.17), bonusRoll(0.99) → 13 + 0.99*2.6 = 13+2.57 → 16 yards
      // yardLine: 25-16 = 9, first down, yardsToGo = min(10,9) = 9
      // Play 2: same crit success → 16 yards, yardLine: 9-16 → clamped to 0 → touchdown!
      const rngValues = [
        // Play 1: success, crit success, bonus yardage
        0.1, 0.01, 0.99,
        // Play 2: success, crit success, bonus yardage
        0.1, 0.01, 0.99,
        // Play 3 (safety — may not be needed): success, crit success, bonus yardage
        0.1, 0.01, 0.99,
      ]
      const rng = createFixedRng(rngValues)
      let state = freshDrive()

      // Play 1
      const r1 = resolveDown(state, "run-aggressive", "pass-aggressive", rng, DEFAULT_PLAY_CONFIG, DEFAULT_PLAY_MATRIX)
      state = r1.state
      expect(r1.result.outcome).toBe("critical_success")
      expect(state.isComplete).toBe(false)

      // Play 2
      const r2 = resolveDown(state, "run-aggressive", "pass-aggressive", rng, DEFAULT_PLAY_CONFIG, DEFAULT_PLAY_MATRIX)
      state = r2.state

      // Should be a touchdown by play 2 or 3
      if (!state.isComplete) {
        const r3 = resolveDown(state, "run-aggressive", "pass-aggressive", rng, DEFAULT_PLAY_CONFIG, DEFAULT_PLAY_MATRIX)
        state = r3.state
      }

      expect(state.isComplete).toBe(true)
      expect(state.completion!.endingType).toBe("touchdown")
      expect(state.completion!.winner).toBe("offense-player")
      expect(state.yardLine).toBe(0)
      expect(state.playHistory.length).toBeLessThanOrEqual(3)
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 8. Complete drive: 4 incomplete passes → turnover on downs
  // ─────────────────────────────────────────────────────────────
  describe("4 incomplete passes → turnover on downs", () => {
    it("4 failed pass plays result in turnover_on_downs", () => {
      // pass-safe vs pass-safe: matched axis
      // successRateMod = -0.08 → modified success = 0.57
      // critFailureMod = +0.03 → modified crit failure = 0.09
      //
      // Each play: success roll 0.9 >= 0.57 → failure, crit fail roll 0.5 >= 0.09 → incomplete_pass
      const rngValues = [
        0.9, 0.5, // Play 1: fail, no crit
        0.9, 0.5, // Play 2: fail, no crit
        0.9, 0.5, // Play 3: fail, no crit
        0.9, 0.5, // Play 4: fail, no crit
      ]
      const rng = createFixedRng(rngValues)
      let state = freshDrive()

      for (let i = 0; i < 4; i++) {
        const { state: newState } = resolveDown(
          state,
          "pass-safe",
          "pass-safe",
          rng,
          DEFAULT_PLAY_CONFIG,
          DEFAULT_PLAY_MATRIX
        )
        state = newState
      }

      expect(state.isComplete).toBe(true)
      expect(state.completion).not.toBeNull()
      expect(state.completion!.endingType).toBe("turnover_on_downs")
      expect(state.completion!.winner).toBe("defense-player")
      expect(state.completion!.loser).toBe("offense-player")
      expect(state.playHistory.length).toBe(4)
    })
  })

  // ─────────────────────────────────────────────────────────────
  // 9. Complete drive: critical failure on first play → immediate turnover
  // ─────────────────────────────────────────────────────────────
  describe("critical failure on first play → immediate turnover", () => {
    it("drive ends immediately with 1 play in history", () => {
      const state = freshDrive()
      // pass-aggressive vs pass-aggressive: matched aggressive
      // successRateMod = -0.10 → modified success = 0.35
      // critFailureMod = +0.08 → modified crit failure = 0.20
      //
      // Roll: 0.9 >= 0.35 → failure, 0.01 < 0.20 → crit failure → interception
      const rng = createFixedRng([0.9, 0.01])
      const { state: newState } = resolveDown(
        state,
        "pass-aggressive",
        "pass-aggressive",
        rng,
        DEFAULT_PLAY_CONFIG,
        DEFAULT_PLAY_MATRIX
      )

      expect(newState.isComplete).toBe(true)
      expect(newState.playHistory.length).toBe(1)
      expect(newState.completion!.endingType).toBe("interception")
      expect(newState.completion!.winner).toBe("defense-player")
    })
  })
})

describe("resolveDown — error cases", () => {
  // ─────────────────────────────────────────────────────────────
  // 10. Error cases
  // ─────────────────────────────────────────────────────────────
  it("throws InvalidPlayError for invalid offensive play ID", () => {
    const state = freshDrive()
    const rng = createFixedRng([0.5])

    expect(() =>
      resolveDown(
        state,
        "bad-play" as OffensivePlayId,
        "run-safe",
        rng,
        DEFAULT_PLAY_CONFIG,
        DEFAULT_PLAY_MATRIX
      )
    ).toThrow(InvalidPlayError)
  })

  it("throws InvalidPlayError for invalid defensive play ID", () => {
    const state = freshDrive()
    const rng = createFixedRng([0.5])

    expect(() =>
      resolveDown(
        state,
        "run-safe",
        "bad-play" as DefensivePlayId,
        rng,
        DEFAULT_PLAY_CONFIG,
        DEFAULT_PLAY_MATRIX
      )
    ).toThrow(InvalidPlayError)
  })

  it("throws DriveCompleteError when called on a completed drive", () => {
    // First create a completed drive via interception
    const state = freshDrive()
    const rng = createFixedRng([0.9, 0.01])
    const { state: completedState } = resolveDown(
      state,
      "pass-aggressive",
      "pass-aggressive",
      rng,
      DEFAULT_PLAY_CONFIG,
      DEFAULT_PLAY_MATRIX
    )

    expect(completedState.isComplete).toBe(true)

    const rng2 = createFixedRng([0.5])
    expect(() =>
      resolveDown(
        completedState,
        "run-safe",
        "run-safe",
        rng2,
        DEFAULT_PLAY_CONFIG,
        DEFAULT_PLAY_MATRIX
      )
    ).toThrow(DriveCompleteError)
  })

  it("throws InvalidPlayerError when createDriveState is called with same player", () => {
    expect(() => createDriveState("player-1", "player-1", 10, 5)).toThrow(
      InvalidPlayerError
    )
  })

  it("throws InvalidSeedError when createDriveState is called with equal seeds", () => {
    expect(() => createDriveState("player-1", "player-2", 10, 10)).toThrow(
      InvalidSeedError
    )
  })
})


// ═══════════════════════════════════════════════════════════════════════
// Integration Tests — createDriveResolver + BracketEngine
// ═══════════════════════════════════════════════════════════════════════

import { createDriveResolver } from "./index"
import {
  generateBracket,
  resolveCurrentRound,
  isComplete as isBracketComplete,
} from "../BracketEngine"

// --- Helper: seeded RNG for deterministic tests ---

function createSeededRng(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

describe("createDriveResolver — integration", () => {
  it("resolves a matchup returning one of the two player IDs", () => {
    const rng = createSeededRng(42)
    const resolver = createDriveResolver(rng)

    const winner = resolver("player-alpha", "player-beta")

    expect(["player-alpha", "player-beta"]).toContain(winner)
  })

  it("deterministic replay: same seed produces identical winner", () => {
    const rngA = createSeededRng(99)
    const rngB = createSeededRng(99)

    const resolverA = createDriveResolver(rngA)
    const resolverB = createDriveResolver(rngB)

    const winnerA = resolverA("hero", "villain")
    const winnerB = resolverB("hero", "villain")

    expect(winnerA).toBe(winnerB)
  })

  it("full bracket with Drive Engine: 4-player bracket resolves a champion", () => {
    const players = ["p1", "p2", "p3", "p4"]
    const rng = createSeededRng(7)
    const resolver = createDriveResolver(rng)

    let bracket = generateBracket(players)

    while (!isBracketComplete(bracket)) {
      bracket = resolveCurrentRound(bracket, resolver)
    }

    // The final round should have a winner
    const finalRound = bracket.rounds[bracket.totalRounds - 1]
    const champion = finalRound.matchups[0].winner

    expect(champion).not.toBeNull()
    expect(players).toContain(champion)
  })
})
