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
    ],
    activePlay: [
      "Snap is clean, play is live...",
      "The ball is snapped...",
      "Here we go...",
      "The play develops...",
      "The offense makes their move...",
      "Execution underway...",
    ],
    outcome: {
      big_gain: [
        "A big pickup! {yards} yards!",
        "Chunk play! {yards} yards gained!",
        "Great execution for {yards}!",
        "{yards} yards. That moves the chains!",
      ],
      small_gain: [
        "A gain of {yards}.",
        "Picks up {yards} on the play.",
        "Short gain. {yards} yards.",
        "{yards} yards. Keeps it moving.",
      ],
      touchdown: [
        "TOUCHDOWN! They punch it in!",
        "Into the end zone! TOUCHDOWN!",
        "That's six! TOUCHDOWN!",
        "Score! They find the end zone!",
      ],
      incomplete: [
        "Pass falls incomplete.",
        "No catch. Ball hits the ground.",
        "Incomplete. Defense holds.",
        "The pass is batted away!",
      ],
      negative: [
        "Loss on the play! Back {yards}.",
        "Stuffed! A {yards}-yard loss.",
        "The defense wins. Loss of {yards}.",
        "Behind the line. Minus {yards}.",
      ],
      turnover: [
        "TURNOVER! The defense has it!",
        "Takeaway! Drive is over!",
        "The defense comes up with the ball!",
        "Turnover! What a play by the defense!",
      ],
      turnover_on_downs: [
        "Turnover on downs!",
        "They come up short on 4th!",
        "The defense holds! Turnover on downs!",
        "Can't convert. Ball goes over.",
      ],
      first_down: [
        "First down! {yards} yards, chains move.",
        "That's a first! {yards}-yard gain.",
        "They pick up the first. {yards} yards.",
        "{yards} yards. New set of downs.",
      ],
    },
  },

  "Fly Route": {
    preSnap: [
      "Star WR in the slot...",
      "Receivers spread wide...",
      "Five wide. Single high safety...",
    ],
    activePlay: [
      "He lets it fly deep!",
      "Launches it downfield!",
      "Ball in the air, beautiful spiral...",
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
  ],
  activePlay: [
    "Snap is clean, play is live...",
    "The ball is snapped...",
    "Here we go...",
    "The play develops...",
    "The offense makes their move...",
    "Execution underway...",
  ],
  outcome: [
    "The play is over.",
    "Back to the huddle.",
    "Reset the chains.",
    "That's the end of the play.",
    "The whistle blows.",
  ],
}
