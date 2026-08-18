// packages/client/src/games/playcaller/play-names/offense-names.ts

import type { PlayDefinition, PlayPool } from "./types"
import type { PlayArtData } from "../play-art/types"

// All 7 circumstances for reference:
// "standard" | "short_yardage" | "medium_yardage" | "long_yardage" | "desperation" | "goal_line" | "must_convert"

// ─── Run-Safe ───────────────────────────────────────────────────────────────

const runSafe: PlayDefinition[] = [
  {
    displayName: "HB Dive",
    formation: "I-Formation",
    circumstances: ["standard", "short_yardage", "medium_yardage", "goal_line"],
    weight: 1,
    playArt: {
      markers: [
        // Offensive line (5 linemen)
        { position: { x: 35, y: 50 }, shape: "square" },
        { position: { x: 42, y: 50 }, shape: "square" },
        { position: { x: 50, y: 50 }, shape: "square" }, // Center
        { position: { x: 58, y: 50 }, shape: "square" },
        { position: { x: 65, y: 50 }, shape: "square" },
        // QB
        { position: { x: 50, y: 55 }, shape: "circle" },
        // FB
        { position: { x: 50, y: 60 }, shape: "circle" },
        // HB (highlighted - ball carrier)
        { position: { x: 50, y: 65 }, shape: "circle", highlighted: true },
      ],
      routes: [
        // HB dives straight through A-gap
        { from: { x: 50, y: 65 }, to: { x: 50, y: 40 }, style: "arrow" },
        // FB lead block
        { from: { x: 50, y: 60 }, to: { x: 50, y: 45 }, style: "arrow" },
      ],
      lineOfScrimmage: 50,
    },
    messages: {
      preSnap: ["Fullback lines up in front of the tailback..."],
      activePlay: ["Handoff. He hits the hole!"],
      matchupOutcome: {
        offense_fooled: [
          "Nobody home in the box. {yards} yards!",
          "The run game feasts on pass coverage. {yards}!",
        ],
      },
    },
  },
  {
    displayName: "QB Sneak",
    formation: "Under Center",
    circumstances: ["short_yardage", "goal_line", "must_convert"],
    weight: 2,
    playArt: {
      markers: [
        { position: { x: 35, y: 50 }, shape: "square" },
        { position: { x: 42, y: 50 }, shape: "square" },
        { position: { x: 50, y: 50 }, shape: "square" },
        { position: { x: 58, y: 50 }, shape: "square" },
        { position: { x: 65, y: 50 }, shape: "square" },
        // QB highlighted - ball carrier on sneak
        { position: { x: 50, y: 52 }, shape: "circle", highlighted: true },
      ],
      routes: [
        // QB tiny push forward behind center
        { from: { x: 50, y: 52 }, to: { x: 50, y: 48 }, style: "arrow" },
      ],
      lineOfScrimmage: 50,
    },
    messages: {
      preSnap: ["QB under center. The line tightens..."],
      activePlay: ["He lunges forward!"],
    },
  },
  {
    displayName: "Inside Zone",
    formation: "Singleback",
    circumstances: ["standard", "medium_yardage", "long_yardage"],
    weight: 1,
    playArt: {
      markers: [
        { position: { x: 35, y: 50 }, shape: "square" },
        { position: { x: 42, y: 50 }, shape: "square" },
        { position: { x: 50, y: 50 }, shape: "square" },
        { position: { x: 58, y: 50 }, shape: "square" },
        { position: { x: 65, y: 50 }, shape: "square" },
        { position: { x: 50, y: 55 }, shape: "circle" }, // QB
        // RB highlighted
        { position: { x: 50, y: 60 }, shape: "circle", highlighted: true },
        // WR left
        { position: { x: 15, y: 50 }, shape: "circle" },
      ],
      routes: [
        // RB reads the zone block and cuts inside
        { from: { x: 50, y: 60 }, to: { x: 47, y: 40 }, style: "arrow" },
        // Linemen zone blocking angles
        { from: { x: 42, y: 50 }, to: { x: 40, y: 45 }, style: "dashed" },
        { from: { x: 50, y: 50 }, to: { x: 48, y: 45 }, style: "dashed" },
      ],
      lineOfScrimmage: 50,
    },
  },
  {
    displayName: "Iso Run",
    formation: "I-Formation Strong",
    circumstances: ["standard", "short_yardage", "must_convert"],
    weight: 1,
    playArt: {
      markers: [
        { position: { x: 35, y: 50 }, shape: "square" },
        { position: { x: 42, y: 50 }, shape: "square" },
        { position: { x: 50, y: 50 }, shape: "square" },
        { position: { x: 58, y: 50 }, shape: "square" },
        { position: { x: 65, y: 50 }, shape: "square" },
        { position: { x: 50, y: 55 }, shape: "circle" }, // QB
        // FB - lead blocker isolating the LB
        { position: { x: 50, y: 60 }, shape: "circle" },
        // HB highlighted
        { position: { x: 50, y: 65 }, shape: "circle", highlighted: true },
      ],
      routes: [
        // FB leads into B-gap to isolate linebacker
        { from: { x: 50, y: 60 }, to: { x: 55, y: 43 }, style: "arrow" },
        // HB follows FB through the hole
        { from: { x: 50, y: 65 }, to: { x: 55, y: 38 }, style: "arrow" },
      ],
      lineOfScrimmage: 50,
    },
  },
  {
    displayName: "Draw Play",
    formation: "Shotgun",
    circumstances: ["long_yardage", "desperation", "standard"],
    weight: 1,
    playArt: {
      markers: [
        { position: { x: 35, y: 50 }, shape: "square" },
        { position: { x: 42, y: 50 }, shape: "square" },
        { position: { x: 50, y: 50 }, shape: "square" },
        { position: { x: 58, y: 50 }, shape: "square" },
        { position: { x: 65, y: 50 }, shape: "square" },
        { position: { x: 50, y: 58 }, shape: "circle" }, // QB in shotgun
        // RB highlighted - delayed handoff
        { position: { x: 45, y: 58 }, shape: "circle", highlighted: true },
        // WR spread out
        { position: { x: 10, y: 50 }, shape: "circle" },
        { position: { x: 90, y: 50 }, shape: "circle" },
      ],
      routes: [
        // QB fakes pass then hands off
        { from: { x: 50, y: 58 }, to: { x: 50, y: 56 }, style: "dashed" },
        // RB delays then hits the gap
        { from: { x: 45, y: 58 }, to: { x: 48, y: 38 }, style: "arrow" },
      ],
      lineOfScrimmage: 50,
    },
    messages: {
      preSnap: ["Passing formation... but wait..."],
      activePlay: ["It's a draw! Defense bit on the pass look!"],
      matchupOutcome: {
        offense_fooled: [
          "They all dropped back. {yards} yards through the middle!",
          "Pass coverage everywhere. {yards} on the draw!",
          "The pass rush vanished. Draw rips through for {yards}!",
        ],
        defense_read: [
          "They didn't bite. Linebackers filled every gap.",
          "The defense read draw the whole way.",
        ],
      },
    },
  },
  {
    displayName: "Fullback Plunge",
    formation: "Goal Line",
    circumstances: ["goal_line", "short_yardage"],
    weight: 1,
    playArt: {
      markers: [
        { position: { x: 35, y: 50 }, shape: "square" },
        { position: { x: 42, y: 50 }, shape: "square" },
        { position: { x: 50, y: 50 }, shape: "square" },
        { position: { x: 58, y: 50 }, shape: "square" },
        { position: { x: 65, y: 50 }, shape: "square" },
        // Extra TE tight
        { position: { x: 70, y: 50 }, shape: "square" },
        { position: { x: 50, y: 53 }, shape: "circle" }, // QB
        // FB highlighted - plunging forward
        { position: { x: 50, y: 57 }, shape: "circle", highlighted: true },
      ],
      routes: [
        // FB plunges straight ahead through the pile
        { from: { x: 50, y: 57 }, to: { x: 50, y: 44 }, style: "arrow" },
      ],
      lineOfScrimmage: 50,
    },
  },
  {
    displayName: "Off Tackle Run",
    formation: "Strong I",
    circumstances: ["medium_yardage", "standard"],
    weight: 1,
    playArt: {
      markers: [
        { position: { x: 35, y: 50 }, shape: "square" },
        { position: { x: 42, y: 50 }, shape: "square" },
        { position: { x: 50, y: 50 }, shape: "square" },
        { position: { x: 58, y: 50 }, shape: "square" },
        { position: { x: 65, y: 50 }, shape: "square" },
        // TE on strong side
        { position: { x: 72, y: 50 }, shape: "square" },
        { position: { x: 50, y: 55 }, shape: "circle" }, // QB
        // FB
        { position: { x: 50, y: 60 }, shape: "circle" },
        // HB highlighted - running off tackle
        { position: { x: 50, y: 65 }, shape: "circle", highlighted: true },
      ],
      routes: [
        // HB runs off the tackle to the strong side
        { from: { x: 50, y: 65 }, to: { x: 68, y: 40 }, style: "arrow" },
        // FB kicks out the edge defender
        { from: { x: 50, y: 60 }, to: { x: 70, y: 47 }, style: "arrow" },
      ],
      lineOfScrimmage: 50,
    },
  },
  {
    displayName: "Delay Run",
    formation: "Shotgun",
    circumstances: ["desperation", "long_yardage"],
    weight: 1,
    playArt: {
      markers: [
        { position: { x: 35, y: 50 }, shape: "square" },
        { position: { x: 42, y: 50 }, shape: "square" },
        { position: { x: 50, y: 50 }, shape: "square" },
        { position: { x: 58, y: 50 }, shape: "square" },
        { position: { x: 65, y: 50 }, shape: "square" },
        { position: { x: 50, y: 58 }, shape: "circle" }, // QB
        // RB highlighted - delays then runs
        { position: { x: 55, y: 58 }, shape: "circle", highlighted: true },
        { position: { x: 15, y: 50 }, shape: "circle" }, // WR
        { position: { x: 85, y: 50 }, shape: "circle" }, // WR
      ],
      routes: [
        // RB waits (dashed pause) then hits hole
        { from: { x: 55, y: 58 }, to: { x: 55, y: 55 }, style: "dashed" },
        { from: { x: 55, y: 55 }, to: { x: 52, y: 40 }, style: "arrow" },
      ],
      lineOfScrimmage: 50,
    },
  },
  {
    displayName: "Sneak Keeper",
    formation: "Under Center",
    circumstances: ["must_convert", "goal_line"],
    weight: 1,
    playArt: {
      markers: [
        { position: { x: 35, y: 50 }, shape: "square" },
        { position: { x: 42, y: 50 }, shape: "square" },
        { position: { x: 50, y: 50 }, shape: "square" },
        { position: { x: 58, y: 50 }, shape: "square" },
        { position: { x: 65, y: 50 }, shape: "square" },
        // QB highlighted - keeps it himself
        { position: { x: 50, y: 52 }, shape: "circle", highlighted: true },
        // RB as decoy
        { position: { x: 45, y: 57 }, shape: "circle" },
      ],
      routes: [
        // QB fakes to RB then keeps right
        { from: { x: 50, y: 52 }, to: { x: 60, y: 45 }, style: "arrow" },
        // RB runs fake route left
        { from: { x: 45, y: 57 }, to: { x: 40, y: 50 }, style: "dashed" },
      ],
      lineOfScrimmage: 50,
    },
  },
]

