// packages/client/src/games/playcaller/play-by-play/matchup-messages.ts
//
// Generic matchup overlay messages used when the defense correctly reads the offense
// (defense_read) or the offense completely fools the defense (offense_fooled).
// These fire at ~100% rate when the matchup condition is met and no play-specific
// matchupOutcome messages exist.

import type { MatchupQuality } from "./types"
import type { PlayAxis } from "./circumstance-messages"

/**
 * Generic matchup messages keyed by quality and axis.
 * Provides at least 5 distinct messages per combination for variety.
 */
export const matchupMessages: Record<MatchupQuality, Record<PlayAxis, string[]>> = {
  defense_read: {
    run: [
      "The defense had that run sniffed out from the start!",
      "They stacked the box and won — nowhere to go.",
      "Perfect read by the front seven. That run was dead on arrival.",
      "The defense sold out to stop the run and it paid off.",
      "Every gap was filled — the defense knew exactly what was coming.",
      "The linebackers read their keys perfectly on that one.",
      "That's what happens when the defense is in the right look — total shutdown.",
    ],
    pass: [
      "The secondary was sitting on that route the whole way!",
      "The defense had the coverage dialed in perfectly.",
      "That's a textbook defensive read — they knew pass all the way.",
      "The defensive backs were in position before the ball left his hand.",
      "Perfect coverage call — the defense had that locked down.",
      "The pass rush and coverage worked together beautifully on that play.",
      "The defense read the pass and made the offense pay for it.",
    ],
  },

  offense_fooled: {
    run: [
      "The defense was completely fooled — nobody in position to make a play!",
      "They sold out for the pass and got gashed on the ground!",
      "Wide open running lanes — the defense was caught in coverage!",
      "The defense was looking pass the whole time — easy yards on the ground!",
      "Not a defender within five yards of the line of scrimmage!",
      "The secondary is backpedaling while the runner has a clean lane!",
      "The defense bit hard on pass — the run game feasts!",
    ],
    pass: [
      "The defense was stacked in the box — wide open receivers everywhere!",
      "They committed to stopping the run and got torched through the air!",
      "All that run support left the secondary exposed!",
      "The defense had everyone near the line — easy pickings in the passing game!",
      "The play-action had them frozen — receivers running free!",
      "With the defense selling out against the run, the passing lanes are wide open!",
      "The defensive coordinator gambled on run and the offense made them pay!",
    ],
  },
}
