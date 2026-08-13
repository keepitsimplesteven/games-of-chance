// packages/shared/src/games/coin-toss/ceremonyTypes.ts
// Coin toss ceremony types for the Playcaller tournament game

import type { CoinSide } from "./types"

/** Side selection for the coin toss ceremony */
export type SideSelection = "OFFENSE" | "DEFENSE"

/** Per-matchup coin toss ceremony step */
export type CeremonyStep = "AWAITING_CALL" | "AWAITING_CHOICE" | "COMPLETE"

/** Per-matchup ceremony state broadcast to clients */
export interface CoinTossCeremonyMatchupState {
  matchupId: string
  step: CeremonyStep
  callerId: string        // higher-seeded player (always playerA)
  waiterId: string        // lower-seeded player (always playerB)
  calledSide: CoinSide | null
  flipOutcome: CoinSide | null
  flippedAt: number | null
  chooserId: string | null
  sideSelection: SideSelection | null
  coinCallDeadlineMs: number | null
  sideChoiceDeadlineMs: number | null
}