// ─── Run-Aggressive ─────────────────────────────────────────────────────────

const runAggressive: PlayDefinition[] = [
  {
    displayName: "Stretch Run",
    formation: "Spread",
    circumstances: ["standard", "medium_yardage", "long_yardage"],
    weight: 1,
    playArt: {
      markers: [
        { position: { x: 35, y: 50 }, shape: "square" },
        { position: { x: 42, y: 50 }, shape: "square" },
        { position: { x: 50, y: 50 }, shape: "square" },
        { position: { x: 58, y: 50 }, shape: "square" },
        { position: { x: 65, y: 50 }, shape: "square" },
        { position: { x: 50, y: 58 }, shape: "circle" }, // QB
        // RB highlighted - stretching to the sideline
        { position: { x: 45, y: 58 }, shape: "circle", highlighted: true },
        { position: { x: 10, y: 50 }, shape: "circle" }, // WR
        { position: { x: 90, y: 50 }, shape: "circle" }, // WR
      ],
      routes: [
        // RB stretches wide to the left sideline
        { from: { x: 45, y: 58 }, to: { x: 20, y: 42 }, style: "arrow" },
        // Linemen zone stretch left
        { from: { x: 42, y: 50 }, to: { x: 35, y: 47 }, style: "dashed" },
        { from: { x: 50, y: 50 }, to: { x: 43, y: 47 }, style: "dashed" },
      ],
      lineOfScrimmage: 50,
    },
    messages: {
      activePlay: ["He bounces it outside!"],
      matchupOutcome: {
        offense_fooled: [
          "Nobody on the perimeter! {yards} yards!",
          "The outside is wide open. {yards}!",
          "Corners dropped back. Sideline is free for {yards}!",
        ],
      },
    },
  },
  {
    displayName: "Power Sweep",
    formation: "I-Formation",
    circumstances: ["short_yardage", "standard", "goal_line", "must_convert"],
    weight: 1,
    playArt: {
      markers: [
        { position: { x: 35, y: 50 }, shape: "square" },
        { position: { x: 42, y: 50 }, shape: "square" },
        { position: { x: 50, y: 50 }, shape: "square" },
        { position: { x: 58, y: 50 }, shape: "square" },
        { position: { x: 65, y: 50 }, shape: "square" },
        { position: { x: 50, y: 55 }, shape: "circle" }, // QB
        { position: { x: 50, y: 60 }, shape: "circle" }, // FB
        // HB highlighted - sweeping wide
        { position: { x: 50, y: 65 }, shape: "circle", highlighted: true },
      ],
      routes: [
        // Guards pull to lead the sweep
        { from: { x: 42, y: 50 }, to: { x: 25, y: 43 }, style: "arrow" },
        { from: { x: 58, y: 50 }, to: { x: 30, y: 45 }, style: "arrow" },
        // HB sweeps wide around the edge
        { from: { x: 50, y: 65 }, to: { x: 20, y: 38 }, style: "arrow" },
      ],
      lineOfScrimmage: 50,
    },
    messages: {
      preSnap: ["The guards are pulling..."],
      activePlay: ["Pulling guard leads the way!"],
      matchupOutcome: {
        offense_fooled: [
          "Guards pulled into open space. {yards} yards!",
          "Nobody in the box. Power wins for {yards}!",
          "The sweep has a wall of blockers. {yards} gained!",
        ],
      },
    },
  },
  {
    displayName: "Reverse",
    formation: "Shotgun Trips",
    circumstances: ["desperation", "long_yardage", "standard"],
    weight: 1,
    playArt: {
      markers: [
        { position: { x: 35, y: 50 }, shape: "square" },
        { position: { x: 42, y: 50 }, shape: "square" },
        { position: { x: 50, y: 50 }, shape: "square" },
        { position: { x: 58, y: 50 }, shape: "square" },
        { position: { x: 65, y: 50 }, shape: "square" },
        { position: { x: 50, y: 58 }, shape: "circle" }, // QB
        { position: { x: 85, y: 50 }, shape: "circle" }, // WR trips right
        { position: { x: 85, y: 47 }, shape: "circle" }, // WR trips right
        // WR on left - takes the reverse (highlighted)
        { position: { x: 15, y: 50 }, shape: "circle", highlighted: true },
      ],
      routes: [
        // Initial fake handoff right
        { from: { x: 50, y: 58 }, to: { x: 60, y: 55 }, style: "dashed" },
        // WR from left reverses across the field
        { from: { x: 15, y: 50 }, to: { x: 50, y: 53 }, style: "dashed" },
        { from: { x: 50, y: 53 }, to: { x: 80, y: 35 }, style: "arrow" },
      ],
      lineOfScrimmage: 50,
    },
    messages: {
      preSnap: ["Something tricky brewing..."],
      activePlay: ["It's a reverse! Defense caught flat-footed!"],
      matchupOutcome: {
        offense_fooled: [
          "Defense pulled the wrong way! {yards} yards!",
          "Misdirection perfect. {yards} on the reverse!",
          "Every defender flowing the wrong direction. {yards}!",
        ],
        defense_read: [
          "The end held his ground. Reverse goes nowhere.",
          "They didn't bite. Discipline wins.",
        ],
      },
    },
  },
  {
    displayName: "Jet Sweep",
    formation: "Pistol",
    circumstances: ["standard", "medium_yardage", "short_yardage"],
    weight: 1,
    playArt: {
      markers: [
        { position: { x: 35, y: 50 }, shape: "square" },
        { position: { x: 42, y: 50 }, shape: "square" },
        { position: { x: 50, y: 50 }, shape: "square" },
        { position: { x: 58, y: 50 }, shape: "square" },
        { position: { x: 65, y: 50 }, shape: "square" },
        { position: { x: 50, y: 55 }, shape: "circle" }, // QB pistol
        { position: { x: 50, y: 60 }, shape: "circle" }, // RB behind QB
        // WR in jet motion (highlighted)
        { position: { x: 30, y: 48 }, shape: "circle", highlighted: true },
      ],
      routes: [
        // WR jet motion across the formation then sweeps outside
        { from: { x: 30, y: 48 }, to: { x: 50, y: 50 }, style: "dashed" },
        { from: { x: 50, y: 50 }, to: { x: 85, y: 38 }, style: "arrow" },
      ],
      lineOfScrimmage: 50,
    },
    messages: {
      matchupOutcome: {
        offense_fooled: [
          "Jet motion had them lost. {yards} easy!",
          "Too much speed to the edge. {yards} yards!",
          "The defense couldn't adjust in time. {yards}!",
        ],
      },
    },
  },
  {
    displayName: "Counter Run",
    formation: "Strong I",
    circumstances: ["medium_yardage", "long_yardage", "must_convert"],
    weight: 1,
    playArt: {
      markers: [
        { position: { x: 35, y: 50 }, shape: "square" },
        { position: { x: 42, y: 50 }, shape: "square" },
        { position: { x: 50, y: 50 }, shape: "square" },
        { position: { x: 58, y: 50 }, shape: "square" },
        { position: { x: 65, y: 50 }, shape: "square" },
        { position: { x: 50, y: 55 }, shape: "circle" }, // QB
        { position: { x: 50, y: 60 }, shape: "circle" }, // FB
        // HB highlighted - fakes one way, cuts back
        { position: { x: 50, y: 65 }, shape: "circle", highlighted: true },
      ],
      routes: [
        // HB steps left (fake) then counters right
        { from: { x: 50, y: 65 }, to: { x: 40, y: 60 }, style: "dashed" },
        { from: { x: 40, y: 60 }, to: { x: 70, y: 38 }, style: "arrow" },
        // Guard pulls to lead the counter
        { from: { x: 42, y: 50 }, to: { x: 65, y: 43 }, style: "arrow" },
      ],
      lineOfScrimmage: 50,
    },
    messages: {
      matchupOutcome: {
        offense_fooled: [
          "Counter froze the defense. {yards} yards!",
          "They went left, runner cut right. {yards}!",
          "The misdirection had them all going the wrong way. {yards}!",
        ],
        defense_read: [
          "Backside LB tracked it perfectly. Nowhere to go.",
          "They read the pulling guard and blew it up.",
        ],
      },
    },
  },
  {
    displayName: "Toss Play",
    formation: "Spread",
    circumstances: ["goal_line", "short_yardage"],
    weight: 1,
    playArt: {
      markers: [
        { position: { x: 35, y: 50 }, shape: "square" },
        { position: { x: 42, y: 50 }, shape: "square" },
        { position: { x: 50, y: 50 }, shape: "square" },
        { position: { x: 58, y: 50 }, shape: "square" },
        { position: { x: 65, y: 50 }, shape: "square" },
        { position: { x: 50, y: 58 }, shape: "circle" }, // QB
        // RB highlighted - catching the toss wide
        { position: { x: 40, y: 58 }, shape: "circle", highlighted: true },
        { position: { x: 10, y: 50 }, shape: "circle" }, // WR blocking
      ],
      routes: [
        // QB tosses to RB
        { from: { x: 50, y: 58 }, to: { x: 40, y: 58 }, style: "dashed" },
        // RB takes toss and gets outside
        { from: { x: 40, y: 58 }, to: { x: 15, y: 38 }, style: "arrow" },
      ],
      lineOfScrimmage: 50,
    },
  },
  {
    displayName: "End Around",
    formation: "Shotgun Bunch",
    circumstances: ["desperation", "long_yardage"],
    weight: 1,
    playArt: {
      markers: [
        { position: { x: 35, y: 50 }, shape: "square" },
        { position: { x: 42, y: 50 }, shape: "square" },
        { position: { x: 50, y: 50 }, shape: "square" },
        { position: { x: 58, y: 50 }, shape: "square" },
        { position: { x: 65, y: 50 }, shape: "square" },
        { position: { x: 50, y: 58 }, shape: "circle" }, // QB
        // WR bunch right
        { position: { x: 80, y: 48 }, shape: "circle" },
        { position: { x: 80, y: 51 }, shape: "circle" },
        // WR taking the end around (highlighted)
        { position: { x: 80, y: 54 }, shape: "circle", highlighted: true },
      ],
      routes: [
        // WR comes in motion behind the line
        { from: { x: 80, y: 54 }, to: { x: 50, y: 60 }, style: "dashed" },
        // Then sprints around the left end
        { from: { x: 50, y: 60 }, to: { x: 15, y: 35 }, style: "arrow" },
      ],
      lineOfScrimmage: 50,
    },
  },
  {
    displayName: "Goal Line Blast",
    formation: "Goal Line",
    circumstances: ["goal_line", "must_convert"],
    weight: 2,
    playArt: {
      markers: [
        { position: { x: 30, y: 50 }, shape: "square" },
        { position: { x: 38, y: 50 }, shape: "square" },
        { position: { x: 46, y: 50 }, shape: "square" },
        { position: { x: 54, y: 50 }, shape: "square" },
        { position: { x: 62, y: 50 }, shape: "square" },
        { position: { x: 70, y: 50 }, shape: "square" }, // Extra lineman
        { position: { x: 50, y: 53 }, shape: "circle" }, // QB
        // FB
        { position: { x: 50, y: 56 }, shape: "circle" },
        // HB highlighted - diving over the top
        { position: { x: 50, y: 60 }, shape: "circle", highlighted: true },
      ],
      routes: [
        // Everyone pushes straight ahead
        { from: { x: 50, y: 60 }, to: { x: 50, y: 43 }, style: "arrow" },
        { from: { x: 50, y: 56 }, to: { x: 50, y: 46 }, style: "arrow" },
      ],
      lineOfScrimmage: 50,
    },
    messages: {
      activePlay: ["He launches over the pile!"],
      matchupOutcome: {
        offense_fooled: [
          "Defense spread for pass. No resistance! {yards}!",
          "The goal line push had nothing in front of it. {yards}!",
        ],
      },
    },
  },
]

