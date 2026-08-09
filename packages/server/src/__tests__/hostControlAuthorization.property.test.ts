/**
 * Feature: host-control-panel, Property 2: Host-control authorization
 *
 * For any host-control message type (KICK_PLAYER, REASSIGN_HOST, ADJUST_SCORE)
 * and any sender whose role is not "host", the server shall reject the message
 * with a NOT_HOST error and not mutate room state.
 *
 * Validates: Requirements 2.5, 3.4, 4.6, 6.1, 6.2
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import * as fc from "fast-check"
import {
  createTestGameRoom,
  joinPlayer,
  getLastSent,
  getStateFromBroadcast,
} from "./helpers"
import type GameRoom from "../room"

// Ensure coin-toss plugin is registered
import "../games/coin-toss/CoinTossPlugin"

/**
 * Arbitrary: generates a host-control message type
 */
const hostControlMessageTypeArb = fc.constantFrom(
  "KICK_PLAYER" as const,
  "REASSIGN_HOST" as const,
  "ADJUST_SCORE" as const
)

/**
 * Arbitrary: generates a valid payload for a given host-control message type.
 * Uses the host's player ID as a valid target (ensuring the payload is structurally valid).
 */
type HostControlMessage =
  | { type: "KICK_PLAYER"; payload: { playerId: string } }
  | { type: "REASSIGN_HOST"; payload: { targetPlayerId: string } }
  | { type: "ADJUST_SCORE"; payload: { targetPlayerId: string; delta: number; scoreType: "game" | "session"; reason?: string } }

function hostControlPayloadArb(targetPlayerId: string): fc.Arbitrary<HostControlMessage> {
  return hostControlMessageTypeArb.chain((msgType): fc.Arbitrary<HostControlMessage> => {
    switch (msgType) {
      case "KICK_PLAYER":
        return fc.constant({
          type: msgType,
          payload: { playerId: targetPlayerId },
        } as HostControlMessage)
      case "REASSIGN_HOST":
        return fc.constant({
          type: msgType,
          payload: { targetPlayerId },
        } as HostControlMessage)
      case "ADJUST_SCORE":
        return fc.record({
          delta: fc.integer({ min: -1000, max: 1000 }),
          scoreType: fc.constantFrom("game" as const, "session" as const),
          reason: fc.option(fc.string({ minLength: 0, maxLength: 50 }), { nil: undefined }),
        }).map((fields): HostControlMessage => ({
          type: "ADJUST_SCORE",
          payload: {
            targetPlayerId,
            delta: fields.delta,
            scoreType: fields.scoreType,
            ...(fields.reason !== undefined ? { reason: fields.reason } : {}),
          },
        }))
    }
  })
}

/**
 * Arbitrary: generates a random non-host player name
 */
const playerNameArb = fc.string({ minLength: 1, maxLength: 20 }).filter(
  (s) => s.trim().length > 0
)

/**
 * Arbitrary: generates a unique client ID for non-host players
 */
const clientIdArb = fc.stringMatching(/^[a-z][a-z0-9]{3,10}$/)

describe("Feature: host-control-panel, Property 2: Host-control authorization", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("non-host players are rejected with NOT_HOST error for all host-control messages, and state is unchanged", async () => {
    await fc.assert(
      fc.asyncProperty(
        hostControlMessageTypeArb,
        fc.integer({ min: -1000, max: 1000 }),
        fc.constantFrom("game" as const, "session" as const),
        clientIdArb,
        async (msgType, delta, scoreType, nonHostClientId) => {
          // Setup: create room with a host and a non-host player
          const { gameRoom, mockRoom } = await createTestGameRoom()

          // Join Alice as host (first player)
          await joinPlayer(gameRoom, { name: "Alice", clientId: "alice-host" })

          // Join non-host player with generated client ID
          const nonHostConn = await joinPlayer(gameRoom, {
            name: "NonHost",
            clientId: nonHostClientId,
          })

          // Capture state BEFORE the unauthorized action
          const stateBefore = getStateFromBroadcast(mockRoom)
          const broadcastCountBefore = mockRoom._broadcasts.length

          // Build the host-control message from the non-host sender
          let message: string
          switch (msgType) {
            case "KICK_PLAYER":
              message = JSON.stringify({
                type: "KICK_PLAYER",
                payload: { playerId: "alice-host" },
              })
              break
            case "REASSIGN_HOST":
              message = JSON.stringify({
                type: "REASSIGN_HOST",
                payload: { targetPlayerId: "alice-host" },
              })
              break
            case "ADJUST_SCORE":
              message = JSON.stringify({
                type: "ADJUST_SCORE",
                payload: {
                  targetPlayerId: "alice-host",
                  delta,
                  scoreType,
                },
              })
              break
          }

          // Send the unauthorized message
          await gameRoom.onMessage(nonHostConn as any, message!)

          // VERIFY: sender receives NOT_HOST error
          const lastSent = getLastSent(nonHostConn)
          expect(lastSent).not.toBeNull()
          expect(lastSent.type).toBe("ERROR")
          expect(lastSent.payload.code).toBe("NOT_HOST")

          // VERIFY: state is unchanged (no new broadcasts after the rejection)
          expect(mockRoom._broadcasts.length).toBe(broadcastCountBefore)

          // VERIFY: room state is identical to before the unauthorized action
          const stateAfter = getStateFromBroadcast(mockRoom)
          expect(stateAfter).toEqual(stateBefore)
        }
      ),
      { numRuns: 100 }
    )
  })
})
