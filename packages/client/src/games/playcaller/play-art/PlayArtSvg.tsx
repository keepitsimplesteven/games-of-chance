import { useTheme } from "../../../theme"
import type { PlayArtData, RouteSegment, PlayerMarker, CoverageZone } from "./types"

interface PlayArtSvgProps {
  data: PlayArtData
  className?: string
}

/**
 * PlayArtSvg — Renders PlayArtData into an inline SVG depicting
 * formation positions, route arrows, and coverage zones.
 *
 * Uses a 0-100 coordinate space (viewBox "0 0 100 100") matching
 * the play art data definitions.
 *
 * All colors are derived from the current theme's `field` tokens.
 */
export function PlayArtSvg({ data, className }: PlayArtSvgProps) {
  const theme = useTheme()
  const { field } = theme

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <marker
          id="play-art-arrow"
          markerWidth="5"
          markerHeight="5"
          refX="4"
          refY="2.5"
          orient="auto"
        >
          <path d="M0,0 L5,2.5 L0,5Z" fill={field.line} />
        </marker>
      </defs>

      {/* Line of scrimmage */}
      <line
        x1={0}
        y1={data.lineOfScrimmage}
        x2={100}
        y2={data.lineOfScrimmage}
        stroke={field.line}
        strokeWidth={0.8}
        strokeDasharray="4,3"
        opacity={0.5}
      />

      {/* Coverage zones (rendered first so they sit behind markers/routes) */}
      {data.zones?.map((zone, i) => (
        <CoverageZoneCircle key={`zone-${i}`} zone={zone} color={field.line} />
      ))}

      {/* Route paths */}
      {data.routes.map((route, i) => (
        <RoutePath key={`route-${i}`} route={route} color={field.line} />
      ))}

      {/* Player markers */}
      {data.markers.map((marker, i) => (
        <PlayerMarkerShape
          key={`marker-${i}`}
          marker={marker}
          defaultColor={field.line}
          highlightColor={field.accent}
        />
      ))}
    </svg>
  )
}

/** Renders a single route segment as an SVG path */
function RoutePath({ route, color }: { route: RouteSegment; color: string }) {
  const d = buildPathD(route)
  const isDashed = route.style === "dashed"
  const hasArrow = route.style === "arrow" || route.style === "curved"

  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={1.5}
      strokeDasharray={isDashed ? "3,2" : undefined}
      markerEnd={hasArrow ? "url(#play-art-arrow)" : undefined}
      opacity={0.9}
    />
  )
}

/** Builds an SVG path `d` attribute from a RouteSegment */
function buildPathD(route: RouteSegment): string {
  const { from, to, style, control } = route

  if (style === "curved" && control) {
    // Quadratic bezier curve through control point
    return `M${from.x},${from.y} Q${control.x},${control.y} ${to.x},${to.y}`
  }

  // Straight line (arrow or dashed)
  return `M${from.x},${from.y} L${to.x},${to.y}`
}

/** Renders a player marker as either a circle (skill) or square (lineman) */
function PlayerMarkerShape({
  marker,
  defaultColor,
  highlightColor,
}: {
  marker: PlayerMarker
  defaultColor: string
  highlightColor: string
}) {
  const fill = marker.highlighted ? highlightColor : defaultColor
  const opacity = marker.highlighted ? 1 : 0.7
  const { x, y } = marker.position

  if (marker.shape === "circle") {
    return <circle cx={x} cy={y} r={2.5} fill={fill} opacity={opacity} />
  }

  // Square (lineman) — 5×5 centered on position
  return (
    <rect
      x={x - 2.5}
      y={y - 2.5}
      width={5}
      height={5}
      fill={fill}
      opacity={opacity}
    />
  )
}

/** Renders a semi-transparent coverage zone circle */
function CoverageZoneCircle({ zone, color }: { zone: CoverageZone; color: string }) {
  return (
    <circle
      cx={zone.center.x}
      cy={zone.center.y}
      r={zone.radius}
      fill={color}
      opacity={zone.opacity * 0.15}
      stroke={color}
      strokeWidth={0.6}
      strokeDasharray="3,2"
    />
  )
}
