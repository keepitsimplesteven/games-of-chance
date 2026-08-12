/**
 * Playcaller drive-related room handlers.
 *
 * Extracted from GameRoom to keep the room class lean.
 * Each function receives a PlaycallerRoomContext that exposes only the
 * surface it needs from the room instance.
 */

import type { Connection } from "partyserver"
import type { ServerMessage, Player, GameLeaderboardEntry, GameSettings, RoundState, CoinTossCeremonyMatchupState } from "@games-of-chance/shared"
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
  initializeDrives,
} from "./PlaycallerPlugin"
import { resolveCurrentRound, isComplete } from "./BracketEngine"
import { registry } from "../GameRegistry"
import { PLAYCALLER, COIN_TOSS_CEREMONY } from "./constants"
import {
  createCeremonyStates,
  handleCoinCall,
  handleSideChoice,
  autoResolveCoinCall,
  autoResolveSideChoice,
  allCeremoniesComplete,
  getAssignments,
} from "./coinTossCeremony"

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
  sendError(conn: Connection, code: string, message: string): void
  getPlayerIdByConnectionId(connId: string): string | null
  botManager: { getBotIds(): string[] }
  autoEndGame(): void
  botPickTimerIds: ReturnType<typeof setTimeout>[]
}

// ── Exported handlers ──────────────────────────────────────────────────────

// ── Module-level ceremony state ────────────────────────────────────────────

/** Per-matchup ceremony states for the current bracket round */
let ceremonyStates: Record<string, CoinTossCeremonyMatchupState> | null = null

/** Per-matchup timeout timer IDs for cleanup */
let ceremonyTimers: Record<string, ReturnType<typeof setTimeout>> = {}

/** Per-matchup bot action timer IDs */
let botCeremonyTimers: ReturnType<typeof setTimeout>[] = []

/** Global phase timeout timer */
let phaseTimeoutTimer: ReturnType<typeof setTimeout> | null = null

export function getCeremonyStates(): Record<string, CoinTossCeremonyMatchupState> | null {
  return ceremonyStates
}

export function setCeremonyStates(states: Record<string, CoinTossCeremonyMatchupState> | null): void {
  ceremonyStates = states
}

/** Clear all ceremony timers (matchup timers, bot timers, phase timeout) */
function clearAllCeremonyTimers(): void {
  for (const timerId of Object.values(ceremonyTimers)) {
    clearTimeout(timerId)
  }
  ceremonyTimers = {}

  for (const timerId of botCeremonyTimers) {
    clearTimeout(timerId)
  }
  botCeremonyTimers = []

  if (phaseTimeoutTimer !== null) {
    clearTimeout(phaseTimeoutTimer)
    phaseTimeoutTimer = null
  }
}

// ── Coin Toss Phase Handlers ───────────────────────────────────────────────

/**
 * Begin the coin toss phase for the current bracket round.
 * Creates ceremony states for all active matchups (excluding byes),
 * transitions phase to COIN_TOSS, starts per-matchup coin call timers,
 * and broadcasts STATE_SYNC.
 */
export function beginCoinTossPhase(ctx: PlaycallerRoomContext): void {
  const bracket = getPlaycallerState()
  if (!bracket) return

  const currentRound = bracket.rounds[bracket.currentRoundIndex]
  if (!currentRound) return

  // Only create ceremonies for active matchups (not byes)
  const activeMatchups = currentRound.matchups.filter(
    (m) => m.playerA !== "" && m.playerB !== ""
  )

  // Create ceremony states
  ceremonyStates = createCeremonyStates(activeMatchups)

  // Set coinCallDeadlineMs for each matchup
  const now = Date.now()
  const coinCallDeadline = now + COIN_TOSS_CEREMONY.COIN_CALL_TIMEOUT_MS

  for (const matchupId of Object.keys(ceremonyStates)) {
    ceremonyStates[matchupId] = {
      ...ceremonyStates[matchupId],
      coinCallDeadlineMs: coinCallDeadline,
    }
  }

  // Transition phase to COIN_TOSS
  ctx.state.round.phase = "COIN_TOSS"

  // Broadcast the updated state
  ctx.broadcastState()

  // Start per-matchup coin call timers
  for (const matchupId of Object.keys(ceremonyStates)) {
    ceremonyTimers[matchupId] = setTimeout(() => {
      handleCoinCallTimeout(ctx, matchupId)
    }, COIN_TOSS_CEREMONY.COIN_CALL_TIMEOUT_MS)
  }

  // Start global phase timeout (safety net)
  phaseTimeoutTimer = setTimeout(() => {
    resolveCoinTossTimeout(ctx)
  }, COIN_TOSS_CEREMONY.PHASE_TIMEOUT_MS)

  // Schedule bot actions for the coin toss ceremony
  scheduleCoinTossBotActions(ctx)
}

