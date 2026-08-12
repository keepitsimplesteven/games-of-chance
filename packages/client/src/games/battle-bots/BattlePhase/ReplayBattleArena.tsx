import { useEffect, useRef, useState, useCallback } from "react"
import { useTheme } from "../../../theme"
import { CompositeRobot, type RobotVisualConfig } from "../assets/RobotParts"
import { StarDisplay } from "../PrepPhase/StarDisplay"
import { HPBar } from "./HPBar"
import { ReplayController, type TickEntry } from "./ReplayController"

// ── Constants ──

/** Color palette assigned to robots by index (matches VsScreen) */
const ROBOT_COLORS = [
  "#e53935", // red
  "#1e88e5", // blue
  "#43a047", // green
  "#fb8c00", // orange
  "#8e24aa", // purple
  "#00acc1", // cyan
  "#f4511e", // deep orange
  "#7cb342", // light green
]

// ── Types ──

export interface ReplayBattleArenaProps {
  tickLogPayload: {
    battleId: string
    robots: Array<{
      ownerId: string
      name: string
      stars: { damage: number; accuracy: number; speed: number }
      visual: { weapon: string; head: string; body: string; color?: string }
      maxHp: number
    }>
    tickLog: TickEntry[]
    gameSpeed: number
  }
  playerNames: Record<string, string> // ownerId → player display name
  currentPlayerId: string | null
  onComplete?: () => void // called when replay finishes
  initialTickIndex?: number // for reconnect resume — skip ahead to this tick
}

interface RobotHpState {
  currentHp: number
  maxHp: number
  eliminated: boolean
}

// ── Component ──

/**
 * ReplayBattleArena — Replay-driven battle display using tick log data.
 *
 * Renders composed robot SVGs via RobotParts, shows HP bars updating per tick,
 * displays star values and "RobotName - PlayerName" labels.
 * Greyed-out robots with "defeated" indicator when eliminated.
 * Shows winner after final tick.
 *
 * Validates: Requirements 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 7.5
 */
