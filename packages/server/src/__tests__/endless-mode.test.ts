/**
 * Endless mode tests: verify that all games are always available,
 * unlock criteria are ignored, and the game never terminates on finale completion.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  createTestGameRoom,
  createMockConnection,
  getLastSent,
  getStateFromBroadcast,
} from "./helpers"

// Ensure all plugins are registered (side-effect imports)
import "../games/coin-toss/CoinTossPlugin"
import "../games/battle-bots/index"
import "../games/big-wheel/BigWheelPlugin"
import "../games/playcaller/PlaycallerPlugin"
import { resetPlaycallerState } from "../games/playcaller/PlaycallerPlugin"

/**
 * Helper: join a player with explicit progressionMode support.
 */
async function joinWithMode(
  gameRoom: any,
  opts: { name: string; role?: "host" | "player"; clientId: string; progressionMode?: "endless" | "tournament" }
) {
  const conn = createMockConnection(`conn-${opts.clientId}`)
  await gameRoom.onConnect(conn as any)
  const joinMsg = JSON.stringify({
    type: "JOIN",
    payload: {
      name: opts.name,
      role: opts.role ?? "player",
      clientId: opts.clientId,
      progressionMode: opts.progressionMode,
    },
  })
  await gameRoom.onMessage(joinMsg, conn as any)
  return conn
}

