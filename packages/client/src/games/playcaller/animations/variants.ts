import type { Variants } from "framer-motion"
import type { BallAnimationConfig } from "./types"

export const ballVariants: Variants = {
  idle: { scale: 1, rotate: 0 },
  run: (config: BallAnimationConfig) => ({
    y: config.toY,
    transition: {
      duration: config.duration,
      ease: "easeInOut",
    },
  }),
  pass: (config: BallAnimationConfig) => ({
    y: config.toY,
    scale: [1, 1.4, 1],
    rotate: [0, 180, 360],
    transition: {
      duration: config.duration,
      ease: "easeOut",
    },
  }),
  turnover: (config: BallAnimationConfig) => ({
    y: config.toY,
    x: [0, -8, 8, -4, 4, 0],
    rotate: [0, -30, 30, -15, 15, 0],
    transition: {
      duration: config.duration,
      ease: "easeOut",
    },
  }),
  touchdown: (config: BallAnimationConfig) => ({
    y: config.toY,
    scale: [1, 1.2, 1.5],
    transition: {
      duration: config.duration,
      ease: "easeOut",
    },
  }),
}

export const playCardVariants: Variants = {
  idle: { scale: 1, opacity: 1, borderColor: "transparent" },
  selected: { scale: 0.95, opacity: 1, borderColor: "var(--accent)" },
  unselected: { scale: 1, opacity: 0.5 },
  disabled: { scale: 1, opacity: 0.6, pointerEvents: "none" },
  highlighted: {
    scale: 1,
    opacity: 1,
    borderColor: "#d4a017",
    boxShadow: "0 0 12px rgba(212, 160, 23, 0.6)",
    pointerEvents: "none",
  },
}

export const historyDrawerVariants: Variants = {
  collapsed: { height: 0, opacity: 0 },
  expanded: { height: "auto", opacity: 1 },
}
