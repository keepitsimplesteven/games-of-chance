import { useState, useEffect, useRef, useCallback } from "react"
import { motion } from "framer-motion"
import type { CommentaryLines } from "./play-by-play/selectCommentary"

/** Configurable timing for the play-by-play sequence (milliseconds) */
export const PLAY_TIMELINE = {
  /** Delay before showing preSnap line after play key changes */
  preSnapDelay: 200,
  /** Duration preSnap is visible before activePlay appears */
  preSnapHold: 1500,
  /** Duration activePlay is visible before outcome appears */
  activePlayHold: 2500,
  /** Extra time after outcome is shown (linger before next play) */
  outcomeHold: 2500,
} as const

export type PlayPhase = "idle" | "preSnap" | "activePlay" | "outcome" | "done"

export interface PlayByPlayAnnouncerProps {
  /** Commentary lines for the current play, or null if none available */
  commentary: CommentaryLines | null
  /** Unique key to reset the animation sequence (e.g. play history length) */
  playKey: number
  /** Called when the outcome phase begins — trigger ball animation here */
  onOutcomeReveal?: () => void
  /** Called when the full sequence is done (after outcome linger) */
  onSequenceDone?: () => void
}

/**
 * PlayByPlayAnnouncer — Sequences 3 announcer lines with configurable timing.
 *
 * Timeline:
 * 1. preSnap fades in (after preSnapDelay)
 * 2. Hold preSnapHold ms
 * 3. activePlay fades in
 * 4. Hold activePlayHold ms
 * 5. outcome fades in + onOutcomeReveal fires (ball animates)
 * 6. Hold outcomeHold ms + onSequenceDone fires
 *
 * When commentary is null, fires onOutcomeReveal immediately (no delay)
 * and renders an empty spacer.
 */
export function PlayByPlayAnnouncer({
  commentary,
  playKey,
  onOutcomeReveal,
  onSequenceDone,
}: PlayByPlayAnnouncerProps) {
  const [phase, setPhase] = useState<PlayPhase>("idle")
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const lastPlayKeyRef = useRef<number>(-1)

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => clearTimeout(t))
    timersRef.current = []
  }, [])

  useEffect(() => {
    // Only run the sequence once per new playKey
    if (playKey === lastPlayKeyRef.current) return
    lastPlayKeyRef.current = playKey

    clearTimers()
    setPhase("idle")

    // playKey 0 means no plays have resolved yet — nothing to announce
    if (playKey === 0) return

    // No commentary → still delay briefly before revealing outcome
    // (gives a beat before the field updates, avoids jarring instant move)
    if (!commentary) {
      const timer = setTimeout(() => {
        onOutcomeReveal?.()
        onSequenceDone?.()
      }, 500)
      timersRef.current = [timer]
      return
    }

    const { preSnapDelay, preSnapHold, activePlayHold, outcomeHold } = PLAY_TIMELINE
    const timers: ReturnType<typeof setTimeout>[] = []

    // Phase 1: preSnap
    timers.push(setTimeout(() => {
      setPhase("preSnap")
    }, preSnapDelay))

    // Phase 2: activePlay
    timers.push(setTimeout(() => {
      setPhase("activePlay")
    }, preSnapDelay + preSnapHold))

    // Phase 3: outcome + trigger ball animation
    timers.push(setTimeout(() => {
      setPhase("outcome")
      onOutcomeReveal?.()
    }, preSnapDelay + preSnapHold + activePlayHold))

    // Phase 4: done
    timers.push(setTimeout(() => {
      setPhase("done")
      onSequenceDone?.()
    }, preSnapDelay + preSnapHold + activePlayHold + outcomeHold))

    timersRef.current = timers

    return clearTimers
  }, [playKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // No commentary — render empty spacer
  if (!commentary) {
    return <div className="shrink-0 h-[52px]" />
  }

  const lines: Array<{ text: string; visible: boolean }> = [
    { text: commentary.preSnap, visible: phase === "preSnap" || phase === "activePlay" || phase === "outcome" || phase === "done" },
    { text: commentary.activePlay, visible: phase === "activePlay" || phase === "outcome" || phase === "done" },
    { text: commentary.outcome, visible: phase === "outcome" || phase === "done" },
  ]

  return (
    <div className="shrink-0 min-h-[52px] max-h-[64px] overflow-hidden flex flex-col justify-center px-1">
      <div className="flex flex-col gap-0.5">
        {lines.map((line, i) => (
          <motion.div
            key={`${playKey}-${i}`}
            initial={{ opacity: 0, y: 4 }}
            animate={
              line.visible
                ? { opacity: 1, y: 0 }
                : { opacity: 0, y: 4 }
            }
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="text-[12px] text-white/90 leading-snug"
          >
            {line.text}
          </motion.div>
        ))}
      </div>
    </div>
  )
}
