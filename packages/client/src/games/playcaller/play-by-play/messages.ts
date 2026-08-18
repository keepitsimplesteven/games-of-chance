// packages/client/src/games/playcaller/play-by-play/messages.ts
//
// Play-by-play announcer commentary keyed by play display name.
// The "Default" entry is used as a fallback when a specific play has no
// registered messages — ensures every play gets commentary.

import type { CommentaryPhase, PlayByPlayMessages } from "./types"

/**
 * Registry of play-by-play commentary.
 * Key = displayName from offense/defense-names (e.g. "Fly Route", "HB Dive").
 * Value = message pools for each phase of the play.
 *
 * The "Default" key is the fallback used for any play without its own entry.
 * To add commentary for a new play, add an entry here with the exact displayName.
 */
export const playByPlayRegistry: Record<string, PlayByPlayMessages> = {
  "Default": {
    preSnap: [
      "The official sets the ball...",
      "Offense breaks the huddle...",
      "Both sides dig in...",
      "Play clock winding down...",
      "The offense gets set...",
      "Checking the defense...",
      "The quarterback barks out the cadence...",
      "A quick check at the line before the snap...",
    ],
    activePlay: [
      "Snap is clean, play is live...",
      "The ball is snapped...",
      "Here we go...",
      "The play develops...",
      "The offense makes their move...",
      "Execution underway...",
      "The blocking holds. The play takes shape...",
      "Everything in motion. Let's see the result...",
    ],
    outcome: {
      big_gain: [
        "A big pickup! {yards} yards!",
        "Chunk play! {yards} yards gained!",
        "Great execution for {yards}!",
        "{yards} yards. That moves the chains!",
        "Now that's what you draw up. {yards} yards!",
        "The offense is rolling. {yards} on the play!",
      ],
      small_gain: [
        "A gain of {yards}.",
        "Picks up {yards} on the play.",
        "Short gain. {yards} yards.",
        "{yards} yards. Keeps it moving.",
        "Not flashy but {yards} keeps the drive alive.",
        "Small ball. {yards} yards, stay on schedule.",
      ],
      touchdown: [
        "TOUCHDOWN! They punch it in!",
        "Into the end zone! TOUCHDOWN!",
        "That's six! TOUCHDOWN!",
        "Score! They find the end zone!",
        "TOUCHDOWN! The offense finishes the drive!",
        "And that'll be six points! What a drive!",
      ],
      incomplete: [
        "Pass falls incomplete.",
        "No catch. Ball hits the ground.",
        "Incomplete. Defense holds.",
        "The pass is batted away!",
        "Can't connect. The ball hits the turf.",
        "Off target. Another incomplete pass.",
      ],
      negative: [
        "Loss on the play! Back {yards}.",
        "Stuffed! A {yards}-yard loss.",
        "The defense wins. Loss of {yards}.",
        "Behind the line. Minus {yards}.",
        "Going backwards. A {yards}-yard setback.",
        "The defense got there first. Minus {yards}.",
      ],
      turnover: [
        "TURNOVER! The defense has it!",
        "Takeaway! Drive is over!",
        "The defense comes up with the ball!",
        "Turnover! What a play by the defense!",
        "That's a game-changing turnover!",
        "The defense takes it away. Drive over.",
      ],
      turnover_on_downs: [
        "Turnover on downs!",
        "They come up short on 4th!",
        "The defense holds! Turnover on downs!",
        "Can't convert. Ball goes over.",
        "Fourth down and they couldn't get it done.",
        "The gamble doesn't pay off. Turnover on downs.",
      ],
      first_down: [
        "First down! {yards} yards, chains move.",
        "That's a first! {yards}-yard gain.",
        "They pick up the first. {yards} yards.",
        "{yards} yards. New set of downs.",
        "The chains move. {yards} yards does the trick.",
        "Fresh set of downs after a {yards}-yard gain.",
      ],
    },
  },

  "Fly Route": {
    preSnap: [
      "Star WR in the slot...",
      "Receivers spread wide...",
      "Five wide. Single high safety...",
      "The speedster lines up outside...",
    ],
    activePlay: [
      "He lets it fly deep!",
      "Launches it downfield!",
      "Ball in the air, beautiful spiral...",
      "The receiver has a step. Here it comes!",
    ],
    outcome: {
      big_gain: [
        "He hauls it in! {yards} yards!",
        "Over the shoulder. {yards}-yard bomb!",
        "Caught deep for {yards}!",
      ],
      small_gain: [
        "Caught but tackled quick. {yards}.",
        "Makes the grab for {yards}.",
      ],
      touchdown: [
        "TOUCHDOWN! What a strike!",
        "Into the end zone untouched!",
        "Caught. Score! TOUCHDOWN!",
      ],
      incomplete: [
        "Just out of reach! Incomplete.",
        "Broken up! No catch.",
        "Overthrown! Nobody catching that.",
      ],
      negative: [
        "Sacked before the throw! Loss of {yards}.",
      ],
      turnover: [
        "INTERCEPTED! Defender read it all the way!",
        "Picked off! He jumped the route!",
        "Into double coverage and it's picked!",
      ],
      turnover_on_downs: [
        "Can't connect deep. Turnover on downs.",
      ],
      first_down: [
        "Caught for the first down! {yards} yards!",
        "He reels it in for {yards}. First down!",
      ],
    },
  },
}

/**
 * Default generic commentary for the tier system (preSnap + activePlay only).
 * This is the guaranteed fallback tier that terminates the cascade for
 * preSnap and activePlay phases.
 *
 * NOTE: The outcome phase is NOT resolved through this flat array system.
 * Outcomes always use the OutcomeCategory-keyed messages from
 * playByPlayRegistry["Default"].outcome to ensure commentary matches
 * what actually happened on the play.
 */
export const defaultMessages: Record<CommentaryPhase, string[]> = {
  preSnap: [
    "The official sets the ball...",
    "Offense breaks the huddle...",
    "Both sides dig in...",
    "Play clock winding down...",
    "The offense gets set...",
    "Checking the defense...",
    "The quarterback barks out the cadence...",
    "A quick check at the line before the snap...",
  ],
  activePlay: [
    "Snap is clean, play is live...",
    "The ball is snapped...",
    "Here we go...",
    "The play develops...",
    "The offense makes their move...",
    "Execution underway...",
    "The blocking holds. The play takes shape...",
    "Everything in motion. Let's see the result...",
  ],
  outcome: [
    "The play is over.",
    "Back to the huddle.",
    "Reset the chains.",
    "That's the end of the play.",
    "The whistle blows.",
    "Both teams reset for the next snap.",
    "The officials mark the spot.",
  ],
}