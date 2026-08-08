// packages/client/src/games/playcaller/play-art/defense.ts

import type { DefensivePlayId } from "../play-names/types"
import type { PlayArtVariants, PlayArtData } from "./types"

// ─── Run Contain (run-safe) ────────────────────────────────────────────────────
// Gap-sound defense with disciplined lane assignments

const runContainStandard: PlayArtData = {
  lineOfScrimmage: 65,
  markers: [
    // Defensive line (4 linemen — squares)
    { position: { x: 30, y: 63 }, shape: "square" },
    { position: { x: 42, y: 63 }, shape: "square" },
    { position: { x: 58, y: 63 }, shape: "square" },
    { position: { x: 70, y: 63 }, shape: "square" },
    // Linebackers (3 — circles)
    { position: { x: 25, y: 55 }, shape: "circle" },
    { position: { x: 50, y: 53 }, shape: "circle" },
    { position: { x: 75, y: 55 }, shape: "circle" },
    // Safeties and corners (4 — circles)
    { position: { x: 15, y: 45 }, shape: "circle" },
    { position: { x: 40, y: 40 }, shape: "circle" },
    { position: { x: 60, y: 40 }, shape: "circle" },
    { position: { x: 85, y: 45 }, shape: "circle" },
  ],
  routes: [
    // Linemen contain — short lateral arrows
    { from: { x: 30, y: 63 }, to: { x: 25, y: 66 }, style: "arrow" },
    { from: { x: 70, y: 63 }, to: { x: 75, y: 66 }, style: "arrow" },
    // Linebackers fill gaps
    { from: { x: 25, y: 55 }, to: { x: 30, y: 60 }, style: "arrow" },
    { from: { x: 50, y: 53 }, to: { x: 50, y: 60 }, style: "arrow" },
    { from: { x: 75, y: 55 }, to: { x: 70, y: 60 }, style: "arrow" },
  ],
  zones: [],
}

const runContainShortYardage: PlayArtData = {
  lineOfScrimmage: 65,
  markers: [
    // Stacked defensive line (5 linemen — goal-line package)
    { position: { x: 25, y: 63 }, shape: "square" },
    { position: { x: 37, y: 63 }, shape: "square" },
    { position: { x: 50, y: 63 }, shape: "square" },
    { position: { x: 63, y: 63 }, shape: "square" },
    { position: { x: 75, y: 63 }, shape: "square" },
    // Linebackers tight (3)
    { position: { x: 30, y: 57 }, shape: "circle" },
    { position: { x: 50, y: 56 }, shape: "circle" },
    { position: { x: 70, y: 57 }, shape: "circle" },
    // Safeties in the box (3)
    { position: { x: 20, y: 48 }, shape: "circle" },
    { position: { x: 50, y: 45 }, shape: "circle" },
    { position: { x: 80, y: 48 }, shape: "circle" },
  ],
  routes: [
    // All linemen drive forward
    { from: { x: 25, y: 63 }, to: { x: 25, y: 67 }, style: "arrow" },
    { from: { x: 37, y: 63 }, to: { x: 37, y: 67 }, style: "arrow" },
    { from: { x: 50, y: 63 }, to: { x: 50, y: 67 }, style: "arrow" },
    { from: { x: 63, y: 63 }, to: { x: 63, y: 67 }, style: "arrow" },
    { from: { x: 75, y: 63 }, to: { x: 75, y: 67 }, style: "arrow" },
    // Linebackers crash edges
    { from: { x: 30, y: 57 }, to: { x: 22, y: 64 }, style: "arrow" },
    { from: { x: 70, y: 57 }, to: { x: 78, y: 64 }, style: "arrow" },
  ],
  zones: [],
}

const runContainDesperation: PlayArtData = {
  lineOfScrimmage: 65,
  markers: [
    // Light box — expecting pass but staying disciplined
    { position: { x: 35, y: 63 }, shape: "square" },
    { position: { x: 50, y: 63 }, shape: "square" },
    { position: { x: 65, y: 63 }, shape: "square" },
    // Linebackers dropped back
    { position: { x: 25, y: 52 }, shape: "circle" },
    { position: { x: 50, y: 50 }, shape: "circle" },
    { position: { x: 75, y: 52 }, shape: "circle" },
    // Deep secondary
    { position: { x: 15, y: 40 }, shape: "circle" },
    { position: { x: 38, y: 35 }, shape: "circle" },
    { position: { x: 62, y: 35 }, shape: "circle" },
    { position: { x: 85, y: 40 }, shape: "circle" },
  ],
  routes: [
    // Contain edges — DEs hold lane
    { from: { x: 35, y: 63 }, to: { x: 28, y: 66 }, style: "arrow" },
    { from: { x: 65, y: 63 }, to: { x: 72, y: 66 }, style: "arrow" },
    // LBs read and react
    { from: { x: 25, y: 52 }, to: { x: 25, y: 58 }, style: "dashed" },
    { from: { x: 75, y: 52 }, to: { x: 75, y: 58 }, style: "dashed" },
  ],
  zones: [
    { center: { x: 50, y: 42 }, radius: 12, opacity: 0.15 },
  ],
}

