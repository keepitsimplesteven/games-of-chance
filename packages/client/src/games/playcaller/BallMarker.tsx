import { motion } from "framer-motion"
import { ballVariants } from "./animations/variants"
import type { BallAnimationConfig } from "./animations/types"

interface BallMarkerProps {
  config: BallAnimationConfig
  x?: number // horizontal position on field
}

/**
 * BallMarker — Framer Motion animated football element for the Field_Panel.
 *
 * Renders a football shape (ellipse + laces) inside a motion.g SVG group.
 * Animates between yard line positions based on play outcome using ballVariants.
 *
 * Validates: Requirements 2.3, 3.1, 3.2, 3.4, 3.5, 12.1
 */
export function BallMarker({ config, x = 50 }: BallMarkerProps) {
  return (
    <motion.g
      variants={ballVariants}
      initial="idle"
      animate={config.type}
      custom={config}
      transform={`translate(${x}, 0)`}
    >
      {/* Football shape — small ellipse */}
      <ellipse cx={0} cy={0} rx={4} ry={2.5} fill="var(--field-accent, #8B4513)" />
      {/* Laces */}
      <line x1={-2} y1={0} x2={2} y2={0} stroke="white" strokeWidth={0.5} />
    </motion.g>
  )
}