describe("Endless mode", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetPlaycallerState()
  })

  afterEach(() => {
    vi.useRealTimers()
    resetPlaycallerState()
  })

  /**
   * Helper: advance fake timers until the broadcast phase matches the target.
   * The playcaller has a multi-down loop with nested timeouts (bot picks,
   * result delays, completion delays), so we flush pending timers iteratively.
   */
  function advanceUntilPhase(mockRoom: { _broadcasts: string[] }, targetPhase: string, maxTicks = 200) {
    for (let i = 0; i < maxTicks; i++) {
      const state = getStateFromBroadcast(mockRoom)
      if (state?.round?.phase === targetPhase) return state
      vi.runOnlyPendingTimers()
    }
    const finalState = getStateFromBroadcast(mockRoom)
    throw new Error(
      `Never reached phase "${targetPhase}" after ${maxTicks} timer ticks. ` +
      `Current phase: "${finalState?.round?.phase}"`
    )
  }

  it("does not create tournamentProgress in endless mode", async () => {
    const { gameRoom, mockRoom } = await createTestGameRoom()

    await joinWithMode(gameRoom, {
      name: "Host",
      clientId: "host-1",
      role: "host",
      progressionMode: "endless",
    })

    const state = getStateFromBroadcast(mockRoom)
    expect(state.room.progressionMode).toBe("endless")
    expect(state.tournamentProgress).toBeNull()
  })

  it("allows selecting any game type in endless mode (no lock/unavailable guards)", async () => {
    const { gameRoom, mockRoom } = await createTestGameRoom()

    const hostConn = await joinWithMode(gameRoom, {
      name: "Host",
      clientId: "host-1",
      role: "host",
      progressionMode: "endless",
    })

    // Switch to each game type — all should work without errors
    const gameTypes = ["coin-toss", "battle-bots", "big-wheel", "playcaller"]

    for (const gameType of gameTypes) {
      const msg = JSON.stringify({
        type: "SET_GAME_TYPE",
        payload: { gameType },
      })
      await gameRoom.onMessage(msg, hostConn as any)

      const state = getStateFromBroadcast(mockRoom)
      expect(state.room.gameType).toBe(gameType)
    }
  })

  it("every registered game in the registry is selectable in endless mode (e2e)", async () => {
    // This test dynamically discovers ALL registered games and verifies each
    // can be selected. If a new game is added and isn't selectable in endless
    // mode, this test will catch it.
    const { gameRoom, mockRoom } = await createTestGameRoom()

    const hostConn = await joinWithMode(gameRoom, {
      name: "Host",
      clientId: "host-1",
      role: "host",
      progressionMode: "endless",
    })

    // Get all registered game types from the registry
    const { registry } = await import("../games/GameRegistry")
    const allGameTypes = registry.list()

    // Must have at least the 4 known games
    expect(allGameTypes.length).toBeGreaterThanOrEqual(4)

    for (const gameType of allGameTypes) {
      const msg = JSON.stringify({
        type: "SET_GAME_TYPE",
        payload: { gameType },
      })
      await gameRoom.onMessage(msg, hostConn as any)

      const state = getStateFromBroadcast(mockRoom)
      // Every registered game must be selectable in endless mode
      expect(state.room.gameType).toBe(gameType)
    }
  })

  it("allows selecting the finale game without playing other games first in endless mode", async () => {
    const { gameRoom, mockRoom } = await createTestGameRoom()

    const hostConn = await joinWithMode(gameRoom, {
      name: "Host",
      clientId: "host-1",
      role: "host",
      progressionMode: "endless",
    })

    // Directly select playcaller (the finale) without playing any other games
    const msg = JSON.stringify({
      type: "SET_GAME_TYPE",
      payload: { gameType: "playcaller" },
    })
    await gameRoom.onMessage(msg, hostConn as any)

    const state = getStateFromBroadcast(mockRoom)
    expect(state.room.gameType).toBe("playcaller")
  })

  it("does not transition to END_TOURNAMENT after completing the finale in endless mode", async () => {
    const { gameRoom, mockRoom } = await createTestGameRoom()

    // Join host with endless mode
    const hostConn = await joinWithMode(gameRoom, {
      name: "Host",
      clientId: "host-1",
      role: "host",
      progressionMode: "endless",
    })
    // Join 3 extra players (4 total = 2 bracket rounds)
    await joinWithMode(gameRoom, { name: "Player2", clientId: "player-2" })
    await joinWithMode(gameRoom, { name: "Player3", clientId: "player-3" })
    await joinWithMode(gameRoom, { name: "Player4", clientId: "player-4" })

    // Switch to playcaller (the finale)
    const setGameMsg = JSON.stringify({
      type: "SET_GAME_TYPE",
      payload: { gameType: "playcaller" },
    })
    await gameRoom.onMessage(setGameMsg, hostConn as any)

    // Start the game (4 players → 2 bracket rounds)
    const startMsg = JSON.stringify({ type: "START_ROUND" })
    await gameRoom.onMessage(startMsg, hostConn as any)

    let state = getStateFromBroadcast(mockRoom)
    expect(state.round.phase).toBe("PICKING")

    // Resolve round 1 (multi-down drive loop with nested timeouts)
    advanceUntilPhase(mockRoom, "RESULT")
    state = getStateFromBroadcast(mockRoom)
    expect(state.round.phase).toBe("RESULT")

    // Host advances to round 2
    await gameRoom.onMessage(startMsg, hostConn as any)
    state = getStateFromBroadcast(mockRoom)
    expect(state.round.phase).toBe("PICKING")

    // Resolve round 2 (final)
    advanceUntilPhase(mockRoom, "RESULT")
    state = getStateFromBroadcast(mockRoom)
    expect(state.round.phase).toBe("RESULT")

    // Host advances after the final round → should go to END_GAME, NOT END_TOURNAMENT
    await gameRoom.onMessage(startMsg, hostConn as any)

    state = getStateFromBroadcast(mockRoom)
    expect(state.round.phase).toBe("END_GAME")
    expect(state.round.phase).not.toBe("END_TOURNAMENT")
    // Tournament progress should still be null in endless mode
    expect(state.tournamentProgress).toBeNull()
  })

  it("does not lock games after they are played in endless mode", async () => {
    const { gameRoom, mockRoom } = await createTestGameRoom()

    const hostConn = await joinWithMode(gameRoom, {
      name: "Host",
      clientId: "host-1",
      role: "host",
      progressionMode: "endless",
    })
    await joinWithMode(gameRoom, {
      name: "Player2",
      clientId: "player-2",
    })

    // Play a coin-toss game to completion
    const startMsg = JSON.stringify({ type: "START_ROUND" })
    await gameRoom.onMessage(startMsg, hostConn as any)

    // Advance past pick window to trigger resolution
    vi.advanceTimersByTime(15100)

    // End the game
    const endMsg = JSON.stringify({ type: "END_GAME" })
    await gameRoom.onMessage(endMsg, hostConn as any)

    let state = getStateFromBroadcast(mockRoom)
    expect(state.round.phase).toBe("LOBBY")

    // Verify no tournamentProgress was created
    expect(state.tournamentProgress).toBeNull()

    // Can still select the same game type again (not locked)
    const setGameMsg = JSON.stringify({
      type: "SET_GAME_TYPE",
      payload: { gameType: "coin-toss" },
    })
    await gameRoom.onMessage(setGameMsg, hostConn as any)

    state = getStateFromBroadcast(mockRoom)
    expect(state.room.gameType).toBe("coin-toss")
  })

  it("finale game remains selectable after playing all other games in endless mode", async () => {
    const { gameRoom, mockRoom } = await createTestGameRoom()

    const hostConn = await joinWithMode(gameRoom, {
      name: "Host",
      clientId: "host-1",
      role: "host",
      progressionMode: "endless",
    })
    await joinWithMode(gameRoom, {
      name: "Player2",
      clientId: "player-2",
    })

    // Play coin-toss multiple times to simulate "games played" in endless
    for (let i = 0; i < 3; i++) {
      const startMsg = JSON.stringify({ type: "START_ROUND" })
      await gameRoom.onMessage(startMsg, hostConn as any)
      vi.advanceTimersByTime(15100)
      const endMsg = JSON.stringify({ type: "END_GAME" })
      await gameRoom.onMessage(endMsg, hostConn as any)
    }

    // Verify we're back in LOBBY
    let state = getStateFromBroadcast(mockRoom)
    expect(state.round.phase).toBe("LOBBY")

    // Now the finale game (playcaller) must still be selectable
    const setPlaycallerMsg = JSON.stringify({
      type: "SET_GAME_TYPE",
      payload: { gameType: "playcaller" },
    })
    await gameRoom.onMessage(setPlaycallerMsg, hostConn as any)

    state = getStateFromBroadcast(mockRoom)
    expect(state.room.gameType).toBe("playcaller")
    // No tournament progress should have been created
    expect(state.tournamentProgress).toBeNull()
  })
})