// ─── Blitz (run-aggressive) ────────────────────────────────────────────────────
// Aggressive rush — linebackers/safeties attack gaps

const blitzStandard: PlayArtData = {
  lineOfScrimmage: 65,
  markers: [
    // Defensive line (4)
    { position: { x: 32, y: 63 }, shape: "square" },
    { position: { x: 44, y: 63 }, shape: "square" },
    { position: { x: 56, y: 63 }, shape: "square" },
    { position: { x: 68, y: 63 }, shape: "square" },
    // Blitzing LBs (2 — highlighted)
    { position: { x: 38, y: 56 }, shape: "circle", highlighted: true },
    { position: { x: 62, y: 56 }, shape: "circle", highlighted: true },
    // Dropping LB (1)
    { position: { x: 50, y: 52 }, shape: "circle" },
    // Secondary (4)
    { position: { x: 15, y: 44 }, shape: "circle" },
    { position: { x: 38, y: 38 }, shape: "circle" },
    { position: { x: 62, y: 38 }, shape: "circle" },
    { position: { x: 85, y: 44 }, shape: "circle" },
  ],
  routes: [
    // Blitz arrows — aggressive toward LOS
    { from: { x: 38, y: 56 }, to: { x: 40, y: 66 }, style: "arrow" },
    { from: { x: 62, y: 56 }, to: { x: 60, y: 66 }, style: "arrow" },
    // DL push
    { from: { x: 32, y: 63 }, to: { x: 32, y: 68 }, style: "arrow" },
    { from: { x: 44, y: 63 }, to: { x: 44, y: 68 }, style: "arrow" },
    { from: { x: 56, y: 63 }, to: { x: 56, y: 68 }, style: "arrow" },
    { from: { x: 68, y: 63 }, to: { x: 68, y: 68 }, style: "arrow" },
  ],
  zones: [],
}

const blitzShortYardage: PlayArtData = {
  lineOfScrimmage: 65,
  markers: [
    // Defensive line (4)
    { position: { x: 30, y: 63 }, shape: "square" },
    { position: { x: 43, y: 63 }, shape: "square" },
    { position: { x: 57, y: 63 }, shape: "square" },
    { position: { x: 70, y: 63 }, shape: "square" },
    // All 3 LBs blitzing (highlighted)
    { position: { x: 30, y: 57 }, shape: "circle", highlighted: true },
    { position: { x: 50, y: 55 }, shape: "circle", highlighted: true },
    { position: { x: 70, y: 57 }, shape: "circle", highlighted: true },
    // Safety blitz (highlighted)
    { position: { x: 50, y: 47 }, shape: "circle", highlighted: true },
    // Remaining secondary (3)
    { position: { x: 15, y: 42 }, shape: "circle" },
    { position: { x: 50, y: 35 }, shape: "circle" },
    { position: { x: 85, y: 42 }, shape: "circle" },
  ],
  routes: [
    // All blitzers fire at the LOS
    { from: { x: 30, y: 57 }, to: { x: 27, y: 66 }, style: "arrow" },
    { from: { x: 50, y: 55 }, to: { x: 50, y: 66 }, style: "arrow" },
    { from: { x: 70, y: 57 }, to: { x: 73, y: 66 }, style: "arrow" },
    { from: { x: 50, y: 47 }, to: { x: 50, y: 58 }, style: "arrow" },
    // DL push
    { from: { x: 30, y: 63 }, to: { x: 30, y: 68 }, style: "arrow" },
    { from: { x: 43, y: 63 }, to: { x: 43, y: 68 }, style: "arrow" },
    { from: { x: 57, y: 63 }, to: { x: 57, y: 68 }, style: "arrow" },
    { from: { x: 70, y: 63 }, to: { x: 70, y: 68 }, style: "arrow" },
  ],
  zones: [],
}

