import { useState, useEffect, useRef } from "react"
import { useGameStore } from "../../store/useGameStore"
import { useTheme } from "../../theme"

/**
 * TournamentEndView — displayed when round.phase === "END_TOURNAMENT".
 * Shows the final session leaderboard as definitive tournament results
 * with a podium-style layout and celebratory visual treatment for the winner.
 *
 * In lottery mode, uses lottery placements for rankings instead of session points.
 *
 * Validates: Requirements 6.3, 6.4
 */
export default function TournamentEndView() {
  const sessionLeaderboard = useGameStore((s) => s.roomState?.sessionLeaderboard)
  const playerId = useGameStore((s) => s.playerId)
  const lotteryState = useGameStore((s) => s.roomState?.lotteryState)
  const players = useGameStore((s) => s.roomState?.players ?? [])
  const progressionMode = useGameStore((s) => s.roomState?.room.progressionMode)
  const theme = useTheme()

  const isLotteryMode = progressionMode === "lottery"

  // Build sorted entries: lottery mode uses placements, normal mode uses session leaderboard
  let sorted: Array<{ playerId: string; playerName: string; sessionPoints: number; rank: number }>

  if (isLotteryMode && lotteryState?.placements) {
    // Use lottery placements as final rankings
    sorted = players.map((p) => ({
      playerId: p.id,
      playerName: p.name,
      sessionPoints: 0,
      rank: lotteryState.placements[p.id] ?? players.length,
    })).sort((a, b) => a.rank - b.rank)
  } else if (sessionLeaderboard && sessionLeaderboard.length > 0) {
    sorted = [...sessionLeaderboard].sort((a, b) => a.rank - b.rank)
  } else {
    sorted = []
  }

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className={theme.mutedText}>No results available.</p>
      </div>
    )
  }
  const winner = sorted[0]
  const second = sorted[1]
  const third = sorted[2]
  const rest = sorted.slice(3)

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      {/* Confetti overlay — JS-driven spawning */}
      <ConfettiOverlay durationMs={10000} />

      {/* Trophy & Title */}
      <div className="animate-bounce text-center">
        <span className="text-5xl" role="img" aria-label="trophy">🏆</span>
      </div>
      <h2 className={`text-2xl font-bold ${theme.titleText}`}>Tournament Complete!</h2>
      <p className={`text-sm ${theme.mutedText}`}>Final standings are in. Congratulations to all players!</p>

      {/* Podium */}
      <div className="flex w-full max-w-md items-end justify-center gap-3 px-4 pt-4">
        {/* 2nd Place */}
        {second && (
          <PodiumSlot
            entry={second}
            position={2}
            isCurrentPlayer={second.playerId === playerId}
            isLotteryMode={isLotteryMode}
          />
        )}

        {/* 1st Place (tallest) */}
        {winner && (
          <PodiumSlot
            entry={winner}
            position={1}
            isCurrentPlayer={winner.playerId === playerId}
            isLotteryMode={isLotteryMode}
          />
        )}

        {/* 3rd Place */}
        {third && (
          <PodiumSlot
            entry={third}
            position={3}
            isCurrentPlayer={third.playerId === playerId}
            isLotteryMode={isLotteryMode}
          />
        )}
      </div>

      {/* Remaining players */}
      {rest.length > 0 && (
        <div className="w-full max-w-md px-4">
          <div className="space-y-1">
            {rest.map((entry) => {
              const isCurrentPlayer = entry.playerId === playerId
              return (
                <div
                  key={entry.playerId}
                  className={`flex items-center justify-between rounded-md px-3 py-2 ${theme.listItem}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${theme.bodyText} ${theme.listItem}`}>
                      {entry.rank}
                    </span>
                    <span className={`text-sm font-medium ${theme.bodyText}`}>
                      {entry.playerName}
                      {isCurrentPlayer && (
                        <span className={`ml-1 text-xs ${theme.mutedText}`}>(you)</span>
                      )}
                    </span>
                  </div>
                  {!isLotteryMode && (
                    <span className={`text-sm font-semibold ${theme.accentText}`}>
                      {entry.sessionPoints} pts
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Confetti Overlay (JS-driven) ───────────────────────────────────────────

const CONFETTI_COLORS = [
  "#f59e0b", "#ef4444", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899",
]

interface ConfettiPiece {
  id: number
  left: number      // 0-100 (%)
  size: number      // px
  duration: number  // fall duration in seconds
  color: string
  rotation: number  // degrees to rotate during fall
}

function ConfettiOverlay({ durationMs }: { durationMs: number }) {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([])
  const nextId = useRef(0)
  const spawnInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const stopTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Spawn a batch of confetti pieces every 200ms
    spawnInterval.current = setInterval(() => {
      const batch: ConfettiPiece[] = Array.from({ length: 6 }, () => ({
        id: nextId.current++,
        left: Math.random() * 100,
        size: 6 + Math.random() * 7,
        duration: 2.5 + Math.random() * 2,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        rotation: 360 + Math.random() * 720,
      }))
      setPieces((prev) => [...prev, ...batch])

      // Remove pieces after they've fallen (their duration + a small buffer)
      const maxDuration = Math.max(...batch.map((p) => p.duration))
      setTimeout(() => {
        const ids = new Set(batch.map((p) => p.id))
        setPieces((prev) => prev.filter((p) => !ids.has(p.id)))
      }, (maxDuration + 0.5) * 1000)
    }, 200)

    // Stop spawning after the specified duration
    stopTimeout.current = setTimeout(() => {
      if (spawnInterval.current) {
        clearInterval(spawnInterval.current)
        spawnInterval.current = null
      }
    }, durationMs)

    return () => {
      if (spawnInterval.current) clearInterval(spawnInterval.current)
      if (stopTimeout.current) clearTimeout(stopTimeout.current)
    }
  }, [durationMs])

  return (
    <>
      <style>{confettiKeyframes}</style>
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        {pieces.map((piece) => (
          <span
            key={piece.id}
            className="absolute top-0 rounded-sm"
            style={{
              left: `${piece.left}%`,
              width: `${piece.size}px`,
              height: `${piece.size}px`,
              backgroundColor: piece.color,
              animation: `confetti-fall ${piece.duration}s ease-in forwards`,
              "--confetti-rotation": `${piece.rotation}deg`,
            } as React.CSSProperties}
          />
        ))}
      </div>
    </>
  )
}

const confettiKeyframes = `
  @keyframes confetti-fall {
    0% {
      transform: translateY(-10px) rotate(0deg);
      opacity: 1;
    }
    80% {
      opacity: 1;
    }
    100% {
      transform: translateY(100vh) rotate(var(--confetti-rotation, 720deg));
      opacity: 0;
    }
  }
`

// ── Podium Slot ────────────────────────────────────────────────────────────

interface PodiumSlotProps {
  entry: { playerId: string; playerName: string; sessionPoints: number; rank: number }
  position: 1 | 2 | 3
  isCurrentPlayer: boolean
  isLotteryMode: boolean
}

function PodiumSlot({ entry, position, isCurrentPlayer, isLotteryMode }: PodiumSlotProps) {
  const theme = useTheme()
  const isWinner = position === 1

  const heightClass = position === 1 ? "h-28" : position === 2 ? "h-20" : "h-16"
  const medal = position === 1 ? "🥇" : position === 2 ? "🥈" : "🥉"

  return (
    <div className="flex flex-1 flex-col items-center gap-1">
      {/* Medal emoji */}
      <span className={`text-2xl ${isWinner ? "animate-pulse" : ""}`} role="img" aria-label={`Position ${position}`}>
        {medal}
      </span>

      {/* Player name */}
      <span className={`text-center text-xs font-semibold max-w-full truncate ${theme.bodyText}`}>
        {entry.playerName}
        {isCurrentPlayer && <span className={`ml-0.5 ${theme.mutedText}`}>(you)</span>}
      </span>

      {/* Points — hidden in lottery mode */}
      {!isLotteryMode && (
        <span className={`text-xs font-bold ${theme.accentText}`}>
          {entry.sessionPoints} pts
        </span>
      )}

      {/* Podium block */}
      <div
        className={`${heightClass} w-full rounded-t-lg flex items-center justify-center ${theme.card} ${
          isWinner ? "shadow-lg" : ""
        }`}
      >
        <span className={`text-lg font-bold ${theme.headingText}`}>{position}</span>
      </div>
    </div>
  )
}
