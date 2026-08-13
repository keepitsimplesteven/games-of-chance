import { motion } from "framer-motion"
import { coinFlipVariants } from "./assets/animations/flipVariants"
import coinHeadsSrc from "./assets/sprites/coin-heads.svg"
import coinTailsSrc from "./assets/sprites/coin-tails.svg"

/**
 * CoinIdleSpin — Shows the coin slowly rotating while waiting for picks.
 * Uses the "slowSpin" variant from flipVariants.
 */
export function CoinIdleSpin() {
  return (
    <div
      className="flex items-center justify-center py-4"
      style={{ perspective: "1000px" }}
    >
      <motion.div
        className="relative"
        style={{
          width: "40vmin",
          height: "40vmin",
          transformStyle: "preserve-3d",
        }}
        variants={coinFlipVariants}
        animate="slowSpin"
        initial="idle"
      >
        {/* Heads face (front) */}
        <img
          src={coinHeadsSrc}
          alt="Coin"
          className="absolute inset-0 w-full h-full"
          style={{ backfaceVisibility: "hidden" }}
        />
        {/* Tails face (back — rotated 180° on Y axis) */}
        <img
          src={coinTailsSrc}
          alt=""
          className="absolute inset-0 w-full h-full"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        />
      </motion.div>
    </div>
  )
}
