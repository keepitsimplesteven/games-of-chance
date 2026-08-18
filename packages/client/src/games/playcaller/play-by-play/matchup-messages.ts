// packages/client/src/games/playcaller/play-by-play/matchup-messages.ts
//
// Generic matchup overlay messages used when the defense correctly reads the offense
// (defense_read) or the offense completely fools the defense (offense_fooled).
// These fire at ~100% rate when the matchup condition is met and no play-specific
// matchupOutcome messages exist.
//
// Messages that involve yardage include {yards}. Turnovers/incompletions do not.

import type { MatchupQuality } from "./types"
import type { PlayAxis } from "./circumstance-messages"

/**
 * Generic matchup messages keyed by quality and axis.
 * 6–8 messages per combination for variety.
 */
export const matchupMessages: Record<MatchupQuality, Record<PlayAxis, string[]>> = {
  defense_read: {
    run: [
      "The defense had that run sniffed out.",
      "They stacked the box and won.",
      "Perfect read by the front seven.",
      "Every gap was filled. Nowhere to go.",
      "The linebackers read their keys perfectly.",
      "The defense sold out to stop the run. It worked.",
      "That's what happens when you call run into a loaded box.",
      "The defensive coordinator had that one circled.",
    ],
    pass: [
      "The secondary was sitting on that route.",
      "Perfect coverage call. Locked down.",
      "Textbook defensive read. They knew pass.",
      "The DBs were in position before the throw.",
      "Pass rush and coverage in sync.",
      "The defense read pass and made them pay.",
      "The coverage was waiting on him the whole way.",
      "That's a play the defense had practiced all week.",
    ],
  },

  offense_fooled: {
    run: [
      "The defense was fooled. {yards} easy yards!",
      "Nobody in position! {yards} on the ground!",
      "Wide open lanes. {yards} yards, no contest!",
      "The defense was in coverage. {yards}-yard gash!",
      "Not a defender near the line. {yards} yards!",
      "They bit on pass. {yards} yards on the run!",
      "The wrong defense on the field. {yards} free yards!",
      "That play call left the defense looking silly. {yards}!",
    ],
    pass: [
      "Stacked in the box. Receivers wide open for {yards}!",
      "All that run support left the secondary exposed. {yards}!",
      "Easy pickings through the air. {yards} yards!",
      "The defense sold out for run. {yards} passing!",
      "Wide open downfield. {yards}-yard gain!",
      "Run defense left the passing lanes open. {yards}!",
      "The offense took what the defense gave them. {yards}!",
      "Nobody within ten yards of the receiver. {yards} easy!",
    ],
  },
}
