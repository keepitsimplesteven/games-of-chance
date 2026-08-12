// packages/client/src/games/playcaller/play-by-play/circumstance-messages.ts

import type { Circumstance } from "../play-names/types"
import type { CommentaryPhase } from "./types"

/**
 * Circumstance-level commentary registry.
 * Provides at least 3 distinct messages per (Circumstance, Phase) combination.
 * Used as the middle tier (30% weight) in the commentary cascade.
 */
export const CircumstanceCommentary: Record<
  Circumstance,
  Record<CommentaryPhase, string[]>
> = {
  standard: {
    preSnap: [
      "Offense lines up in a standard formation, nothing fancy here.",
      "A routine down-and-distance situation for the offense.",
      "They come to the line with plenty of options available.",
    ],
    activePlay: [
      "The play develops as the line holds firm.",
      "He's looking downfield with time in the pocket.",
      "The ball carrier hits the gap and pushes forward.",
    ],
    outcome: [
      "A solid play on a straightforward down.",
      "They'll take that and move the chains.",
      "Just another day at the office for this offense.",
    ],
  },

  short_yardage: {
    preSnap: [
      "They just need a yard or two here.",
      "Short yardage situation — the big guys up front will earn their paycheck.",
      "Less than three yards to go, they're loading up the box.",
    ],
    activePlay: [
      "He lowers his shoulder and drives forward!",
      "The offensive line surges ahead, creating a crease.",
      "A quick push up the middle — fighting for every inch.",
    ],
    outcome: [
      "Tough, physical football right there.",
      "That's the kind of gritty play that wins games.",
      "Short and sweet — exactly what they needed.",
    ],
  },

  medium_yardage: {
    preSnap: [
      "A manageable distance here — three to five yards needed.",
      "They've got options with this kind of yardage to cover.",
      "Not too long, not too short — a play-caller's sweet spot.",
    ],
    activePlay: [
      "He's working through his reads with a clean pocket.",
      "The back takes the handoff and finds a lane.",
      "A quick route develops as the receiver makes his break.",
    ],
    outcome: [
      "A well-executed play on a medium-distance down.",
      "They handled that manageable yardage with ease.",
      "Good fundamentals on a routine conversion opportunity.",
    ],
  },

  long_yardage: {
    preSnap: [
      "A lot of ground to cover on this play.",
      "Third and long — they'll need a big play here.",
      "The defense is sitting back, daring them to earn it.",
    ],
    activePlay: [
      "He's forced to throw it deep — needs a chunk play!",
      "Dropping back, looking for something downfield.",
      "The receivers are running full routes trying to get open.",
    ],
    outcome: [
      "A tough ask when you're facing that kind of distance.",
      "Long yardage situations always test an offense's resolve.",
      "That's the challenge when you fall behind the chains.",
    ],
  },

  desperation: {
    preSnap: [
      "Fourth and long — it's do or die right here.",
      "This could be the ballgame if they don't convert.",
      "Desperation time. They have to make something happen.",
    ],
    activePlay: [
      "He heaves it downfield — everything is on the line!",
      "Scrambling, looking, desperate for an open man!",
      "All receivers are running go routes — they need a miracle!",
    ],
    outcome: [
      "That's what happens when your back is against the wall.",
      "Desperation plays rarely end well, but you have to try.",
      "A defining moment in this drive, one way or another.",
    ],
  },

  goal_line: {
    preSnap: [
      "They're on the doorstep — inside the five-yard line.",
      "Goal line stand time — the defense digs in.",
      "So close to the end zone, you can taste it.",
    ],
    activePlay: [
      "He dives for the pylon!",
      "A massive push at the goal line — bodies everywhere!",
      "Stretching the ball out, trying to break the plane!",
    ],
    outcome: [
      "Goal line football is as physical as it gets.",
      "Every inch matters this close to paydirt.",
      "The red zone is where championships are won and lost.",
    ],
  },

  must_convert: {
    preSnap: [
      "Fourth and short — they absolutely have to get this.",
      "No margin for error. Convert or hand it over.",
      "The chains are watching. This is a must-have play.",
    ],
    activePlay: [
      "A gutsy call on fourth down — here it comes!",
      "He's pushing forward with everything he's got!",
      "The line fires off the ball — total commitment!",
    ],
    outcome: [
      "That's the kind of play that defines a drive.",
      "Fourth down conversions take guts and execution.",
      "When you have to have it, character shows up.",
    ],
  },
}
