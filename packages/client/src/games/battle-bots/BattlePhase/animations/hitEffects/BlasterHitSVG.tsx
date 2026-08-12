import type { HitSVGProps } from '../types'

/** Elongated line graphic representing a blaster hit (laser beam strike). */
export function BlasterHitSVG({ color, size, opacity }: HitSVGProps) {
  const height = size * 0.35

  return (
    <svg
      width={size}
      height={height}
      viewBox={`0 0 ${size} ${height}`}
      opacity={opacity}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Main laser beam line */}
      <line
        x1={0}
        y1={height / 2}
        x2={size}
        y2={height / 2}
        stroke={color}
        strokeWidth={height * 0.3}
        strokeLinecap="round"
      />
      {/* Inner glow line */}
      <line
        x1={size * 0.1}
        y1={height / 2}
        x2={size * 0.9}
        y2={height / 2}
        stroke={color}
        strokeWidth={height * 0.15}
        strokeLinecap="round"
        opacity={0.6}
      />
    </svg>
  )
}
