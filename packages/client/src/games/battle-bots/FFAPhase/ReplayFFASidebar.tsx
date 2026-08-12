import { useEffect, useState } from "react"
import { FFASidebar } from "./FFASidebar"
import type { TickEntry } from "../BattlePhase/ReplayController"

// ── Types ──

interface TickLogPayload {
  battleId: string
  robots: Array<{
    ownerId: string
    name: string
    stars: { damage: number; accuracy: number; speed: number }
    visual: { weapon: string; head: string; body: string }
    maxHp: number
  }>
  tickLog: TickEntry[]
  gameSpeed: number
  currentTickIndex?: number
}

interface ReplayFFASidebarProps {
  payload: TickLogPayload
  bracketName: string
  playerNames: Record<string, string>
}

interface RobotHpState {
  ownerId: string
  name: string
  currentHp: number
  maxHp: number
  eliminated: boolean
}

/**
 * ReplayFFASidebar — Animated sidebar that replays the other FFA bracket's
 * HP changes in real-time alongside the player's main bracket.
 *
 * Processes the tick log at gameSpeed intervals to progressively update
 * robot HP states, matching how ReplaySidebar works for 1v1 battles.
 */
export function ReplayFFASidebar({ payload, bracketName, playerNames }: ReplayFFASidebarProps) {
  const [robotStates, setRobotStates] = useState<RobotHpState[]>(() =>
    (payload.robots ?? []).map((r) => ({
      ownerId: r.ownerId,
      name: `${r.name} - ${playerNames[r.ownerId] ?? r.ownerId.slice(0, 8)}`,
      currentHp: r.maxHp,
      maxHp: r.maxHp,
      eliminated: false,
    }))
  )

  useEffect(() => {
    const tickLog = payload.tickLog ?? []
    if (tickLog.length === 0) return

    const gameSpeed = payload.gameSpeed ?? 100
    const startIndex = payload.currentTickIndex ?? 0

    // If reconnecting mid-replay, fast-forward to the current tick
    if (startIndex > 0) {
      setRobotStates((prev) => {
        const next = [...prev]
        const ticksToProcess = tickLog.slice(0, startIndex)
        for (const tick of ticksToProcess) {
          for (const attack of tick.attacks) {
            const idx = next.findIndex((r) => r.ownerId === attack.targetId)
            if (idx !== -1) {
              next[idx] = { ...next[idx], currentHp: attack.targetHpAfter }
            }
          }
          for (const eliminatedId of tick.eliminations) {
            const idx = next.findIndex((r) => r.ownerId === eliminatedId)
            if (idx !== -1) {
              next[idx] = { ...next[idx], currentHp: 0, eliminated: true }
            }
          }
        }
        return next
      })
    }

    let currentTick = startIndex

    const intervalId = window.setInterval(() => {
      if (currentTick >= tickLog.length) {
        window.clearInterval(intervalId)
        return
      }

      const tick = tickLog[currentTick]
      currentTick++

      setRobotStates((prev) => {
        const next = [...prev]
        let changed = false

        for (const attack of tick.attacks) {
          const idx = next.findIndex((r) => r.ownerId === attack.targetId)
          if (idx !== -1) {
            next[idx] = { ...next[idx], currentHp: attack.targetHpAfter }
            changed = true
          }
        }

        for (const eliminatedId of tick.eliminations) {
          const idx = next.findIndex((r) => r.ownerId === eliminatedId)
          if (idx !== -1) {
            next[idx] = { ...next[idx], currentHp: 0, eliminated: true }
            changed = true
          }
        }

        return changed ? next : prev
      })
    }, gameSpeed)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [payload, playerNames])

  return <FFASidebar bracketName={bracketName} robots={robotStates} />
}
