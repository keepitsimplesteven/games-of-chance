// packages/client/src/games/playcaller/play-art/types.ts

import type { Circumstance } from "../play-names/types"

/** A point on the play art canvas (0-100 coordinate space) */
export interface Point {
  x: number
  y: number
}

/** A single route/path segment */
export interface RouteSegment {
  /** Starting position */
  from: Point
  /** Ending position */
  to: Point
  /** Route style: solid arrow, dashed (zone), or curved */
  style: "arrow" | "dashed" | "curved"
  /** Optional: curve control point for curved routes */
  control?: Point
}

/** A player position marker */
export interface PlayerMarker {
  /** Position on the canvas */
  position: Point
  /** Shape: circle for skill players, square for linemen */
  shape: "circle" | "square"
  /** Whether this player is highlighted (ball carrier, blitzer) */
  highlighted?: boolean
}

/** Coverage zone (defense only) */
export interface CoverageZone {
  /** Center of the zone */
  center: Point
  /** Radius of the zone circle */
  radius: number
  /** Opacity (0-1) */
  opacity: number
}

/** Complete play art definition */
export interface PlayArtData {
  /** Player position markers */
  markers: PlayerMarker[]
  /** Route/movement arrows */
  routes: RouteSegment[]
  /** Coverage zones (defense only) */
  zones?: CoverageZone[]
  /** Line of scrimmage Y position (0-100) */
  lineOfScrimmage: number
}

/** Map of play art variants by circumstance */
export type PlayArtVariants = Record<Circumstance, PlayArtData>
