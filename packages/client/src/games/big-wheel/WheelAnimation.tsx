import { useEffect, useRef, useState, useCallback } from "react"
import { WheelSegment } from "./WheelSegment"
import { WheelPointer } from "./WheelPointer"

/** Carnival color palette — ordered from lowest to highest value tier */
const SEGMENT_COLORS = {
  green: "#27ae60",   // lowest tier
  blue: "#2980b9",    // low-mid tier
  yellow: "#f1c40f",  // mid tier
  orange: "#e67e22",  // high tier
  red: "#e74c3c",     // max value only
}

/**
 * Get segment color based on value relative to the reel strip's range.
 * The max value in the strip gets red (exclusive).
 * Remaining values are divided into 4 equal tiers: green, blue, yellow, orange.
 */
function getSegmentColor(value: number, minValue: number, maxValue: number): string {
  if (value === maxValue) return SEGMENT_COLORS.red

  // Normalize remaining values into 4 tiers
  const range = maxValue - minValue
  if (range <= 0) return SEGMENT_COLORS.green

  const normalized = (value - minValue) / (maxValue - minValue) // 0 to <1 (never 1, since max is handled above)
  if (normalized >= 0.75) return SEGMENT_COLORS.orange
  if (normalized >= 0.50) return SEGMENT_COLORS.yellow
  if (normalized >= 0.25) return SEGMENT_COLORS.blue
  return SEGMENT_COLORS.green
}

interface WheelAnimationProps {
  /** Ordered array of numeric values on the wheel */
  reelStrip: number[]
  /** Whether the wheel is currently spinning */
  isSpinning: boolean
  /** The segment index the wheel should land on (null if not yet resolved) */
  landingIndex: number | null
  /** Called when the spin animation finishes */
  onSpinComplete?: () => void
}

/**
 * WheelAnimation — Main animated wheel component.
 *
 * Uses CSS transform on the SVG group for spinning. The pointer is fixed at the top.
 * The wheel rotates so that the winning segment ends up under the pointer.
 *
 * Key geometry: segments are laid out clockwise starting from 12 o'clock (top).
 * Segment 0 occupies the arc from -halfAngle to +halfAngle at the top.
 * To land on segment N, we rotate so that segment N's center is at the top (0°).
 */
export function WheelAnimation({
  reelStrip,
  isSpinning,
  landingIndex,
  onSpinComplete,
}: WheelAnimationProps) {
  const wheelRef = useRef<SVGGElement>(null)
  const [currentRotation, setCurrentRotation] = useState(0)
  const animatingRef = useRef(false)
  const animationFrameRef = useRef<number | null>(null)

  const totalSegments = reelStrip.length
  const anglePerSegment = 360 / totalSegments
  const reelMin = Math.min(...reelStrip)
  const reelMax = Math.max(...reelStrip)

  /**
   * Calculate target rotation to land on a given segment index.
   * Segment N's center is at N * anglePerSegment degrees from the start.
   * We rotate the wheel so that angle ends up at the top (under the pointer).
   * Since we rotate clockwise (positive degrees), we need:
   *   target = currentRotation + fullSpins*360 + offset
   * where offset brings segment N to the top.
   */
  const calculateTargetRotation = useCallback(
    (targetIndex: number) => {
      // Where the segment center currently sits (degrees from top, clockwise)
      // Segment 0 starts at 0°, its center is at halfAngle
      const segmentCenter = targetIndex * anglePerSegment + anglePerSegment / 2
      // Add random variance within the segment: ±40% of half-angle (leaves 10% margin on each edge)
      const variance = (Math.random() - 0.5) * 0.9 * anglePerSegment
      const targetAngle = segmentCenter + variance
      // To bring this angle to the top (0°), rotate by:
      const currentNormalized = ((currentRotation % 360) + 360) % 360
      const needed = (360 - targetAngle - currentNormalized + 720) % 360
      // Add 4-6 full extra rotations for dramatic effect
      const extraRotations = (4 + Math.floor(Math.random() * 3)) * 360
      return currentRotation + extraRotations + needed
    },
    [anglePerSegment, currentRotation]
  )

  const onSpinCompleteRef = useRef(onSpinComplete)
  onSpinCompleteRef.current = onSpinComplete

  const calculateTargetRotationRef = useRef(calculateTargetRotation)
  calculateTargetRotationRef.current = calculateTargetRotation

  useEffect(() => {
    if (isSpinning && landingIndex !== null && !animatingRef.current) {
      animatingRef.current = true

      const targetRotation = calculateTargetRotationRef.current(landingIndex)
      const startRotation = currentRotation
      const totalDelta = targetRotation - startRotation
      const duration = 3500 + Math.random() * 1500 // 3.5–5 seconds
      const startTime = performance.now()

      // Ease-out cubic: decelerates naturally
      const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

      const animate = (now: number) => {
        const elapsed = now - startTime
        const progress = Math.min(elapsed / duration, 1)
        const easedProgress = easeOutCubic(progress)
        const rotation = startRotation + totalDelta * easedProgress

        if (wheelRef.current) {
          wheelRef.current.style.transform = `rotate(${rotation}deg)`
        }

        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(animate)
        } else {
          // Animation complete
          setCurrentRotation(targetRotation)
          animatingRef.current = false
          animationFrameRef.current = null
          onSpinCompleteRef.current?.()
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate)
    }
  }, [isSpinning, landingIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  // Set initial rotation on the element
  useEffect(() => {
    if (wheelRef.current && !animatingRef.current) {
      wheelRef.current.style.transform = `rotate(${currentRotation}deg)`
    }
  }, [currentRotation])

  return (
    <div className="relative flex items-center justify-center w-full h-full">
      {/* Pointer at top */}
      <WheelPointer />

      {/* Wheel SVG */}
      <svg viewBox="0 0 400 400" className="w-full h-full">
        <defs>
          {/* Metallic rim gradient */}
          <linearGradient id="rim-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#d4d4d4" />
            <stop offset="30%" stopColor="#a0a0a0" />
            <stop offset="70%" stopColor="#c8c8c8" />
            <stop offset="100%" stopColor="#909090" />
          </linearGradient>
          {/* Center hub gradient */}
          <radialGradient id="hub-gradient" cx="50%" cy="40%" r="50%">
            <stop offset="0%" stopColor="#f0f0f0" />
            <stop offset="60%" stopColor="#b0b0b0" />
            <stop offset="100%" stopColor="#808080" />
          </radialGradient>
        </defs>

        {/* Metallic rim — thick outer ring */}
        <circle
          cx="200"
          cy="200"
          r="195"
          fill="none"
          stroke="url(#rim-gradient)"
          strokeWidth="12"
        />

        {/* Rotating wheel group */}
        <g
          ref={wheelRef}
          style={{ transformOrigin: "200px 200px", transform: `rotate(${currentRotation}deg)` }}
        >
          {/* Segments */}
          {reelStrip.map((value, index) => (
            <WheelSegment
              key={index}
              value={value}
              index={index}
              totalSegments={totalSegments}
              color={getSegmentColor(value, reelMin, reelMax)}
            />
          ))}
        </g>

        {/* Center hub (non-rotating) */}
        <circle
          cx="200"
          cy="200"
          r="24"
          fill="url(#hub-gradient)"
          stroke="#666"
          strokeWidth="2"
        />
        <circle
          cx="200"
          cy="196"
          r="8"
          fill="white"
          opacity="0.3"
        />
      </svg>
    </div>
  )
}
