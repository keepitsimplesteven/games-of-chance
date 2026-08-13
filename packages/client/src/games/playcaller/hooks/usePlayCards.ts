// packages/client/src/games/playcaller/hooks/usePlayCards.ts

import { useMemo } from "react"
import { selectPlay, playPoolRegistry } from "../play-names"
import type { Circumstance, PlaySlot } from "../play-names/types"
import type { PlayArtData } from "../play-art/types"

/** Data object representing a single play card in the UI */
export interface PlayCardData {
  playId: PlaySlot
  displayName: string
  formation: string
  artData: PlayArtData
}

const ALL_SLOTS: PlaySlot[] = ["run-safe", "run-aggressive", "pass-safe", "pass-aggressive"]

/**
 * Combines play pool selection + current circumstance to produce
 * an array of 4 card data objects for the active player's role.
 *
 * Each slot selection is independent (separate random draw from the
 * weighted pool filtered by the current circumstance).
 */
export function usePlayCards(circumstance: Circumstance, role: "offense" | "defense"): PlayCardData[] {
  return useMemo(() => {
    const pool = playPoolRegistry[role]
    return ALL_SLOTS.map((slot) => {
      const selected = selectPlay(pool[slot], circumstance, Math.random)
      return {
        playId: slot,
        displayName: selected.displayName,
        formation: selected.formation,
        artData: selected.playArt,
      }
    })
  }, [circumstance, role])
}
