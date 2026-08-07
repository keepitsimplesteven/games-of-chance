// packages/client/src/games/playcaller/play-by-play/messages.ts
//
// Play-by-play announcer commentary keyed by play display name.
// Start with Fly Route as proof of concept — other plays will return undefined
// and the UI gracefully shows nothing.

import type { PlayByPlayMessages } from "./types"

/**
 * Registry of play-by-play commentary.
 * Key = displayName from offense/defense-names (e.g. "Fly Route", "HB Dive").
 * Value = message pools for each phase of the play.
 *
 * To add commentary for a new play, add an entry here with the exact displayName.
 */
export const playByPlayRegistry: Record<string, PlayByPlayMessages> = {
  "Fly Route": {
    preSnap: [
      "Offense lines up, star WR in the slot...",
      "Receivers spread wide, the crowd holds its breath...",
      "Shotgun formation, the WR motions to the boundary...",
      "Five wide, the defense is showing single high...",
      "The offense is going for it all here...",
    ],
    activePlay: [
      "QB rolls to his left and lets it fly...",
      "He drops back, steps up, and launches it deep...",
      "The ball is in the air, a beautiful spiral...",
      "He fires it downfield to the streaking receiver...",
      "Back to pass, pump fakes, and sends it long...",
    ],
    outcome: {
      big_gain: [
        "Caught for a huge gain! A {yards} yard pickup!",
        "He hauls it in! What a throw and catch for {yards}!",
        "Over the shoulder, got it! {yards} yards downfield!",
        "Snatched out of the air! A {yards} yard bomb!",
      ],
      small_gain: [
        "Caught, but the defender was right there. {yards} yards.",
        "He makes the grab but gets tackled short. {yards} yards.",
        "Brings it in for a modest {yards} yard gain.",
      ],
      touchdown: [
        "TOUCHDOWN! He's in! What a strike!",
        "Into the end zone! Nobody within 10 yards of him!",
        "He walks in untouched! TOUCHDOWN!",
        "Caught at the 5, spins... TOUCHDOWN!",
      ],
      incomplete: [
        "Just out of reach! The pass falls incomplete.",
        "Broken up by the defender! No catch.",
        "He couldn't hang on! Ball hits the turf.",
        "Overthrown! Nobody's catching that one.",
      ],
      negative: [
        "Sacked before he could throw! Loss on the play.",
        "The rush was too fast, he's brought down behind the line.",
      ],
      turnover: [
        "INTERCEPTED! The defender read it all the way!",
        "Picked off! He jumped the route perfectly!",
        "Turnover! That throw was into double coverage!",
        "He had his man but the ball is stolen away!",
      ],
    },
  },
}
