// packages/client/src/games/playcaller/play-by-play/circumstance-messages.ts

import type { Circumstance } from "../play-names/types"
import type { CommentaryPhase } from "./types"

/** Play axis — "run" or "pass" — derived from the offensive play slot */
export type PlayAxis = "run" | "pass"

/**
 * Circumstance-level commentary registry.
 * 6–10 messages per (Circumstance, Phase) combination.
 * Used as the middle tier (30% weight) in the commentary cascade.
 *
 * NOTE: activePlay messages here are generic fallbacks. Prefer the axis-specific
 * messages from CircumstanceActivePlayByAxis when a play axis is known.
 */
export const CircumstanceCommentary: Record<
  Circumstance,
  Record<CommentaryPhase, string[]>
> = {
  standard: {
    preSnap: [
      "Offense breaks the huddle.",
      "Both sides set at the line.",
      "Play clock winding down.",
      "Lined up, ready to go.",
      "The offense gets set.",
      "Standard formation here.",
      "Nothing fancy. They line up and get ready.",
    ],
    activePlay: [
      "The play develops.",
      "Snap is away, here we go.",
      "Ball is snapped, play underway.",
      "He takes the snap cleanly.",
      "The play unfolds.",
      "Action at the line.",
    ],
    outcome: [
      "Solid execution. {yards} yards.",
      "A routine {yards}-yard play.",
      "They'll take {yards} there.",
      "Nothing spectacular but {yards} works.",
      "Clean play for {yards}.",
      "Steady. {yards} yards on the play.",
    ],
  },

  short_yardage: {
    preSnap: [
      "Just a yard or two needed.",
      "The big guys up front lean in.",
      "Short yardage. The box is loaded.",
      "They crowd the line.",
      "Bodies packed tight at the point of attack.",
      "Less than three to go.",
      "A war in the trenches coming.",
    ],
    activePlay: [
      "He attacks the line!",
      "The O-line fires off the ball!",
      "A quick push forward.",
      "Fighting for inches.",
      "He lowers his pad level and drives.",
      "Pure power football.",
    ],
    outcome: [
      "Physical play. {yards} gained.",
      "Gritty stuff. {yards} yards.",
      "They muscle out {yards}.",
      "That's tough football for {yards}.",
      "{yards} yards in the trenches.",
      "Short and sweet. {yards}.",
    ],
  },

  medium_yardage: {
    preSnap: [
      "Manageable distance here.",
      "Three to five yards needed.",
      "Plenty of options at this distance.",
      "A play-caller's sweet spot.",
      "Medium yardage. Should be doable.",
      "Not too far. The offense has choices.",
    ],
    activePlay: [
      "The play develops nicely.",
      "He finds his target.",
      "Good execution at the snap.",
      "Clean handoff, quick read.",
      "The offense goes to work.",
      "Smooth operation.",
    ],
    outcome: [
      "Well-run play. {yards} yards.",
      "{yards} on the play. Good work.",
      "They handle medium distance. {yards}.",
      "Clean execution for {yards}.",
      "Solid fundamentals. {yards} gained.",
      "{yards} yards. Right on schedule.",
    ],
  },

  long_yardage: {
    preSnap: [
      "A lot of ground to cover.",
      "Long way to go here.",
      "The defense sits back and dares them.",
      "They need a chunk play.",
      "Tough ask with this much yardage.",
      "Behind the chains. They need yards.",
      "The defense can afford to be patient.",
    ],
    activePlay: [
      "They need a big one here.",
      "Trying to create something.",
      "The offense takes a shot.",
      "Going for it all.",
      "Reaching for a chunk play.",
      "A lot to make up.",
    ],
    outcome: [
      "Tough distance. {yards} on the play.",
      "{yards} yards. Was it enough?",
      "They get {yards} but needed more.",
      "A {yards}-yard effort in a long situation.",
      "{yards} gained. Still work to do.",
      "Fighting back. {yards} yards.",
    ],
  },

  desperation: {
    preSnap: [
      "Fourth and long. Do or die.",
      "This could be the ballgame.",
      "Desperation time.",
      "They have to make something happen.",
      "Everything on the line here.",
      "Last chance. No tomorrow.",
      "Win or go home on this play.",
    ],
    activePlay: [
      "Everything is on the line!",
      "Scrambling, trying to make something happen!",
      "All-in on this one!",
      "The offense goes for broke!",
      "Heart pounding. This is it.",
      "No holding back.",
    ],
    outcome: [
      "Desperation. {yards} yards on the play.",
      "Backs against the wall. {yards} gained.",
      "{yards} yards. Did it save the drive?",
      "A defining moment. {yards}.",
      "Do or die got them {yards}.",
      "Under pressure. {yards} yards.",
    ],
  },

  goal_line: {
    preSnap: [
      "Inside the five. So close.",
      "Goal line stand time.",
      "On the doorstep of the end zone.",
      "The defense digs in at the goal line.",
      "Inches from paydirt.",
      "Red zone offense time.",
      "Can they punch it in?",
    ],
    activePlay: [
      "He lunges for the goal line!",
      "A massive push. Bodies everywhere!",
      "Reaching for the plane!",
      "Goal line chaos!",
      "Stretching the ball out!",
      "The pile surges forward!",
    ],
    outcome: [
      "Goal line football. {yards} yards.",
      "Every inch matters here. {yards} gained.",
      "Physical at the goal line. {yards}.",
      "{yards} yards in the red zone.",
      "Brutal at the stripe. {yards}.",
      "Close quarters. {yards} on the play.",
    ],
  },

  must_convert: {
    preSnap: [
      "Fourth and short. Must have it.",
      "Convert or give it back.",
      "The chains are watching.",
      "No margin for error.",
      "This is a must-convert play.",
      "The drive hangs in the balance.",
      "One shot to keep it alive.",
    ],
    activePlay: [
      "Gutsy call. Here it comes!",
      "Pushing forward with everything!",
      "Total commitment!",
      "Fourth down, all effort!",
      "No hesitation. He goes for it.",
      "Maximum effort on this play.",
    ],
    outcome: [
      "Fourth down football. {yards} yards.",
      "{yards} on the conversion attempt.",
      "Guts and execution. {yards}.",
      "A {yards}-yard effort when it counted.",
      "Character play. {yards} gained.",
      "Fourth down. {yards} yards.",
    ],
  },
}

