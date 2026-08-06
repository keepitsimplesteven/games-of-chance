import { useTheme } from "../../theme"
import { yardLineToY, formatDownDistance } from "./field-utils"
import { BallMarker } from "./BallMarker"
import type { BallAnimationConfig } from "./animations/types"

/** SVG layout constants */
const SVG_WIDTH = 120
const END_ZONE_HEIGHT = 30
const FIELD_HEIGHT = 240
const SVG_HEIGHT = END_ZONE_HEIGHT + FIELD_HEIGHT + 10 // 280 total (5px padding top/bottom)
const FIELD_TOP = END_ZONE_HEIGHT + 5 // y-offset where playing field starts (after top padding)
const FIELD_X = 10
const FIELD_W = 100

interface FieldPanelProps {
  yardLine: number
  maxYards: number // typically 35
  down: number
  yardsToGo: number
  ballAnimConfig: BallAnimationConfig
}

/**
 * FieldPanel — A 125px-wide vertical SVG football field.
 *
 * Renders:
 * - End zone at the top
 * - Playing field below with yard line markers at 10-yard intervals
 * - BallMarker positioned at the current yard line (animated via Framer Motion)
 * - Down/distance text above the field
 *
 * Uses theme `field` tokens for all colors (no hardcoded values).
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 13.1
 */
export function FieldPanel({
  yardLine,
  maxYards,
  down,
  yardsToGo,
  ballAnimConfig,
}: FieldPanelProps) {
  const theme = useTheme()
  const { field } = theme

  const ballY = yardLineToY(yardLine, maxYards, FIELD_HEIGHT, FIELD_TOP)

  return (
    <div
      className="w-full h-full overflow-hidden"
      style={{ display: "grid", gridTemplateRows: "auto 1fr" }}
    >
      {/* Down/Distance text */}
      <div className="text-center text-[11px] py-0.5">
        <span className="font-bold" style={{ color: field.accent }}>
          {formatDownDistance(down, yardsToGo)}
        </span>
        <span className="ml-1 text-[9px] text-white">&bull; {yardLine} yd</span>
      </div>

      {/* Field SVG */}
      <div className="overflow-hidden">
        <svg
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
          aria-label={`Football field, ball on ${yardLine} yard line`}
        >
          {/* End zone */}
          <rect
            x={FIELD_X}
            y={5}
            width={FIELD_W}
            height={END_ZONE_HEIGHT}
            fill={darken(field.surface, 0.3)}
            stroke={field.surface}
            strokeWidth={2}
          />
          <text
            x={60}
            y={23}
            textAnchor="middle"
            fill={field.accent}
            fontSize="8"
            fontFamily="monospace"
            fontWeight="bold"
          >
            END ZONE
          </text>

          {/* Playing field surface */}
          <rect
            x={FIELD_X}
            y={FIELD_TOP}
            width={FIELD_W}
            height={FIELD_HEIGHT}
            fill={field.surface}
            stroke={field.surface}
            strokeWidth={2}
          />

          {/* Yard line markers at 10-yard intervals */}
          {Array.from({ length: Math.floor(maxYards / 10) + 1 }, (_, i) => i * 10)
            .filter((yd) => yd > 0 && yd <= maxYards)
            .map((yd) => {
              const y = yardLineToY(yd, maxYards, FIELD_HEIGHT, FIELD_TOP)
              const isMajor = yd % 10 === 0
              return (
                <g key={yd}>
                  <line
                    x1={FIELD_X}
                    y1={y}
                    x2={FIELD_X + FIELD_W}
                    y2={y}
                    stroke={field.line}
                    strokeWidth={isMajor ? 1.5 : 0.8}
                    strokeDasharray={isMajor ? "none" : "4,3"}
                    opacity={0.8}
                  />
                  <text
                    x={FIELD_X - 1}
                    y={y + 3}
                    textAnchor="end"
                    fill={field.accent}
                    fontSize="7"
                    fontFamily="monospace"
                  >
                    {yd}
                  </text>
                </g>
              )
            })}

          {/* Ball marker — positioned at field center, Y from yardLineToY */}
          <BallMarker config={ballAnimConfig} x={FIELD_X + FIELD_W / 2} initialY={ballY} />

          {/* Outer border */}
          <rect
            x={FIELD_X}
            y={5}
            width={FIELD_W}
            height={END_ZONE_HEIGHT + FIELD_HEIGHT}
            fill="none"
            stroke={field.surface}
            strokeWidth={3}
          />
        </svg>
      </div>
    </div>
  )
}

/**
 * Simple hex color darkening utility.
 * Multiplies each RGB channel by (1 - amount).
 */
function darken(hex: string, amount: number): string {
  const c = hex.replace("#", "")
  const r = Math.round(parseInt(c.slice(0, 2), 16) * (1 - amount))
  const g = Math.round(parseInt(c.slice(2, 4), 16) * (1 - amount))
  const b = Math.round(parseInt(c.slice(4, 6), 16) * (1 - amount))
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
}
