/**
 * Integration tests for full Big Wheel game flow.
 *
 * Verifies the complete game lifecycle by calling plugin methods in sequence:
 * - 3-player game with manual spins and correct leaderboard
 * - Disconnection mid-turn with auto-resolved remaining spins
 * - Timeout auto-resolve producing valid results
 *
 * **Validates: Requirements 4.1, 4.6, 7.1, 12.1**
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import {
  bigWheelPlugin,
  setBigWheelState,
  resetBigWheelState,
} from "../BigWheelPlugin"
import {
  handleActiveSpinnerDisconnection,
  resolveDisconnectedTurn,
} from "../disconnection"
import { BIG_WHEEL } from "../constants"

// ── Helpers ────────────────────────────────────────────────────────────────

function makePlayer(id: string, name: string, connected = true) {
  return { id, name, role: "player" as const, connected, connectionId: connected ? id : null }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Big Wheel Integration Tests", () => {
  afterEach(() => {
    resetBigWheelState()
  })

  describe("Test 1: 3-player full game", () => {
    it("all players spin manually, game ends with correct leaderboard", () => {
      const players = [
        makePlayer("p1", "Alice"),
        makePlayer("p2", "Bob"),
        makePlayer("p3", "Charlie"),
      ]
      const reelStrip = BIG_WHEEL.DEFAULT_REEL_STRIP

      // Initialize plugin state
      setBigWheelState({
        spinOrder: ["p1", "p2", "p3"],
        currentTurnIndex: 0,
        spinResults: {},
        currentSpinNumber: 1,
        reelStrip,
        disconnectedPlayers: [],
      })

      const gameScores: Record<string, number> = {}

      // Simulate each player's turn
      for (let turnIdx = 0; turnIdx < 3; turnIdx++) {
        const playerId = ["p1", "p2", "p3"][turnIdx]

        // Set plugin state for this player's turn
        setBigWheelState({
          spinOrder: ["p1", "p2", "p3"],
          currentTurnIndex: turnIdx,
          spinResults: gameScores, // reuse as tracking
          currentSpinNumber: 1,
          reelStrip,
          disconnectedPlayers: [],
        })

        // Spin 1
        const spin1Result = bigWheelPlugin.resolveRound(
          { [playerId]: { type: "spin" } },
          {}
        )
        expect(spin1Result.spinnerPlayerId).toBe(playerId)
        expect(spin1Result.spinNumber).toBe(1)
        expect(spin1Result.reelIndex).toBeGreaterThanOrEqual(0)
        expect(spin1Result.reelIndex).toBeLessThan(reelStrip.length)
        expect(spin1Result.value).toBe(reelStrip[spin1Result.reelIndex])
        expect(spin1Result.spinTotal).toBeNull()

        // Record spin 1 result in spinResults for spin 2
        setBigWheelState({
          spinOrder: ["p1", "p2", "p3"],
          currentTurnIndex: turnIdx,
          spinResults: { [playerId]: [spin1Result.value] },
          currentSpinNumber: 2,
          reelStrip,
          disconnectedPlayers: [],
        })

        // Spin 2
        const spin2Result = bigWheelPlugin.resolveRound(
          { [playerId]: { type: "spin" } },
          {}
        )
        expect(spin2Result.spinnerPlayerId).toBe(playerId)
        expect(spin2Result.spinNumber).toBe(2)
        expect(spin2Result.reelIndex).toBeGreaterThanOrEqual(0)
        expect(spin2Result.reelIndex).toBeLessThan(reelStrip.length)
        expect(spin2Result.value).toBe(reelStrip[spin2Result.reelIndex])
        expect(spin2Result.spinTotal).toBe(spin1Result.value + spin2Result.value)

        // Score the round
        const scoreResult = bigWheelPlugin.scoreRound(
          { [playerId]: { type: "spin" } },
          spin2Result,
          players,
          {}
        )
        expect(scoreResult.deltas[playerId]).toBe(spin2Result.spinTotal)

        // Accumulate game scores
        gameScores[playerId] = (gameScores[playerId] ?? 0) + (scoreResult.deltas[playerId] ?? 0)
      }

      // Compute final leaderboard
      const leaderboard = bigWheelPlugin.computeGameLeaderboard(players, gameScores)

      // Verify all 3 players appear
      expect(leaderboard).toHaveLength(3)
      const leaderboardIds = leaderboard.map((e) => e.playerId)
      expect(leaderboardIds).toContain("p1")
      expect(leaderboardIds).toContain("p2")
      expect(leaderboardIds).toContain("p3")

      // Verify leaderboard is sorted by score descending
      for (let i = 0; i < leaderboard.length - 1; i++) {
        expect(leaderboard[i].score).toBeGreaterThanOrEqual(leaderboard[i + 1].score)
      }

      // Verify ranks are sequential
      for (let i = 0; i < leaderboard.length; i++) {
        expect(leaderboard[i].rank).toBe(i + 1)
      }
    })
  })

  describe("Test 2: Disconnection mid-turn", () => {
    it("remaining spins auto-resolve when active spinner disconnects", () => {
      const players = [
        makePlayer("p1", "Alice"),
        makePlayer("p2", "Bob"),
      ]
      const reelStrip = BIG_WHEEL.DEFAULT_REEL_STRIP

      // --- Player 1 spins normally ---
      setBigWheelState({
        spinOrder: ["p1", "p2"],
        currentTurnIndex: 0,
        spinResults: {},
        currentSpinNumber: 1,
        reelStrip,
        disconnectedPlayers: [],
      })

      // P1 Spin 1
      const p1Spin1 = bigWheelPlugin.resolveRound(
        { p1: { type: "spin" } },
        {}
      )
      expect(p1Spin1.spinnerPlayerId).toBe("p1")
      expect(p1Spin1.spinNumber).toBe(1)

      // Update state for P1 Spin 2
      setBigWheelState({
        spinOrder: ["p1", "p2"],
        currentTurnIndex: 0,
        spinResults: { p1: [p1Spin1.value] },
        currentSpinNumber: 2,
        reelStrip,
        disconnectedPlayers: [],
      })

      // P1 Spin 2
      const p1Spin2 = bigWheelPlugin.resolveRound(
        { p1: { type: "spin" } },
        {}
      )
      expect(p1Spin2.spinNumber).toBe(2)
      expect(p1Spin2.spinTotal).toBe(p1Spin1.value + p1Spin2.value)

      const p1Score = p1Spin2.spinTotal!

      // --- Player 2 disconnects before spinning ---
      // Use resolveDisconnectedTurn since the player is a non-active player who disconnected
      // and their turn is being skipped
      setBigWheelState({
        spinOrder: ["p1", "p2"],
        currentTurnIndex: 1,
        spinResults: { p1: [p1Spin1.value, p1Spin2.value] },
        currentSpinNumber: 1,
        reelStrip,
        disconnectedPlayers: [],
      })

      const disconnectResult = resolveDisconnectedTurn("p2")

      // Verify player 2's spinTotal is 0
      expect(disconnectResult).not.toBeNull()
      expect(disconnectResult!.spinTotal).toBe(0)

      // Build game scores
      const gameScores: Record<string, number> = {
        p1: p1Score,
        p2: 0,
      }

      // Verify game can still produce a valid leaderboard
      // Mark p2 as disconnected for leaderboard filtering
      const connectedPlayers = [
        makePlayer("p1", "Alice", true),
        makePlayer("p2", "Bob", false), // disconnected
      ]

      const leaderboard = bigWheelPlugin.computeGameLeaderboard(connectedPlayers, gameScores)

      // Only connected players appear in the leaderboard (Req 7.4)
      expect(leaderboard).toHaveLength(1)
      expect(leaderboard[0].playerId).toBe("p1")
      expect(leaderboard[0].score).toBe(p1Score)
      expect(leaderboard[0].rank).toBe(1)
    })

    it("active spinner disconnects mid-turn after spin 1 — spin 2 auto-resolves", () => {
      const reelStrip = BIG_WHEEL.DEFAULT_REEL_STRIP

      // P1 has already completed spin 1
      setBigWheelState({
        spinOrder: ["p1", "p2"],
        currentTurnIndex: 0,
        spinResults: { p1: [50] }, // spin 1 already happened with value 50
        currentSpinNumber: 2,
        reelStrip,
        disconnectedPlayers: [],
      })

      // P1 disconnects during their turn (after spin 1)
      const result = handleActiveSpinnerDisconnection("p1")

      expect(result).not.toBeNull()
      expect(result!.playerId).toBe("p1")
      // Should have auto-resolved 1 remaining spin
      expect(result!.resolvedSpins).toHaveLength(1)
      expect(result!.resolvedIndices).toHaveLength(1)
      // spinTotal = first spin (50) + auto-resolved spin value
      const autoResolvedValue = result!.resolvedSpins[0]
      expect(result!.spinTotal).toBe(50 + autoResolvedValue)
      // The auto-resolved value must come from the reel strip
      expect(reelStrip).toContain(autoResolvedValue)
    })
  })

  describe("Test 3: Timeout auto-resolve", () => {
    it("auto-resolve produces valid result with correct reel strip value", () => {
      const reelStrip = BIG_WHEEL.DEFAULT_REEL_STRIP

      setBigWheelState({
        spinOrder: ["p1"],
        currentTurnIndex: 0,
        spinResults: {},
        currentSpinNumber: 1,
        reelStrip,
        disconnectedPlayers: [],
      })

      // Simulate timeout: server calls resolveRound regardless of whether
      // the player submitted a pick (resolveRound doesn't care about picks content)
      const result = bigWheelPlugin.resolveRound({}, {})

      // Verify the result has valid reelIndex and value
      expect(result.reelIndex).toBeGreaterThanOrEqual(0)
      expect(result.reelIndex).toBeLessThan(reelStrip.length)
      expect(result.value).toBeGreaterThan(0)

      // Verify round-trip consistency: value === reelStrip[reelIndex]
      expect(result.value).toBe(reelStrip[result.reelIndex])

      // Verify spinner info is correct
      expect(result.spinnerPlayerId).toBe("p1")
      expect(result.spinNumber).toBe(1)
    })

    it("auto-resolve on spin 2 produces valid spinTotal", () => {
      const reelStrip = BIG_WHEEL.DEFAULT_REEL_STRIP
      const spin1Value = 45

      setBigWheelState({
        spinOrder: ["p1"],
        currentTurnIndex: 0,
        spinResults: { p1: [spin1Value] },
        currentSpinNumber: 2,
        reelStrip,
        disconnectedPlayers: [],
      })

      // Timeout on spin 2 — server auto-resolves
      const result = bigWheelPlugin.resolveRound({}, {})

      // Verify valid result
      expect(result.reelIndex).toBeGreaterThanOrEqual(0)
      expect(result.reelIndex).toBeLessThan(reelStrip.length)
      expect(result.value).toBe(reelStrip[result.reelIndex])

      // Verify spinTotal is computed correctly
      expect(result.spinTotal).toBe(spin1Value + result.value)
      expect(result.spinNumber).toBe(2)
    })
  })
})
