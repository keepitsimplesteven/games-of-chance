import type { GameLeaderboardEntry, TossHistoryEntry, CoinSide } from "@games-of-chance/shared"
import { useGameStore } from "../../store/useGameStore"
import { useTheme } from "../../theme"
import { useDeferredRevealValue } from "../../hooks/useDeferredRevealValue"
import { BaseLeaderboard } from "../../components/game/BaseLeaderboard"

/**
 * CoinTossLeaderboard — Combined leaderboard + result view for the coin-toss game.
 *
 * Shows:
 * 1. The full sequence of coin toss outcomes (H/T coins gated behind useDeferredRevealValue)
 * 2. Per player: pick accuracy sequence (green/red), streak icons, and +delta
 *
 * Wraps BaseLeaderboard with custom renderHeader and renderRow slots.
 */
export function CoinTossLeaderboard() {
  const roomState = useGameStore((s) => s.roomState)
  const playerId = useGameStore((s) => s.playerId)

  if (!roomState) return null

  // Gate leaderboard and toss history behind deferred reveal
  const leaderboard = useDeferredRevealValue(roomState.gameLeaderboard, [])
  const coinTossState = roomState.coinTossGameState
  const tossHistory = useDeferredRevealValue(coinTossState?.tossHistory ?? [], [])

  if (leaderboard.length === 0) return null

  // Sort leaderboard by rank
  const sorted = [...leaderboard].sort((a, b) => a.rank - b.rank)

  return (
    <BaseLeaderboard
      entries={sorted}
      currentPlayerId={playerId}
      renderHeader={() => <TossSequenceRow tossHistory={tossHistory} />}
      renderScore={(entry) => (
        <CoinTossDelta entry={entry} tossHistory={tossHistory} />
      )}
      renderRow={(entry) => (
        <CoinTossPickSequence entry={entry} tossHistory={tossHistory} />
      )}
    />
  )
}

// ── Toss Sequence Row ──────────────────────────────────────────────────────

function TossSequenceRow({ tossHistory }: { tossHistory: TossHistoryEntry[] }) {
  const theme = useTheme()

  if (tossHistory.length === 0) return null

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

// ── CoinToss Inline Delta ───────────────────────────────────────────────────

interface CoinTossDeltaProps {
  entry: GameLeaderboardEntry
  tossHistory: TossHistoryEntry[]
}

/**
 * Inline slot content: shows the +delta label on line 1 next to the score.
 */
function CoinTossDelta({ entry, tossHistory }: CoinTossDeltaProps) {
  const theme = useTheme()

  const latestDelta = tossHistory.length > 0
    ? tossHistory[tossHistory.length - 1].deltas[entry.playerId] ?? 0
    : 0

  if (latestDelta <= 0) return null

  return (
    <span className={`text-[10px] font-bold ${theme.statusSuccess}`}>
      +{latestDelta}
    </span>
  )
}

// ── CoinToss Pick Sequence (Line 2) ────────────────────────────────────────

interface CoinTossPickSequenceProps {
  entry: GameLeaderboardEntry
  tossHistory: TossHistoryEntry[]
}

/**
 * Row slot content (line 2): per-player pick accuracy tokens (green/red H/T).
 */
function CoinTossPickSequence({ entry, tossHistory }: CoinTossPickSequenceProps) {
  if (tossHistory.length === 0) return null

  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      {tossHistory.map((toss, i) => {
        const playerPick = toss.picks[entry.playerId]
        if (!playerPick) return <EmptyToken key={i} />
        const isCorrect = playerPick === toss.outcome
        return <PickToken key={i} side={playerPick} correct={isCorrect} />
      })}
    </div>
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
