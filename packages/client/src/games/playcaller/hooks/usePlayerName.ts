import { useCallback } from "react"
import { useGameStore } from "../../../store/useGameStore"

/**
 * usePlayerName — Hook that provides a resolver function to look up
 * a player's display name from their ID using the room state players list.
 *
 * Falls back to displaying the raw ID if the player is not found in the roster.
 *
 * Usage:
 *   const getPlayerName = usePlayerName()
 *   const name = getPlayerName(somePlayerId)
 */
export function usePlayerName() {
  const players = useGameStore((s) => s.roomState?.players)

  const getPlayerName = useCallback(
    (id: string | null | undefined): string => {
      if (!id) return "Unknown"
      return players?.find((p) => p.id === id)?.name ?? id
    },
    [players]
  )

  return getPlayerName
}
