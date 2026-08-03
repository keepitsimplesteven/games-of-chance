import type {
  Player,
  GameLeaderboardEntry,
  RoundScoreResult,
  BigWheelPick,
  BigWheelSpinResult,
  GameSettings,
} from "@games-of-chance/shared"
import type { GamePlugin } from "../GamePlugin"
import { registry } from "../GameRegistry"
import { BIG_WHEEL, BIG_WHEEL_SETTINGS_SCHEMA } from "./constants"

// ── Plugin State ───────────────────────────────────────────────────────────

/** Persisted across rounds via module-level state */
export interface BigWheelPluginState {
  /** Ordered list of player IDs determining spin sequence */
  spinOrder: string[]
  /** Current index in spinOrder (0-based) */
  currentTurnIndex: number
  /** Each player's spin values collected so far */
  spinResults: Record<string, number[]>
  /** Which spin (1 or 2) the current active player is on */
  currentSpinNumber: 1 | 2
  /** The reel strip in use for this game instance */
  reelStrip: number[]
  /** Players who disconnected — their turns are skipped */
  disconnectedPlayers: string[]
}

/** Module-level state for the current Big Wheel game */
let pluginState: BigWheelPluginState | null = null

/**
 * Returns the current plugin state (for testing and room integration).
 */
export function getBigWheelState(): BigWheelPluginState | null {
  return pluginState
}

/**
 * Sets the plugin state (used by room.ts to initialize on game launch).
 */
export function setBigWheelState(state: BigWheelPluginState): void {
  pluginState = state
}

/**
 * Resets the module-level plugin state. Called when a game ends.
 */
export function resetBigWheelState(): void {
  pluginState = null
}

// ── Plugin Implementation ──────────────────────────────────────────────────

/**
 * Big Wheel game plugin — turn-based wheel spinning game.
 * Players take turns spinning a wheel twice; the two spin values
 * are summed to produce a final score.
 */
export const bigWheelPlugin: GamePlugin<BigWheelPick, BigWheelSpinResult> = {
  gameType: "big-wheel",

  settingsSchema: BIG_WHEEL_SETTINGS_SCHEMA,

  pickWindowMs: BIG_WHEEL.PICK_WINDOW_MS,

  validatePick(pick: unknown): pick is BigWheelPick {
    if (typeof pick !== "object" || pick === null) return false
    const candidate = pick as Record<string, unknown>
    return candidate.type === "spin"
  },

  resolveRound(
    _picks: Record<string, BigWheelPick>,
    _settings: GameSettings
  ): BigWheelSpinResult {
    if (!pluginState) {
      throw new Error("BigWheel plugin state not initialized — call setBigWheelState before resolving rounds")
    }

    // 1. Determine active spinner and spin number from plugin state
    const spinnerPlayerId = pluginState.spinOrder[pluginState.currentTurnIndex]
    const spinNumber = pluginState.currentSpinNumber

    // 2. Select a uniformly random index from the reel strip
    const reelStrip = pluginState.reelStrip
    const reelIndex = Math.floor(Math.random() * reelStrip.length)

    // 3. Get the value at the selected index
    const value = reelStrip[reelIndex]

    // 4. Compute spinTotal: null for spin 1, sum for spin 2
    let spinTotal: number | null = null
    if (spinNumber === 2) {
      const previousSpins = pluginState.spinResults[spinnerPlayerId]
      const spin1Value = previousSpins && previousSpins.length > 0 ? previousSpins[0] : 0
      spinTotal = spin1Value + value
    }

    return {
      spinnerPlayerId,
      spinNumber,
      reelIndex,
      value,
      spinTotal,
    }
  },

  scoreRound(
    _picks: Record<string, BigWheelPick>,
    result: BigWheelSpinResult,
    _players: Player[],
    _settings: GameSettings
  ): RoundScoreResult {
    // Score each spin individually so the leaderboard updates progressively
    // Spin 1: delta = the spin 1 value
    // Spin 2: delta = the spin 2 value (just the second spin, not the total)
    return { deltas: { [result.spinnerPlayerId]: result.value } }
  },

  computeGameLeaderboard(
    players: Player[],
    gameScores: Record<string, number>
  ): GameLeaderboardEntry[] {
    // Only include connected players (Requirement 7.4)
    const connected = players.filter((p) => p.connected)

    // Build entries with score and session rank (from spinOrder position)
    const entries = connected.map((p) => {
      // Use spinOrder index as session rank proxy (lower index = better session rank)
      const sessionRank = pluginState
        ? pluginState.spinOrder.indexOf(p.id)
        : -1
      return {
        playerId: p.id,
        playerName: p.name,
        score: gameScores[p.id] ?? 0,
        rank: 0,
        sessionRank: sessionRank === -1 ? Infinity : sessionRank,
      }
    })

    // Sort by score descending, break ties by session rank ascending (Req 7.1, 7.2)
    entries.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      if (a.sessionRank !== b.sessionRank) return a.sessionRank - b.sessionRank
      // Same score AND same session rank: randomize (Req 7.3)
      return Math.random() - 0.5
    })

    // Assign sequential ranks (1, 2, 3, ...)
    for (let i = 0; i < entries.length; i++) {
      entries[i].rank = i + 1
    }

    // Return GameLeaderboardEntry (strip internal sessionRank field)
    return entries.map(({ playerId, playerName, score, rank }) => ({
      playerId,
      playerName,
      score,
      rank,
    }))
  },
}

// Register the plugin in the global GameRegistry
registry.register(bigWheelPlugin)
