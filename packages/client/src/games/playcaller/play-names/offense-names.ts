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
      preSnap: ["The fullback lines up in front of the tailback..."],
      activePlay: ["He takes the handoff and hits the hole!"],
      matchupOutcome: {
        offense_fooled: [
          "You could drive a truck through a hole that big!",
          "Not a defender within five yards — the run game is feasting!",
          "The secondary is deep in coverage while the HB runs free!",
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
      preSnap: ["Quarterback under center, the line tightens up."],
      activePlay: ["He lunges forward behind the center!"],
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
      preSnap: ["Looks like a passing formation... but wait."],
      activePlay: ["It's a draw! The defense bit on the pass look!"],
      matchupOutcome: {
        offense_fooled: [
          "The defense was sitting in pass coverage — the draw rips right through them!",
          "They all dropped back expecting pass and the runner just waltzed through!",
          "Nobody at the second level — the pass-rushers are out of the picture!",
        ],
        defense_read: [
          "They didn't bite on the draw action — the linebackers filled every gap.",
          "The defense read draw all the way and stuffed it at the line.",
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
      activePlay: ["He bounces it outside, looking for the edge!"],
      matchupOutcome: {
        offense_fooled: [
          "The corners are in deep coverage — the outside is completely undefended!",
          "There's nobody on the perimeter! The defense was dropping into pass coverage!",
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
      preSnap: ["The guards are pulling — big play coming."],
      activePlay: ["The pulling guard leads the way!"],
      matchupOutcome: {
        offense_fooled: [
          "The guards pulled into wide open space — the secondary is nowhere near the action!",
          "Power wins when there's nobody in the box to stop it!",
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
      preSnap: ["Something tricky is brewing on this one."],
      activePlay: ["It's a reverse! The defense is caught flat-footed!"],
      matchupOutcome: {
        offense_fooled: [
          "The defense got pulled completely out of the way!",
          "The misdirection was perfect — the whole defense flowed the wrong direction!",
          "The reverse caught every single defender on the wrong side of the field!",
        ],
        defense_read: [
          "The end held his ground — he read the reverse all the way!",
          "The defense didn't bite on the misdirection. Reverse goes nowhere.",
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
          "The jet motion had the defense completely lost — easy yards on the edge!",
          "The speed to the outside was too much — nobody in position to contain!",
          "The secondary was in coverage and the jet sweep ran right past them!",
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
          "The counter action froze the defense — they went the wrong way!",
          "The defense flowed left and the runner cut right into daylight!",
          "The misdirection was devastating — the defense bought it completely!",
        ],
        defense_read: [
          "The backside linebacker didn't bite — he tracked the counter perfectly.",
          "They read the pulling guard and blew up the counter in the backfield.",
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
      activePlay: ["He launches himself over the pile!"],
      matchupOutcome: {
        offense_fooled: [
          "The defense spread out for pass coverage — the goal line push had no resistance!",
          "They tried to defend the end zone through the air and got bulldozed on the ground!",
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
      activePlay: ["Quick throw to the slant — it's on the way!"],
      matchupOutcome: {
        offense_fooled: [
          "The linebackers were all crashing toward the line — the slant is wide open over the middle!",
          "With everyone keying on the run, the quick slant finds acres of space!",
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
      preSnap: ["The offensive line looks ready to let them in..."],
      activePlay: ["Screen pass! Blockers out in front!"],
      matchupOutcome: {
        offense_fooled: [
          "The blitzers flew right past — the screen has blockers everywhere!",
          "They sold out to stop the run and the screen has a convoy!",
          "The defense crashed the line and left the screen wide open!",
        ],
        defense_read: [
          "The linebackers sniffed out the screen — they're all over it.",
          "The defense read screen from the start and blew it up behind the line.",
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
      activePlay: ["Nothing deep — he looks to dump it off to the back."],
      matchupOutcome: {
        offense_fooled: [
          "The defense crashed the line expecting run — the checkdown has the whole flat to himself!",
          "Nobody picked up the back out of the backfield — he's all alone in space!",
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
      preSnap: ["Single high safety — this could be a deep shot."],
      activePlay: ["He launches it deep! The receiver is streaking downfield!"],
      matchupOutcome: {
        offense_fooled: [
          "The defense was selling out for the run — the receiver is WIDE open deep!",
          "Single-high safety was cheating up for run support — it's a footrace and nobody's close!",
          "They loaded the box and left the deep middle completely exposed!",
        ],
        defense_read: [
          "The safety was sitting on this route the entire time — perfect coverage.",
          "Double coverage over the top — the defense knew deep ball was coming.",
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
      preSnap: ["Everyone is going deep. This is all or nothing."],
      activePlay: ["He heaves it! The ball is in the air!"],
      matchupOutcome: {
        offense_fooled: [
          "The defense was loaded in the box — receivers running free all over the field!",
          "Nobody deep! The Hail Mary has a chance because the defense was expecting run!",
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
      activePlay: ["Lobs it to the corner of the end zone!"],
      matchupOutcome: {
        offense_fooled: [
          "The corner was cheating up for run support — the fade is one-on-one with nobody over the top!",
          "The safety bit on the run fake and there's nobody to help on the fade!",
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
      activePlay: ["Screen to the wide side! Blockers setting up!"],
      matchupOutcome: {
        offense_fooled: [
          "The run defense crashed inside and left the perimeter wide open for the screen!",
          "Blockers have a wall set up — the defense was all looking at the backfield!",
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
      preSnap: ["The receiver is in motion — watch for a route combo."],
      activePlay: ["Double move! He fakes the out and breaks deep!"],
      matchupOutcome: {
        offense_fooled: [
          "The defense was playing run — nobody even close to contest the double move!",
          "With the linebackers crashing forward, the double move created a massive void!",
        ],
        defense_read: [
          "The corner didn't bite on the first move — he stayed patient and made the play.",
          "Textbook discipline by the defender — the double move didn't fool anyone.",
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