const blitzDesperation: PlayArtData = {
  lineOfScrimmage: 65,
  markers: [
    // Defensive line (3 — light front)
    { position: { x: 35, y: 63 }, shape: "square" },
    { position: { x: 50, y: 63 }, shape: "square" },
    { position: { x: 65, y: 63 }, shape: "square" },
    // Edge blitzers (2 — highlighted)
    { position: { x: 20, y: 58 }, shape: "circle", highlighted: true },
    { position: { x: 80, y: 58 }, shape: "circle", highlighted: true },
    // Coverage LBs (2)
    { position: { x: 35, y: 50 }, shape: "circle" },
    { position: { x: 65, y: 50 }, shape: "circle" },
    // Deep secondary (4)
    { position: { x: 15, y: 38 }, shape: "circle" },
    { position: { x: 38, y: 32 }, shape: "circle" },
    { position: { x: 62, y: 32 }, shape: "circle" },
    { position: { x: 85, y: 38 }, shape: "circle" },
  ],
  routes: [
    // Edge rushers attack
    { from: { x: 20, y: 58 }, to: { x: 25, y: 67 }, style: "arrow" },
    { from: { x: 80, y: 58 }, to: { x: 75, y: 67 }, style: "arrow" },
    // DL push
    { from: { x: 35, y: 63 }, to: { x: 35, y: 68 }, style: "arrow" },
    { from: { x: 65, y: 63 }, to: { x: 65, y: 68 }, style: "arrow" },
    // Coverage LBs drop into zones
    { from: { x: 35, y: 50 }, to: { x: 30, y: 42 }, style: "dashed" },
    { from: { x: 65, y: 50 }, to: { x: 70, y: 42 }, style: "dashed" },
  ],
  zones: [
    { center: { x: 30, y: 38 }, radius: 10, opacity: 0.15 },
    { center: { x: 70, y: 38 }, radius: 10, opacity: 0.15 },
  ],
}

// ─── Zone Coverage (pass-safe) ─────────────────────────────────────────────────
// Zone defense — defenders cover areas of the field

const zoneCoverageStandard: PlayArtData = {
  lineOfScrimmage: 65,
  markers: [
    // Defensive line (4)
    { position: { x: 32, y: 63 }, shape: "square" },
    { position: { x: 44, y: 63 }, shape: "square" },
    { position: { x: 56, y: 63 }, shape: "square" },
    { position: { x: 68, y: 63 }, shape: "square" },
    // Linebackers dropping into zones (3)
    { position: { x: 25, y: 54 }, shape: "circle" },
    { position: { x: 50, y: 52 }, shape: "circle" },
    { position: { x: 75, y: 54 }, shape: "circle" },
    // Corners and safeties (4)
    { position: { x: 15, y: 42 }, shape: "circle" },
    { position: { x: 38, y: 36 }, shape: "circle" },
    { position: { x: 62, y: 36 }, shape: "circle" },
    { position: { x: 85, y: 42 }, shape: "circle" },
  ],
  routes: [
    // LBs drop into zone areas
    { from: { x: 25, y: 54 }, to: { x: 22, y: 46 }, style: "dashed" },
    { from: { x: 50, y: 52 }, to: { x: 50, y: 44 }, style: "dashed" },
    { from: { x: 75, y: 54 }, to: { x: 78, y: 46 }, style: "dashed" },
  ],
  zones: [
    // Flat zones
    { center: { x: 18, y: 48 }, radius: 10, opacity: 0.2 },
    { center: { x: 82, y: 48 }, radius: 10, opacity: 0.2 },
    // Hook zones
    { center: { x: 35, y: 46 }, radius: 9, opacity: 0.18 },
    { center: { x: 65, y: 46 }, radius: 9, opacity: 0.18 },
    // Deep middle
    { center: { x: 50, y: 32 }, radius: 12, opacity: 0.15 },
  ],
}

