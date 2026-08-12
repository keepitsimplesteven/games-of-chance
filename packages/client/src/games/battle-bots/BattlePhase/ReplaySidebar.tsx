import { useEffect, useState } from "react"
import { BattleSidebar } from "./BattleSidebar"
import type { TickEntry } from "./ReplayController"

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
}

interface ReplaySidebarProps {
  payloads: TickLogPayload[]
  playerNames: Record<string, string>
}

interface RobotHpState {
  currentHp: number
  maxHp: number
  eliminated: boolean
}

interface BattleHpState {
  battleId: string
  robot1Name: string
  robot2Name: string
  robot1: RobotHpState
  robot2: RobotHpState
  tickIndex: number
  complete: boolean
}

/**
 * ReplaySidebar — Animated sidebar that replays other battles' HP changes
 * in real-time alongside the main battle, using tick log data.
 *
 * Runs a single interval that advances all battles simultaneously at gameSpeed,
 * processing tick entries to update HP state per-robot.
 */
export function ReplaySidebar({ payloads, playerNames }: ReplaySidebarProps) {
  const [battleStates, setBattleStates] = useState<BattleHpState[]>(() =>
    payloads.map((payload) => {
      const [r1, r2] = payload.robots ?? []
      return {
        battleId: payload.battleId,
        robot1Name: `${r1?.name ?? "?"} - ${playerNames[r1?.ownerId ?? ""] ?? "?"}`,
        robot2Name: `${r2?.name ?? "?"} - ${playerNames[r2?.ownerId ?? ""] ?? "?"}`,
        robot1: {
          currentHp: r1?.maxHp ?? 100,
          maxHp: r1?.maxHp ?? 100,
          eliminated: false,
        },
        robot2: {
          currentHp: r2?.maxHp ?? 100,
          maxHp: r2?.maxHp ?? 100,
          eliminated: false,
        },
        tickIndex: -1,
        complete: (payload.tickLog?.length ?? 0) === 0,
      }
    })
  )

  useEffect(() => {
    if (payloads.length === 0) return

    // Use gameSpeed from the first payload (all battles share the same speed)
    const gameSpeed = payloads[0].gameSpeed ?? 100

    const intervalId = window.setInterval(() => {
      setBattleStates((prev) => {
        let changed = false
        const next = prev.map((state, i) => {
          if (state.complete) return state

          const payload = payloads[i]
          const tickLog = payload.tickLog ?? []
          const nextTickIndex = state.tickIndex + 1

          if (nextTickIndex >= tickLog.length) {
            changed = true
            return { ...state, complete: true }
          }

          changed = true
          const tick = tickLog[nextTickIndex]
          const [r1, r2] = payload.robots ?? []
          const r1Id = r1?.ownerId ?? ""
          const r2Id = r2?.ownerId ?? ""

          // Process attacks in this tick to get HP values
          let r1Hp = state.robot1.currentHp
          let r2Hp = state.robot2.currentHp
          let r1Eliminated = state.robot1.eliminated
          let r2Eliminated = state.robot2.eliminated

          for (const attack of tick.attacks) {
            if (attack.targetId === r1Id) {
              r1Hp = attack.targetHpAfter
            } else if (attack.targetId === r2Id) {
              r2Hp = attack.targetHpAfter
            }
          }

          // Process eliminations
          for (const eliminatedId of tick.eliminations) {
            if (eliminatedId === r1Id) r1Eliminated = true
            if (eliminatedId === r2Id) r2Eliminated = true
          }

          const isComplete = nextTickIndex >= tickLog.length - 1

          return {
            ...state,
            tickIndex: nextTickIndex,
            complete: isComplete,
            robot1: { ...state.robot1, currentHp: r1Hp, eliminated: r1Eliminated },
            robot2: { ...state.robot2, currentHp: r2Hp, eliminated: r2Eliminated },
          }
        })

        return changed ? next : prev
      })
    }, gameSpeed)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [payloads])

  // Convert state to sidebar format
  const battles = battleStates.map((state) => ({
    battleId: state.battleId,
    robot1: {
      name: state.robot1Name,
      currentHp: state.robot1.currentHp,
      maxHp: state.robot1.maxHp,
      eliminated: state.robot1.eliminated,
    },
    robot2: {
      name: state.robot2Name,
      currentHp: state.robot2.currentHp,
      maxHp: state.robot2.maxHp,
      eliminated: state.robot2.eliminated,
    },
  }))

  return <BattleSidebar battles={battles} />
}