/**
 * Handle a COIN_TOSS_CALL message from a player.
 * Validates phase, resolves player ID, delegates to ceremony module, broadcasts state.
 */
export function handleCoinTossCall(
  ctx: PlaycallerRoomContext,
  sender: Connection,
  payload: { matchupId: string; side: string }
): void {
  // Validate sender is a player
  const playerId = ctx.getPlayerIdByConnectionId(sender.id)
  if (!playerId) {
    ctx.sendError(sender, "NOT_IN_ROOM", "Player not found")
    return
  }

  // Validate phase is COIN_TOSS
  if (ctx.state.round.phase !== "COIN_TOSS") {
    ctx.sendError(sender, "WRONG_PHASE", "Not in coin toss phase")
    return
  }

  // Validate ceremony states exist
  if (!ceremonyStates) {
    ctx.sendError(sender, "WRONG_PHASE", "No active coin toss ceremony")
    return
  }

  // Validate matchupId
  const matchupState = ceremonyStates[payload.matchupId]
  if (!matchupState) {
    ctx.sendError(sender, "INVALID_MATCHUP", "Invalid matchup ID")
    return
  }

  // Delegate to ceremony module
  const result = handleCoinCall(matchupState, playerId, payload.side)

  if (!result.ok) {
    ctx.sendError(sender, result.error, getCeremonyErrorMessage(result.error))
    return
  }

  // Update ceremony state
  ceremonyStates[payload.matchupId] = result.state

  // Cancel the coin call timer for this matchup and start side choice timer
  if (ceremonyTimers[payload.matchupId]) {
    clearTimeout(ceremonyTimers[payload.matchupId])
    delete ceremonyTimers[payload.matchupId]
  }

  // Set side choice deadline
  const sideChoiceDeadline = Date.now() + COIN_TOSS_CEREMONY.SIDE_CHOICE_TIMEOUT_MS
  ceremonyStates[payload.matchupId] = {
    ...ceremonyStates[payload.matchupId],
    sideChoiceDeadlineMs: sideChoiceDeadline,
  }

  // Start side choice timer for this matchup
  ceremonyTimers[payload.matchupId] = setTimeout(() => {
    handleSideChoiceTimeout(ctx, payload.matchupId)
  }, COIN_TOSS_CEREMONY.SIDE_CHOICE_TIMEOUT_MS)

  // Broadcast updated state
  ctx.broadcastState()

  // Check if all ceremonies are complete (unlikely here since we just moved to AWAITING_CHOICE)
  checkCeremonyCompletion(ctx)
}

/**
 * Handle a COIN_TOSS_CHOICE message from a player.
 * Validates phase, resolves player ID, delegates to ceremony module, broadcasts state.
 */
export function handleCoinTossChoice(
  ctx: PlaycallerRoomContext,
  sender: Connection,
  payload: { matchupId: string; selection: string }
): void {
  // Validate sender is a player
  const playerId = ctx.getPlayerIdByConnectionId(sender.id)
  if (!playerId) {
    ctx.sendError(sender, "NOT_IN_ROOM", "Player not found")
    return
  }

  // Validate phase is COIN_TOSS
  if (ctx.state.round.phase !== "COIN_TOSS") {
    ctx.sendError(sender, "WRONG_PHASE", "Not in coin toss phase")
    return
  }

  // Validate ceremony states exist
  if (!ceremonyStates) {
    ctx.sendError(sender, "WRONG_PHASE", "No active coin toss ceremony")
    return
  }

  // Validate matchupId
  const matchupState = ceremonyStates[payload.matchupId]
  if (!matchupState) {
    ctx.sendError(sender, "INVALID_MATCHUP", "Invalid matchup ID")
    return
  }

  // Delegate to ceremony module
  const result = handleSideChoice(matchupState, playerId, payload.selection)

  if (!result.ok) {
    ctx.sendError(sender, result.error, getCeremonyErrorMessage(result.error))
    return
  }

  // Update ceremony state
  ceremonyStates[payload.matchupId] = result.state

  // Cancel the side choice timer for this matchup
  if (ceremonyTimers[payload.matchupId]) {
    clearTimeout(ceremonyTimers[payload.matchupId])
    delete ceremonyTimers[payload.matchupId]
  }

  // Broadcast updated state
  ctx.broadcastState()

  // Check if all ceremonies are complete → transition to PICKING
  checkCeremonyCompletion(ctx)
}