// ─── Pass-Safe ──────────────────────────────────────────────────────────────

const passSafe: PlayDefinition[] = [
  {
    displayName: "Slant Route",
    formation: "Shotgun",
    circumstances: ["standard", "medium_yardage", "short_yardage"],
    weight: 1,
    playArt: {
      markers: [
        { position: { x: 35, y: 50 }, shape: "square" },
        { position: { x: 42, y: 50 }, shape: "square" },
        { position: { x: 50, y: 50 }, shape: "square" },
        { position: { x: 58, y: 50 }, shape: "square" },
        { position: { x: 65, y: 50 }, shape: "square" },
        { position: { x: 50, y: 58 }, shape: "circle" }, // QB
        { position: { x: 45, y: 58 }, shape: "circle" }, // RB
        // WR highlighted - running the slant
        { position: { x: 85, y: 50 }, shape: "circle", highlighted: true },
        { position: { x: 15, y: 50 }, shape: "circle" }, // Other WR
      ],
      routes: [
        // WR runs short then cuts inside on the slant
        { from: { x: 85, y: 50 }, to: { x: 82, y: 47 }, style: "arrow" },
        { from: { x: 82, y: 47 }, to: { x: 65, y: 40 }, style: "arrow" },
      ],
      lineOfScrimmage: 50,
    },
    messages: {
      activePlay: ["Quick throw to the slant!"],
      matchupOutcome: {
        offense_fooled: [
          "LBs crashed the line. Slant wide open for {yards}!",
          "Everyone keying run. The slant finds daylight for {yards}!",
        ],
      },
    },
  },
  {
    displayName: "Quick Out",
    formation: "Under Center",
    circumstances: ["short_yardage", "standard", "must_convert"],
    weight: 1,
    playArt: {
      markers: [
        { position: { x: 35, y: 50 }, shape: "square" },
        { position: { x: 42, y: 50 }, shape: "square" },
        { position: { x: 50, y: 50 }, shape: "square" },
        { position: { x: 58, y: 50 }, shape: "square" },
        { position: { x: 65, y: 50 }, shape: "square" },
        { position: { x: 50, y: 53 }, shape: "circle" }, // QB under center
        // WR highlighted - running quick out to sideline
        { position: { x: 15, y: 50 }, shape: "circle", highlighted: true },
        { position: { x: 85, y: 50 }, shape: "circle" }, // Other WR
      ],
      routes: [
        // WR runs up 3 yards then breaks to the sideline
        { from: { x: 15, y: 50 }, to: { x: 15, y: 45 }, style: "arrow" },
        { from: { x: 15, y: 45 }, to: { x: 5, y: 45 }, style: "arrow" },
      ],
      lineOfScrimmage: 50,
    },
  },
  {
    displayName: "Screen Pass",
    formation: "Shotgun",
    circumstances: ["standard", "medium_yardage", "long_yardage", "short_yardage", "goal_line"],
    weight: 1,
    playArt: {
      markers: [
        { position: { x: 35, y: 50 }, shape: "square" },
        { position: { x: 42, y: 50 }, shape: "square" },
        { position: { x: 50, y: 50 }, shape: "square" },
        { position: { x: 58, y: 50 }, shape: "square" },
        { position: { x: 65, y: 50 }, shape: "square" },
        { position: { x: 50, y: 58 }, shape: "circle" }, // QB
        // RB highlighted - screen target
        { position: { x: 40, y: 58 }, shape: "circle", highlighted: true },
        { position: { x: 15, y: 50 }, shape: "circle" }, // WR
      ],
      routes: [
        // QB short dump to RB
        { from: { x: 50, y: 58 }, to: { x: 40, y: 55 }, style: "dashed" },
        // RB catches screen and runs behind linemen
        { from: { x: 40, y: 58 }, to: { x: 35, y: 55 }, style: "arrow" },
        { from: { x: 35, y: 55 }, to: { x: 20, y: 38 }, style: "arrow" },
        // Linemen release downfield to block
        { from: { x: 35, y: 50 }, to: { x: 25, y: 42 }, style: "dashed" },
        { from: { x: 42, y: 50 }, to: { x: 30, y: 42 }, style: "dashed" },
      ],
      lineOfScrimmage: 50,
    },
    messages: {
      preSnap: ["The O-line looks ready to let them in..."],
      activePlay: ["Screen pass! Blockers out front!"],
      matchupOutcome: {
        offense_fooled: [
          "Blitzers flew past. Screen has a convoy! {yards}!",
          "Run defense crashed. Screen wide open for {yards}!",
          "The screen had three blockers and one defender. {yards}!",
        ],
        defense_read: [
          "They sniffed the screen. Blown up at the line.",
          "The defense played it perfectly. No chance.",
        ],
      },
    },
  },
  {
    displayName: "Curl Route",
    formation: "Singleback",
    circumstances: ["medium_yardage", "long_yardage", "standard"],
    weight: 1,
    playArt: {
      markers: [
        { position: { x: 35, y: 50 }, shape: "square" },
        { position: { x: 42, y: 50 }, shape: "square" },
        { position: { x: 50, y: 50 }, shape: "square" },
        { position: { x: 58, y: 50 }, shape: "square" },
        { position: { x: 65, y: 50 }, shape: "square" },
        { position: { x: 50, y: 55 }, shape: "circle" }, // QB
        { position: { x: 50, y: 60 }, shape: "circle" }, // RB
        // WR highlighted - running curl
        { position: { x: 85, y: 50 }, shape: "circle", highlighted: true },
      ],
      routes: [
        // WR runs 8 yards downfield then curls back
        { from: { x: 85, y: 50 }, to: { x: 85, y: 38 }, style: "arrow" },
        { from: { x: 85, y: 38 }, to: { x: 82, y: 40 }, style: "curved", control: { x: 88, y: 38 } },
      ],
      lineOfScrimmage: 50,
    },
  },
  {
    displayName: "Checkdown Pass",
    formation: "Shotgun",
    circumstances: ["desperation", "long_yardage", "must_convert"],
    weight: 1,
    playArt: {
      markers: [
        { position: { x: 35, y: 50 }, shape: "square" },
        { position: { x: 42, y: 50 }, shape: "square" },
        { position: { x: 50, y: 50 }, shape: "square" },
        { position: { x: 58, y: 50 }, shape: "square" },
        { position: { x: 65, y: 50 }, shape: "square" },
        { position: { x: 50, y: 58 }, shape: "circle" }, // QB
        // RB highlighted - checkdown target
        { position: { x: 42, y: 58 }, shape: "circle", highlighted: true },
        // WRs running deep (decoys)
        { position: { x: 15, y: 50 }, shape: "circle" },
        { position: { x: 85, y: 50 }, shape: "circle" },
      ],
      routes: [
        // WRs run deep routes (dashed - not primary)
        { from: { x: 15, y: 50 }, to: { x: 15, y: 30 }, style: "dashed" },
        { from: { x: 85, y: 50 }, to: { x: 85, y: 30 }, style: "dashed" },
        // RB slips out as checkdown
        { from: { x: 42, y: 58 }, to: { x: 30, y: 48 }, style: "arrow" },
      ],
      lineOfScrimmage: 50,
    },
    messages: {
      activePlay: ["Nothing deep. Dumps it to the back..."],
      matchupOutcome: {
        offense_fooled: [
          "Defense crashed for run. Back alone in the flat for {yards}!",
          "Nobody picked up the checkdown. {yards} free yards!",
        ],
      },
    },
  },
  {
    displayName: "Flat Route",
    formation: "Singleback Twins",
    circumstances: ["short_yardage", "goal_line", "must_convert"],
    weight: 1,
    playArt: {
      markers: [
        { position: { x: 35, y: 50 }, shape: "square" },
        { position: { x: 42, y: 50 }, shape: "square" },
        { position: { x: 50, y: 50 }, shape: "square" },
        { position: { x: 58, y: 50 }, shape: "square" },
        { position: { x: 65, y: 50 }, shape: "square" },
        { position: { x: 50, y: 55 }, shape: "circle" }, // QB
        { position: { x: 50, y: 60 }, shape: "circle" }, // RB
        // TE highlighted - running to the flat
        { position: { x: 72, y: 50 }, shape: "circle", highlighted: true },
        // Twins WRs
        { position: { x: 82, y: 48 }, shape: "circle" },
        { position: { x: 82, y: 52 }, shape: "circle" },
      ],
      routes: [
        // TE releases to the flat area
        { from: { x: 72, y: 50 }, to: { x: 85, y: 44 }, style: "arrow" },
      ],
      lineOfScrimmage: 50,
    },
  },
  {
    displayName: "Drag Route",
    formation: "Shotgun Spread",
    circumstances: ["desperation", "long_yardage"],
    weight: 1,
    playArt: {
      markers: [
        { position: { x: 35, y: 50 }, shape: "square" },
        { position: { x: 42, y: 50 }, shape: "square" },
        { position: { x: 50, y: 50 }, shape: "square" },
        { position: { x: 58, y: 50 }, shape: "square" },
        { position: { x: 65, y: 50 }, shape: "square" },
        { position: { x: 50, y: 58 }, shape: "circle" }, // QB
        { position: { x: 42, y: 58 }, shape: "circle" }, // RB
        // WR highlighted - dragging across the middle
        { position: { x: 10, y: 50 }, shape: "circle", highlighted: true },
        { position: { x: 90, y: 50 }, shape: "circle" }, // Other WR
      ],
      routes: [
        // WR drags across the field at shallow depth
        { from: { x: 10, y: 50 }, to: { x: 10, y: 46 }, style: "arrow" },
        { from: { x: 10, y: 46 }, to: { x: 75, y: 46 }, style: "arrow" },
      ],
      lineOfScrimmage: 50,
    },
  },
  {
    displayName: "Swing Pass",
    formation: "I-Formation",
    circumstances: ["standard", "goal_line"],
    weight: 1,
    playArt: {
      markers: [
        { position: { x: 35, y: 50 }, shape: "square" },
        { position: { x: 42, y: 50 }, shape: "square" },
        { position: { x: 50, y: 50 }, shape: "square" },
        { position: { x: 58, y: 50 }, shape: "square" },
        { position: { x: 65, y: 50 }, shape: "square" },
        { position: { x: 50, y: 55 }, shape: "circle" }, // QB
        { position: { x: 50, y: 60 }, shape: "circle" }, // FB
        // RB highlighted - swinging out of backfield
        { position: { x: 50, y: 65 }, shape: "circle", highlighted: true },
      ],
      routes: [
        // RB swings out to the flat in an arc
        { from: { x: 50, y: 65 }, to: { x: 30, y: 48 }, style: "curved", control: { x: 35, y: 62 } },
      ],
      lineOfScrimmage: 50,
    },
  },
]

