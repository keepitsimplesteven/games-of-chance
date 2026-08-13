// packages/client/src/games/playcaller/play-names/defense-names.ts

import type { PlayPool, PlayDefinition } from "./types"
import type { PlayArtData } from "../play-art/types"

// --- Run-Safe Defensive Plays ---

const runSafePlays: PlayDefinition[] = [
  {
    displayName: "Cover 2",
    formation: "4-3",
    circumstances: ["standard", "medium_yardage", "long_yardage"],
    playArt: {
      markers: [
        // 4 DL (squares)
        { position: { x: 30, y: 52 }, shape: "square" },
        { position: { x: 42, y: 52 }, shape: "square" },
        { position: { x: 58, y: 52 }, shape: "square" },
        { position: { x: 70, y: 52 }, shape: "square" },
        // 3 LBs (circles)
        { position: { x: 30, y: 58 }, shape: "circle" },
        { position: { x: 50, y: 58 }, shape: "circle" },
        { position: { x: 70, y: 58 }, shape: "circle" },
        // 2 CBs
        { position: { x: 15, y: 62 }, shape: "circle" },
        { position: { x: 85, y: 62 }, shape: "circle" },
        // 2 Safeties deep
        { position: { x: 30, y: 80 }, shape: "circle", highlighted: true },
        { position: { x: 70, y: 80 }, shape: "circle", highlighted: true },
      ],
      routes: [],
      zones: [
        { center: { x: 30, y: 80 }, radius: 18, opacity: 0.2 },
        { center: { x: 70, y: 80 }, radius: 18, opacity: 0.2 },
      ],
      lineOfScrimmage: 50,
    },
    messages: {
      preSnap: ["The defense lines up in a classic Cover 2 shell."],
      activePlay: ["Safeties drop back, linebackers fill the gaps."],
    },
  },
  {
    displayName: "Base 4-3 Run Fit",
    formation: "4-3",
    circumstances: ["standard", "short_yardage", "medium_yardage"],
    playArt: {
      markers: [
        // 4 DL
        { position: { x: 32, y: 52 }, shape: "square" },
        { position: { x: 44, y: 52 }, shape: "square" },
        { position: { x: 56, y: 52 }, shape: "square" },
        { position: { x: 68, y: 52 }, shape: "square" },
        // 3 LBs
        { position: { x: 35, y: 58 }, shape: "circle" },
        { position: { x: 50, y: 58 }, shape: "circle" },
        { position: { x: 65, y: 58 }, shape: "circle" },
        // 2 CBs
        { position: { x: 15, y: 60 }, shape: "circle" },
        { position: { x: 85, y: 60 }, shape: "circle" },
        // 2 Safeties
        { position: { x: 35, y: 72 }, shape: "circle" },
        { position: { x: 65, y: 72 }, shape: "circle" },
      ],
      routes: [
        // LBs fill gaps
        { from: { x: 35, y: 58 }, to: { x: 38, y: 53 }, style: "arrow" },
        { from: { x: 50, y: 58 }, to: { x: 50, y: 53 }, style: "arrow" },
        { from: { x: 65, y: 58 }, to: { x: 62, y: 53 }, style: "arrow" },
      ],
      lineOfScrimmage: 50,
    },
  },
  {
    displayName: "Goal Line Stack",
    formation: "5-2 Goal Line",
    circumstances: ["goal_line", "short_yardage", "must_convert"],
    playArt: {
      markers: [
        // 5 DL stacked tight near line
        { position: { x: 30, y: 52 }, shape: "square" },
        { position: { x: 40, y: 52 }, shape: "square" },
        { position: { x: 50, y: 52 }, shape: "square" },
        { position: { x: 60, y: 52 }, shape: "square" },
        { position: { x: 70, y: 52 }, shape: "square" },
        // 2 LBs right behind
        { position: { x: 40, y: 55 }, shape: "circle" },
        { position: { x: 60, y: 55 }, shape: "circle" },
        // 2 CBs tight
        { position: { x: 20, y: 55 }, shape: "circle" },
        { position: { x: 80, y: 55 }, shape: "circle" },
        // 2 Safeties close
        { position: { x: 40, y: 60 }, shape: "circle" },
        { position: { x: 60, y: 60 }, shape: "circle" },
      ],
      routes: [],
      lineOfScrimmage: 50,
    },
    messages: {
      preSnap: ["Everyone packs the box at the goal line."],
      activePlay: ["Bodies collide at the line of scrimmage!"],
    },
  },
  {
    displayName: "Gap Control",
    formation: "4-3 Under",
    circumstances: ["standard", "short_yardage", "must_convert"],
    playArt: {
      markers: [
        // 4 DL shifted under
        { position: { x: 28, y: 52 }, shape: "square" },
        { position: { x: 40, y: 52 }, shape: "square" },
        { position: { x: 52, y: 52 }, shape: "square" },
        { position: { x: 64, y: 52 }, shape: "square" },
        // 3 LBs
        { position: { x: 36, y: 57 }, shape: "circle" },
        { position: { x: 50, y: 57 }, shape: "circle" },
        { position: { x: 72, y: 57 }, shape: "circle" },
        // 2 CBs
        { position: { x: 12, y: 60 }, shape: "circle" },
        { position: { x: 88, y: 60 }, shape: "circle" },
        // 2 Safeties
        { position: { x: 40, y: 70 }, shape: "circle" },
        { position: { x: 60, y: 70 }, shape: "circle" },
      ],
      routes: [
        // Gap assignments shown
        { from: { x: 28, y: 52 }, to: { x: 25, y: 49 }, style: "arrow" },
        { from: { x: 40, y: 52 }, to: { x: 36, y: 49 }, style: "arrow" },
        { from: { x: 52, y: 52 }, to: { x: 55, y: 49 }, style: "arrow" },
        { from: { x: 64, y: 52 }, to: { x: 68, y: 49 }, style: "arrow" },
      ],
      lineOfScrimmage: 50,
    },
  },
  {
    displayName: "Contain Defense",
    formation: "4-4",
    circumstances: ["medium_yardage", "long_yardage", "desperation"],
    playArt: {
      markers: [
        // 4 DL spread wide
        { position: { x: 25, y: 52 }, shape: "square" },
        { position: { x: 42, y: 52 }, shape: "square" },
        { position: { x: 58, y: 52 }, shape: "square" },
        { position: { x: 75, y: 52 }, shape: "square" },
        // 4 LBs
        { position: { x: 25, y: 58 }, shape: "circle" },
        { position: { x: 42, y: 58 }, shape: "circle" },
        { position: { x: 58, y: 58 }, shape: "circle" },
        { position: { x: 75, y: 58 }, shape: "circle" },
        // 1 CB, 1 CB, 1 Safety
        { position: { x: 10, y: 62 }, shape: "circle" },
        { position: { x: 90, y: 62 }, shape: "circle" },
        { position: { x: 50, y: 75 }, shape: "circle" },
      ],
      routes: [
        // DEs contain outside
        { from: { x: 25, y: 52 }, to: { x: 15, y: 48 }, style: "arrow" },
        { from: { x: 75, y: 52 }, to: { x: 85, y: 48 }, style: "arrow" },
      ],
      lineOfScrimmage: 50,
    },
    messages: {
      activePlay: ["The defense stays disciplined, keeping everything in front."],
    },
  },
  {
    displayName: "Two-Gap Technique",
    formation: "3-4",
    circumstances: ["standard", "short_yardage", "goal_line"],
    playArt: {
      markers: [
        // 3 DL (big NT in middle)
        { position: { x: 35, y: 52 }, shape: "square" },
        { position: { x: 50, y: 52 }, shape: "square", highlighted: true },
        { position: { x: 65, y: 52 }, shape: "square" },
        // 4 LBs
        { position: { x: 25, y: 57 }, shape: "circle" },
        { position: { x: 42, y: 57 }, shape: "circle" },
        { position: { x: 58, y: 57 }, shape: "circle" },
        { position: { x: 75, y: 57 }, shape: "circle" },
        // 2 CBs
        { position: { x: 12, y: 62 }, shape: "circle" },
        { position: { x: 88, y: 62 }, shape: "circle" },
        // 2 Safeties
        { position: { x: 35, y: 72 }, shape: "circle" },
        { position: { x: 65, y: 72 }, shape: "circle" },
      ],
      routes: [
        // NT two-gap responsibility arrows
        { from: { x: 50, y: 52 }, to: { x: 44, y: 49 }, style: "dashed" },
        { from: { x: 50, y: 52 }, to: { x: 56, y: 49 }, style: "dashed" },
      ],
      lineOfScrimmage: 50,
    },
  },
  {
    displayName: "Run Stuff Front",
    formation: "5-2",
    circumstances: ["short_yardage", "goal_line", "must_convert"],
    playArt: {
      markers: [
        // 5 DL packed tight
        { position: { x: 28, y: 52 }, shape: "square" },
        { position: { x: 39, y: 52 }, shape: "square" },
        { position: { x: 50, y: 52 }, shape: "square" },
        { position: { x: 61, y: 52 }, shape: "square" },
        { position: { x: 72, y: 52 }, shape: "square" },
        // 2 LBs
        { position: { x: 40, y: 57 }, shape: "circle" },
        { position: { x: 60, y: 57 }, shape: "circle" },
        // 2 CBs
        { position: { x: 15, y: 58 }, shape: "circle" },
        { position: { x: 85, y: 58 }, shape: "circle" },
        // 2 Safeties
        { position: { x: 40, y: 66 }, shape: "circle" },
        { position: { x: 60, y: 66 }, shape: "circle" },
      ],
      routes: [
        // All DL fire forward
        { from: { x: 28, y: 52 }, to: { x: 28, y: 48 }, style: "arrow" },
        { from: { x: 39, y: 52 }, to: { x: 39, y: 48 }, style: "arrow" },
        { from: { x: 50, y: 52 }, to: { x: 50, y: 48 }, style: "arrow" },
        { from: { x: 61, y: 52 }, to: { x: 61, y: 48 }, style: "arrow" },
        { from: { x: 72, y: 52 }, to: { x: 72, y: 48 }, style: "arrow" },
      ],
      lineOfScrimmage: 50,
    },
    messages: {
      preSnap: ["Five down linemen crowd the line, daring the run."],
    },
  },
  {
    displayName: "Spy Contain",
    formation: "4-2-5",
    circumstances: ["desperation", "long_yardage"],
    playArt: {
      markers: [
        // 4 DL
        { position: { x: 30, y: 52 }, shape: "square" },
        { position: { x: 43, y: 52 }, shape: "square" },
        { position: { x: 57, y: 52 }, shape: "square" },
        { position: { x: 70, y: 52 }, shape: "square" },
        // 2 LBs (one is spy)
        { position: { x: 40, y: 58 }, shape: "circle" },
        { position: { x: 50, y: 56 }, shape: "circle", highlighted: true },
        // 5 DBs
        { position: { x: 15, y: 62 }, shape: "circle" },
        { position: { x: 85, y: 62 }, shape: "circle" },
        { position: { x: 30, y: 72 }, shape: "circle" },
        { position: { x: 50, y: 72 }, shape: "circle" },
        { position: { x: 70, y: 72 }, shape: "circle" },
      ],
      routes: [
        // Spy mirrors QB
        { from: { x: 50, y: 56 }, to: { x: 45, y: 53 }, style: "dashed" },
        { from: { x: 50, y: 56 }, to: { x: 55, y: 53 }, style: "dashed" },
      ],
      lineOfScrimmage: 50,
    },
    messages: {
      activePlay: ["The spy mirrors the quarterback's every move."],
    },
  },
]