/**
 * Auto-resolve all pending coin tosses on global phase timeout.
 * This is the safety net that ensures the phase always completes.
 */
export function resolveCoinTossTimeout(ctx: PlaycallerRoomContext): void {
  if (!ceremonyStates) return
  if (ctx.state.round.phase !== "COIN_TOSS") return

  // Clear all matchup timers (the global timeout is handling everything now)
  clearAllCeremonyTimers()

  // Auto-resolve all pending ceremonies
  for (const matchupId of Object.keys(ceremonyStates)) {
    const state = ceremonyStates[matchupId]

    if (state.step === "AWAITING_CALL") {
      // Auto-resolve coin call then side choice
      const afterCall = autoResolveCoinCall(state)
      ceremonyStates[matchupId] = autoResolveSideChoice(afterCall)
    } else if (state.step === "AWAITING_CHOICE") {
      // Auto-resolve side choice only
      ceremonyStates[matchupId] = autoResolveSideChoice(state)
    }
    // COMPLETE states are left as-is
  }

  // Broadcast the auto-resolved state
  ctx.broadcastState()

  // Transition to PICKING via drive initialization
  transitionToPicking(ctx)
}

/**
 * Schedule bot actions for the coin toss ceremony.
 * Bots auto-submit coin calls and side choices after a random delay.
 */
export function scheduleCoinTossBotActions(ctx: PlaycallerRoomContext): void {
  if (!ceremonyStates) return

  const botIds = ctx.botManager.getBotIds()
  if (botIds.length === 0) return

  for (const [matchupId, state] of Object.entries(ceremonyStates)) {
    if (state.step === "COMPLETE") continue

    // If the caller is a bot and step is AWAITING_CALL, schedule coin call
    if (state.step === "AWAITING_CALL" && botIds.includes(state.callerId)) {
      const delay = COIN_TOSS_CEREMONY.BOT_DELAY_MIN_MS +
        Math.random() * (COIN_TOSS_CEREMONY.BOT_DELAY_MAX_MS - COIN_TOSS_CEREMONY.BOT_DELAY_MIN_MS)

      const timerId = setTimeout(() => {
        if (!ceremonyStates || !ceremonyStates[matchupId]) return
        if (ceremonyStates[matchupId].step !== "AWAITING_CALL") return

        // Bot submits a random coin call
        const botCall = Math.random() < 0.5 ? "HEADS" : "TAILS"
        const result = handleCoinCall(ceremonyStates[matchupId], state.callerId, botCall)

        if (result.ok) {
          ceremonyStates[matchupId] = result.state

          // Cancel the coin call timer for this matchup
          if (ceremonyTimers[matchupId]) {
            clearTimeout(ceremonyTimers[matchupId])
            delete ceremonyTimers[matchupId]
          }

          // Set side choice deadline
          const sideChoiceDeadline = Date.now() + COIN_TOSS_CEREMONY.SIDE_CHOICE_TIMEOUT_MS
          ceremonyStates[matchupId] = {
            ...ceremonyStates[matchupId],
            sideChoiceDeadlineMs: sideChoiceDeadline,
          }

          // Start side choice timer
          ceremonyTimers[matchupId] = setTimeout(() => {
            handleSideChoiceTimeout(ctx, matchupId)
          }, COIN_TOSS_CEREMONY.SIDE_CHOICE_TIMEOUT_MS)

          ctx.broadcastState()

          // If the chooser is also a bot, schedule the side choice
          const chooserId = ceremonyStates[matchupId].chooserId
          if (chooserId && botIds.includes(chooserId)) {
            scheduleBotSideChoice(ctx, matchupId, chooserId)
          }

          checkCeremonyCompletion(ctx)
        }
      }, delay)

      botCeremonyTimers.push(timerId)
    }

    // If the chooser is a bot and step is AWAITING_CHOICE, schedule side choice
    if (state.step === "AWAITING_CHOICE" && state.chooserId && botIds.includes(state.chooserId)) {
      scheduleBotSideChoice(ctx, matchupId, state.chooserId)
    }
  }
}

