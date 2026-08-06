// packages/client/src/games/playcaller/play-art/offense.ts

import type { PlayArtData, PlayArtVariants } from "./types"
import type { OffensivePlayId } from "../play-names/types"

// ─── Shared Formation Helpers ───────────────────────────────────────────────

/** Standard 5 offensive linemen (squares) centered on the line of scrimmage */
function linemen(los: number): PlayArtData["markers"] {
  return [
    { position: { x: 35, y: los }, shape: "square" },
    { position: { x: 42, y: los }, shape: "square" },
    { position: { x: 50, y: los }, shape: "square" }, // center
    { position: { x: 58, y: los }, shape: "square" },
    { position: { x: 65, y: los }, shape: "square" },
  ]
}

// ─── Inside Run (run-safe) ──────────────────────────────────────────────────

/** Standard: HB Dive — I-Formation, RB behind QB, straight up the gut */
const runSafeStandard: PlayArtData = {
  lineOfScrimmage: 65,
  markers: [
    ...linemen(65),
    { position: { x: 50, y: 72 }, shape: "circle" }, // QB
    { position: { x: 50, y: 80 }, shape: "circle", highlighted: true }, // RB (ball carrier)
    { position: { x: 25, y: 63 }, shape: "circle" }, // WR left
    { position: { x: 75, y: 63 }, shape: "circle" }, // WR right
  ],
  routes: [
    // RB plunges straight through the A-gap
    { from: { x: 50, y: 80 }, to: { x: 50, y: 50 }, style: "arrow" },
    // Blocking arrows from guards
    { from: { x: 42, y: 65 }, to: { x: 42, y: 58 }, style: "dashed" },
    { from: { x: 58, y: 65 }, to: { x: 58, y: 58 }, style: "dashed" },
  ],
}

/** Short yardage: QB Sneak — Under Center, QB pushes forward */
const runSafeShortYardage: PlayArtData = {
  lineOfScrimmage: 65,
  markers: [
    ...linemen(65),
    { position: { x: 50, y: 68 }, shape: "circle", highlighted: true }, // QB under center
    { position: { x: 50, y: 76 }, shape: "circle" }, // FB
    { position: { x: 25, y: 63 }, shape: "circle" }, // WR left
    { position: { x: 75, y: 63 }, shape: "circle" }, // WR right
  ],
  routes: [
    // QB sneaks straight ahead
    { from: { x: 50, y: 68 }, to: { x: 50, y: 55 }, style: "arrow" },
    // Full line surge
    { from: { x: 35, y: 65 }, to: { x: 35, y: 59 }, style: "dashed" },
    { from: { x: 42, y: 65 }, to: { x: 42, y: 59 }, style: "dashed" },
    { from: { x: 58, y: 65 }, to: { x: 58, y: 59 }, style: "dashed" },
    { from: { x: 65, y: 65 }, to: { x: 65, y: 59 }, style: "dashed" },
  ],
}

/** Desperation: Draw Play — Shotgun, fake pass then run up the middle */
const runSafeDesperation: PlayArtData = {
  lineOfScrimmage: 65,
  markers: [
    ...linemen(65),
    { position: { x: 50, y: 75 }, shape: "circle" }, // QB in shotgun
    { position: { x: 44, y: 75 }, shape: "circle", highlighted: true }, // RB beside QB
    { position: { x: 20, y: 63 }, shape: "circle" }, // WR left
    { position: { x: 80, y: 63 }, shape: "circle" }, // WR right
    { position: { x: 30, y: 68 }, shape: "circle" }, // Slot left
  ],
  routes: [
    // QB drops back (fake pass)
    { from: { x: 50, y: 75 }, to: { x: 50, y: 80 }, style: "dashed" },
    // RB delayed run up the middle
    { from: { x: 44, y: 75 }, to: { x: 50, y: 48 }, style: "arrow" },
    // WR runs route as decoy
    { from: { x: 20, y: 63 }, to: { x: 25, y: 40 }, style: "dashed" },
  ],
}

// ─── Outside Run (run-aggressive) ───────────────────────────────────────────

/** Standard: Stretch Run — Spread formation, RB sweeps to the edge */
const runAggressiveStandard: PlayArtData = {
  lineOfScrimmage: 65,
  markers: [
    ...linemen(65),
    { position: { x: 50, y: 73 }, shape: "circle" }, // QB
    { position: { x: 44, y: 73 }, shape: "circle", highlighted: true }, // RB
    { position: { x: 18, y: 63 }, shape: "circle" }, // WR left
    { position: { x: 82, y: 63 }, shape: "circle" }, // WR right
    { position: { x: 28, y: 66 }, shape: "circle" }, // Slot left
  ],
  routes: [
    // RB sweeps outside left
    { from: { x: 44, y: 73 }, to: { x: 20, y: 52 }, style: "arrow", control: { x: 30, y: 68 } },
    // Pulling guard
    { from: { x: 58, y: 65 }, to: { x: 30, y: 58 }, style: "dashed" },
    // WR blocks downfield
    { from: { x: 18, y: 63 }, to: { x: 18, y: 55 }, style: "dashed" },
  ],
}