// --- Run-Aggressive Defensive Plays ---

const runAggressivePlays: PlayDefinition[] = [
  {
    displayName: "Run Blitz",
    formation: "4-3 Under",
    circumstances: ["standard", "short_yardage", "medium_yardage"],
    playArt: {
      markers: [
        // 4 DL
        { position: { x: 30, y: 52 }, shape: "square" },
        { position: { x: 42, y: 52 }, shape: "square" },
        { position: { x: 58, y: 52 }, shape: "square" },
        { position: { x: 70, y: 52 }, shape: "square" },
        // 3 LBs (1 blitzing)
        { position: { x: 35, y: 57 }, shape: "circle", highlighted: true },
        { position: { x: 50, y: 57 }, shape: "circle" },
        { position: { x: 65, y: 57 }, shape: "circle" },
        // 2 CBs
        { position: { x: 15, y: 62 }, shape: "circle" },
        { position: { x: 85, y: 62 }, shape: "circle" },
        // 2 Safeties
        { position: { x: 35, y: 72 }, shape: "circle" },
        { position: { x: 65, y: 72 }, shape: "circle" },
      ],
      routes: [
        // LB blitz path
        { from: { x: 35, y: 57 }, to: { x: 38, y: 49 }, style: "arrow" },
      ],
      lineOfScrimmage: 50,
    },
    messages: {
      preSnap: ["The linebacker creeps toward the line, eyes locked on the backfield."],
      activePlay: ["Here comes the blitz! Linebackers shoot the gaps!"],
    },
  },
  {
    displayName: "A-Gap Blitz",
    formation: "4-4",
    circumstances: ["short_yardage", "goal_line", "must_convert"],
    playArt: {
      markers: [
        // 4 DL
        { position: { x: 30, y: 52 }, shape: "square" },
        { position: { x: 42, y: 52 }, shape: "square" },
        { position: { x: 58, y: 52 }, shape: "square" },
        { position: { x: 70, y: 52 }, shape: "square" },
        // 4 LBs (middle one blitzing A-gap)
        { position: { x: 25, y: 57 }, shape: "circle" },
        { position: { x: 45, y: 55 }, shape: "circle", highlighted: true },
        { position: { x: 55, y: 57 }, shape: "circle" },
        { position: { x: 75, y: 57 }, shape: "circle" },
        // 2 CBs
        { position: { x: 12, y: 62 }, shape: "circle" },
        { position: { x: 88, y: 62 }, shape: "circle" },
        // 1 Safety
        { position: { x: 50, y: 72 }, shape: "circle" },
      ],
      routes: [
        // A-gap blitz path between center and guard
        { from: { x: 45, y: 55 }, to: { x: 47, y: 48 }, style: "arrow" },
      ],
      lineOfScrimmage: 50,
    },
    messages: {
      activePlay: ["The blitzer fires through the A-gap!"],
    },
  },
  {
    displayName: "Pinch Front Slant",
    formation: "4-3",
    circumstances: ["standard", "medium_yardage", "long_yardage"],
    playArt: {
      markers: [
        // 4 DL
        { position: { x: 30, y: 52 }, shape: "square" },
        { position: { x: 43, y: 52 }, shape: "square" },
        { position: { x: 57, y: 52 }, shape: "square" },
        { position: { x: 70, y: 52 }, shape: "square" },
        // 3 LBs
        { position: { x: 35, y: 58 }, shape: "circle" },
        { position: { x: 50, y: 58 }, shape: "circle" },
        { position: { x: 65, y: 58 }, shape: "circle" },
        // 2 CBs
        { position: { x: 15, y: 62 }, shape: "circle" },
        { position: { x: 85, y: 62 }, shape: "circle" },
        // 2 Safeties
        { position: { x: 35, y: 72 }, shape: "circle" },
        { position: { x: 65, y: 72 }, shape: "circle" },
      ],
      routes: [
        // DL pinch/slant inside
        { from: { x: 30, y: 52 }, to: { x: 37, y: 48 }, style: "arrow" },
        { from: { x: 43, y: 52 }, to: { x: 47, y: 48 }, style: "arrow" },
        { from: { x: 57, y: 52 }, to: { x: 53, y: 48 }, style: "arrow" },
        { from: { x: 70, y: 52 }, to: { x: 63, y: 48 }, style: "arrow" },
      ],
      lineOfScrimmage: 50,
    },
  },
  {
    displayName: "Edge Crash",
    formation: "3-4 Over",
    circumstances: ["standard", "short_yardage", "medium_yardage", "must_convert"],
    playArt: {
      markers: [
        // 3 DL
        { position: { x: 38, y: 52 }, shape: "square" },
        { position: { x: 50, y: 52 }, shape: "square" },
        { position: { x: 62, y: 52 }, shape: "square" },
        // 4 OLBs (edge rushers highlighted)
        { position: { x: 20, y: 54 }, shape: "circle", highlighted: true },
        { position: { x: 40, y: 57 }, shape: "circle" },
        { position: { x: 60, y: 57 }, shape: "circle" },
        { position: { x: 80, y: 54 }, shape: "circle", highlighted: true },
        // 2 CBs
        { position: { x: 12, y: 62 }, shape: "circle" },
        { position: { x: 88, y: 62 }, shape: "circle" },
        // 2 Safeties
        { position: { x: 40, y: 72 }, shape: "circle" },
        { position: { x: 60, y: 72 }, shape: "circle" },
      ],
      routes: [
        // Edge rushers crash inside
        { from: { x: 20, y: 54 }, to: { x: 30, y: 48 }, style: "arrow" },
        { from: { x: 80, y: 54 }, to: { x: 70, y: 48 }, style: "arrow" },
      ],
      lineOfScrimmage: 50,
    },
  },
  {
    displayName: "Goal Line Overload",
    formation: "6-1 Goal Line",
    circumstances: ["goal_line"],
    playArt: {
      markers: [
        // 6 DL packed at the line
        { position: { x: 25, y: 52 }, shape: "square" },
        { position: { x: 35, y: 52 }, shape: "square" },
        { position: { x: 45, y: 52 }, shape: "square" },
        { position: { x: 55, y: 52 }, shape: "square" },
        { position: { x: 65, y: 52 }, shape: "square" },
        { position: { x: 75, y: 52 }, shape: "square" },
        // 1 LB stacked behind
        { position: { x: 50, y: 55 }, shape: "circle", highlighted: true },
        // 2 CBs
        { position: { x: 15, y: 56 }, shape: "circle" },
        { position: { x: 85, y: 56 }, shape: "circle" },
        // 2 Safeties close
        { position: { x: 35, y: 60 }, shape: "circle" },
        { position: { x: 65, y: 60 }, shape: "circle" },
      ],
      routes: [
        // All DL fire forward
        { from: { x: 25, y: 52 }, to: { x: 25, y: 47 }, style: "arrow" },
        { from: { x: 35, y: 52 }, to: { x: 35, y: 47 }, style: "arrow" },
        { from: { x: 45, y: 52 }, to: { x: 45, y: 47 }, style: "arrow" },
        { from: { x: 55, y: 52 }, to: { x: 55, y: 47 }, style: "arrow" },
        { from: { x: 65, y: 52 }, to: { x: 65, y: 47 }, style: "arrow" },
        { from: { x: 75, y: 52 }, to: { x: 75, y: 47 }, style: "arrow" },
      ],
      lineOfScrimmage: 50,
    },
    messages: {
      preSnap: ["Six men on the line — they're selling out to stop the run!"],
      activePlay: ["The entire front crashes toward the ball carrier."],
    },
  },
  {
    displayName: "Safety Blitz",
    formation: "4-2-5",
    circumstances: ["desperation", "long_yardage"],
    playArt: {
      markers: [
        // 4 DL
        { position: { x: 30, y: 52 }, shape: "square" },
        { position: { x: 43, y: 52 }, shape: "square" },
        { position: { x: 57, y: 52 }, shape: "square" },
        { position: { x: 70, y: 52 }, shape: "square" },
        // 2 LBs
        { position: { x: 40, y: 58 }, shape: "circle" },
        { position: { x: 60, y: 58 }, shape: "circle" },
        // 3 CBs
        { position: { x: 10, y: 62 }, shape: "circle" },
        { position: { x: 50, y: 62 }, shape: "circle" },
        { position: { x: 90, y: 62 }, shape: "circle" },
        // SS blitzing, FS deep
        { position: { x: 55, y: 55 }, shape: "circle", highlighted: true },
        { position: { x: 50, y: 80 }, shape: "circle" },
      ],
      routes: [
        // Safety blitz path
        { from: { x: 55, y: 55 }, to: { x: 53, y: 48 }, style: "arrow" },
      ],
      lineOfScrimmage: 50,
    },
    messages: {
      preSnap: ["The strong safety starts creeping up... he's coming."],
      activePlay: ["The safety comes on a delayed blitz!"],
    },
  },
  {
    displayName: "Stunt Package",
    formation: "3-4",
    circumstances: ["medium_yardage", "long_yardage", "desperation"],
    playArt: {
      markers: [
        // 3 DL
        { position: { x: 35, y: 52 }, shape: "square" },
        { position: { x: 50, y: 52 }, shape: "square" },
        { position: { x: 65, y: 52 }, shape: "square" },
        // 4 LBs
        { position: { x: 22, y: 56 }, shape: "circle" },
        { position: { x: 40, y: 56 }, shape: "circle" },
        { position: { x: 60, y: 56 }, shape: "circle" },
        { position: { x: 78, y: 56 }, shape: "circle" },
        // 2 CBs
        { position: { x: 12, y: 63 }, shape: "circle" },
        { position: { x: 88, y: 63 }, shape: "circle" },
        // 2 Safeties
        { position: { x: 38, y: 74 }, shape: "circle" },
        { position: { x: 62, y: 74 }, shape: "circle" },
      ],
      routes: [
        // DL stunt: DE loops inside, DT loops outside
        { from: { x: 35, y: 52 }, to: { x: 45, y: 47 }, style: "curved", control: { x: 40, y: 47 } },
        { from: { x: 50, y: 52 }, to: { x: 38, y: 47 }, style: "curved", control: { x: 44, y: 46 } },
        { from: { x: 65, y: 52 }, to: { x: 55, y: 47 }, style: "curved", control: { x: 60, y: 47 } },
      ],
      lineOfScrimmage: 50,
    },
  },
]