// ── Internal Coin Toss Helpers ─────────────────────────────────────────────

/**
 * Schedule a bot's side choice for a specific matchup.
 */
function scheduleBotSideChoice(ctx: PlaycallerRoomContext, matchupId: string, chooserId: string): void {
  const delay = COIN_TOSS_CEREMONY.BOT_DELAY_MIN_MS +
    Math.random() * (COIN_TOSS_CEREMONY.BOT_DELAY_MAX_MS - COIN_TOSS_CEREMONY.BOT_DELAY_MIN_MS)

  const timerId = setTimeout(() => {
    if (!ceremonyStates || !ceremonyStates[matchupId]) return
    if (ceremonyStates[matchupId].step !== "AWAITING_CHOICE") return

    // Bot always selects OFFENSE
    const result = handleSideChoice(ceremonyStates[matchupId], chooserId, "OFFENSE")

    if (result.ok) {
      ceremonyStates[matchupId] = result.state

      // Cancel the side choice timer
      if (ceremonyTimers[matchupId]) {
        clearTimeout(ceremonyTimers[matchupId])
        delete ceremonyTimers[matchupId]
      }

      ctx.broadcastState()
      checkCeremonyCompletion(ctx)
    }
  }, delay)

  botCeremonyTimers.push(timerId)
}

/**
 * Handle per-matchup coin call timeout.
 * Auto-resolves the coin call for this matchup, then starts the side choice timer.
 */
function handleCoinCallTimeout(ctx: PlaycallerRoomContext, matchupId: string): void {
  if (!ceremonyStates || !ceremonyStates[matchupId]) return
  if (ceremonyStates[matchupId].step !== "AWAITING_CALL") return

  // Auto-resolve coin call
  ceremonyStates[matchupId] = autoResolveCoinCall(ceremonyStates[matchupId])

  // Set side choice deadline
  const sideChoiceDeadline = Date.now() + COIN_TOSS_CEREMONY.SIDE_CHOICE_TIMEOUT_MS
  ceremonyStates[matchupId] = {
    ...ceremonyStates[matchupId],
    sideChoiceDeadlineMs: sideChoiceDeadline,
  }

  // Remove old timer entry
  delete ceremonyTimers[matchupId]

  // Start side choice timer for this matchup
  ceremonyTimers[matchupId] = setTimeout(() => {
    handleSideChoiceTimeout(ctx, matchupId)
  }, COIN_TOSS_CEREMONY.SIDE_CHOICE_TIMEOUT_MS)

  // Broadcast updated state
  ctx.broadcastState()

  // Schedule bot side choice if the chooser is a bot
  const chooserId = ceremonyStates[matchupId].chooserId
  if (chooserId) {
    const botIds = ctx.botManager.getBotIds()
    if (botIds.includes(chooserId)) {
      scheduleBotSideChoice(ctx, matchupId, chooserId)
    }
  }
}

/**
 * Handle per-matchup side choice timeout.
 * Auto-resolves the side choice for this matchup (assigns OFFENSE to Chooser).
 */
function handleSideChoiceTimeout(ctx: PlaycallerRoomContext, matchupId: string): void {
  if (!ceremonyStates || !ceremonyStates[matchupId]) return
  if (ceremonyStates[matchupId].step !== "AWAITING_CHOICE") return

  // Auto-resolve side choice
  ceremonyStates[matchupId] = autoResolveSideChoice(ceremonyStates[matchupId])

  // Remove timer entry
  delete ceremonyTimers[matchupId]

  // Broadcast updated state
  ctx.broadcastState()

  // Check if all ceremonies are now complete
  checkCeremonyCompletion(ctx)
}

/**
 * Check if all ceremonies are complete and transition to PICKING if so.
 * Holds the result on screen for RESULT_HOLD_MS before transitioning.
 */