/** Short yardage: Power Sweep — I-Formation, fullback leads around the edge */
const runAggressiveShortYardage: PlayArtData = {
  lineOfScrimmage: 65,
  markers: [
    ...linemen(65),
    { position: { x: 50, y: 70 }, shape: "circle" }, // QB
    { position: { x: 50, y: 76 }, shape: "circle" }, // FB (lead blocker)
    { position: { x: 50, y: 82 }, shape: "circle", highlighted: true }, // RB
    { position: { x: 25, y: 63 }, shape: "circle" }, // WR left
    { position: { x: 75, y: 63 }, shape: "circle" }, // TE right
  ],
  routes: [
    // FB leads around right end
    { from: { x: 50, y: 76 }, to: { x: 72, y: 56 }, style: "dashed", control: { x: 68, y: 68 } },
    // RB follows FB
    { from: { x: 50, y: 82 }, to: { x: 70, y: 52 }, style: "arrow", control: { x: 65, y: 72 } },
    // Pulling guard
    { from: { x: 42, y: 65 }, to: { x: 68, y: 58 }, style: "dashed" },
  ],
}

/** Desperation: Reverse — Shotgun, handoff to WR going opposite direction */
const runAggressiveDesperation: PlayArtData = {
  lineOfScrimmage: 65,
  markers: [
    ...linemen(65),
    { position: { x: 50, y: 75 }, shape: "circle" }, // QB
    { position: { x: 44, y: 75 }, shape: "circle" }, // RB (decoy)
    { position: { x: 80, y: 63 }, shape: "circle", highlighted: true }, // WR right (ball carrier)
    { position: { x: 20, y: 63 }, shape: "circle" }, // WR left
  ],
  routes: [
    // RB runs right as decoy
    { from: { x: 44, y: 75 }, to: { x: 70, y: 62 }, style: "dashed" },
    // WR takes reverse left
    { from: { x: 80, y: 63 }, to: { x: 20, y: 45 }, style: "arrow", control: { x: 50, y: 72 } },
    // QB hands off (short motion)
    { from: { x: 50, y: 75 }, to: { x: 60, y: 70 }, style: "dashed" },
  ],
}

// ─── Short Pass (pass-safe) ─────────────────────────────────────────────────

/** Standard: Slant Route — Shotgun, quick inside-breaking route */
const passSafeStandard: PlayArtData = {
  lineOfScrimmage: 65,
  markers: [
    ...linemen(65),
    { position: { x: 50, y: 73 }, shape: "circle" }, // QB
    { position: { x: 44, y: 73 }, shape: "circle" }, // RB
    { position: { x: 20, y: 63 }, shape: "circle", highlighted: true }, // WR left (primary)
    { position: { x: 80, y: 63 }, shape: "circle" }, // WR right
    { position: { x: 30, y: 66 }, shape: "circle" }, // Slot left
  ],
  routes: [
    // Primary WR slant inside
    { from: { x: 20, y: 63 }, to: { x: 40, y: 45 }, style: "arrow" },
    // Slot runs flat route
    { from: { x: 30, y: 66 }, to: { x: 20, y: 55 }, style: "arrow" },
    // WR right runs out route
    { from: { x: 80, y: 63 }, to: { x: 88, y: 50 }, style: "dashed" },
    // RB checkdown
    { from: { x: 44, y: 73 }, to: { x: 30, y: 72 }, style: "dashed" },
  ],
}

/** Short yardage: Quick Out — Under Center, fast sideline throw */
const passSafeShortYardage: PlayArtData = {
  lineOfScrimmage: 65,
  markers: [
    ...linemen(65),
    { position: { x: 50, y: 68 }, shape: "circle" }, // QB under center
    { position: { x: 50, y: 76 }, shape: "circle" }, // RB
    { position: { x: 80, y: 63 }, shape: "circle", highlighted: true }, // WR right (primary)
    { position: { x: 20, y: 63 }, shape: "circle" }, // WR left
  ],
  routes: [
    // WR right quick out
    { from: { x: 80, y: 63 }, to: { x: 92, y: 58 }, style: "arrow" },
    // WR left drag route
    { from: { x: 20, y: 63 }, to: { x: 40, y: 58 }, style: "dashed" },
    // RB pass protection
    { from: { x: 50, y: 76 }, to: { x: 58, y: 68 }, style: "dashed" },
  ],
}

