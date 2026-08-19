import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useTheme } from "../../theme"

export interface MatchupEntry {
  playerAName: string
  playerBName: string
  /** Whether the current player is in this matchup */
  isCurrentPlayer?: boolean
}

export interface MatchupIntroProps {
  /** Round name shown at top (e.g., "Quarter-Final", "Semi-Final", "Final") */
  roundName: string
  /** All matchups in this round */
  matchups: MatchupEntry[]
  onComplete: () => void
  durationMs?: number
}

/**
 * MatchupIntro — Reusable VS intro animation shown at the start of a bracket round.
 *
 * Shows the round name at top, then all matchups for the round with player names
 * sliding in from left/right. The current player's matchup gets a highlighted border.
 *
 * Generic enough for playcaller, battle-bots, or any 1v1 matchup game.
 */
export function MatchupIntro({
  roundName,
  matchups,
  onComplete,
  durationMs = 6000,
}: MatchupIntroProps) {
  const theme = useTheme()
  const [fadingOut, setFadingOut] = useState(false)

  useEffect(() => {
    // Start fade-out at durationMs, then call onComplete after the 800ms fade finishes
    const fadeTimer = setTimeout(() => setFadingOut(true), durationMs)
    const completeTimer = setTimeout(onComplete, durationMs + 800)
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(completeTimer)
    }
  }, [onComplete, durationMs])

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 px-4"
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/85"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        />

        {/* Round name */}
        <motion.h2
          className={`relative text-2xl font-black uppercase tracking-widest ${theme.accentText}`}
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          {roundName}
        </motion.h2>

        {/* Matchup list */}
        <div className="relative flex flex-col gap-4 w-full max-w-sm">
          {matchups.map((matchup, i) => (
            <motion.div
              key={i}
              className={`flex items-center justify-center gap-3 rounded-lg px-4 py-3 ${
                matchup.isCurrentPlayer
                  ? "border-2 border-amber-400 bg-white/5"
                  : "border border-white/10 bg-white/[0.02]"
              }`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, delay: 0.2 + i * 0.1, ease: "easeOut" }}
            >
              {/* Player A — slides in from left */}
              <motion.span
                className={`text-base font-bold uppercase tracking-wide text-right flex-1 break-words leading-tight ${theme.bodyText}`}
                style={{ wordBreak: "break-word", minWidth: 0 }}
                initial={{ x: -60, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.35, delay: 0.3 + i * 0.1 }}
              >
                {matchup.playerAName}
              </motion.span>

              {/* VS badge */}
              <motion.span
                className={`text-lg font-black shrink-0 ${theme.accentText}`}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.25, delay: 0.4 + i * 0.1, ease: "backOut" }}
              >
                VS
              </motion.span>

              {/* Player B — slides in from right */}
              <motion.span
                className={`text-base font-bold uppercase tracking-wide text-left flex-1 break-words leading-tight ${theme.bodyText}`}
                style={{ wordBreak: "break-word", minWidth: 0 }}
                initial={{ x: 60, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.35, delay: 0.3 + i * 0.1 }}
              >
                {matchup.playerBName}
              </motion.span>
            </motion.div>
          ))}
        </div>

        {/* Fade out overlay — triggered by timer, not by framer delay */}
        <motion.div
          className="absolute inset-0 bg-black pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: fadingOut ? 1 : 0 }}
          transition={{ duration: 0.8 }}
        />
      </motion.div>
    </AnimatePresence>
  )
}
