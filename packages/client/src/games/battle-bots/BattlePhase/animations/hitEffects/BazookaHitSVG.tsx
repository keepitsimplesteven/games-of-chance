import type { HitSVGProps } from '../types'

/** Jagged starburst outline graphic representing a bazooka hit (explosion). */
export function BazookaHitSVG({ color, size, opacity }: HitSVGProps) {
  const cx = size / 2
  const cy = size / 2
  const outerRadius = size * 0.45
  const innerRadius = size * 0.22
  const points = 8

  // Generate starburst polygon points
  const starPoints: string[] = []
  for (let i = 0; i < points * 2; i++) {
    const angle = (Math.PI * i) / points - Math.PI / 2
    const radius = i % 2 === 0 ? outerRadius : innerRadius
    const x = cx + radius * Math.cos(angle)
    const y = cy + radius * Math.sin(angle)
    starPoints.push(`${x},${y}`)
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      opacity={opacity}
      xmlns="http://www.w3.org/2000/svg"
    >
      <polygon
        points={starPoints.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={size * 0.04}
        strokeLinejoin="miter"
      />
    </svg>
  )
}
