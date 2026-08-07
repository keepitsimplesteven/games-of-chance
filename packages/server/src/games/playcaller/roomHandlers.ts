/**
 * Playcaller drive-related room handlers.
 *
 * Extracted from GameRoom to keep the room class lean.
 * Each function receives a PlaycallerRoomContext that exposes only the
 * surface it needs from the room instance.
 */

import type * as Party from "partykit/server"
import type { ServerMessage, Player, GameLeaderboardEntry, GameSettings, RoundState } from "@games-of-chance/shared"
import type { OffensivePlayId, DefensivePlayId } from "./drive"
import { selectRandomPlay } from "./drive"
import {
  getPlaycallerState,
  setPlaycallerState,
  getDriveStates,
  resetDriveStates,
  clearDownPicks,
  recordPlaySelection,
  resolveMatchupDown,
  allDrivesComplete,
  allActiveMatchupsResolved,
  fillMissingPicks,
} from "./PlaycallerPlugin"
import { resolveCurrentRound, isComplete } from "./BracketEngine"
import { registry } from "../GameRegistry"
import { PLAYCALLER } from "./constants"

// ── Play lists for bot pick generation ─────────────────────────────────────
const OFFENSIVE_PLAYS: OffensivePlayId[] = ["run-safe", "run-aggressive", "pass-safe", "pass-aggressive"]
const DEFENSIVE_PLAYS: DefensivePlayId[] = ["run-safe", "run-aggressive", "pass-safe", "pass-aggressive"]

// ── Context interface ──────────────────────────────────────────────────────

export interface PlaycallerRoomState {
  round: RoundState
  config: { gameType: string }
  gameSettings: GameSettings
  players: Record<string, Player>
  gameScores: Record<string, number>
  gameLeaderboard: GameLeaderboardEntry[]
}

export interface PlaycallerRoomContext {
  state: PlaycallerRoomState
  broadcastState(): void
  cancelDeadlineTimer(): void
  cancelBotPickTimers(): void
  scheduleResolve(delayMs: number): void
  sendError(conn: Party.Connection, code: string, message: string): void
  getPlayerIdByConnectionId(connId: string): string | null
  botManager: { getBotIds(): string[] }
  autoEndGame(): void
  botPickTimerIds: ReturnType<typeof setTimeout>[]
}

// ── Exported handlers ──────────────────────────────────────────────────────

/**
 * Handle a player's play selection during a playcaller down.
 */
export function handlePlaySelection(
  ctx: PlaycallerRoomContext,
  sender: Party.Connection,
  payload: { matchupId: string; play: string }
): void {
  // Validate sender is a player
  const playerId = ctx.getPlayerIdByConnectionId(sender.id)
  if (!playerId) {
    ctx.sendError(sender, "NOT_IN_ROOM", "Player not found")
    return
  }

  // Validate phase is PICKING
  if (ctx.state.round.phase !== "PICKING") {
    ctx.sendError(sender, "WRONG_PHASE", "Not in picking phase")
    return
  }

  const result = recordPlaySelection(playerId, payload.matchupId, payload.play as any)

  if ("error" in result) {
    // "Already picked" is silently ignored per requirement 9.1
    if (result.error !== "Already picked") {
      ctx.sendError(sender, "INVALID_PICK", result.error)
    }
    return
  }

  // Send PICK_ACK to the sender
  const ackMsg: ServerMessage = { type: "PICK_ACK", payload: { playerId } }
  sender.send(JSON.stringify(ackMsg))

  if (result.resolved) {
    // Resolve this matchup's down
    resolveMatchupDown(result.matchupId)
    ctx.broadcastState()

    // Check if all drives are now complete (bracket round over)
    if (allDrivesComplete()) {
      ctx.cancelDeadlineTimer()
      ctx.cancelBotPickTimers()
      // Delay before advancing so clients see final drive completion
      setTimeout(() => {
        advancePlaycallerBracket(ctx)
      }, PLAYCALLER.DRIVE_COMPLETION_DELAY_MS)
    } else if (allActiveMatchupsResolved()) {
      // All active matchups have both picks in — resolve them all and advance
      // (other matchups were already resolved individually above or by bots)
      ctx.cancelDeadlineTimer()
      ctx.cancelBotPickTimers()
      clearDownPicks()
      setTimeout(() => {
        beginPlaycallerDown(ctx)
      }, PLAYCALLER.PLAY_RESULT_DELAY_MS)
    }
    // Otherwise: this matchup resolved but others still waiting — just broadcast, don't touch timer
  }
}

