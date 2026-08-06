import { motion } from "framer-motion"
import { ballVariants } from "./animations/variants"
import type { BallAnimationConfig } from "./animations/types"

interface BallMarkerProps {
  config: BallAnimationConfig
  x?: number // horizontal position on field
  initialY?: number // initial vertical position (yard line mapped to SVG Y)
}

/**
 * BallMarker — Framer Motion animated football element for the FieldPanel.
 *
 * When config.type is "idle", the ball positions itself directly at initialY
 * (reactive to prop changes, enabling spectator view updates).
 *
 * When config.type is a play animation ("run", "pass", etc.), the ball
 * animates from its current position to config.toY using ballVariants.
 *
 * Validates: Requirements 2.3, 3.1, 3.2, 3.4, 3.5, 12.1
 */
export function BallMarker({ config, x = 50, initialY = 0 }: BallMarkerProps) {
  // For idle mode: position directly at initialY (reactive to prop changes)
  if (config.type === "idle") {
    return (
      <motion.g
        animate={{ y: initialY }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        style={{ x }}
      >
        <ellipse cx={0} cy={0} rx={4} ry={2.5} fill="var(--field-accent, #8B4513)" />
        <line x1={-2} y1={0} x2={2} y2={0} stroke="white" strokeWidth={0.5} />
      </motion.g>
    )
  }

  // For play animations: use variants to animate to toY
  return (
    <motion.g
      variants={ballVariants}
      initial={{ y: initialY }}
      animate={config.type}
      custom={config}
      style={{ x }}
    >
      <ellipse cx={0} cy={0} rx={4} ry={2.5} fill="var(--field-accent, #8B4513)" />
      <line x1={-2} y1={0} x2={2} y2={0} stroke="white" strokeWidth={0.5} />
    </motion.g>
  )
}
