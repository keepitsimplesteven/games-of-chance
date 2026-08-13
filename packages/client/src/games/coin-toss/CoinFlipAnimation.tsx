import { useEffect, useMemo, useRef } from "react"
import { motion, useAnimationControls } from "framer-motion"
import { coinFlipVariants } from "./assets/animations/flipVariants"
import coinHeadsSrc from "./assets/sprites/coin-heads.svg"
import coinTailsSrc from "./assets/sprites/coin-tails.svg"

interface CoinFlipAnimationProps {
  result: unknown // CoinTossResult shape: { outcome: "HEADS" | "TAILS", flippedAt: number }
  onAnimationComplete: () => void
}

/** Threshold in ms — if flippedAt is older than this, skip animation (reconnection). */
const SKIP_THRESHOLD_MS = 2000

/**
 * CoinFlipAnimation — 3D CSS rotateY coin flip using Framer Motion.
 *
 * - Synchronizes animation start via result.flippedAt timestamp.
 * - Skips animation on reconnection (flippedAt in the past > 2s).
 * - Lands on the correct face (Heads or Tails) based on result.outcome.
 * - Fires onAnimationComplete when animation finishes.
 * - Sized at 40vmin for portrait/landscape compatibility.
 * - Uses a ref guard to ensure animation only plays once per mount.
 *
 * Validates: Requirements 18.1, 18.2, 18.3, 18.4, 22.5
 */
export function CoinFlipAnimation({
  result,
  onAnimationComplete,
}: CoinFlipAnimationProps) {
  const controls = useAnimationControls()
  const hasPlayed = useRef(false)

  // Parse result — returns null if result is not valid yet
  const parsed = useMemo(() => {
    if (result && typeof result === "object" && "outcome" in result && "flippedAt" in result) {
      const r = result as { outcome: "HEADS" | "TAILS"; flippedAt: number }
      return { outcome: r.outcome, flippedAt: r.flippedAt }
    }
    return null
  }, [result])

  const outcome = parsed?.outcome ?? "HEADS"
  const flippedAt = parsed?.flippedAt ?? 0

  // Determine if animation should be skipped (flippedAt is in the past by > 2 seconds)
  const shouldSkip = useMemo(() => {
    if (!parsed) return false
    const elapsed = Date.now() - flippedAt
    return elapsed > SKIP_THRESHOLD_MS
  }, [parsed, flippedAt])

  // Determine the landed variant based on outcome
  const landedVariant = outcome === "HEADS" ? "landedHeads" : "landedTails"

  useEffect(() => {
    // Wait until we have a valid result before doing anything
    if (!parsed) return

    // Guard: only play once per mount
    if (hasPlayed.current) return
    hasPlayed.current = true

    if (shouldSkip) {
      // Skip animation — show final face immediately and fire callback
      controls.set(landedVariant)
      onAnimationComplete()
      return
    }

    // Play the flip animation sequence
    let cancelled = false

    async function playAnimation() {
      // Start flipping
      await controls.start("flipping")
      if (cancelled) return

      // Land on the correct face
      await controls.start(landedVariant)
      if (cancelled) return

      // Fire completion callback
      onAnimationComplete()
    }

    playAnimation()

    return () => {
      cancelled = true
    }
  }, [parsed, shouldSkip, landedVariant, controls, onAnimationComplete])

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
        animate={controls}
        initial="idle"
      >
        {/* Heads face (front) */}
        <img
          src={coinHeadsSrc}
          alt="Heads"
          className="absolute inset-0 w-full h-full"
          style={{ backfaceVisibility: "hidden" }}
        />
        {/* Tails face (back — rotated 180° on Y axis) */}
        <img
          src={coinTailsSrc}
          alt="Tails"
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
