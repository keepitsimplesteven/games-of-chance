import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import * as fc from "fast-check"
import {
  createTestGameRoom,
  joinPlayer,
  getStateFromBroadcast,
} from "./helpers"

// Ensure coin-toss plugin is registered
import "../games/coin-toss/CoinTossPlugin"

describe("Feature: host-control-panel, Property 5: Kick during PICKING triggers early resolution", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /**
   * Property 5: Kick during PICKING triggers early resolution
   *
   * For any room in PICKING phase, if the kicked player had not submitted a pick
   * and all remaining connected players have submitted picks, the round shall
   * transition to RESOLVING.
   *
   * **Validates: Requirements 2.7**
   */
  it("kicking a non-picker when all other connected players have picked triggers early resolution", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate number of "pickers" (players who HAVE submitted picks) — at least host + 1
        fc.integer({ min: 2, max: 8 }),
        // Randomize pick sides for each picker
        fc.array(fc.constantFrom("HEADS" as const, "TAILS" as const), { minLength: 8, maxLength: 8 }),
        async (totalPickers, sides) => {
          const { gameRoom, mockRoom } = await createTestGameRoom()

          // Join host (first player becomes host automatically)
          const hostConn = await joinPlayer(gameRoom, {
            name: "Host",
            clientId: "host-1",
          })

          // Join pickers (players who will submit picks)
          const pickerConns = []
          for (let i = 0; i < totalPickers - 1; i++) {
            const conn = await joinPlayer(gameRoom, {
              name: `Picker${i}`,
              clientId: `picker-${i}`,
            })
            pickerConns.push(conn)
          }

          // Join the kick target — this player will NOT submit a pick
          await joinPlayer(gameRoom, {
            name: "KickTarget",
            clientId: "kick-target",
          })

          // Host starts a round (transitions to PICKING)
          const startMsg = JSON.stringify({ type: "START_ROUND" })
          await gameRoom.onMessage(startMsg, hostConn as any)

          // Verify we're in PICKING phase
          let state = getStateFromBroadcast(mockRoom)
          expect(state.round.phase).toBe("PICKING")

          // Host submits pick
          const hostPickMsg = JSON.stringify({
            type: "SUBMIT_PICK",
            payload: { pick: { side: sides[0] } },
          })
          await gameRoom.onMessage(hostPickMsg, hostConn as any)

          // All pickers submit their picks
          for (let i = 0; i < pickerConns.length; i++) {
            const msg = JSON.stringify({
              type: "SUBMIT_PICK",
              payload: { pick: { side: sides[i + 1] ?? "HEADS" } },
            })
            await gameRoom.onMessage(msg, pickerConns[i] as any)
          }

          // KickTarget has NOT submitted a pick
          // At this point, NOT all connected players have picked (kickTarget hasn't)
          // So we should still be in PICKING
          state = getStateFromBroadcast(mockRoom)
          expect(state.round.phase).toBe("PICKING")

          // Host kicks the non-picker
          const kickMsg = JSON.stringify({
            type: "KICK_PLAYER",
            payload: { playerId: "kick-target" },
          })
          await gameRoom.onMessage(kickMsg, hostConn as any)

          // After kicking the non-picker, all remaining connected players have picked
          // The round should trigger early resolution via scheduleResolve(0)
          // Flush the timer
          vi.advanceTimersByTime(0)

          state = getStateFromBroadcast(mockRoom)
          // resolveRound goes PICKING → RESOLVING → RESULT in a single synchronous call
          expect(state.round.phase).toBe("RESULT")

          // Verify kicked player is no longer in the player list
          const kickedPlayer = state.players.find(
            (p: any) => p.id === "kick-target"
          )
          expect(kickedPlayer).toBeUndefined()
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Additional: Kicking a non-picker when NOT all others have picked
   * should NOT trigger early resolution — round stays in PICKING.
   *
   * **Validates: Requirements 2.7**
   */
  it("kicking a non-picker when other non-pickers remain does NOT trigger early resolution", async () => {
    await fc.assert(
      fc.asyncProperty(
        // At least 1 player who hasn't picked (in addition to the kick target)
        fc.integer({ min: 1, max: 5 }),
        // At least 0 extra players who have picked (host always picks)
        fc.integer({ min: 0, max: 4 }),
        async (extraNonPickers, extraPickers) => {
          const { gameRoom, mockRoom } = await createTestGameRoom()

          // Join host
          const hostConn = await joinPlayer(gameRoom, {
            name: "Host",
            clientId: "host-1",
          })

          // Join pickers
          const pickerConns = []
          for (let i = 0; i < extraPickers; i++) {
            const conn = await joinPlayer(gameRoom, {
              name: `Picker${i}`,
              clientId: `picker-${i}`,
            })
            pickerConns.push(conn)
          }

          // Join extra non-pickers (these will NOT submit picks and will remain after kick)
          for (let i = 0; i < extraNonPickers; i++) {
            await joinPlayer(gameRoom, {
              name: `NonPicker${i}`,
              clientId: `nonpicker-${i}`,
            })
          }

          // Join the kick target
          await joinPlayer(gameRoom, {
            name: "KickTarget",
            clientId: "kick-target",
          })

          // Start round
          const startMsg = JSON.stringify({ type: "START_ROUND" })
          await gameRoom.onMessage(startMsg, hostConn as any)

          // Verify PICKING
          let state = getStateFromBroadcast(mockRoom)
          expect(state.round.phase).toBe("PICKING")

          // Host submits pick
          const pickMsg = JSON.stringify({
            type: "SUBMIT_PICK",
            payload: { pick: { side: "HEADS" } },
          })
          await gameRoom.onMessage(pickMsg, hostConn as any)

          // Pickers submit picks
          for (const pickerConn of pickerConns) {
            const msg = JSON.stringify({
              type: "SUBMIT_PICK",
              payload: { pick: { side: "TAILS" } },
            })
            await gameRoom.onMessage(msg, pickerConn as any)
          }

          // Kick the target (who hasn't picked)
          const kickMsg = JSON.stringify({
            type: "KICK_PLAYER",
            payload: { playerId: "kick-target" },
          })
          await gameRoom.onMessage(kickMsg, hostConn as any)

          // Since there are still non-pickers remaining, we should stay in PICKING
          state = getStateFromBroadcast(mockRoom)
          expect(state.round.phase).toBe("PICKING")

          // Verify kicked player is removed
          const kickedPlayer = state.players.find(
            (p: any) => p.id === "kick-target"
          )
          expect(kickedPlayer).toBeUndefined()
        }
      ),
      { numRuns: 100 }
    )
  })
})