/**
 * Advance the bracket after all drives in the round complete.
 * Determines winners from drive completions, advances the bracket,
 * transitions to RESULT phase, and scores if tournament is complete.
 */
export function advancePlaycallerBracket(ctx: PlaycallerRoomContext): void {
  // Determine winners from drive completions
  const drives = getDriveStates()!
  const winners: Record<string, string> = {}

  for (const [matchupId, drive] of Object.entries(drives)) {
    winners[matchupId] = drive.completion!.winner
  }

  // Advance bracket using the drive winners
  const bracket = getPlaycallerState()!
  const currentRound = bracket.rounds[bracket.currentRoundIndex]

  // Build a resolver that returns the pre-determined winner from drives
  const driveResolver = (playerA: string, playerB: string): string => {
    const matchup = currentRound.matchups.find(
      m => (m.playerA === playerA && m.playerB === playerB) ||
           (m.playerA === playerB && m.playerB === playerA)
    )
    return matchup ? winners[matchup.matchupId] : playerA
  }

  const updatedBracket = resolveCurrentRound(bracket, driveResolver)
  setPlaycallerState(updatedBracket)

  // Reset drive states
  resetDriveStates()

  // Transition to RESULT
  const resolvedRoundIndex = updatedBracket.currentRoundIndex - 1
  const resolvedRound = updatedBracket.rounds[resolvedRoundIndex]
  
  ctx.state.round.phase = "RESULT"
  ctx.state.round.result = {
    bracketRound: resolvedRoundIndex,
    matchups: resolvedRound.matchups,
    isComplete: isComplete(updatedBracket),
  }
  ctx.state.round.resolvedAt = Date.now()

  // Score if tournament complete
  if (isComplete(updatedBracket)) {
    const plugin = registry.lookup("playcaller")
    const scoreResult = plugin.scoreRound(
      {},
      ctx.state.round.result,
      Object.values(ctx.state.players),
      ctx.state.gameSettings
    )
    for (const [playerId, delta] of Object.entries(scoreResult.deltas)) {
      ctx.state.gameScores[playerId] = (ctx.state.gameScores[playerId] ?? 0) + delta
    }
    ctx.state.gameLeaderboard = plugin.computeGameLeaderboard(
      Object.values(ctx.state.players),
      ctx.state.gameScores
    )
  }

  ctx.broadcastState()
}

/**
 * Enter the playcaller per-down picking phase.
 * Resets picks, sets a new deadline, and broadcasts state.
 * If this is the first down of a bracket round, delays the play clock to allow
 * clients to show a VS intro animation.
 */
export function beginPlaycallerDown(ctx: PlaycallerRoomContext): void {
  clearDownPicks()

  // Determine if this is the first down of the round (all active drives have empty playHistory)
  const activeDrives = getDriveStates()
  const isFirstDown = activeDrives
    ? Object.values(activeDrives).every(
        (d) => !d.isComplete && d.playHistory.length === 0
      )
    : false

  const startDelay = isFirstDown ? PLAYCALLER.ROUND_INTRO_DELAY_MS : 0

  if (startDelay > 0) {
    // Adjust deadline to account for intro animation
    ctx.state.round = {
      ...ctx.state.round,
      phase: "PICKING",
      picks: {},
      pickDeadlineMs: Date.now() + startDelay + PLAYCALLER.PICK_WINDOW_MS,
    }
    ctx.broadcastState()

    setTimeout(() => {
      schedulePlaycallerBotPicks(ctx)
      ctx.scheduleResolve(PLAYCALLER.PICK_WINDOW_MS)
    }, startDelay)
  } else {
    ctx.state.round = {
      ...ctx.state.round,
      phase: "PICKING",
      picks: {},
      pickDeadlineMs: Date.now() + PLAYCALLER.PICK_WINDOW_MS,
    }
    ctx.broadcastState()
    schedulePlaycallerBotPicks(ctx)
    ctx.scheduleResolve(PLAYCALLER.PICK_WINDOW_MS)
  }
}

