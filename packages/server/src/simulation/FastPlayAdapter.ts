import type * as Party from "partykit/server"
import type {
  RoomState,
  RoomConfig,
  Player,
  RoundState,
  GameLeaderboardEntry,
} from "@games-of-chance/shared"
import {
  createBotPlayers,
  RandomBot,
  createRng,
  pickGeneratorRegistry,
} from "@games-of-chance/simulation"
import { registry } from "../games/GameRegistry"

/**
 * Simulation state payload — extends RoomState with a simulation marker.
 * Clients can use the `simulation` flag to distinguish simulated rounds
 * from live gameplay.
 */
export interface SimulationRoomState extends RoomState {
  simulation: true
}

/**
 * Runs a simulation game on the server, broadcasting STATE_SYNC
 * at configurable intervals so clients render using existing UI.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.8
 */
export class FastPlayAdapter {
  private aborted = false
  private timerId: ReturnType<typeof setTimeout> | null = null

  constructor(
    private room: Party.Room,
    private roundIntervalMs: number = 500
  ) {}

  /**
   * Execute a full simulation game, broadcasting STATE_SYNC per round.
   * Resolves when all rounds complete or abort() is called.
   */
  async run(
    gameType: string,
    playerCount: number,
    roundCount: number,
    seed?: number
  ): Promise<void> {
    this.aborted = false

    const plugin = registry.lookup(gameType)
    const pickGenerator = pickGeneratorRegistry.lookup(gameType)
    const players = createBotPlayers(playerCount)
    const rng = createRng(seed)
    const bot = new RandomBot()

    const gameScores: Record<string, number> = {}
    for (const p of players) gameScores[p.id] = 0

    for (let r = 1; r <= roundCount; r++) {
      if (this.aborted) break

      // Generate picks for all bots
      const picks: Record<string, unknown> = {}
      for (const p of players) {
        picks[p.id] = bot.decidePick(pickGenerator, rng)
      }

      // Resolve round via plugin
      const result = plugin.resolveRound(picks)

      // Score round via plugin
      const scoreResult = plugin.scoreRound(picks, result, players)

      // Accumulate scores
      for (const [playerId, delta] of Object.entries(scoreResult.deltas)) {
        gameScores[playerId] = (gameScores[playerId] ?? 0) + delta
      }

      // Compute leaderboard after this round
      const leaderboard = plugin.computeGameLeaderboard(players, gameScores)

      // Broadcast STATE_SYNC with current round state
      const roundState: RoundState = {
        phase: "RESOLVING",
        roundNumber: r,
        pickDeadlineMs: null,
        picks,
        result,
        resolvedAt: Date.now(),
      }

      this.broadcastSimState(players, roundState, leaderboard, gameType)

      // Wait between rounds (unless aborted)
      if (r < roundCount) {
        await this.delay(this.roundIntervalMs)
      }
    }

    // Final broadcast with RESULT phase (only if not aborted)
    if (!this.aborted) {
      const leaderboard = plugin.computeGameLeaderboard(players, gameScores)

      const finalRoundState: RoundState = {
        phase: "RESULT",
        roundNumber: roundCount,
        pickDeadlineMs: null,
        picks: {},
        result: null,
        resolvedAt: Date.now(),
      }

      this.broadcastSimState(players, finalRoundState, leaderboard, gameType)
    }
  }

  /**
   * Stop the simulation mid-execution. Partial results already broadcast
   * are preserved — the loop simply stops advancing.
   */
  abort(): void {
    this.aborted = true
    if (this.timerId) {
      clearTimeout(this.timerId)
      this.timerId = null
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.timerId = setTimeout(() => {
        this.timerId = null
        resolve()
      }, ms)
    })
  }

  /**
   * Broadcast a STATE_SYNC message with simulation metadata.
   * Matches the existing ServerMessage shape so clients can render
   * using the same rendering path as live games.
   */
  private broadcastSimState(
    players: Player[],
    round: RoundState,
    gameLeaderboard: GameLeaderboardEntry[],
    gameType: string
  ): void {
    const roomConfig: RoomConfig = {
      roomId: this.room.id,
      gameType,
      maxPlayers: players.length,
      scoringMode: "grand-prix",
      autoMode: false,
      autoRoundIntervalMs: this.roundIntervalMs,
      placementPoints: [10, 5, 3, 1, 1, 1, 1, 0, 0, 0],
    }

    const payload: SimulationRoomState = {
      room: roomConfig,
      players,
      round,
      gameLeaderboard,
      sessionLeaderboard: [],
      simulation: true,
    }

    const msg = {
      type: "STATE_SYNC" as const,
      payload,
    }

    this.room.broadcast(JSON.stringify(msg))
  }
}
