import { useGameStore } from "../../../store/useGameStore"
import type { PlaycallerGameState, DriveState } from "@games-of-chance/shared"

/**
 * Extracts the DriveState for a specific matchup from the Zustand store.
 * Returns null if drive states are not available or the matchup isn't found.
 *
 * Validates: Requirements 14.1, 14.2
 */
export function useDriveState(matchupId: string): DriveState | null {
  const driveStates = useGameStore(
    (s) =>
      (s.roomState?.playcallerGameState as PlaycallerGameState | null | undefined)
        ?.driveStates
  )
  return driveStates?.[matchupId] ?? null
}
