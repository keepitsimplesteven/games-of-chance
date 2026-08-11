import { useState, useEffect } from "react"

/**
 * LandscapeInterstitial — Full-screen overlay shown when the device is in
 * landscape orientation AND the viewport height is too short for game UI
 * (< 480px). Prompts the user to rotate back to portrait.
 *
 * Game state is preserved underneath — no unmounting occurs.
 *
 * Validates: Requirements 3.6
 */

const LANDSCAPE_HEIGHT_THRESHOLD = 480

export function LandscapeInterstitial() {
  const [showOverlay, setShowOverlay] = useState(false)

  useEffect(() => {
    const landscapeQuery = window.matchMedia("(orientation: landscape)")

    function evaluate() {
      const isLandscape = landscapeQuery.matches
      const isTooShort = window.innerHeight < LANDSCAPE_HEIGHT_THRESHOLD
      setShowOverlay(isLandscape && isTooShort)
    }

    // Initial check
    evaluate()

    // Listen for orientation changes
    landscapeQuery.addEventListener("change", evaluate)
    // Listen for resize (covers height changes)
    window.addEventListener("resize", evaluate)

    return () => {
      landscapeQuery.removeEventListener("change", evaluate)
      window.removeEventListener("resize", evaluate)
    }
  }, [])

  if (!showOverlay) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-zinc-900/95 backdrop-blur-sm"
      role="alert"
      aria-live="assertive"
    >
      {/* Rotate phone icon with animation */}
      <div className="mb-6 animate-rotate-hint text-6xl" aria-hidden="true">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="72"
          height="72"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-zinc-300"
        >
          {/* Phone body */}
          <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
          {/* Home indicator */}
          <line x1="10" y1="18" x2="14" y2="18" />
          {/* Rotation arrow */}
          <path
            d="M 22 8 A 8 8 0 0 0 16 2"
            className="text-zinc-400"
            stroke="currentColor"
            fill="none"
          />
          <polyline points="22,3 22,8 17,8" className="text-zinc-400" stroke="currentColor" />
        </svg>
      </div>

      <p className="text-center text-lg font-medium text-zinc-200">
        Please rotate to portrait
      </p>
      <p className="mt-2 text-center text-sm text-zinc-400">
        This game works best in portrait orientation
      </p>
    </div>
  )
}

export default LandscapeInterstitial
