import { motion } from "framer-motion"
import { useTheme } from "../../theme"
import { usePlayerName } from "./hooks/usePlayerName"
import { computeDriveSummary } from "./field-utils"
import type { DriveState } from "./field-utils.types"

export interface DriveCompletionOverlayProps {
  driveState: DriveState // must be complete (isComplete === true)
  onAnimationDone: () => void // called after celebration animation completes
  onDismiss?: () => void // optional: called when user taps to dismiss
}

/**
 * DriveCompletionOverlay — Shows touchdown celebration or turnover indicator,
 * drive summary stats, and signals `roundAnimationDone` after animation completes.
 *
 * Tap anywhere to dismiss (calls onDismiss if provided).
 *
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4
 */
export function DriveCompletionOverlay({
  driveState,
  onAnimationDone,
  onDismiss,
}: DriveCompletionOverlayProps) {
  const theme = useTheme()
  const getPlayerName = usePlayerName()
  const summary = computeDriveSummary(driveState)

  // Guard: if completion data is missing, skip rendering
  if (!summary) return null

  const isTouchdown = summary.endingType === "touchdown"

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      onAnimationComplete={onAnimationDone}
      onClick={onDismiss}
      className={`${theme.card} rounded-lg p-4 text-center flex flex-col items-center gap-3 cursor-pointer`}
      role="button"
      tabIndex={0}
      aria-label="Tap to dismiss"
    >
      {/* Outcome indicator */}
      {isTouchdown ? (
        <div className="flex flex-col items-center gap-1">
          <span className="text-3xl" role="img" aria-label="Touchdown celebration">
            🏈🎉
          </span>
          <span className={`text-lg font-bold ${theme.statusSuccess}`}>
            TOUCHDOWN!
          </span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1">
          <span className="text-3xl" role="img" aria-label="Turnover indicator">
            🚫
          </span>
          <span className={`text-lg font-bold ${theme.statusDanger}`}>
            {formatEndingType(summary.endingType)}
          </span>
        </div>
      )}

      {/* Winner name */}
      <span className={`text-base font-bold ${theme.accentText}`}>
        Winner: {getPlayerName(summary.winner)}
      </span>

      {/* Drive summary stats */}
      <div className="flex gap-4">
        <div className="flex flex-col items-center">
          <span className={`text-xl font-bold ${theme.bodyText}`}>
            {summary.totalPlays}
          </span>
          <span className={`text-[10px] ${theme.mutedText}`}>Plays</span>
        </div>
        <div className="flex flex-col items-center">
          <span className={`text-xl font-bold ${theme.bodyText}`}>
            {summary.totalYards}
          </span>
          <span className={`text-[10px] ${theme.mutedText}`}>Yards</span>
        </div>
      </div>

      {/* Dismiss hint */}
      {onDismiss && (
        <span className={`text-[10px] ${theme.mutedText} mt-2`}>
          Tap to dismiss
        </span>
      )}
    </motion.div>
  )
}

/** Maps ending type to a user-friendly display label. */
function formatEndingType(endingType: string): string {
  switch (endingType) {
    case "interception":
      return "INTERCEPTION"
    case "fumble":
      return "FUMBLE"
    case "turnover_on_downs":
      return "TURNOVER ON DOWNS"
    default:
      return "TURNOVER"
  }
}