/**
 * Schedule bot picks for the playcaller down loop.
 * Bots in active matchups submit a random play after a short delay.
 */
export function schedulePlaycallerBotPicks(ctx: PlaycallerRoomContext): void {
  ctx.cancelBotPickTimers()

  const botIds = ctx.botManager.getBotIds()
  const activeDrives = getDriveStates()
  if (!activeDrives || botIds.length === 0) return

  for (const [matchupId, drive] of Object.entries(activeDrives)) {
    if (drive.isComplete) continue

    for (const botId of botIds) {
      if (botId !== drive.offensePlayerId && botId !== drive.defensePlayerId) continue

      const isOffense = botId === drive.offensePlayerId
      const delay = 1500 + Math.random() * 2000 // 1.5–3.5s delay (gives humans time to see UI)

      const timerId = setTimeout(() => {
        const play = isOffense
          ? selectRandomPlay(OFFENSIVE_PLAYS, Math.random)
          : selectRandomPlay(DEFENSIVE_PLAYS, Math.random)

        // Submit via the same recordPlaySelection path
        const result = recordPlaySelection(botId, matchupId, play)
        if ("resolved" in result && result.resolved) {
          // Both picks are in — resolve the down
          resolveMatchupDown(result.matchupId)
          ctx.broadcastState()

          if (allDrivesComplete()) {
            ctx.cancelDeadlineTimer()
            ctx.cancelBotPickTimers()
            // Delay before advancing so clients see final drive completion
            setTimeout(() => {
              advancePlaycallerBracket(ctx)
            }, PLAYCALLER.DRIVE_COMPLETION_DELAY_MS)
          } else if (allActiveMatchupsResolved()) {
            // All active matchups resolved — advance to next down
            ctx.cancelDeadlineTimer()
            ctx.cancelBotPickTimers()
            clearDownPicks()
            setTimeout(() => {
              beginPlaycallerDown(ctx)
            }, PLAYCALLER.PLAY_RESULT_DELAY_MS)
          }
          // Otherwise: just this matchup resolved, others still waiting
        } else if ("resolved" in result && !result.resolved) {
          // Bot submitted but opponent hasn't yet — just broadcast the updated state
          ctx.broadcastState()
        }
      }, delay)

      ctx.botPickTimerIds.push(timerId)
    }
  }
}

/**
 * Handle play clock expiry for the playcaller down loop.
 * Fills missing picks with random plays and resolves all active matchups.
 */
export function resolvePlaycallerTimeout(ctx: PlaycallerRoomContext): void {
  if (ctx.state.round.phase !== "PICKING") return

  ctx.cancelDeadlineTimer()

  // Fill missing picks with random plays
  const matchupsToResolve = fillMissingPicks()

  // Resolve all matchups that now have both picks
  for (const matchupId of matchupsToResolve) {
    resolveMatchupDown(matchupId)
  }

  // Clear picks for next down
  clearDownPicks()

  // Check if all drives complete
  if (allDrivesComplete()) {
    ctx.broadcastState()
    // Delay before advancing so clients see final drive completion
    setTimeout(() => {
      advancePlaycallerBracket(ctx)
    }, PLAYCALLER.DRIVE_COMPLETION_DELAY_MS)
  } else {
    // Start next down
    beginPlaycallerDown(ctx)
  }
}
