import { useState, useEffect } from "react"
import { useGameStore } from "../../store/useGameStore"
import { useTheme } from "../../theme"
import type { LotteryState } from "@games-of-chance/shared"

/**
 * LotteryRevealScreen — shown during the LOTTERY_REVEAL phase after the
 * playcaller tournament bracket (main + consolation) completes in lottery mode.
 *
 * Displays the full odds table as a grid with rows = seed positions (last place
 * first as "Seed 1") and columns = placements (1st–Nth). Each player's actual
 * result cell is highlighted.
 *
 * Two reveal modes based on `draftPickEnabled`:
 * - Draft Pick DISABLED: animated reveal from 10th to 1st with staggered timing.
 *   Host sees "Finish" button after animation completes.
 * - Draft Pick ENABLED: instant reveal, all results shown at once. Host sees
 *   "Continue to Draft" button immediately.
 *
 * Validates: Requirements 6.2, 6.3, 6.4, 6.5, 6.6, 3.8
 */
export function LotteryRevealScreen() {
  const theme = useTheme()
  const lotteryState = useGameStore((s) => s.roomState?.lotteryState)
  const draftPickEnabled = useGameStore(
    (s) => s.roomState?.room.draftPickEnabled ?? false
  )
  const players = useGameStore((s) => s.roomState?.players ?? [])
  const role = useGameStore((s) => s.role)

  // Build seed-ordered player list from placements
  // Seed 1 = best lottery odds = worst session rank (first row)
  // We derive seed order from the placements map:
  // The player with placement drawn from row 0 is seed 1, etc.
  // Since placements maps playerId → final placement, we need to figure out
  // the original seed order. The placements are drawn by seed index, so
  // we can reconstruct seed ordering from how the table was applied.
  // The server stores players in session-list order where index 0 = seed 1.
  // We use the players array order as the seed order (same as session list).
  const playerCount = players.length
  const oddsTable = lotteryState?.oddsTable ?? []
  const placements = lotteryState?.placements ?? {}

  // Build seed-to-player mapping.
  // Players are ordered by session list (seed 1 = worst performer = first in list).
  // The odds table rows correspond 1:1 with the players array order.
  const seedPlayers = players.map((p, idx) => ({
    playerId: p.id,
    playerName: p.name,
    seedIndex: idx,
    placement: placements[p.id] ?? idx + 1,
  }))

  // Number of columns = min(playerCount, oddsTable columns available)
  const columnCount = Math.min(
    playerCount,
    oddsTable.length > 0 ? oddsTable[0].length : 10
  )

  // Animated reveal state
  // revealedCount tracks how many placements have been revealed (from last to first)
  const [revealedCount, setRevealedCount] = useState(0)

  useEffect(() => {
    if (draftPickEnabled) {
      // Instant reveal — show all at once
      setRevealedCount(playerCount)
      return
    }

    // Staggered reveal from last place to first (10th → 1st)
    const timer = setInterval(() => {
      setRevealedCount((prev) => {
        if (prev >= playerCount) {
          clearInterval(timer)
          return prev
        }
        return prev + 1
      })
    }, 1500)
    return () => clearInterval(timer)
  }, [draftPickEnabled, playerCount])

  const animationComplete = revealedCount >= playerCount

  // Determine which placements have been revealed.
  // Reveal order: last place (highest placement number) first.
  // "revealedCount of 1" means the player with placement = playerCount is revealed.
  const isPlacementRevealed = (placement: number): boolean => {
    if (draftPickEnabled) return true
    // Reveal from highest placement down: placement N is revealed first (revealedCount >= 1)
    const revealOrder = playerCount - placement + 1 // placement N → order 1, placement 1 → order N
    return revealedCount >= revealOrder
  }

  const handleAdvance = () => {
    const send = useGameStore.getState()._socketSend
    if (send) {
      send({ type: "ADVANCE_LOTTERY_PHASE" })
    }
  }

  if (!lotteryState) {
    return (
      <div
        className={`flex flex-col items-center gap-6 rounded-lg p-8 shadow-sm ${theme.card}`}
      >
        <h2 className={`text-2xl font-bold ${theme.titleText}`}>
          Lottery Results
        </h2>
        <p className={theme.mutedText}>Waiting for lottery data...</p>
      </div>
    )
  }

  return (
    <div
      className={`flex flex-col items-center gap-6 rounded-lg p-6 shadow-sm ${theme.card}`}
    >
      {/* Header */}
      <div className="text-center">
        <h2 className={`text-2xl font-bold ${theme.titleText}`}>
          Lottery Results
        </h2>
        <p className={`mt-1 text-sm ${theme.mutedText}`}>
          Draft lottery odds &amp; results
        </p>
      </div>

      {/* Odds Table Grid */}
      <div className="w-full overflow-x-auto">
        <table className="mx-auto border-collapse text-xs">
          <thead>
            <tr>
              {/* Top-left corner cell: "Seed / Pick" label */}
              <th
                className={`sticky left-0 z-10 border border-white/10 px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide ${theme.mutedText} ${theme.card}`}
              >
                Seed
              </th>
              {/* Placement column headers */}
              {Array.from({ length: columnCount }, (_, colIdx) => (
                <th
                  key={colIdx}
                  className={`border border-white/10 px-2 py-1.5 text-center font-semibold ${theme.headingText}`}
                >
                  {formatOrdinal(colIdx + 1)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {seedPlayers.map((seed) => {
              const rowOdds = oddsTable[seed.seedIndex] ?? []
              return (
                <tr key={seed.playerId}>
                  {/* Seed label — sticky left on mobile scroll */}
                  <td
                    className={`sticky left-0 z-10 border border-white/10 px-2 py-1.5 text-left font-medium whitespace-nowrap ${theme.bodyText} ${theme.card}`}
                  >
                    <span className={`mr-1 text-[10px] ${theme.mutedText}`}>
                      {seed.seedIndex + 1}.
                    </span>
                    {seed.playerName}
                  </td>
                  {/* Odds cells */}
                  {Array.from({ length: columnCount }, (_, colIdx) => {
                    const placementCol = colIdx + 1 // 1-based placement
                    const isResult = seed.placement === placementCol
                    const revealed = isPlacementRevealed(placementCol)
                    const probability = rowOdds[colIdx] ?? 0

                    return (
                      <td
                        key={colIdx}
                        className={`border border-white/10 px-2 py-1.5 text-center tabular-nums ${
                          isResult && revealed
                            ? "bg-amber-500/30 ring-2 ring-inset ring-amber-400 font-bold text-amber-200"
                            : theme.bodyText
                        }`}
                      >
                        {formatPercent(probability)}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Host advance button */}
      {role === "host" && animationComplete && (
        <button
          onClick={handleAdvance}
          className={`rounded-lg px-6 py-3 text-sm font-semibold shadow-sm transition ${theme.btnPrimary}`}
        >
          {draftPickEnabled ? "Continue to Draft" : "Finish"}
        </button>
      )}
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Format a number (0.189) as a percentage string ("18.9%") */
function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

/** Format a number as an ordinal string (1 → "1st", 2 → "2nd", etc.) */
function formatOrdinal(n: number): string {
  const suffixes = ["th", "st", "nd", "rd"]
  const mod100 = n % 100
  const suffix =
    mod100 >= 11 && mod100 <= 13
      ? "th"
      : suffixes[n % 10] ?? "th"
  return `${n}${suffix}`
}
