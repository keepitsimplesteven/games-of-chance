import { motion } from "framer-motion"
import type { GameLeaderboardEntry, TossHistoryEntry, CoinSide } from "@games-of-chance/shared"
import { useGameStore } from "../../store/useGameStore"
import { useTheme } from "../../theme"
import { useDeferredRevealValue } from "../../hooks/useDeferredRevealValue"

/**
 * CoinTossLeaderboard — Combined leaderboard + result view for the coin-toss game.
 *
 * Shows:
 * 1. The full sequence of coin toss outcomes (H/T coins gated behind useDeferredRevealValue)
 * 2. Per player: name, streak icons, their pick accuracy sequence (green/red), and +delta
 *
 * This replaces both the old ResultDisplay and the generic GameLeaderboard for coin-toss.
 * The current player is rendered first with slight emphasis.
 */
export function CoinTossLeaderboard() {
  const roomState = useGameStore((s) => s.roomState)
  const playerId = useGameStore((s) => s.playerId)
  const theme = useTheme()

  if (!roomState) return null

  // Gate leaderboard and toss history behind deferred reveal
  const leaderboard = useDeferredRevealValue(roomState.gameLeaderboard)
  const coinTossState = roomState.coinTossGameState
  const tossHistory = useDeferredRevealValue(coinTossState?.tossHistory ?? [])

  if (leaderboard.length === 0) return null

  // Sort leaderboard: by rank
  const sorted = [...leaderboard].sort((a, b) => {
    if (b.playerId === playerId) return 1
    return a.rank - b.rank
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`rounded-lg p-3 ${theme.card}`}
    >
      {/* Toss sequence header */}
      {tossHistory.length > 0 && (
        <TossSequenceRow tossHistory={tossHistory} />
      )}

      {/* Player entries */}
      <ul className="space-y-1.5 mt-2">
        {sorted.map((entry) => (
          <PlayerRow
            key={entry.playerId}
            entry={entry}
            tossHistory={tossHistory}
            isCurrentPlayer={entry.playerId === playerId}
          />
        ))}
      </ul>
    </motion.div>
  )
}

// ── Toss Sequence Row ──────────────────────────────────────────────────────

function TossSequenceRow({ tossHistory }: { tossHistory: TossHistoryEntry[] }) {
  const theme = useTheme()

  return (
    <div className="flex items-center gap-1 flex-wrap pb-2 border-b border-[#2a7a3a] mb-1">
      <span className={`text-[10px] uppercase tracking-wider font-bold mr-1 ${theme.mutedText}`}>
        Flips:
      </span>
      {tossHistory.map((toss, i) => (
        <CoinToken key={i} side={toss.outcome} />
      ))}
    </div>
  )
}

// ── Coin Token ─────────────────────────────────────────────────────────────

/**
 * Small coin token for the toss sequence. Uses gold "H"/"T" text — compact
 * enough to fit many on a single row at mobile widths.
 */
function CoinToken({ side }: { side: CoinSide }) {
  const label = side === "HEADS" ? "H" : "T"

  return (
    <span
      className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#f5c542] text-[#111111] text-[10px] font-black leading-none shadow-[0_1px_0_#8b6914]"
      aria-label={side === "HEADS" ? "Heads" : "Tails"}
    >
      {label}
    </span>
  )
}

// ── Player Row ─────────────────────────────────────────────────────────────

interface PlayerRowProps {
  entry: GameLeaderboardEntry
  tossHistory: TossHistoryEntry[]
  isCurrentPlayer: boolean
}

function PlayerRow({ entry, tossHistory, isCurrentPlayer }: PlayerRowProps) {
  const theme = useTheme()

  const streakEmoji = getStreakIndicator(entry.streak, entry.coldStreak)

  // Compute the latest round's delta from toss history
  const latestDelta = tossHistory.length > 0
    ? tossHistory[tossHistory.length - 1].deltas[entry.playerId] ?? 0
    : 0

  // Only show delta during RESULT phase when animation is done (already gated by useDeferredRevealValue)
  const showDelta = latestDelta > 0

  return (
    <li
      className={`flex items-center gap-2 rounded-md px-2.5 py-2 ${theme.listItem} ${isCurrentPlayer ? "border-[#f5c542]" : ""
        }`}
    >
      {/* Rank badge */}
      <span
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold shrink-0 ${entry.rank === 1
          ? "bg-[#f5c542] text-[#111111]"
          : "bg-[#1b5e2a] text-[#f0f0f0]"
          }`}
      >
        {entry.rank}
      </span>

      {/* Name + streak */}
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-center gap-1 min-w-0 shrink-0">
          <span className={`text-xs font-bold truncate ${theme.bodyText}`}>
            {entry.playerName}
            {isCurrentPlayer && (
              <span className={`ml-0.5 text-[10px] ${theme.mutedText}`}>(you)</span>
            )}
          </span>
          {streakEmoji && (
            <span className="text-xs shrink-0">{streakEmoji}</span>
          )}
        </div>

        {/* Pick accuracy sequence */}
        <div className="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto scrollbar-none">
          {tossHistory.map((toss, i) => {
            const playerPick = toss.picks[entry.playerId]
            if (!playerPick) return <EmptyToken key={i} />
            const isCorrect = playerPick === toss.outcome
            return (
              <PickToken key={i} side={playerPick} correct={isCorrect} />
            )
          })}
        </div>
      </div>

      {/* Score + delta */}
      <div className="flex items-center gap-1 shrink-0">
        {showDelta && (
          <span className={`text-[10px] font-bold ${theme.statusSuccess}`}>
            +{latestDelta}
          </span>
        )}
        <span className={`text-xs font-bold tabular-nums ${theme.accentText}`}>
          {entry.score}
        </span>
      </div>
    </li>
  )
}

// ── Pick Token ─────────────────────────────────────────────────────────────

/**
 * Small colored H/T token showing a player's pick for a specific round.
 * Green = matched the outcome, Red = mismatched.
 */
function PickToken({ side, correct }: { side: CoinSide; correct: boolean }) {
  const label = side === "HEADS" ? "H" : "T"
  const colorClass = correct
    ? "bg-[#3a9a4a] text-[#f0f0f0]"
    : "bg-[#cc3333] text-[#f0f0f0]"

  return (
    <span
      className={`inline-flex items-center justify-center w-4 h-4 rounded-sm text-[9px] font-bold leading-none shrink-0 ${colorClass}`}
      aria-label={`${side === "HEADS" ? "Heads" : "Tails"} — ${correct ? "correct" : "incorrect"}`}
    >
      {label}
    </span>
  )
}

/** Placeholder for rounds where this player didn't submit a pick */
function EmptyToken() {
  return (
    <span className="inline-flex items-center justify-center w-4 h-4 rounded-sm bg-[#0f3d18] text-[#3a9a4a] text-[9px] font-bold leading-none shrink-0">
      –
    </span>
  )
}

// ── Streak Indicator Helper ────────────────────────────────────────────────

function getStreakIndicator(streak?: number, coldStreak?: number): string {
  const s = streak ?? 0
  const c = coldStreak ?? 0

  if (s >= 3) return "🔥🔥"
  if (s === 2) return "🔥"
  if (c >= 3) return "🧊🧊"
  if (c === 2) return "🧊"
  return ""
}
