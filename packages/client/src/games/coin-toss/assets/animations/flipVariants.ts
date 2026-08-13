import type { Variants } from "framer-motion"

/** Coin flip animation variants — swap these to change the feel */
export const coinFlipVariants: Variants = {
  idle: { rotateY: 0, scale: 1 },
  slowSpin: {
    rotateY: [0, 360],
    scale: 1,
    transition: { duration: 6, ease: "linear", repeat: Infinity },
  },
  flipping: {
    rotateY: [0, 360, 720, 1080, 1440],
    scale: [1, 1.1, 1, 1.1, 1],
    transition: { duration: 1.8, ease: "easeOut" },
  },
  landedHeads: {
    rotateY: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 300, damping: 20 },
  },
  landedTails: {
    rotateY: 180,
    scale: 1,
    transition: { type: "spring", stiffness: 300, damping: 20 },
  },
}
