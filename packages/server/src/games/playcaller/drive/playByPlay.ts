import type { PlayOutcome, OffensivePlayId, DefensivePlayId } from "./types"

/** Maps each PlayOutcome to an array of template strings with {yards} placeholder */
export type PlayByPlayTemplates = Record<PlayOutcome, string[]>

/** Default template strings for each outcome type */
export const DEFAULT_TEMPLATES: PlayByPlayTemplates = {
  success: [
    "Gains {yards} yards on the play.",
    "A {yards}-yard pickup.",
    "Moves the chains for {yards} yards.",
  ],
  critical_success: [
    "BREAKAWAY! A huge {yards}-yard gain!",
    "Breaks through for {yards} yards!",
    "What a play! {yards} yards downfield!",
  ],
  incomplete_pass: [
    "Pass falls incomplete.",
    "The throw is off target. Incomplete.",
    "Dropped! The receiver couldn't hang on.",
  ],
  tackle_for_loss: [
    "Tackled for a loss of {yards} yards!",
    "Stuffed in the backfield! Loses {yards} yards.",
    "Brought down behind the line for -{yards}.",
  ],
  interception: [
    "INTERCEPTED! The defense picks it off!",
    "Picked! That pass is intercepted!",
    "Turnover! The ball is intercepted.",
  ],
  fumble: [
    "FUMBLE! The ball is loose and the defense recovers!",
    "Strips the ball! Fumble recovered by the defense!",
    "The ball comes free! Fumble!",
  ],
}

/** Input for generating play-by-play text (subset of PlayResult without playByPlayText) */
export interface PlayByPlayInput {
  outcome: PlayOutcome
  yardsGained: number
  offensivePlay: OffensivePlayId
  defensivePlay: DefensivePlayId
}

/**
 * Generates play-by-play text from a play result.
 *
 * Deterministic: same inputs always produce the same output.
 * Template selection is based on a hash derived from play details.
 * Replaces {yards} with the absolute value of yardsGained.
 */
export function generatePlayByPlay(
  result: PlayByPlayInput,
  templates: PlayByPlayTemplates = DEFAULT_TEMPLATES
): string {
  const { outcome, yardsGained, offensivePlay, defensivePlay } = result
  const templateList = templates[outcome]

  // Deterministic template selection based on play details
  const index =
    (offensivePlay.charCodeAt(0) +
      defensivePlay.charCodeAt(0) +
      Math.abs(yardsGained)) %
    templateList.length

  const template = templateList[index]

  // Replace {yards} with the absolute value of yardsGained
  return template.replace(/\{yards\}/g, String(Math.abs(yardsGained)))
}
