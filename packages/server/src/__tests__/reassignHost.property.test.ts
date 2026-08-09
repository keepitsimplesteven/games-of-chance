import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import * as fc from "fast-check"
import {
  createTestGameRoom,
  joinPlayer,
  getStateFromBroadcast,
  getLastSent,
} from "./helpers"
import type GameRoom from "../room"

// Ensure coin-toss plugin is registered
import "../games/coin-toss/CoinTossPlugin"

describe("Feature: host-control-panel, Property 6: Reassign host swaps roles", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  /**
   * Property 6: Reassign host swaps roles
   *
   * For any room with a host and any connected non-host target player,
   * after a valid REASSIGN_HOST message, the target player's role shall be "host"
   * and the previous host's role shall be "player", with exactly one host in the room.
   *
   * **Validates: Requirements 3.2**
   */
  it("target becomes host, sender becomes player, exactly one host exists", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate player count between 2 and 4 (max roomSize is 4 by default, humans can't exceed it)
        fc.integer({ min: 2, max: 4 }),
        // Generate a target index (which non-host player to target for reassignment)
        fc.integer({ min: 0, max: 100 }),
        async (playerCount, targetIndexSeed) => {
          const { gameRoom, mockRoom } = await createTestGameRoom()

          // Join players: first player is host, rest are regular players
          const connections: Awaited<ReturnType<typeof joinPlayer>>[] = []
          for (let i = 0; i < playerCount; i++) {
            const conn = await joinPlayer(gameRoom, {
              name: `Player${i}`,
              clientId: `player-${i}`,
            })
            connections.push(conn)
          }

          // Verify initial state: first player is host
          let state = getStateFromBroadcast(mockRoom)
          const hostPlayer = state.players.find((p: any) => p.role === "host")
          expect(hostPlayer.id).toBe("player-0")

          // Get non-host connected human players (exclude bots)
          const nonHostPlayers = state.players.filter(
            (p: any) => p.role !== "host" && p.connected && !p.id.startsWith("bot:")
          )
          expect(nonHostPlayers.length).toBeGreaterThan(0)

          // Pick a target from non-host players using the seed
          const targetIndex = targetIndexSeed % nonHostPlayers.length
          const targetPlayer = nonHostPlayers[targetIndex]

          // Host (player-0, connections[0]) sends REASSIGN_HOST targeting the chosen player
          const reassignMsg = JSON.stringify({
            type: "REASSIGN_HOST",
            payload: { targetPlayerId: targetPlayer.id },
          })
          await gameRoom.onMessage(connections[0] as any, reassignMsg)

          // Get state after reassignment
          state = getStateFromBroadcast(mockRoom)

          // Verify: target is now host
          const targetAfter = state.players.find(
            (p: any) => p.id === targetPlayer.id
          )
          expect(targetAfter.role).toBe("host")

          // Verify: previous host (player-0) is now player
          const previousHost = state.players.find(
            (p: any) => p.id === "player-0"
          )
          expect(previousHost.role).toBe("player")

          // Verify: exactly one host exists in the room
          const hosts = state.players.filter((p: any) => p.role === "host")
          expect(hosts.length).toBe(1)

          // Verify: the single host is the target player
          expect(hosts[0].id).toBe(targetPlayer.id)

          // Verify: total player count unchanged (equals roomSize, including bots)
          expect(state.players.length).toBe(4) // default roomSize
        }
      ),
      { numRuns: 100 }
    )
  })
})
