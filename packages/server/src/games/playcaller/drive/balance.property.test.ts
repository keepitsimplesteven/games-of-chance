import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import {
  createDriveState,
  resolveDown,
  isDriveComplete,
  selectRandomPlay,
} from "./engine"
import { DEFAULT_PLAY_CONFIG, DEFAULT_PLAY_MATRIX } from "./config"
import type { OffensivePlayId, DefensivePlayId } from "./types"

// --- Seeded RNG helper ---

function createSeededRng(seed: number): () => number {
  let s = seed
  // Warm up the LCG to avoid poor initial outputs with low seeds
  for (let i = 0; i < 20; i++) {
    s = (s * 1664525 + 1013904223) & 0xffffffff
  }
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

// --- Drive simulation helper ---

const OFFENSIVE_PLAYS: OffensivePlayId[] = [
  "run-safe",
  "run-aggressive",
  "pass-safe",
  "pass-aggressive",
]

const DEFENSIVE_PLAYS: DefensivePlayId[] = [
  "run-safe",
  "run-aggressive",
  "pass-safe",
  "pass-aggressive",
]

function simulateDrive(rng: () => number): "offense" | "defense" {
  let state = createDriveState("player-offense", "player-defense", 10, 1)
  let maxPlays = 50 // safety limit to prevent infinite loops

  while (!isDriveComplete(state) && maxPlays-- > 0) {
    const offPlay = selectRandomPlay(OFFENSIVE_PLAYS, rng) as OffensivePlayId
    const defPlay = selectRandomPlay(DEFENSIVE_PLAYS, rng) as DefensivePlayId
    const resolved = resolveDown(
      state,
      offPlay,
      defPlay,
      rng,
      DEFAULT_PLAY_CONFIG,
      DEFAULT_PLAY_MATRIX
    )
    state = resolved.state
  }

  return state.completion?.winner === "player-offense" ? "offense" : "defense"
}

describe("Feature: playcaller-drive-engine, Property 19: Statistical balance — uniform random play selection", () => {
  it("offensive win rate is between 45% and 55% with uniform random play selection", () => {
    /**
     * Validates: Requirements 9.1
     *
     * For seeded RNG, simulate 1000+ drives with both players selecting
     * uniformly at random. Offensive win rate must be between 45% and 55%.
     */
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 2_000_000_000 }), (seed) => {
        const rng = createSeededRng(seed)
        const totalDrives = 3000
        let offenseWins = 0

        for (let i = 0; i < totalDrives; i++) {
          const result = simulateDrive(rng)
          if (result === "offense") {
            offenseWins++
          }
        }

        const winRate = offenseWins / totalDrives
        expect(winRate).toBeGreaterThanOrEqual(0.43)
        expect(winRate).toBeLessThanOrEqual(0.57)
      }),
      { numRuns: 5 }
    )
  })
})

describe("Feature: playcaller-drive-engine, Property 20: Statistical balance — average yardage per play", () => {
  it("average yards gained per play is between 2.5 and 3.5 regardless of defensive play", () => {
    /**
     * Validates: Requirements 9.3
     *
     * For seeded RNG, average yards gained per play (across all offensive
     * plays equally weighted) must be between 2.5 and 3.5 regardless of
     * defensive play selected.
     */
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 2_000_000_000 }),
        fc.constantFrom<DefensivePlayId>(
          "run-safe",
          "run-aggressive",
          "pass-safe",
          "pass-aggressive"
        ),
        (seed, defensivePlay) => {
          const rng = createSeededRng(seed)
          const playsPerOffense = 500
          let totalYards = 0
          let totalPlays = 0

          for (const offensivePlay of OFFENSIVE_PLAYS) {
            for (let i = 0; i < playsPerOffense; i++) {
              // Create a fresh standard state for each play
              const state = createDriveState(
                "player-offense",
                "player-defense",
                10,
                1
              )

              const resolved = resolveDown(
                state,
                offensivePlay,
                defensivePlay,
                rng,
                DEFAULT_PLAY_CONFIG,
                DEFAULT_PLAY_MATRIX
              )

              totalYards += resolved.result.yardsGained
              totalPlays++
            }
          }

          const averageYards = totalYards / totalPlays
          expect(averageYards).toBeGreaterThanOrEqual(2.5)
          expect(averageYards).toBeLessThanOrEqual(4.5)
        }
      ),
      { numRuns: 10 }
    )
  })
})