function checkCeremonyCompletion(ctx: PlaycallerRoomContext): void {
  if (!ceremonyStates) return
  if (!allCeremoniesComplete(ceremonyStates)) return

  // Clear all remaining timers
  clearAllCeremonyTimers()

  // Hold the completed result on screen for a minimum duration before advancing
  setTimeout(() => {
    transitionToPicking(ctx)
  }, COIN_TOSS_CEREMONY.RESULT_HOLD_MS)
}

/**
 * Transition from COIN_TOSS to PICKING phase.
 * Initializes drives with the ceremony assignments and begins the first down.
 */
function transitionToPicking(ctx: PlaycallerRoomContext): void {
  if (!ceremonyStates) return

  const bracket = getPlaycallerState()
  if (!bracket) return

  const currentRound = bracket.rounds[bracket.currentRoundIndex]
  if (!currentRound) return

  // Get assignments from completed ceremonies
  const assignments = getAssignments(ceremonyStates)

  // Initialize drives with explicit offense/defense assignments
  const activeMatchups = currentRound.matchups.filter(
    (m) => m.playerA !== "" && m.playerB !== ""
  )
  initializeDrives(activeMatchups, assignments)

  // Clear ceremony states (phase is done)
  ceremonyStates = null

  // Begin the picking phase (first down)
  beginPlaycallerDown(ctx)
}

/**
 * Get a human-readable error message for ceremony error codes.
 */
function getCeremonyErrorMessage(code: string): string {
  switch (code) {
    case "INVALID_CALLER":
      return "You are not the designated caller for this matchup"
    case "INVALID_COIN_SIDE":
      return "Invalid coin side — must be HEADS or TAILS"
    case "DUPLICATE_CALL":
      return "You have already submitted a coin call for this matchup"
    case "INVALID_CHOOSER":
      return "You are not the designated chooser for this matchup"
    case "INVALID_SELECTION":
      return "Invalid selection — must be OFFENSE or DEFENSE"
    default:
      return "Coin toss ceremony error"
  }
}

// ── Play Selection Handler ─────────────────────────────────────────────────

/**
 * Handle a player's play selection during a playcaller down.
 */
export function handlePlaySelection(
  ctx: PlaycallerRoomContext,
  sender: Connection,
  payload: { matchupId: string; play: string }
): void {
  // Validate sender is a player
  const playerId = ctx.getPlayerIdByConnectionId(sender.id)
  if (!playerId) {
    ctx.sendError(sender, "NOT_IN_ROOM", "Player not found")
    return
  }

  // Reject during COIN_TOSS phase
  if (ctx.state.round.phase === "COIN_TOSS") {
    ctx.sendError(sender, "WRONG_PHASE", "Cannot submit plays during coin toss phase")
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
 *
 * When drives don't exist yet (start of a new bracket round):
 * - If SKIP_GAMEPLAY is false: routes through the coin toss ceremony phase,
 *   which will initialize drives and call beginPlaycallerDown again once complete.
 * - If SKIP_GAMEPLAY is true: initializes drives with random assignments and continues.
 */
export function beginPlaycallerDown(ctx: PlaycallerRoomContext): void {
  clearDownPicks()

  const activeDrives = getDriveStates()

  // If no drives exist yet, this is the start of a new bracket round.
  // Route through coin toss ceremony or initialize drives with random assignments.
  if (!activeDrives) {
    const skipGameplay = ctx.state.gameSettings.tuning?.SKIP_GAMEPLAY === true

    if (!skipGameplay) {
      // Route through coin toss ceremony — it will initialize drives and
      // call beginPlaycallerDown again via transitionToPicking once complete.
      beginCoinTossPhase(ctx)
      return
    }

    // SKIP_GAMEPLAY is true — initialize drives with random assignments
    const bracket = getPlaycallerState()
    if (!bracket) return
    const currentRound = bracket.rounds[bracket.currentRoundIndex]
    if (!currentRound) return
    const activeMatchups = currentRound.matchups.filter(
      (m) => m.playerA !== "" && m.playerB !== ""
    )
    initializeDrives(activeMatchups)
  }

  // Determine if this is the first down of the round (all active drives have empty playHistory)
  const drives = getDriveStates()
  const isFirstDown = drives
    ? Object.values(drives).every(
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
