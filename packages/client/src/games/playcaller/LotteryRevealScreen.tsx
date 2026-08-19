import { useState, useEffect, useRef, useCallback } from "react"
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
 * Reveal is host-controlled:
 * - Default mode: Host clicks "Next reveal" to fade in each cell one at a time.
 * - Dramatic reveal mode: Host toggles on; cells auto-reveal on a timer via server.
 * - Draft Pick ENABLED: instant reveal, all results shown at once.
 * - Static mode (modal view): instant reveal, no controls.
 *
 * Validates: Requirements 6.2, 6.3, 6.4, 6.5, 6.6, 3.8
 */
export function LotteryRevealScreen({ staticMode = false }: { staticMode?: boolean } = {}) {
  const theme = useTheme()
  const lotteryState = useGameStore((s) => s.roomState?.lotteryState)
  const draftPickEnabled = useGameStore(
    (s) => s.roomState?.room.draftPickEnabled ?? false
  )
  const players = useGameStore((s) => s.roomState?.players ?? [])
  const playerSeeds = useGameStore((s) => s.roomState?.playerSeeds ?? {})
  const role = useGameStore((s) => s.role)

  // Build seed-ordered player list from placements.
  // When host-assigned seeds exist, use them to determine row order
  // (seed 1 = best lottery odds = row 0 of odds table).
  // Otherwise fall back to the players array order (join order).
  const playerCount = players.length
  const oddsTable = lotteryState?.oddsTable ?? []
  const placements = lotteryState?.placements ?? {}

  const hasHostSeeds = Object.keys(playerSeeds).length > 0

  // Sort players by seed: seed 1 first (index 0), seed 2 second (index 1), etc.
  const seedOrderedPlayers = hasHostSeeds
    ? [...players].sort(
        (a, b) => (playerSeeds[a.id] ?? Infinity) - (playerSeeds[b.id] ?? Infinity)
      )
    : players

  // Build seed-to-player mapping using the seed-sorted order.
  // The odds table rows correspond 1:1 with the seed order (row 0 = seed 1).
  const seedPlayers = seedOrderedPlayers.map((p, idx) => ({
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

  // Server-driven reveal count (host advances via socket messages)
  const serverRevealedCount = lotteryState?.revealedCount ?? 0
  const dramaticMode = lotteryState?.dramaticMode ?? false

  // For static/draftPick modes, show everything immediately regardless of server state
  const effectiveRevealedCount =
    staticMode || draftPickEnabled ? playerCount : serverRevealedCount

  // Ref map for result cells — keyed by placement column (1-based)
  const resultCellRefs = useRef<Record<number, HTMLTableCellElement | null>>({})

  // Callback ref setter for result cells
  const setResultCellRef = useCallback(
    (placement: number) => (el: HTMLTableCellElement | null) => {
      resultCellRefs.current[placement] = el
    },
    []
  )

  // Scroll the newly revealed result cell into view
  const prevRevealedRef = useRef(effectiveRevealedCount)
  useEffect(() => {
    if (staticMode || draftPickEnabled || effectiveRevealedCount === 0) return
    if (effectiveRevealedCount <= prevRevealedRef.current) {
      prevRevealedRef.current = effectiveRevealedCount
      return
    }
    prevRevealedRef.current = effectiveRevealedCount

    // The most recently revealed placement: reveal from last place down
    const revealedPlacement = playerCount - effectiveRevealedCount + 1
    const cell = resultCellRefs.current[revealedPlacement]
    if (cell) {
      cell.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" })
    }
  }, [effectiveRevealedCount, playerCount, staticMode, draftPickEnabled])

  // Dramatic mode: auto-send LOTTERY_REVEAL_NEXT on a timer
  useEffect(() => {
    if (!dramaticMode || staticMode || draftPickEnabled) return
    if (serverRevealedCount >= playerCount) return

    const timer = setTimeout(() => {
      const send = useGameStore.getState()._socketSend
      if (send) {
        send({ type: "LOTTERY_REVEAL_NEXT" })
      }
    }, 2500)
    return () => clearTimeout(timer)
  }, [dramaticMode, serverRevealedCount, playerCount, staticMode, draftPickEnabled])

  const animationComplete = effectiveRevealedCount >= playerCount

  // Determine which placements have been revealed.
  // Reveal order: last place (highest placement number) first.
  const isPlacementRevealed = (placement: number): boolean => {
    if (staticMode || draftPickEnabled) return true
    const revealOrder = playerCount - placement + 1
    return effectiveRevealedCount >= revealOrder
  }

  const handleRevealNext = () => {
    const send = useGameStore.getState()._socketSend
    if (send) {
      send({ type: "LOTTERY_REVEAL_NEXT" })
    }
  }

  const handleToggleDramatic = () => {
    const send = useGameStore.getState()._socketSend
    if (send) {
      send({ type: "LOTTERY_TOGGLE_DRAMATIC" })
    }
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
                    className={`sticky left-0 z-10 border border-white/10 px-2 py-1.5 text-left font-medium max-w-[7rem] sm:max-w-[10rem] ${theme.bodyText} ${theme.card}`}
                  >
                    <div className="flex items-baseline gap-0.5 overflow-hidden">
                      <span className={`shrink-0 text-[10px] ${theme.mutedText}`}>
                        {seed.seedIndex + 1}.
                      </span>
                      <span className="truncate">{seed.playerName}</span>
                    </div>
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
                        ref={isResult ? setResultCellRef(placementCol) : undefined}
                        className={`relative border border-white/10 px-2 py-1.5 text-center tabular-nums ${theme.bodyText}`}
                      >
                        {formatPercent(probability)}
                        {/* Highlight overlay — fades in when revealed */}
                        {isResult && (
                          <div
                            className={`absolute inset-0 rounded-sm bg-amber-500/30 ring-2 ring-inset ring-amber-400 transition-opacity duration-500 ${
                              revealed ? "opacity-100" : "opacity-0"
                            }`}
                          />
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Host reveal controls — shown during active reveal (not in static/draftPick mode) */}
      {!staticMode && !draftPickEnabled && role === "host" && !animationComplete && (
        <div className="flex flex-col items-center gap-3">
          {/* Next reveal button (default mode) */}
          <button
            onClick={handleRevealNext}
            disabled={dramaticMode}
            className={`rounded-lg px-6 py-3 text-sm font-semibold shadow-sm transition ${
              dramaticMode
                ? "opacity-40 cursor-not-allowed " + theme.btnGhost
                : theme.btnPrimary
            }`}
          >
            Next Reveal ({effectiveRevealedCount}/{playerCount})
          </button>

          {/* Dramatic mode toggle */}
          <button
            onClick={handleToggleDramatic}
            className={`rounded-lg px-4 py-2 text-xs font-medium transition ${
              dramaticMode ? theme.btnSecondary : theme.btnGhost
            }`}
          >
            {dramaticMode ? "✦ Dramatic Mode ON" : "✦ Dramatic Reveal Mode"}
          </button>
        </div>
      )}

      {/* Non-host waiting indicator */}
      {!staticMode && !draftPickEnabled && role !== "host" && !animationComplete && (
        <div className={`text-sm ${theme.mutedText}`}>
          Waiting for host to reveal the next pick
        </div>
      )}

      {/* Host advance button — shown after all reveals complete */}
      {!staticMode && role === "host" && animationComplete && (
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