// --- Pass-Safe Defensive Plays ---

const passSafePlays: PlayDefinition[] = [
  {
    displayName: "Cover 3 Zone",
    formation: "3-4",
    circumstances: ["standard", "medium_yardage", "short_yardage"],
    playArt: {
      markers: [
        // 3 DL
        { position: { x: 35, y: 52 }, shape: "square" },
        { position: { x: 50, y: 52 }, shape: "square" },
        { position: { x: 65, y: 52 }, shape: "square" },
        // 4 LBs underneath
        { position: { x: 25, y: 60 }, shape: "circle" },
        { position: { x: 42, y: 60 }, shape: "circle" },
        { position: { x: 58, y: 60 }, shape: "circle" },
        { position: { x: 75, y: 60 }, shape: "circle" },
        // 2 CBs deep thirds
        { position: { x: 20, y: 82 }, shape: "circle" },
        { position: { x: 80, y: 82 }, shape: "circle" },
        // 1 Safety deep middle third
        { position: { x: 50, y: 85 }, shape: "circle", highlighted: true },
        // 1 Safety underneath
        { position: { x: 50, y: 65 }, shape: "circle" },
      ],
      routes: [],
      zones: [
        { center: { x: 20, y: 82 }, radius: 16, opacity: 0.2 },
        { center: { x: 50, y: 85 }, radius: 16, opacity: 0.2 },
        { center: { x: 80, y: 82 }, radius: 16, opacity: 0.2 },
      ],
      lineOfScrimmage: 50,
    },
    messages: {
      preSnap: ["Three deep, four underneath — a classic zone shell."],
      activePlay: ["Defenders drop into their zones, watching the quarterback's eyes."],
    },
  },
  {
    displayName: "Cover 4 Quarters",
    formation: "Nickel",
    circumstances: ["standard", "long_yardage", "medium_yardage"],
    playArt: {
      markers: [
        // 4 DL
        { position: { x: 30, y: 52 }, shape: "square" },
        { position: { x: 43, y: 52 }, shape: "square" },
        { position: { x: 57, y: 52 }, shape: "square" },
        { position: { x: 70, y: 52 }, shape: "square" },
        // 2 LBs
        { position: { x: 40, y: 58 }, shape: "circle" },
        { position: { x: 60, y: 58 }, shape: "circle" },
        // 1 Nickel CB
        { position: { x: 50, y: 62 }, shape: "circle" },
        // 2 CBs deep quarters
        { position: { x: 15, y: 80 }, shape: "circle" },
        { position: { x: 85, y: 80 }, shape: "circle" },
        // 2 Safeties deep quarters
        { position: { x: 38, y: 82 }, shape: "circle" },
        { position: { x: 62, y: 82 }, shape: "circle" },
      ],
      routes: [],
      zones: [
        { center: { x: 15, y: 80 }, radius: 14, opacity: 0.15 },
        { center: { x: 38, y: 82 }, radius: 14, opacity: 0.15 },
        { center: { x: 62, y: 82 }, radius: 14, opacity: 0.15 },
        { center: { x: 85, y: 80 }, radius: 14, opacity: 0.15 },
      ],
      lineOfScrimmage: 50,
    },
  },
  {
    displayName: "Tampa 2",
    formation: "4-3",
    circumstances: ["standard", "medium_yardage", "short_yardage"],
    playArt: {
      markers: [
        // 4 DL
        { position: { x: 30, y: 52 }, shape: "square" },
        { position: { x: 42, y: 52 }, shape: "square" },
        { position: { x: 58, y: 52 }, shape: "square" },
        { position: { x: 70, y: 52 }, shape: "square" },
        // 2 OLBs underneath
        { position: { x: 28, y: 60 }, shape: "circle" },
        { position: { x: 72, y: 60 }, shape: "circle" },
        // MLB drops deep middle
        { position: { x: 50, y: 58 }, shape: "circle", highlighted: true },
        // 2 CBs
        { position: { x: 15, y: 62 }, shape: "circle" },
        { position: { x: 85, y: 62 }, shape: "circle" },
        // 2 Safeties deep halves
        { position: { x: 30, y: 80 }, shape: "circle" },
        { position: { x: 70, y: 80 }, shape: "circle" },
      ],
      routes: [
        // MLB drops to deep middle
        { from: { x: 50, y: 58 }, to: { x: 50, y: 78 }, style: "dashed" },
      ],
      zones: [
        { center: { x: 30, y: 80 }, radius: 16, opacity: 0.2 },
        { center: { x: 50, y: 78 }, radius: 12, opacity: 0.15 },
        { center: { x: 70, y: 80 }, radius: 16, opacity: 0.2 },
      ],
      lineOfScrimmage: 50,
    },
    messages: {
      activePlay: ["The middle linebacker drops deep, taking away the seam."],
    },
  },
  {
    displayName: "Flat Zone",
    formation: "4-3",
    circumstances: ["short_yardage", "goal_line", "must_convert"],
    playArt: {
      markers: [
        // 4 DL
        { position: { x: 30, y: 52 }, shape: "square" },
        { position: { x: 42, y: 52 }, shape: "square" },
        { position: { x: 58, y: 52 }, shape: "square" },
        { position: { x: 70, y: 52 }, shape: "square" },
        // 3 LBs covering flats
        { position: { x: 25, y: 58 }, shape: "circle" },
        { position: { x: 50, y: 58 }, shape: "circle" },
        { position: { x: 75, y: 58 }, shape: "circle" },
        // 2 CBs in flat zone
        { position: { x: 10, y: 58 }, shape: "circle" },
        { position: { x: 90, y: 58 }, shape: "circle" },
        // 2 Safeties
        { position: { x: 35, y: 70 }, shape: "circle" },
        { position: { x: 65, y: 70 }, shape: "circle" },
      ],
      routes: [
        // LBs and CBs drop to flat zones
        { from: { x: 25, y: 58 }, to: { x: 15, y: 62 }, style: "dashed" },
        { from: { x: 75, y: 58 }, to: { x: 85, y: 62 }, style: "dashed" },
      ],
      zones: [
        { center: { x: 15, y: 60 }, radius: 10, opacity: 0.2 },
        { center: { x: 85, y: 60 }, radius: 10, opacity: 0.2 },
      ],
      lineOfScrimmage: 50,
    },
  },
  {
    displayName: "Prevent Defense",
    formation: "3-3-5 Prevent",
    circumstances: ["long_yardage", "desperation"],
    playArt: {
      markers: [
        // 3 DL
        { position: { x: 35, y: 52 }, shape: "square" },
        { position: { x: 50, y: 52 }, shape: "square" },
        { position: { x: 65, y: 52 }, shape: "square" },
        // 3 LBs shallow
        { position: { x: 30, y: 60 }, shape: "circle" },
        { position: { x: 50, y: 60 }, shape: "circle" },
        { position: { x: 70, y: 60 }, shape: "circle" },
        // 5 DBs spread deep
        { position: { x: 10, y: 85 }, shape: "circle" },
        { position: { x: 30, y: 88 }, shape: "circle" },
        { position: { x: 50, y: 90 }, shape: "circle" },
        { position: { x: 70, y: 88 }, shape: "circle" },
        { position: { x: 90, y: 85 }, shape: "circle" },
      ],
      routes: [],
      zones: [
        { center: { x: 10, y: 85 }, radius: 12, opacity: 0.15 },
        { center: { x: 30, y: 88 }, radius: 14, opacity: 0.2 },
        { center: { x: 50, y: 90 }, radius: 14, opacity: 0.2 },
        { center: { x: 70, y: 88 }, radius: 14, opacity: 0.2 },
        { center: { x: 90, y: 85 }, radius: 12, opacity: 0.15 },
      ],
      lineOfScrimmage: 50,
    },
    messages: {
      preSnap: ["The defense drops everyone deep — they're playing prevent."],
      activePlay: ["Five defensive backs blanket the secondary."],
    },
  },
  {
    displayName: "Goal Line Zone",
    formation: "4-3 Short",
    circumstances: ["goal_line", "must_convert"],
    playArt: {
      markers: [
        // 4 DL tight
        { position: { x: 32, y: 52 }, shape: "square" },
        { position: { x: 44, y: 52 }, shape: "square" },
        { position: { x: 56, y: 52 }, shape: "square" },
        { position: { x: 68, y: 52 }, shape: "square" },
        // 3 LBs at 5 yards
        { position: { x: 30, y: 56 }, shape: "circle" },
        { position: { x: 50, y: 56 }, shape: "circle" },
        { position: { x: 70, y: 56 }, shape: "circle" },
        // 2 CBs tight
        { position: { x: 18, y: 56 }, shape: "circle" },
        { position: { x: 82, y: 56 }, shape: "circle" },
        // 2 Safeties shallow zones
        { position: { x: 35, y: 62 }, shape: "circle" },
        { position: { x: 65, y: 62 }, shape: "circle" },
      ],
      routes: [],
      zones: [
        { center: { x: 35, y: 62 }, radius: 10, opacity: 0.2 },
        { center: { x: 65, y: 62 }, radius: 10, opacity: 0.2 },
        { center: { x: 50, y: 58 }, radius: 8, opacity: 0.15 },
      ],
      lineOfScrimmage: 50,
    },
    messages: {
      preSnap: ["The secondary tightens up near the goal line."],
    },
  },
  {
    displayName: "Soft Cover 2",
    formation: "Nickel",
    circumstances: ["long_yardage", "desperation"],
    playArt: {
      markers: [
        // 4 DL
        { position: { x: 30, y: 52 }, shape: "square" },
        { position: { x: 43, y: 52 }, shape: "square" },
        { position: { x: 57, y: 52 }, shape: "square" },
        { position: { x: 70, y: 52 }, shape: "square" },
        // 2 LBs
        { position: { x: 40, y: 60 }, shape: "circle" },
        { position: { x: 60, y: 60 }, shape: "circle" },
        // 3 CBs cushion
        { position: { x: 12, y: 68 }, shape: "circle" },
        { position: { x: 50, y: 65 }, shape: "circle" },
        { position: { x: 88, y: 68 }, shape: "circle" },
        // 2 Safeties deep halves (soft)
        { position: { x: 30, y: 85 }, shape: "circle" },
        { position: { x: 70, y: 85 }, shape: "circle" },
      ],
      routes: [],
      zones: [
        { center: { x: 30, y: 85 }, radius: 20, opacity: 0.15 },
        { center: { x: 70, y: 85 }, radius: 20, opacity: 0.15 },
      ],
      lineOfScrimmage: 50,
    },
  },
]