export function ReplayBattleArena({
  tickLogPayload,
  playerNames,
  currentPlayerId,
  onComplete,
  initialTickIndex,
}: ReplayBattleArenaProps) {
  const theme = useTheme()
  const controllerRef = useRef<ReplayController | null>(null)

  const { robots, tickLog, gameSpeed } = tickLogPayload

  // Initialize HP state: all robots start at maxHp, not eliminated
  const [hpStates, setHpStates] = useState<Record<string, RobotHpState>>(() => {
    const initial: Record<string, RobotHpState> = {}
    for (const robot of robots) {
      initial[robot.ownerId] = {
        currentHp: robot.maxHp,
        maxHp: robot.maxHp,
        eliminated: false,
      }
    }
    return initial
  })

  const [isComplete, setIsComplete] = useState(false)
  const [winnerId, setWinnerId] = useState<string | null>(null)

  // Determine winner from the final state of the tick log
  const determineWinner = useCallback(
    (states: Record<string, RobotHpState>): string | null => {
      const survivors = Object.entries(states).filter(([, s]) => !s.eliminated)
      if (survivors.length === 1) {
        return survivors[0][0]
      }
      return null
    },
    []
  )

  // Process a tick entry to update HP states
  const processTick = useCallback(
    (tickEntry: TickEntry) => {
      setHpStates((prev) => {
        const next = { ...prev }

        // Track the latest HP for each target from attacks in this tick
        for (const attack of tickEntry.attacks) {
          if (next[attack.targetId]) {
            next[attack.targetId] = {
              ...next[attack.targetId],
              currentHp: attack.targetHpAfter,
            }
          }
        }

        // Mark eliminations
        for (const eliminatedId of tickEntry.eliminations) {
          if (next[eliminatedId]) {
            next[eliminatedId] = {
              ...next[eliminatedId],
              currentHp: 0,
              eliminated: true,
            }
          }
        }

        return next
      })
    },
    []
  )

  // Start replay on mount
  useEffect(() => {
    const controller = new ReplayController()
    controllerRef.current = controller

    // If reconnecting mid-replay, fast-forward HP state to the target tick
    if (initialTickIndex && initialTickIndex > 0 && tickLog.length > 0) {
      // Process all ticks from 0 to initialTickIndex-1 silently to build HP state
      const ticksToProcess = tickLog.slice(0, initialTickIndex)
      for (const tick of ticksToProcess) {
        // Apply attacks
        setHpStates((prev) => {
          const next = { ...prev }
          for (const attack of tick.attacks) {
            if (next[attack.targetId]) {
              next[attack.targetId] = {
                ...next[attack.targetId],
                currentHp: attack.targetHpAfter,
              }
            }
          }
          for (const eliminatedId of tick.eliminations) {
            if (next[eliminatedId]) {
              next[eliminatedId] = {
                ...next[eliminatedId],
                currentHp: 0,
                eliminated: true,
              }
            }
          }
          return next
        })
      }
    }

    // Register tick callback (processes ticks during live playback)
    controller.onTick((tickEntry) => {
      processTick(tickEntry)
    })

    // Start playback and jump to reconnect position if needed
    controller.start(tickLog, gameSpeed)
    if (initialTickIndex && initialTickIndex > 0 && tickLog.length > 0) {
      controller.jumpToTick(initialTickIndex)
    }

    // Poll for completion
    const checkInterval = window.setInterval(() => {
      const state = controller.getCurrentState()
      if (state.isComplete) {
        setIsComplete(true)
        window.clearInterval(checkInterval)
      }
    }, gameSpeed)

    return () => {
      window.clearInterval(checkInterval)
      controller.destroy()
    }
  }, [tickLog, gameSpeed, processTick, initialTickIndex])

  // When complete, determine winner and fire callback
  useEffect(() => {
    if (isComplete) {
      const winner = determineWinner(hpStates)
      setWinnerId(winner)
      onComplete?.()
    }
  }, [isComplete, hpStates, determineWinner, onComplete])

  // Determine if this is a battle involving the current player
  const isPlayerBattle =
    currentPlayerId != null &&
    robots.some((r) => r.ownerId === currentPlayerId)

  const is1v1 = robots.length === 2

  return (
    <div
      className={`rounded-md p-3 lg:p-6 ${
        isPlayerBattle
          ? "border-4 border-[#f5c542] bg-[#1b5e2a] shadow-[inset_0_0_20px_rgba(0,0,0,0.4)]"
          : `${theme.card}`
      }`}
    >
      {isPlayerBattle && (
        <h2
          className={`mb-4 text-center text-sm font-semibold uppercase tracking-wide ${theme.accentText}`}
        >
          Your Battle
        </h2>
      )}

      {is1v1 ? (
        <Layout1v1
          robots={robots}
          hpStates={hpStates}
          playerNames={playerNames}
          winnerId={winnerId}
          isComplete={isComplete}
        />
      ) : (
        <LayoutFFA
          robots={robots}
          hpStates={hpStates}
          playerNames={playerNames}
          winnerId={winnerId}
          isComplete={isComplete}
        />
      )}

      {/* End-of-battle winner announcement */}
      {isComplete && winnerId && (
        <div className="mt-4 text-center">
          <span
            className={`inline-block rounded-md px-4 py-2 text-sm font-bold uppercase tracking-wide ${theme.accentText} bg-[#0f3d18] border border-[#f5c542]`}
          >
            🏆 Winner: {robots.find((r) => r.ownerId === winnerId)?.name ?? "Unknown"} —{" "}
            {playerNames[winnerId] ?? "Unknown"}
          </span>
        </div>
      )}
    </div>
  )
}

// ── 1v1 Layout ──

interface LayoutProps {
  robots: ReplayBattleArenaProps["tickLogPayload"]["robots"]
  hpStates: Record<string, RobotHpState>
  playerNames: Record<string, string>
  winnerId: string | null
  isComplete: boolean
}

