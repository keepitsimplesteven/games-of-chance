// packages/client/src/games/playcaller/hooks/usePlayCards.ts

import { useMemo } from "react"
import type { Circumstance, OffensivePlayId, DefensivePlayId, PlayNameEntry } from "../play-names/types"
import { getPlayName } from "../play-names"
import { offensePlayArt } from "../play-art/offense"
import { defensePlayArt } from "../play-art/defense"
import type { PlayArtData } from "../play-art/types"

/** Data object representing a single play card in the UI */
export interface PlayCardData {
  playId: OffensivePlayId | DefensivePlayId
  displayName: string
  formation: string
  artData: PlayArtData
}

const OFFENSE_PLAYS: OffensivePlayId[] = ["run-safe", "run-aggressive", "pass-safe", "pass-aggressive"]
const DEFENSE_PLAYS: DefensivePlayId[] = ["run-safe", "run-aggressive", "pass-safe", "pass-aggressive"]

/**
 * Combines play art data + play names + current circumstance to produce
 * an array of 4 card data objects for the active player's role.
 */
export function usePlayCards(circumstance: Circumstance, role: "offense" | "defense"): PlayCardData[] {
  return useMemo(() => {
    const plays = role === "offense" ? OFFENSE_PLAYS : DEFENSE_PLAYS
    const artMap = role === "offense" ? offensePlayArt : defensePlayArt

    return plays.map((playId) => {
      const nameEntry: PlayNameEntry = getPlayName(playId, circumstance, role)
      const artData: PlayArtData = artMap[playId][circumstance]
      return { playId, displayName: nameEntry.displayName, formation: nameEntry.formation, artData }
    })
  }, [circumstance, role])
}