// --- Pass-Aggressive Defensive Plays ---

const passAggressivePlays: PlayDefinition[] = [
  {
    displayName: "All-Out Blitz",
    formation: "3-3-5",
    circumstances: ["standard", "short_yardage", "medium_yardage"],
    playArt: {
      markers: [
        // 3 DL
        { position: { x: 35, y: 52 }, shape: "square" },
        { position: { x: 50, y: 52 }, shape: "square" },
        { position: { x: 65, y: 52 }, shape: "square" },
        // 3 LBs all blitzing
        { position: { x: 28, y: 55 }, shape: "circle", highlighted: true },
        { position: { x: 50, y: 55 }, shape: "circle", highlighted: true },
        { position: { x: 72, y: 55 }, shape: "circle", highlighted: true },
        // 5 DBs in man coverage
        { position: { x: 10, y: 60 }, shape: "circle" },
        { position: { x: 30, y: 62 }, shape: "circle" },
        { position: { x: 50, y: 75 }, shape: "circle" },
        { position: { x: 70, y: 62 }, shape: "circle" },
        { position: { x: 90, y: 60 }, shape: "circle" },
      ],
      routes: [
        // All 3 LBs blitz
        { from: { x: 28, y: 55 }, to: { x: 30, y: 47 }, style: "arrow" },
        { from: { x: 50, y: 55 }, to: { x: 50, y: 47 }, style: "arrow" },
        { from: { x: 72, y: 55 }, to: { x: 70, y: 47 }, style: "arrow" },
        // DL rush
        { from: { x: 35, y: 52 }, to: { x: 35, y: 47 }, style: "arrow" },
        { from: { x: 65, y: 52 }, to: { x: 65, y: 47 }, style: "arrow" },
      ],
      lineOfScrimmage: 50,
    },
    messages: {
      preSnap: ["They're showing pressure from everywhere!"],
      activePlay: ["Five rushers collapse the pocket!"],
    },
  },
  {
    displayName: "Corner Blitz",
    formation: "3-4",
    circumstances: ["standard", "medium_yardage", "long_yardage"],
    playArt: {
      markers: [
        // 3 DL
        { position: { x: 35, y: 52 }, shape: "square" },
        { position: { x: 50, y: 52 }, shape: "square" },
        { position: { x: 65, y: 52 }, shape: "square" },
        // 4 LBs
        { position: { x: 25, y: 57 }, shape: "circle" },
        { position: { x: 42, y: 57 }, shape: "circle" },
        { position: { x: 58, y: 57 }, shape: "circle" },
        { position: { x: 75, y: 57 }, shape: "circle" },
        // CB blitzing from edge
        { position: { x: 8, y: 55 }, shape: "circle", highlighted: true },
        // Other CB
        { position: { x: 88, y: 62 }, shape: "circle" },
        // 2 Safeties
        { position: { x: 35, y: 75 }, shape: "circle" },
        { position: { x: 65, y: 75 }, shape: "circle" },
      ],
      routes: [
        // Corner blitz path off the edge
        { from: { x: 8, y: 55 }, to: { x: 18, y: 47 }, style: "arrow" },
      ],
      zones: [
        { center: { x: 35, y: 75 }, radius: 14, opacity: 0.15 },
        { center: { x: 65, y: 75 }, radius: 14, opacity: 0.15 },
      ],
      lineOfScrimmage: 50,
    },
    messages: {
      activePlay: ["The corner comes off the edge — can the QB see him?!"],
    },
  },
  {
    displayName: "Zone Blitz",
    formation: "3-4",
    circumstances: ["standard", "short_yardage", "must_convert"],
    playArt: {
      markers: [
        // 3 DL (one drops into zone)
        { position: { x: 35, y: 52 }, shape: "square" },
        { position: { x: 50, y: 52 }, shape: "square" },
        { position: { x: 65, y: 52 }, shape: "square" },
        // 4 LBs (OLB blitzes, ILB zones)
        { position: { x: 22, y: 55 }, shape: "circle", highlighted: true },
        { position: { x: 40, y: 57 }, shape: "circle" },
        { position: { x: 60, y: 57 }, shape: "circle" },
        { position: { x: 78, y: 57 }, shape: "circle" },
        // 2 CBs
        { position: { x: 12, y: 65 }, shape: "circle" },
        { position: { x: 88, y: 65 }, shape: "circle" },
        // 2 Safeties
        { position: { x: 38, y: 75 }, shape: "circle" },
        { position: { x: 62, y: 75 }, shape: "circle" },
      ],
      routes: [
        // OLB blitzes
        { from: { x: 22, y: 55 }, to: { x: 25, y: 47 }, style: "arrow" },
        // DE drops into zone
        { from: { x: 65, y: 52 }, to: { x: 72, y: 60 }, style: "dashed" },
      ],
      zones: [
        { center: { x: 72, y: 62 }, radius: 10, opacity: 0.2 },
        { center: { x: 38, y: 75 }, radius: 14, opacity: 0.15 },
        { center: { x: 62, y: 75 }, radius: 14, opacity: 0.15 },
      ],
      lineOfScrimmage: 50,
    },
  },
  {
    displayName: "Overload Blitz",
    formation: "Nickel",
    circumstances: ["goal_line", "must_convert", "short_yardage"],
    playArt: {
      markers: [
        // 4 DL shifted strong side
        { position: { x: 25, y: 52 }, shape: "square" },
        { position: { x: 37, y: 52 }, shape: "square" },
        { position: { x: 49, y: 52 }, shape: "square" },
        { position: { x: 61, y: 52 }, shape: "square" },
        // 2 LBs strong side blitzing
        { position: { x: 30, y: 56 }, shape: "circle", highlighted: true },
        { position: { x: 43, y: 56 }, shape: "circle", highlighted: true },
        // Nickel back
        { position: { x: 75, y: 57 }, shape: "circle" },
        // 2 CBs
        { position: { x: 12, y: 60 }, shape: "circle" },
        { position: { x: 88, y: 60 }, shape: "circle" },
        // 2 Safeties
        { position: { x: 40, y: 70 }, shape: "circle" },
        { position: { x: 65, y: 70 }, shape: "circle" },
      ],
      routes: [
        // Overload blitz from strong side
        { from: { x: 30, y: 56 }, to: { x: 32, y: 48 }, style: "arrow" },
        { from: { x: 43, y: 56 }, to: { x: 43, y: 48 }, style: "arrow" },
      ],
      lineOfScrimmage: 50,
    },
    messages: {
      preSnap: ["They're stacking the strong side — big pressure coming."],
    },
  },
  {
    displayName: "Double A-Gap Pressure",
    formation: "Dime",
    circumstances: ["long_yardage", "desperation"],
    playArt: {
      markers: [
        // 3 DL
        { position: { x: 35, y: 52 }, shape: "square" },
        { position: { x: 50, y: 52 }, shape: "square" },
        { position: { x: 65, y: 52 }, shape: "square" },
        // 2 ILBs in A-gaps
        { position: { x: 44, y: 54 }, shape: "circle", highlighted: true },
        { position: { x: 56, y: 54 }, shape: "circle", highlighted: true },
        // 6 DBs
        { position: { x: 10, y: 62 }, shape: "circle" },
        { position: { x: 25, y: 65 }, shape: "circle" },
        { position: { x: 50, y: 80 }, shape: "circle" },
        { position: { x: 75, y: 65 }, shape: "circle" },
        { position: { x: 90, y: 62 }, shape: "circle" },
        { position: { x: 50, y: 68 }, shape: "circle" },
      ],
      routes: [
        // Both ILBs fire through A-gaps
        { from: { x: 44, y: 54 }, to: { x: 46, y: 47 }, style: "arrow" },
        { from: { x: 56, y: 54 }, to: { x: 54, y: 47 }, style: "arrow" },
      ],
      lineOfScrimmage: 50,
    },
    messages: {
      preSnap: ["Both inside linebackers creep to the line."],
      activePlay: ["Double A-gap pressure! They're coming right up the middle!"],
    },
  },
  {
    displayName: "Fire Zone",
    formation: "3-3-5",
    circumstances: ["medium_yardage", "long_yardage", "desperation"],
    playArt: {
      markers: [
        // 3 DL
        { position: { x: 35, y: 52 }, shape: "square" },
        { position: { x: 50, y: 52 }, shape: "square" },
        { position: { x: 65, y: 52 }, shape: "square" },
        // 3 LBs (2 rush, 1 drops)
        { position: { x: 25, y: 55 }, shape: "circle", highlighted: true },
        { position: { x: 50, y: 57 }, shape: "circle" },
        { position: { x: 75, y: 55 }, shape: "circle", highlighted: true },
        // 5 DBs zoning behind
        { position: { x: 12, y: 65 }, shape: "circle" },
        { position: { x: 35, y: 72 }, shape: "circle" },
        { position: { x: 50, y: 78 }, shape: "circle" },
        { position: { x: 65, y: 72 }, shape: "circle" },
        { position: { x: 88, y: 65 }, shape: "circle" },
      ],
      routes: [
        // 2 OLBs fire
        { from: { x: 25, y: 55 }, to: { x: 27, y: 47 }, style: "arrow" },
        { from: { x: 75, y: 55 }, to: { x: 73, y: 47 }, style: "arrow" },
        // ILB drops to zone
        { from: { x: 50, y: 57 }, to: { x: 50, y: 67 }, style: "dashed" },
      ],
      zones: [
        { center: { x: 35, y: 72 }, radius: 12, opacity: 0.2 },
        { center: { x: 50, y: 72 }, radius: 12, opacity: 0.15 },
        { center: { x: 65, y: 72 }, radius: 12, opacity: 0.2 },
      ],
      lineOfScrimmage: 50,
    },
  },
  {
    displayName: "Goal Line Man Blitz",
    formation: "4-4 Goal Line",
    circumstances: ["goal_line"],
    playArt: {
      markers: [
        // 4 DL at goal line
        { position: { x: 30, y: 52 }, shape: "square" },
        { position: { x: 43, y: 52 }, shape: "square" },
        { position: { x: 57, y: 52 }, shape: "square" },
        { position: { x: 70, y: 52 }, shape: "square" },
        // 4 LBs (1 edge blitzing)
        { position: { x: 20, y: 55 }, shape: "circle", highlighted: true },
        { position: { x: 40, y: 56 }, shape: "circle" },
        { position: { x: 60, y: 56 }, shape: "circle" },
        { position: { x: 80, y: 55 }, shape: "circle" },
        // 3 DBs in man
        { position: { x: 15, y: 58 }, shape: "circle" },
        { position: { x: 50, y: 62 }, shape: "circle" },
        { position: { x: 85, y: 58 }, shape: "circle" },
      ],
      routes: [
        // Edge blitz off the corner
        { from: { x: 20, y: 55 }, to: { x: 22, y: 48 }, style: "arrow" },
        // All DL rush
        { from: { x: 30, y: 52 }, to: { x: 30, y: 48 }, style: "arrow" },
        { from: { x: 43, y: 52 }, to: { x: 43, y: 48 }, style: "arrow" },
        { from: { x: 57, y: 52 }, to: { x: 57, y: 48 }, style: "arrow" },
        { from: { x: 70, y: 52 }, to: { x: 70, y: 48 }, style: "arrow" },
      ],
      lineOfScrimmage: 50,
    },
    messages: {
      activePlay: ["Man coverage across the board with a blitz off the edge!"],
    },
  },
]

/**
 * Defense play pool registry — covers all 4 defensive PlaySlots with
 * full circumstance coverage (standard, short_yardage, medium_yardage,
 * long_yardage, desperation, goal_line, must_convert).
 *
 * Placement constraint: "Prevent Defense" appears only in pass-safe
 * for {long_yardage, desperation} per Requirement 4.1.
 */
export const defensePlayPool: PlayPool = {
  "run-safe": runSafePlays,
  "run-aggressive": runAggressivePlays,
  "pass-safe": passSafePlays,
  "pass-aggressive": passAggressivePlays,
}