/**
 * Axis-specific activePlay messages by circumstance.
 * These override the generic activePlay messages from CircumstanceCommentary
 * when the play axis (run or pass) is known.
 * 6–8 messages per (circumstance, axis) combo.
 */
export const CircumstanceActivePlayByAxis: Record<
  Circumstance,
  Record<PlayAxis, string[]>
> = {
  standard: {
    run: [
      "He takes the handoff and hits the hole.",
      "The back looks for a seam.",
      "A designed run. Follows his blockers.",
      "Handoff clean. The runner presses forward.",
      "He gets the carry and reads the blocks.",
      "Between the tackles he goes.",
    ],
    pass: [
      "He drops back looking downfield.",
      "Quick drop, eyes up.",
      "From the pocket, he surveys the field.",
      "Setting up to throw.",
      "He scans the secondary.",
      "Clean pocket. He lets it fly.",
    ],
  },

  short_yardage: {
    run: [
      "He lowers his shoulder and drives!",
      "The O-line fires. Power run!",
      "A quick push up the gut.",
      "He churns his legs at the line.",
      "Downhill. No dancing.",
      "Straight ahead. Full power.",
    ],
    pass: [
      "Quick throw to the flat.",
      "He fires it out fast.",
      "Short toss over the middle.",
      "A dart to the first-down marker.",
      "Quick release on short yardage.",
      "He zips it to the open man.",
    ],
  },

  medium_yardage: {
    run: [
      "The back takes the handoff and reads.",
      "Zone blocking opens a crease.",
      "He follows the fullback through.",
      "A patient run. Waiting for the hole.",
      "He presses the line then cuts.",
      "Following his blocks well.",
    ],
    pass: [
      "He works through his reads.",
      "The receiver makes his break.",
      "Stepping up and firing.",
      "He finds the intermediate window.",
      "Nice route develops. He throws.",
      "Timing throw to the open zone.",
    ],
  },

  long_yardage: {
    run: [
      "A draw play! Trying to catch them off guard.",
      "Delayed handoff. Looking for a big lane.",
      "He bounces it outside, seeking a chunk.",
      "The runner tries to create something.",
      "Misdirection run on long yardage.",
      "He takes the carry and freelances.",
    ],
    pass: [
      "He needs a chunk play. Fires deep!",
      "Dropping back, looking downfield.",
      "The receivers run full routes.",
      "He steps up and launches one.",
      "Going for the first on one throw.",
      "Deep shot. He lets it go.",
    ],
  },

  desperation: {
    run: [
      "Jet sweep! Going for the edge!",
      "He takes it himself and scrambles!",
      "A trick play! The runner needs a miracle!",
      "All-out effort on the ground!",
      "He's trying to make something from nothing!",
      "Running for his life out there!",
    ],
    pass: [
      "He heaves it downfield!",
      "Scrambling, desperate for an open man!",
      "All receivers going deep!",
      "He launches it and prays!",
      "Nothing to lose. He fires!",
      "A prayer downfield!",
    ],
  },

  goal_line: {
    run: [
      "He lunges for the goal line!",
      "Massive push. Bodies everywhere!",
      "The ball carrier dives for the end zone!",
      "He leaps over the pile!",
      "Stretching the ball toward the line!",
      "Goal line power. He drives forward!",
    ],
    pass: [
      "Fade to the corner of the end zone!",
      "Quick throw to the back of the end zone!",
      "Play-action at the goal line!",
      "A dart to the end zone!",
      "He fires it into the back corner!",
      "End zone target. He lets it rip!",
    ],
  },

  must_convert: {
    run: [
      "Gutsy run call on fourth down!",
      "Pushing forward with everything!",
      "The line fires. Total commitment!",
      "Fourth down run. He attacks!",
      "Power on fourth. All effort!",
      "No hesitation. He plows ahead!",
    ],
    pass: [
      "Quick pass on fourth. Gotta convert!",
      "He fires to the sticks!",
      "Timing route on fourth down!",
      "He guns it to the marker!",
      "Fourth down throw. No fear!",
      "A pass to move the chains!",
    ],
  },
}
