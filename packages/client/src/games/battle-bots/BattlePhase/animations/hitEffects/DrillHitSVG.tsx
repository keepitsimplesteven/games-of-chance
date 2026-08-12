import type { HitSVGProps } from '../types'

/** Cartoonish conical drill graphic representing a drill hit. */
export function DrillHitSVG({ color, size, opacity }: HitSVGProps) {
  const cx = size / 2

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      opacity={opacity}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Conical drill bit — tapers to a point at the top */}
      <polygon
        points={`${cx},${size * 0.05} ${cx - size * 0.28},${size * 0.65} ${cx + size * 0.28},${size * 0.65}`}
        fill={color}
      />
      {/* Spiral groove lines on the cone */}
      <line
        x1={cx - size * 0.06}
        y1={size * 0.2}
        x2={cx - size * 0.2}
        y2={size * 0.5}
        stroke="rgba(0,0,0,0.3)"
        strokeWidth={size * 0.03}
        strokeLinecap="round"
      />
      <line
        x1={cx + size * 0.02}
        y1={size * 0.15}
        x2={cx - size * 0.08}
        y2={size * 0.55}
        stroke="rgba(0,0,0,0.25)"
        strokeWidth={size * 0.025}
        strokeLinecap="round"
      />
      <line
        x1={cx + size * 0.1}
        y1={size * 0.25}
        x2={cx + size * 0.05}
        y2={size * 0.55}
        stroke="rgba(0,0,0,0.2)"
        strokeWidth={size * 0.025}
        strokeLinecap="round"
      />
      {/* Chuck / base of drill */}
      <rect
        x={cx - size * 0.22}
        y={size * 0.63}
        width={size * 0.44}
        height={size * 0.18}
        fill={color}
        rx={size * 0.04}
        opacity={0.85}
      />
      {/* Handle grip */}
      <rect
        x={cx - size * 0.18}
        y={size * 0.8}
        width={size * 0.36}
        height={size * 0.14}
        fill={color}
        rx={size * 0.06}
        opacity={0.7}
      />
    </svg>
  )
}