// ─── Pass-Aggressive ────────────────────────────────────────────────────────

const passAggressive: PlayDefinition[] = [
  {
    displayName: "Fly Route",
    formation: "Shotgun Spread",
    circumstances: ["standard", "long_yardage", "medium_yardage"],
    weight: 1,
    playArt: {
      markers: [
        { position: { x: 35, y: 50 }, shape: "square" },
        { position: { x: 42, y: 50 }, shape: "square" },
        { position: { x: 50, y: 50 }, shape: "square" },
        { position: { x: 58, y: 50 }, shape: "square" },
        { position: { x: 65, y: 50 }, shape: "square" },
        { position: { x: 50, y: 58 }, shape: "circle" }, // QB
        { position: { x: 42, y: 58 }, shape: "circle" }, // RB
        // WR highlighted - running straight deep fly route
        { position: { x: 90, y: 50 }, shape: "circle", highlighted: true },
        { position: { x: 10, y: 50 }, shape: "circle" }, // Other WR
      ],
      routes: [
        // WR blazes straight downfield
        { from: { x: 90, y: 50 }, to: { x: 90, y: 15 }, style: "arrow" },
      ],
      lineOfScrimmage: 50,
    },
    messages: {
      preSnap: ["Single high safety. Could be a deep shot..."],
      activePlay: ["He launches it deep!"],
      matchupOutcome: {
        offense_fooled: [
          "Defense sold out for run. Wide open deep! {yards}!",
          "Safety cheated up. Nobody over the top! {yards}!",
          "Loaded box gave away the deep middle. {yards}!",
        ],
        defense_read: [
          "Safety was sitting on this route. Perfect coverage.",
          "Double coverage. They knew it was coming.",
        ],
      },
    },
  },
  {
    displayName: "Hail Mary",
    formation: "Shotgun Empty",
    circumstances: ["desperation"],
    weight: 2,
    playArt: {
      markers: [
        { position: { x: 35, y: 50 }, shape: "square" },
        { position: { x: 42, y: 50 }, shape: "square" },
        { position: { x: 50, y: 50 }, shape: "square" },
        { position: { x: 58, y: 50 }, shape: "square" },
        { position: { x: 65, y: 50 }, shape: "square" },
        { position: { x: 50, y: 58 }, shape: "circle" }, // QB
        // All WRs going deep - one highlighted
        { position: { x: 10, y: 50 }, shape: "circle", highlighted: true },
        { position: { x: 25, y: 50 }, shape: "circle" },
        { position: { x: 75, y: 50 }, shape: "circle" },
        { position: { x: 90, y: 50 }, shape: "circle" },
      ],
      routes: [
        // All receivers streak deep to the end zone
        { from: { x: 10, y: 50 }, to: { x: 40, y: 10 }, style: "arrow" },
        { from: { x: 25, y: 50 }, to: { x: 45, y: 10 }, style: "arrow" },
        { from: { x: 75, y: 50 }, to: { x: 55, y: 10 }, style: "arrow" },
        { from: { x: 90, y: 50 }, to: { x: 60, y: 10 }, style: "arrow" },
      ],
      lineOfScrimmage: 50,
    },
    messages: {
      preSnap: ["Everyone going deep. All or nothing..."],
      activePlay: ["He heaves it!"],
      matchupOutcome: {
        offense_fooled: [
          "Defense loaded the box. Receivers running free! {yards}!",
          "Nobody deep. The desperation heave has a chance! {yards}!",
        ],
      },
    },
  },
  {
    displayName: "Fade",
    formation: "Shotgun",
    circumstances: ["short_yardage", "goal_line", "must_convert"],
    weight: 1,
    playArt: {
      markers: [
        { position: { x: 35, y: 50 }, shape: "square" },
        { position: { x: 42, y: 50 }, shape: "square" },
        { position: { x: 50, y: 50 }, shape: "square" },
        { position: { x: 58, y: 50 }, shape: "square" },
        { position: { x: 65, y: 50 }, shape: "square" },
        { position: { x: 50, y: 58 }, shape: "circle" }, // QB
        { position: { x: 42, y: 58 }, shape: "circle" }, // RB
        // WR highlighted - running fade to corner of end zone
        { position: { x: 90, y: 50 }, shape: "circle", highlighted: true },
      ],
      routes: [
        // WR runs a fade toward the back corner pylon
        { from: { x: 90, y: 50 }, to: { x: 95, y: 20 }, style: "arrow" },
      ],
      lineOfScrimmage: 50,
    },
    messages: {
      activePlay: ["Lobs it to the corner!"],
      matchupOutcome: {
        offense_fooled: [
          "Corner cheated up for run. Fade is 1-on-none! {yards}!",
          "No safety help over the top. Easy fade for {yards}!",
        ],
      },
    },
  },
  {
    displayName: "Post Route",
    formation: "Shotgun Trips",
    circumstances: ["standard", "medium_yardage", "long_yardage"],
    weight: 1,
    playArt: {
      markers: [
        { position: { x: 35, y: 50 }, shape: "square" },
        { position: { x: 42, y: 50 }, shape: "square" },
        { position: { x: 50, y: 50 }, shape: "square" },
        { position: { x: 58, y: 50 }, shape: "square" },
        { position: { x: 65, y: 50 }, shape: "square" },
        { position: { x: 50, y: 58 }, shape: "circle" }, // QB
        { position: { x: 42, y: 58 }, shape: "circle" }, // RB
        // WR highlighted - running post toward middle of field
        { position: { x: 85, y: 50 }, shape: "circle", highlighted: true },
        { position: { x: 85, y: 47 }, shape: "circle" }, // Trip WR
        { position: { x: 85, y: 53 }, shape: "circle" }, // Trip WR
      ],
      routes: [
        // WR runs 10 yards then breaks to the post (middle)
        { from: { x: 85, y: 50 }, to: { x: 85, y: 38 }, style: "arrow" },
        { from: { x: 85, y: 38 }, to: { x: 55, y: 20 }, style: "arrow" },
      ],
      lineOfScrimmage: 50,
    },
  },
  {
    displayName: "Corner Route",
    formation: "Singleback",
    circumstances: ["medium_yardage", "long_yardage", "goal_line"],
    weight: 1,
    playArt: {
      markers: [
        { position: { x: 35, y: 50 }, shape: "square" },
        { position: { x: 42, y: 50 }, shape: "square" },
        { position: { x: 50, y: 50 }, shape: "square" },
        { position: { x: 58, y: 50 }, shape: "square" },
        { position: { x: 65, y: 50 }, shape: "square" },
        { position: { x: 50, y: 55 }, shape: "circle" }, // QB
        { position: { x: 50, y: 60 }, shape: "circle" }, // RB
        // WR highlighted - running corner route to the sideline
        { position: { x: 80, y: 50 }, shape: "circle", highlighted: true },
      ],
      routes: [
        // WR runs upfield then breaks to the corner/sideline
        { from: { x: 80, y: 50 }, to: { x: 80, y: 38 }, style: "arrow" },
        { from: { x: 80, y: 38 }, to: { x: 95, y: 22 }, style: "arrow" },
      ],
      lineOfScrimmage: 50,
    },
  },
  {
    displayName: "Screen Pass",
    formation: "Shotgun",
    circumstances: ["standard", "medium_yardage", "long_yardage", "short_yardage", "goal_line"],
    weight: 1,
    playArt: {
      markers: [
        { position: { x: 35, y: 50 }, shape: "square" },
        { position: { x: 42, y: 50 }, shape: "square" },
        { position: { x: 50, y: 50 }, shape: "square" },
        { position: { x: 58, y: 50 }, shape: "square" },
        { position: { x: 65, y: 50 }, shape: "square" },
        { position: { x: 50, y: 58 }, shape: "circle" }, // QB
        // WR highlighted - WR screen to the wide side
        { position: { x: 85, y: 50 }, shape: "circle", highlighted: true },
        { position: { x: 15, y: 50 }, shape: "circle" }, // Other WR
      ],
      routes: [
        // QB quick throw to WR screen
        { from: { x: 50, y: 58 }, to: { x: 85, y: 52 }, style: "dashed" },
        // WR catches and runs behind blockers
        { from: { x: 85, y: 50 }, to: { x: 85, y: 52 }, style: "arrow" },
        { from: { x: 85, y: 52 }, to: { x: 90, y: 35 }, style: "arrow" },
        // Linemen release to block for WR screen
        { from: { x: 65, y: 50 }, to: { x: 80, y: 42 }, style: "dashed" },
        { from: { x: 58, y: 50 }, to: { x: 75, y: 42 }, style: "dashed" },
      ],
      lineOfScrimmage: 50,
    },
    messages: {
      activePlay: ["Screen to the wide side!"],
      matchupOutcome: {
        offense_fooled: [
          "Run D crashed inside. Perimeter open! {yards}!",
          "The WR screen has a clean runway. {yards} yards!",
        ],
      },
    },
  },
  {
    displayName: "Seam Route",
    formation: "Shotgun Twins",
    circumstances: ["desperation", "long_yardage", "must_convert"],
    weight: 1,
    playArt: {
      markers: [
        { position: { x: 35, y: 50 }, shape: "square" },
        { position: { x: 42, y: 50 }, shape: "square" },
        { position: { x: 50, y: 50 }, shape: "square" },
        { position: { x: 58, y: 50 }, shape: "square" },
        { position: { x: 65, y: 50 }, shape: "square" },
        { position: { x: 50, y: 58 }, shape: "circle" }, // QB
        { position: { x: 42, y: 58 }, shape: "circle" }, // RB
        // TE highlighted - running the seam between safeties
        { position: { x: 72, y: 50 }, shape: "circle", highlighted: true },
        // Twins WRs
        { position: { x: 85, y: 48 }, shape: "circle" },
        { position: { x: 85, y: 52 }, shape: "circle" },
      ],
      routes: [
        // TE runs straight up the seam between hash marks
        { from: { x: 72, y: 50 }, to: { x: 72, y: 20 }, style: "arrow" },
      ],
      lineOfScrimmage: 50,
    },
  },
  {
    displayName: "Double Move",
    formation: "Shotgun Spread",
    circumstances: ["standard", "short_yardage", "must_convert"],
    weight: 1,
    playArt: {
      markers: [
        { position: { x: 35, y: 50 }, shape: "square" },
        { position: { x: 42, y: 50 }, shape: "square" },
        { position: { x: 50, y: 50 }, shape: "square" },
        { position: { x: 58, y: 50 }, shape: "square" },
        { position: { x: 65, y: 50 }, shape: "square" },
        { position: { x: 50, y: 58 }, shape: "circle" }, // QB
        { position: { x: 42, y: 58 }, shape: "circle" }, // RB
        // WR highlighted - running double move (out-and-up)
        { position: { x: 90, y: 50 }, shape: "circle", highlighted: true },
        { position: { x: 10, y: 50 }, shape: "circle" }, // Other WR
      ],
      routes: [
        // WR fakes the out route
        { from: { x: 90, y: 50 }, to: { x: 95, y: 44 }, style: "dashed" },
        // Then breaks deep
        { from: { x: 95, y: 44 }, to: { x: 88, y: 18 }, style: "arrow" },
      ],
      lineOfScrimmage: 50,
    },
    messages: {
      preSnap: ["Receiver in motion. Watch for a route combo..."],
      activePlay: ["Double move! Fakes out, breaks deep!"],
      matchupOutcome: {
        offense_fooled: [
          "Defense playing run. Double move creates a void! {yards}!",
          "LBs bit forward. The fake opened up the deep shot. {yards}!",
        ],
        defense_read: [
          "Corner stayed patient. Double move fooled nobody.",
          "Textbook discipline. The fake didn't sell.",
        ],
      },
    },
  },
]

/** Offense play pool indexed by PlaySlot */
export const offensePlayPool: PlayPool = {
  "run-safe": runSafe,
  "run-aggressive": runAggressive,
  "pass-safe": passSafe,
  "pass-aggressive": passAggressive,
}