/** Desperation: Screen Pass — Shotgun, dump to RB behind the line */
const passSafeDesperation: PlayArtData = {
  lineOfScrimmage: 65,
  markers: [
    ...linemen(65),
    { position: { x: 50, y: 75 }, shape: "circle" }, // QB
    { position: { x: 38, y: 73 }, shape: "circle", highlighted: true }, // RB (screen target)
    { position: { x: 20, y: 63 }, shape: "circle" }, // WR left
    { position: { x: 80, y: 63 }, shape: "circle" }, // WR right
    { position: { x: 70, y: 66 }, shape: "circle" }, // Slot right
  ],
  routes: [
    // RB swings out for screen
    { from: { x: 38, y: 73 }, to: { x: 18, y: 50 }, style: "arrow", control: { x: 20, y: 70 } },
    // Linemen release to block downfield
    { from: { x: 35, y: 65 }, to: { x: 25, y: 55 }, style: "dashed" },
    { from: { x: 42, y: 65 }, to: { x: 30, y: 55 }, style: "dashed" },
    // WRs run deep as decoys
    { from: { x: 20, y: 63 }, to: { x: 22, y: 38 }, style: "dashed" },
    { from: { x: 80, y: 63 }, to: { x: 78, y: 38 }, style: "dashed" },
  ],
}

// ─── Deep Pass (pass-aggressive) ────────────────────────────────────────────

/** Standard: Fly Route — Shotgun Spread, WR streaks deep downfield */
const passAggressiveStandard: PlayArtData = {
  lineOfScrimmage: 65,
  markers: [
    ...linemen(65),
    { position: { x: 50, y: 75 }, shape: "circle" }, // QB
    { position: { x: 44, y: 75 }, shape: "circle" }, // RB
    { position: { x: 15, y: 63 }, shape: "circle", highlighted: true }, // WR left (go route)
    { position: { x: 85, y: 63 }, shape: "circle" }, // WR right
    { position: { x: 30, y: 66 }, shape: "circle" }, // Slot left
    { position: { x: 70, y: 66 }, shape: "circle" }, // Slot right
  ],
  routes: [
    // Primary WR fly route (straight deep)
    { from: { x: 15, y: 63 }, to: { x: 15, y: 25 }, style: "arrow" },
    // Slot left runs post
    { from: { x: 30, y: 66 }, to: { x: 45, y: 35 }, style: "arrow" },
    // WR right runs comeback
    { from: { x: 85, y: 63 }, to: { x: 85, y: 45 }, style: "dashed" },
    // RB pass protection
    { from: { x: 44, y: 75 }, to: { x: 38, y: 68 }, style: "dashed" },
  ],
}

/** Short yardage: Fade — Shotgun, back-shoulder throw to the corner */
const passAggressiveShortYardage: PlayArtData = {
  lineOfScrimmage: 65,
  markers: [
    ...linemen(65),
    { position: { x: 50, y: 73 }, shape: "circle" }, // QB
    { position: { x: 50, y: 80 }, shape: "circle" }, // RB
    { position: { x: 82, y: 63 }, shape: "circle", highlighted: true }, // WR right (fade)
    { position: { x: 20, y: 63 }, shape: "circle" }, // WR left
    { position: { x: 70, y: 66 }, shape: "circle" }, // TE right
  ],
  routes: [
    // Fade route to corner
    { from: { x: 82, y: 63 }, to: { x: 90, y: 35 }, style: "arrow", control: { x: 86, y: 48 } },
    // WR left runs dig route
    { from: { x: 20, y: 63 }, to: { x: 45, y: 48 }, style: "dashed" },
    // TE runs seam
    { from: { x: 70, y: 66 }, to: { x: 70, y: 45 }, style: "dashed" },
  ],
}

/** Desperation: Hail Mary — Shotgun Empty, everyone goes deep */
const passAggressiveDesperation: PlayArtData = {
  lineOfScrimmage: 65,
  markers: [
    ...linemen(65),
    { position: { x: 50, y: 75 }, shape: "circle" }, // QB
    { position: { x: 15, y: 63 }, shape: "circle" }, // WR far left
    { position: { x: 32, y: 66 }, shape: "circle" }, // Slot left
    { position: { x: 68, y: 66 }, shape: "circle", highlighted: true }, // Slot right (primary)
    { position: { x: 85, y: 63 }, shape: "circle" }, // WR far right
  ],
  routes: [
    // All receivers go deep to the end zone
    { from: { x: 15, y: 63 }, to: { x: 30, y: 20 }, style: "arrow", control: { x: 20, y: 40 } },
    { from: { x: 32, y: 66 }, to: { x: 40, y: 20 }, style: "arrow" },
    { from: { x: 68, y: 66 }, to: { x: 55, y: 18 }, style: "arrow" },
    { from: { x: 85, y: 63 }, to: { x: 65, y: 20 }, style: "arrow", control: { x: 78, y: 40 } },
  ],
}

// ─── Export ─────────────────────────────────────────────────────────────────

export const offensePlayArt: Record<OffensivePlayId, PlayArtVariants> = {
  "run-safe": {
    standard: runSafeStandard,
    short_yardage: runSafeShortYardage,
    desperation: runSafeDesperation,
  },
  "run-aggressive": {
    standard: runAggressiveStandard,
    short_yardage: runAggressiveShortYardage,
    desperation: runAggressiveDesperation,
  },
  "pass-safe": {
    standard: passSafeStandard,
    short_yardage: passSafeShortYardage,
    desperation: passSafeDesperation,
  },
  "pass-aggressive": {
    standard: passAggressiveStandard,
    short_yardage: passAggressiveShortYardage,
    desperation: passAggressiveDesperation,
  },
}
