import { useEffect, useState } from "react"
import { useGameStore } from "../../store/useGameStore"
import { useTheme } from "../../theme"

/**
 * DraftPickScreen — Draft position selection UI shown during DRAFT_PICK phase.
 *
 * Players choose their actual snake draft position in lottery-winner order
 * (1st-place lottery winner picks first). The current picker sees enabled
 * "SELECT" buttons; all other players spectate with disabled buttons.
 *
 * Features:
 * - "Player X is on the clock" header with 30s countdown timer
 * - Draft positions displayed as a vertical list with SELECT buttons
 * - Already-selected positions show "Pick N — Player Name"
 * - Current picker sees enabled buttons; spectators see disabled buttons
 *
 * Validates: Requirements 7.3, 7.8, 7.9, 7.10, 7.11, 7.12, 7.13, 8.5
 */
export function DraftPickScreen() {
  const theme = useTheme()
  const draftPickState = useGameStore((s) => s.roomState?.draftPickState)
  const players = useGameStore((s) => s.roomState?.players ?? [])
  const playerId = useGameStore((s) => s.playerId)

  const [countdown, setCountdown] = useState(30)

  // Reset countdown when currentPickIndex changes
  useEffect(() => {
    setCountdown(30)
  }, [draftPickState?.currentPickIndex])

  // Countdown timer
  useEffect(() => {
    if (!draftPickState) return
    if (draftPickState.currentPickIndex >= draftPickState.pickOrder.length) return

    const interval = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)

    return () => clearInterval(interval)
  }, [draftPickState?.currentPickIndex, draftPickState])

  if (!draftPickState) {
    return (
      <div className={`flex flex-col items-center gap-6 rounded-lg p-8 shadow-sm ${theme.card}`}>
        <h2 className={`text-2xl font-bold ${theme.titleText}`}>Draft Pick</h2>
        <p className={theme.mutedText}>Waiting for draft pick state...</p>
      </div>
    )
  }

  const { pickOrder, currentPickIndex, selections, availablePositions } = draftPickState
  const allPicksComplete = currentPickIndex >= pickOrder.length
  const currentPickerId = allPicksComplete ? null : pickOrder[currentPickIndex]
  const isMyTurn = currentPickerId === playerId

  const getPlayerName = (id: string): string => {
    const player = players.find((p) => p.id === id)
    return player?.name ?? "Unknown"
  }

  const handleSelectPosition = (position: number) => {
    if (!isMyTurn) return
    const send = useGameStore.getState()._socketSend
    if (send) {
      send({ type: "DRAFT_PICK_SELECTION", payload: { position } })
    }
  }

  // Build the full list of positions (1 through total players)
  const totalPositions = pickOrder.length
  const positionRows = Array.from({ length: totalPositions }, (_, i) => i + 1)

  return (
    <div className={`flex flex-col items-center gap-6 rounded-lg p-6 shadow-sm ${theme.card}`}>
      {/* Header — who is on the clock */}
      <div className="text-center">
        {allPicksComplete ? (
          <h2 className={`text-2xl font-bold ${theme.titleText}`}>
            All picks are in!
          </h2>
        ) : (
          <>
            <h2 className={`text-2xl font-bold ${theme.titleText}`}>
              {isMyTurn ? "You are" : `${getPlayerName(currentPickerId!)} is`} on the clock
            </h2>
            <div
              className={`mt-2 text-3xl font-mono font-bold ${
                countdown <= 5 ? "text-red-400" : theme.accentText
              }`}
            >
              {countdown}s
            </div>
          </>
        )}
      </div>

      {/* Draft positions list */}
      <div className="flex w-full max-w-md flex-col gap-2">
        {positionRows.map((position) => {
          const selectedBy = Object.entries(selections).find(
            ([, pos]) => pos === position
          )
          const isAvailable = availablePositions.includes(position)
          const isSelected = !!selectedBy

          return (
            <div
              key={position}
              className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                isSelected
                  ? "border-white/20 opacity-70"
                  : "border-white/10"
              } ${theme.card}`}
            >
              <div className="flex items-center gap-3">
                <span className={`text-lg font-bold ${theme.bodyText}`}>
                  Pick {position}
                </span>
                {isSelected && (
                  <span className={`text-sm ${theme.accentText}`}>
                    — {getPlayerName(selectedBy[0])}
                  </span>
                )}
              </div>

              {!isSelected && !allPicksComplete && (
                <button
                  onClick={() => handleSelectPosition(position)}
                  disabled={!isMyTurn || !isAvailable}
                  className={`rounded-md px-4 py-1.5 text-sm font-semibold transition ${
                    isMyTurn && isAvailable
                      ? theme.btnPrimary
                      : "cursor-not-allowed opacity-50 " + theme.btnGhost
                  }`}
                >
                  SELECT
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
