import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as fc from "fast-check"
import {
  createTestGameRoom,
  joinPlayer,
  getStateFromBroadcast,
} from "./helpers"

// Ensure coin-toss plugin is registered
import "../games/coin-toss/CoinTossPlugin"

/**
 * Feature: host-control-panel, Property 9: Adjustment log grows monotonically
 *
 * For any valid ADJUST_SCORE operation, the adjustment log length shall increase
 * by exactly one, and the new entry shall contain the correct target player ID,
 * delta, score type, timestamp, and reason.
 *
 * **Validates: Requirements 4.4**
 */
describe("Feature: host-control-panel, Property 9: Adjustment log grows monotonically", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("adjustment log length increases by exactly 1 per ADJUST_SCORE operation with correct entry fields", () => {
    fc.assert(
      fc.asyncProperty(
        // Generate a sequence of 1-5 ADJUST_SCORE operations
        fc.integer({ min: 1, max: 5 }),
        // Generate parameters for each operation
        fc.array(
          fc.record({
            delta: fc.integer({ min: -1000, max: 1000 }),
            scoreType: fc.constantFrom("game" as const, "session" as const),
            reason: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
            targetIndex: fc.integer({ min: 0, max: 100 }),
          }),
          { minLength: 5, maxLength: 5 }
        ),
        async (numOps, opParams) => {
          const { gameRoom, mockRoom } = await createTestGameRoom()

          // Join the host player
          const hostConn = await joinPlayer(gameRoom, {
            name: "Host",
            clientId: "host-1",
          })

          // Join 3 non-host players to have multiple targets
          const nonHostIds: string[] = []
          for (let i = 1; i <= 3; i++) {
            await joinPlayer(gameRoom, {
              name: `Player${i}`,
              clientId: `player-${i}`,
            })
            nonHostIds.push(`player-${i}`)
          }

          // Perform numOps ADJUST_SCORE operations sequentially
          for (let i = 0; i < numOps; i++) {
            const params = opParams[i]
            const targetId = nonHostIds[params.targetIndex % nonHostIds.length]

            // Get log length before this operation
            const stateBefore = getStateFromBroadcast(mockRoom)
            const logLengthBefore = stateBefore.adjustmentLog?.length ?? 0

            // Send ADJUST_SCORE
            const adjustMsg = JSON.stringify({
              type: "ADJUST_SCORE",
              payload: {
                targetPlayerId: targetId,
                delta: params.delta,
                scoreType: params.scoreType,
                reason: params.reason,
              },
            })
            await gameRoom.onMessage(adjustMsg, hostConn as any)

            // Get state after
            const stateAfter = getStateFromBroadcast(mockRoom)
            const logLengthAfter = stateAfter.adjustmentLog.length

            // Verify log length increased by exactly 1
            expect(logLengthAfter).toBe(logLengthBefore + 1)

            // Verify the new entry has correct fields
            const newEntry = stateAfter.adjustmentLog[logLengthAfter - 1]
            expect(newEntry.targetPlayerId).toBe(targetId)
            expect(newEntry.delta).toBe(params.delta)
            expect(newEntry.scoreType).toBe(params.scoreType)
            expect(newEntry.reason).toBe(params.reason ?? "")
            expect(newEntry.performedBy).toBe("host-1")
            expect(typeof newEntry.timestamp).toBe("number")
            expect(typeof newEntry.id).toBe("string")
            expect(newEntry.id.length).toBeGreaterThan(0)
          }

          // Final verification: total log length equals numOps
          const finalState = getStateFromBroadcast(mockRoom)
          expect(finalState.adjustmentLog.length).toBe(numOps)
        }
      ),
      { numRuns: 100 }
    )
  })
})
