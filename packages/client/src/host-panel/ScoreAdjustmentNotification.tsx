import { useEffect, useRef, useState } from "react"
import { useGameStore } from "../store/useGameStore"
import type { AdjustmentLogEntry } from "@games-of-chance/shared"

interface Toast {
  id: string
  entry: AdjustmentLogEntry
  playerName: string
}

const TOAST_TIMEOUT_MS = 4500

export default function ScoreAdjustmentNotification() {
  const adjustmentLog = useGameStore((s) => s.roomState?.adjustmentLog ?? [])
  const players = useGameStore((s) => s.roomState?.players ?? [])
  const seenCountRef = useRef(0)
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    const currentLength = adjustmentLog.length
    if (currentLength > seenCountRef.current) {
      const newEntries = adjustmentLog.slice(seenCountRef.current)
      const newToasts: Toast[] = newEntries.map((entry) => {
        const player = players.find((p) => p.id === entry.targetPlayerId)
        return {
          id: entry.id,
          entry,
          playerName: player?.name ?? "Unknown Player",
        }
      })
      setToasts((prev) => [...prev, ...newToasts])
    }
    seenCountRef.current = currentLength
  }, [adjustmentLog, players])

  // Auto-dismiss toasts after timeout
  useEffect(() => {
    if (toasts.length === 0) return

    const timer = setTimeout(() => {
      setToasts((prev) => prev.slice(1))
    }, TOAST_TIMEOUT_MS)

    return () => clearTimeout(timer)
  }, [toasts])

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => {
        const sign = toast.entry.delta >= 0 ? "+" : ""
        return (
          <div
            key={toast.id}
            className="pointer-events-auto animate-fade-in rounded-lg bg-gray-900 px-4 py-3 text-sm text-white shadow-lg max-w-xs"
            role="status"
            aria-live="polite"
          >
            <p>
              <span className="font-semibold">[Host]</span> adjusted{" "}
              <span className="font-semibold">{toast.playerName}</span>&apos;s{" "}
              <span className="text-blue-300">{toast.entry.scoreType}</span> score by{" "}
              <span className={toast.entry.delta >= 0 ? "text-green-400" : "text-red-400"}>
                {sign}{toast.entry.delta}
              </span>
            </p>
            {toast.entry.reason && (
              <p className="mt-1 text-xs text-gray-300">
                Reason: {toast.entry.reason}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