const zoneCoverageShortYardage: PlayArtData = {
  lineOfScrimmage: 65,
  markers: [
    // Defensive line (4)
    { position: { x: 30, y: 63 }, shape: "square" },
    { position: { x: 43, y: 63 }, shape: "square" },
    { position: { x: 57, y: 63 }, shape: "square" },
    { position: { x: 70, y: 63 }, shape: "square" },
    // LBs in tight zone (3)
    { position: { x: 28, y: 57 }, shape: "circle" },
    { position: { x: 50, y: 55 }, shape: "circle" },
    { position: { x: 72, y: 57 }, shape: "circle" },
    // Secondary shallow (4)
    { position: { x: 15, y: 47 }, shape: "circle" },
    { position: { x: 38, y: 42 }, shape: "circle" },
    { position: { x: 62, y: 42 }, shape: "circle" },
    { position: { x: 85, y: 47 }, shape: "circle" },
  ],
  routes: [
    // LBs settle into short zones
    { from: { x: 28, y: 57 }, to: { x: 25, y: 52 }, style: "dashed" },
    { from: { x: 50, y: 55 }, to: { x: 50, y: 50 }, style: "dashed" },
    { from: { x: 72, y: 57 }, to: { x: 75, y: 52 }, style: "dashed" },
  ],
  zones: [
    // Tight underneath zones to guard short passes
    { center: { x: 20, y: 52 }, radius: 8, opacity: 0.22 },
    { center: { x: 50, y: 50 }, radius: 9, opacity: 0.22 },
    { center: { x: 80, y: 52 }, radius: 8, opacity: 0.22 },
    // Deep safety help
    { center: { x: 50, y: 36 }, radius: 11, opacity: 0.12 },
  ],
}

const zoneCoverageDesperation: PlayArtData = {
  lineOfScrimmage: 65,
  markers: [
    // Light rush (3 linemen)
    { position: { x: 35, y: 63 }, shape: "square" },
    { position: { x: 50, y: 63 }, shape: "square" },
    { position: { x: 65, y: 63 }, shape: "square" },
    // Deep zone defenders (8 — prevent defense)
    { position: { x: 15, y: 48 }, shape: "circle" },
    { position: { x: 35, y: 45 }, shape: "circle" },
    { position: { x: 50, y: 43 }, shape: "circle" },
    { position: { x: 65, y: 45 }, shape: "circle" },
    { position: { x: 85, y: 48 }, shape: "circle" },
    { position: { x: 30, y: 30 }, shape: "circle" },
    { position: { x: 50, y: 28 }, shape: "circle" },
    { position: { x: 70, y: 30 }, shape: "circle" },
  ],
  routes: [
    // Everyone drops deep
    { from: { x: 15, y: 48 }, to: { x: 12, y: 38 }, style: "dashed" },
    { from: { x: 85, y: 48 }, to: { x: 88, y: 38 }, style: "dashed" },
    { from: { x: 35, y: 45 }, to: { x: 30, y: 35 }, style: "dashed" },
    { from: { x: 65, y: 45 }, to: { x: 70, y: 35 }, style: "dashed" },
  ],
  zones: [
    // Deep thirds — prevent defense
    { center: { x: 20, y: 35 }, radius: 14, opacity: 0.2 },
    { center: { x: 50, y: 28 }, radius: 14, opacity: 0.2 },
    { center: { x: 80, y: 35 }, radius: 14, opacity: 0.2 },
    // Underneath zone
    { center: { x: 50, y: 48 }, radius: 12, opacity: 0.12 },
  ],
}

// ─── Man Press (pass-aggressive) ───────────────────────────────────────────────
// Man-to-man coverage with press at the line

const manPressStandard: PlayArtData = {
  lineOfScrimmage: 65,
  markers: [
    // Defensive line (4)
    { position: { x: 32, y: 63 }, shape: "square" },
    { position: { x: 44, y: 63 }, shape: "square" },
    { position: { x: 56, y: 63 }, shape: "square" },
    { position: { x: 68, y: 63 }, shape: "square" },
    // Blitzing corners from edges (highlighted)
    { position: { x: 12, y: 56 }, shape: "circle", highlighted: true },
    { position: { x: 88, y: 56 }, shape: "circle", highlighted: true },
    // Blitzing LBs (2 — highlighted)
    { position: { x: 38, y: 54 }, shape: "circle", highlighted: true },
    { position: { x: 62, y: 54 }, shape: "circle", highlighted: true },
    // Free safety deep
    { position: { x: 50, y: 35 }, shape: "circle" },
    // Slot blitzers (2 — highlighted)
    { position: { x: 25, y: 56 }, shape: "circle", highlighted: true },
    { position: { x: 75, y: 56 }, shape: "circle", highlighted: true },
  ],
  routes: [
    // Corners blitz toward LOS
    { from: { x: 12, y: 56 }, to: { x: 18, y: 66 }, style: "arrow" },
    { from: { x: 88, y: 56 }, to: { x: 82, y: 66 }, style: "arrow" },
    // Slot blitzers attack toward LOS
    { from: { x: 25, y: 56 }, to: { x: 28, y: 66 }, style: "arrow" },
    { from: { x: 75, y: 56 }, to: { x: 72, y: 66 }, style: "arrow" },
    // LBs fire toward LOS
    { from: { x: 38, y: 54 }, to: { x: 40, y: 66 }, style: "arrow" },
    { from: { x: 62, y: 54 }, to: { x: 60, y: 66 }, style: "arrow" },
  ],
  zones: [],
}

