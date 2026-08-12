// packages/client/src/games/playcaller/play-by-play/circumstance-messages.ts

import type { Circumstance } from "../play-names/types"
import type { CommentaryPhase } from "./types"

/** Play axis — "run" or "pass" — derived from the offensive play slot */
export type PlayAxis = "run" | "pass"

/**
 * Circumstance-level commentary registry.
 * Provides at least 3 distinct messages per (Circumstance, Phase) combination.
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
      "The offense breaks the huddle and comes to the line.",
      "Both sides get set at the line of scrimmage.",
      "The play clock winds down as they settle in.",
    ],
    activePlay: [
      "The play develops as the line holds firm.",
      "He takes the snap and the play is underway.",
      "The ball is out — let's see what happens.",
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
      "He lowers his shoulder and attacks the line!",
      "The offensive line fires off the ball!",
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
      "The play develops behind a solid pocket.",
      "The back takes the handoff and looks for a lane.",
      "A quick-hitting play to move the chains.",
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
      "They need a chunk play here to stay alive.",
      "The offense tries to create something downfield.",
      "A lot of yardage to cover — can they do it?",
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
      "Everything is on the line!",
      "Scrambling, desperate to make something happen!",
      "The offense goes all-in — do or die!",
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
      "He lunges toward the goal line!",
      "A massive push at the goal line — bodies everywhere!",
      "The ball is stretched out, reaching for the plane!",
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

/**
 * Axis-specific activePlay messages by circumstance.
 * These override the generic activePlay messages from CircumstanceCommentary
 * when the play axis (run or pass) is known.
 */
export const CircumstanceActivePlayByAxis: Record<
  Circumstance,
  Record<PlayAxis, string[]>
> = {
  standard: {
    run: [
      "He takes the handoff and hits the hole.",
      "The running back looks for a seam in the defense.",
      "A designed run — the back follows his blockers.",
    ],
    pass: [
      "He drops back in the pocket looking downfield.",
      "Quick drop, eyes up, looking for a receiver.",
      "The quarterback surveys the field from the pocket.",
    ],
  },

  short_yardage: {
    run: [
      "He lowers his shoulder and attacks the line!",
      "The offensive line fires off the ball — power run!",
      "A quick push up the middle — fighting for every inch.",
    ],
    pass: [
      "A quick throw to the flat on short yardage.",
      "He fires it out quick — beating the blitz!",
      "A short throw over the middle — just need a few yards.",
    ],
  },

  medium_yardage: {
    run: [
      "The back takes the handoff and looks for a lane.",
      "Zone blocking opens a crease — the runner hits it.",
      "He follows the fullback through the B-gap.",
    ],
    pass: [
      "He works through his reads with a clean pocket.",
      "A quick route develops as the receiver makes his break.",
      "Stepping up, firing to the intermediate zone.",
    ],
  },

  long_yardage: {
    run: [
      "A draw play! Trying to catch the defense off guard.",
      "He takes the handoff on a designed delay.",
      "The runner bounces it outside, looking for a big gain.",
    ],
    pass: [
      "He's forced to throw it deep — needs a chunk play!",
      "Dropping back, looking for something downfield.",
      "The receivers are running full routes trying to get open.",
    ],
  },

  desperation: {
    run: [
      "A jet sweep! Trying to get the edge on fourth and long!",
      "He takes it himself and scrambles for everything he can get!",
      "A trick play — the runner needs a miracle!",
    ],
    pass: [
      "He heaves it downfield — everything is on the line!",
      "Scrambling, looking, desperate for an open man!",
      "All receivers are running go routes — they need a miracle!",
    ],
  },

  goal_line: {
    run: [
      "He lunges toward the goal line!",
      "A massive push at the goal line — bodies everywhere!",
      "The ball carrier dives toward the end zone!",
    ],
    pass: [
      "A fade to the corner of the end zone!",
      "He fires it quick to the back of the end zone!",
      "A play-action pass at the goal line — what a call!",
    ],
  },

  must_convert: {
    run: [
      "A gutsy run call on fourth down — here it comes!",
      "He's pushing forward with everything he's got!",
      "The line fires off the ball — total commitment on the ground!",
    ],
    pass: [
      "A quick pass on fourth down — gotta convert!",
      "He fires to the sticks — the chain gang is watching!",
      "A timing route on fourth down — it's now or never!",
    ],
  },
}
