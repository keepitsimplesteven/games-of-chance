interface WheelSegmentProps {
  /** The numeric value displayed on this segment */
  value: number
  /** Zero-based index of this segment in the wheel */
  index: number
  /** Total number of segments on the wheel */
  totalSegments: number
  /** Fill color for this segment wedge */
  color: string
}

/**
 * WheelSegment — Individual SVG wedge slice component.
 *
 * Renders a single pie-wedge of the wheel with:
 * - A colored fill from the carnival palette
 * - A white bold numeric label centered in the wedge
 * - A thin dark border line between segments
 *
 * Validates: Requirements 9.1, 9.2
 */
export function WheelSegment({
  value,
  index,
  totalSegments,
  color,
}: WheelSegmentProps) {
  const anglePerSegment = 360 / totalSegments
  const startAngle = index * anglePerSegment
  const endAngle = startAngle + anglePerSegment

  // Convert degrees to radians
  const toRad = (deg: number) => (deg * Math.PI) / 180

  // Calculate the SVG arc path for this wedge
  // Center at (200, 200), radius 180
  const cx = 200
  const cy = 200
  const radius = 180

  const x1 = cx + radius * Math.cos(toRad(startAngle - 90))
  const y1 = cy + radius * Math.sin(toRad(startAngle - 90))
  const x2 = cx + radius * Math.cos(toRad(endAngle - 90))
  const y2 = cy + radius * Math.sin(toRad(endAngle - 90))

  const largeArcFlag = anglePerSegment > 180 ? 1 : 0

  const pathData = [
    `M ${cx} ${cy}`,
    `L ${x1} ${y1}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
    `Z`,
  ].join(" ")

  // Label position — midpoint of the wedge at 2/3 radius
  const midAngle = startAngle + anglePerSegment / 2
  const labelRadius = radius * 0.65
  const labelX = cx + labelRadius * Math.cos(toRad(midAngle - 90))
  const labelY = cy + labelRadius * Math.sin(toRad(midAngle - 90))

  // Rotate label so it reads radially (perpendicular to the rim)
  // The text is rotated by midAngle so it points outward from center
  const labelRotation = midAngle

  return (
    <g>
      {/* Wedge fill */}
      <path
        d={pathData}
        fill={color}
        stroke="#1a1a1a"
        strokeWidth="1"
      />
      {/* Numeric label — rotated to read radially outward */}
      <text
        x={labelX}
        y={labelY}
        textAnchor="middle"
        dominantBaseline="central"
        fill="white"
        fontWeight="bold"
        fontSize={totalSegments > 30 ? "8" : totalSegments > 15 ? "12" : "16"}
        transform={`rotate(${labelRotation}, ${labelX}, ${labelY})`}
        style={{ pointerEvents: "none" }}
      >
        {value}
      </text>
    </g>
  )
}