const manPressShortYardage: PlayArtData = {
  lineOfScrimmage: 65,
  markers: [
    // Defensive line (4)
    { position: { x: 30, y: 63 }, shape: "square" },
    { position: { x: 43, y: 63 }, shape: "square" },
    { position: { x: 57, y: 63 }, shape: "square" },
    { position: { x: 70, y: 63 }, shape: "square" },
    // Press corners tight (highlighted)
    { position: { x: 12, y: 64 }, shape: "circle", highlighted: true },
    { position: { x: 88, y: 64 }, shape: "circle", highlighted: true },
    // LBs stacked at LOS for man/spy
    { position: { x: 35, y: 57 }, shape: "circle" },
    { position: { x: 50, y: 56 }, shape: "circle" },
    { position: { x: 65, y: 57 }, shape: "circle" },
    // Safety high
    { position: { x: 50, y: 40 }, shape: "circle" },
    // Slot corner
    { position: { x: 25, y: 58 }, shape: "circle" },
  ],
  routes: [
    // Press corners jam and mirror
    { from: { x: 12, y: 64 }, to: { x: 12, y: 55 }, style: "arrow" },
    { from: { x: 88, y: 64 }, to: { x: 88, y: 55 }, style: "arrow" },
    // Slot mirrors
    { from: { x: 25, y: 58 }, to: { x: 25, y: 50 }, style: "arrow" },
    // LBs man up on backs
    { from: { x: 35, y: 57 }, to: { x: 32, y: 64 }, style: "arrow" },
    { from: { x: 65, y: 57 }, to: { x: 68, y: 64 }, style: "arrow" },
  ],
  zones: [],
}

const manPressDesperation: PlayArtData = {
  lineOfScrimmage: 65,
  markers: [
    // Defensive line (3 — light rush for more coverage)
    { position: { x: 35, y: 63 }, shape: "square" },
    { position: { x: 50, y: 63 }, shape: "square" },
    { position: { x: 65, y: 63 }, shape: "square" },
    // Press corners deep (highlighted)
    { position: { x: 10, y: 58 }, shape: "circle", highlighted: true },
    { position: { x: 90, y: 58 }, shape: "circle", highlighted: true },
    // Man coverage deep (5 DBs)
    { position: { x: 25, y: 48 }, shape: "circle" },
    { position: { x: 40, y: 42 }, shape: "circle" },
    { position: { x: 50, y: 38 }, shape: "circle" },
    { position: { x: 60, y: 42 }, shape: "circle" },
    { position: { x: 75, y: 48 }, shape: "circle" },
  ],
  routes: [
    // Press corners trail deep
    { from: { x: 10, y: 58 }, to: { x: 10, y: 40 }, style: "arrow" },
    { from: { x: 90, y: 58 }, to: { x: 90, y: 40 }, style: "arrow" },
    // Man coverage — each DB trails their man deep
    { from: { x: 25, y: 48 }, to: { x: 20, y: 35 }, style: "curved", control: { x: 18, y: 42 } },
    { from: { x: 40, y: 42 }, to: { x: 35, y: 28 }, style: "curved", control: { x: 33, y: 35 } },
    { from: { x: 60, y: 42 }, to: { x: 65, y: 28 }, style: "curved", control: { x: 67, y: 35 } },
    { from: { x: 75, y: 48 }, to: { x: 80, y: 35 }, style: "curved", control: { x: 82, y: 42 } },
  ],
  zones: [],
}

// ─── Export ────────────────────────────────────────────────────────────────────

export const defensePlayArt: Record<DefensivePlayId, PlayArtVariants> = {
  "run-safe": {
    standard: runContainStandard,
    short_yardage: runContainShortYardage,
    desperation: runContainDesperation,
  },
  "run-aggressive": {
    standard: blitzStandard,
    short_yardage: blitzShortYardage,
    desperation: blitzDesperation,
  },
  "pass-safe": {
    standard: zoneCoverageStandard,
    short_yardage: zoneCoverageShortYardage,
    desperation: zoneCoverageDesperation,
  },
  "pass-aggressive": {
    standard: manPressStandard,
    short_yardage: manPressShortYardage,
    desperation: manPressDesperation,
  },
}