function Layout1v1({ robots, hpStates, playerNames, winnerId, isComplete }: LayoutProps) {
  const theme = useTheme()
  const [robot1, robot2] = robots

  return (
    <div className="flex items-center justify-between gap-2 lg:gap-4">
      {/* Robot 1 (left side) */}
      {robot1 && (
        <ReplayRobotFighter
          robot={robot1}
          index={0}
          hpState={hpStates[robot1.ownerId]}
          playerName={playerNames[robot1.ownerId] ?? "Unknown"}
          isWinner={isComplete && winnerId === robot1.ownerId}
        />
      )}

      {/* VS divider */}
      <div className="flex flex-col items-center gap-1">
        <span className={`text-xl lg:text-2xl font-black ${theme.mutedText}`}>VS</span>
      </div>

      {/* Robot 2 (right side) */}
      {robot2 && (
        <ReplayRobotFighter
          robot={robot2}
          index={1}
          hpState={hpStates[robot2.ownerId]}
          playerName={playerNames[robot2.ownerId] ?? "Unknown"}
          isWinner={isComplete && winnerId === robot2.ownerId}
        />
      )}
    </div>
  )
}

// ── FFA Layout ──

function LayoutFFA({ robots, hpStates, playerNames, winnerId, isComplete }: LayoutProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:gap-4">
      {robots.map((robot, index) => (
        <ReplayRobotFighter
          key={robot.ownerId}
          robot={robot}
          index={index}
          hpState={hpStates[robot.ownerId]}
          playerName={playerNames[robot.ownerId] ?? "Unknown"}
          isWinner={isComplete && winnerId === robot.ownerId}
        />
      ))}
    </div>
  )
}

// ── Robot Fighter Card ──

interface ReplayRobotFighterProps {
  robot: ReplayBattleArenaProps["tickLogPayload"]["robots"][number]
  index: number
  hpState: RobotHpState | undefined
  playerName: string
  isWinner: boolean
}

function ReplayRobotFighter({
  robot,
  index,
  hpState,
  playerName,
  isWinner,
}: ReplayRobotFighterProps) {
  const theme = useTheme()
  const color = robot.visual?.color ?? ROBOT_COLORS[index % ROBOT_COLORS.length]
  const currentHp = hpState?.currentHp ?? robot.maxHp
  const maxHp = hpState?.maxHp ?? robot.maxHp
  const eliminated = hpState?.eliminated ?? false

  // Fallback for missing/incomplete visual config
  const visual = robot.visual ?? { weapon: "drill", head: "square", body: "square" }
  const visualConfig: RobotVisualConfig = {
    weaponType: (visual.weapon || "drill") as RobotVisualConfig["weaponType"],
    headType: (visual.head || "square") as RobotVisualConfig["headType"],
    bodyType: (visual.body || "square") as RobotVisualConfig["bodyType"],
    color,
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-1 lg:gap-2">
      {/* Status label */}
      <div className="h-5 lg:h-6">
        {isWinner && (
          <span className={`animate-pulse text-xs lg:text-sm font-bold ${theme.accentText}`}>
            🏆 WINNER!
          </span>
        )}
        {eliminated && !isWinner && (
          <span className={`text-xs lg:text-sm font-bold ${theme.statusDanger}`}>DEFEATED</span>
        )}
      </div>

      {/* Robot SVG */}
      <div
        className={`relative transition-all ${
          eliminated ? "opacity-50 grayscale" : ""
        }`}
      >
        <CompositeRobot config={visualConfig} size={56} className="lg:hidden" />
        <CompositeRobot config={visualConfig} size={80} className="hidden lg:block" />

        {/* Defeated overlay */}
        {eliminated && (
          <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/40">
            <span className={`text-xl lg:text-2xl font-black ${theme.statusDanger}`}>✕</span>
          </div>
        )}
      </div>

      {/* Robot name - Player name */}
      <span
        className={`text-center text-xs lg:text-sm font-semibold ${
          eliminated ? "text-[#3a9a4a]/40 line-through" : theme.bodyText
        }`}
      >
        {robot.name} - {playerName}
      </span>

      {/* HP Bar */}
      <div className="w-full max-w-[120px] lg:max-w-[160px]">
        <HPBar currentHp={currentHp} maxHp={maxHp} />
      </div>

      {/* Star values */}
      <StarDisplay
        damage={robot.stars.damage}
        accuracy={robot.stars.accuracy}
        speed={robot.stars.speed}
      />
    </div>
  )
}
