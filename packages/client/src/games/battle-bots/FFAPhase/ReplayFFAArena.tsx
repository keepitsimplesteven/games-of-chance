import { useEffect, useRef, useState, useCallback, useMemo, createRef } from "react"
import { useTheme } from "../../../theme"
import { CompositeRobot, type RobotVisualConfig } from "../assets/RobotParts"
import { StarDisplay } from "../PrepPhase/StarDisplay"
import { EnergyBar } from "../BattlePhase/EnergyBar"
import { HPBar } from "../BattlePhase/HPBar"
import { ReplayController, type TickEntry } from "../BattlePhase/ReplayController"
import { AnimationLayer } from "../BattlePhase/animations"

// ── Constants ──

/** Color palette assigned to robots by index (matches VsScreen/ReplayBattleArena) */
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

export interface ReplayFFAArenaProps {
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
  bracketName: string // "Winners Bracket" or "Losers Bracket"
  onComplete?: () => void // called when replay finishes
  initialTickIndex?: number // for reconnect resume — skip ahead to this tick
}

interface RobotHpState {
  currentHp: number
  maxHp: number
  eliminated: boolean
}

interface EliminationRecord {
  ownerId: string
  eliminatedOnTick: number
}

// ── Component ──

/**
 * ReplayFFAArena — FFA-specific replay component with elimination rankings.
 *
 * Uses ReplayController for tick playback (same pattern as ReplayBattleArena).
 * Renders robots in a grid layout with HP bars, stars, and visual SVGs.
 * Displays bracket name header and elimination order/rankings at battle end.
 *
 * Validates: Requirements 13.6, 17.1
 */
export function ReplayFFAArena({
  tickLogPayload,
  playerNames,
  currentPlayerId,
  bracketName,
  onComplete,
  initialTickIndex,
}: ReplayFFAArenaProps) {
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

  // Energy state tracking for EnergyBar display
  const [energyStates, setEnergyStates] = useState<Record<string, number>>({})

  const [isComplete, setIsComplete] = useState(false)
  const [winnerId, setWinnerId] = useState<string | null>(null)
  const [eliminations, setEliminations] = useState<EliminationRecord[]>([])
  const [currentTickEntry, setCurrentTickEntry] = useState<TickEntry | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  // Refs to robot card DOM elements for slide animations
  const robotRefs = useRef<Record<string, React.RefObject<HTMLDivElement>>>({})
  if (Object.keys(robotRefs.current).length === 0 || !robots.every(r => r.ownerId in robotRefs.current)) {
    const refs: Record<string, React.RefObject<HTMLDivElement>> = {}
    for (const robot of robots) {
      refs[robot.ownerId] = robotRefs.current[robot.ownerId] ?? createRef<HTMLDivElement>()
    }
    robotRefs.current = refs
  }

  // Refs specifically to the robot SVG container divs (for hit effects & damage numbers)
  const robotSvgRefs = useRef<Record<string, React.RefObject<HTMLDivElement>>>({})
  if (Object.keys(robotSvgRefs.current).length === 0 || !robots.every(r => r.ownerId in robotSvgRefs.current)) {
    const refs: Record<string, React.RefObject<HTMLDivElement>> = {}
    for (const robot of robots) {
      refs[robot.ownerId] = robotSvgRefs.current[robot.ownerId] ?? createRef<HTMLDivElement>()
    }
    robotSvgRefs.current = refs
  }

  // Color assignments for animation layer
  const robotColors = useMemo(() => {
    const colors: Record<string, string> = {}
    for (let i = 0; i < robots.length; i++) {
      const robot = robots[i]
      colors[robot.ownerId] = robot.visual?.color ?? ROBOT_COLORS[i % ROBOT_COLORS.length]
    }
    return colors
  }, [robots])

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

  // Process a tick entry to update HP states and track eliminations
  const processTick = useCallback((tickEntry: TickEntry) => {
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

    // Record eliminations for ranking display
    if (tickEntry.eliminations.length > 0) {
      setEliminations((prev) => [
        ...prev,
        ...tickEntry.eliminations.map((ownerId) => ({
          ownerId,
          eliminatedOnTick: tickEntry.tick,
        })),
      ])
    }
  }, [])

  // Start replay on mount
  useEffect(() => {
    const controller = new ReplayController()
    controllerRef.current = controller

    // If reconnecting mid-replay, fast-forward HP state to the target tick
    if (initialTickIndex && initialTickIndex > 0 && tickLog.length > 0) {
      // Process all ticks from 0 to initialTickIndex-1 silently to build HP state
      const ticksToProcess = tickLog.slice(0, initialTickIndex)
      for (const tick of ticksToProcess) {
        // Apply attacks and eliminations directly to build up state
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

        // Record eliminations for ranking display
        if (tick.eliminations.length > 0) {
          setEliminations((prev) => [
            ...prev,
            ...tick.eliminations.map((ownerId) => ({
              ownerId,
              eliminatedOnTick: tick.tick,
            })),
          ])
        }
      }

      // Initialize energy state directly from the reconnect tick's TickEntry (no iteration)
      const reconnectTick = tickLog[initialTickIndex - 1]
      if (reconnectTick?.energyStates) {
        setEnergyStates(reconnectTick.energyStates)
      }
    }

    // Register tick callback (processes ticks during live playback)
    controller.onTick((tickEntry) => {
      processTick(tickEntry)
      setCurrentTickEntry(tickEntry)
      setEnergyStates(tickEntry.energyStates ?? {})
    })

    // Start playback and jump to reconnect position if needed
    controller.start(tickLog, gameSpeed)
    setIsPlaying(true)
    if (initialTickIndex && initialTickIndex > 0 && tickLog.length > 0) {
      controller.jumpToTick(initialTickIndex)
    }

    // Poll for completion and isPlaying state
    const checkInterval = window.setInterval(() => {
      const state = controller.getCurrentState()
      setIsPlaying(state.isPlaying)
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

  // Build ranked elimination list: last survivor = #1, later elimination = higher rank
  const rankings = useMemo(() => {
    if (!isComplete) return []

    // Sort eliminations by tick descending (later = higher rank)
    const sorted = [...eliminations].sort(
      (a, b) => b.eliminatedOnTick - a.eliminatedOnTick
    )

    const result: Array<{
      rank: number
      ownerId: string
      robotName: string
      playerName: string
      eliminatedOnTick: number | null // null = survivor
    }> = []

    // Survivor gets rank 1
    if (winnerId) {
      const robot = robots.find((r) => r.ownerId === winnerId)
      result.push({
        rank: 1,
        ownerId: winnerId,
        robotName: robot?.name ?? "Unknown",
        playerName: playerNames[winnerId] ?? "Unknown",
        eliminatedOnTick: null,
      })
    }

    // Assign ranks to eliminated robots
    // Robots eliminated on the same tick share the same rank
    let currentRank = 2
    let prevTick: number | null = null

    for (let i = 0; i < sorted.length; i++) {
      const entry = sorted[i]
      const robot = robots.find((r) => r.ownerId === entry.ownerId)

      // Same tick as previous → same rank
      if (prevTick !== null && entry.eliminatedOnTick === prevTick) {
        result.push({
          rank: currentRank,
          ownerId: entry.ownerId,
          robotName: robot?.name ?? "Unknown",
          playerName: playerNames[entry.ownerId] ?? "Unknown",
          eliminatedOnTick: entry.eliminatedOnTick,
        })
      } else {
        // Different tick → increment rank (unless first eliminated entry)
        if (i > 0) {
          currentRank++
        }
        result.push({
          rank: currentRank,
          ownerId: entry.ownerId,
          robotName: robot?.name ?? "Unknown",
          playerName: playerNames[entry.ownerId] ?? "Unknown",
          eliminatedOnTick: entry.eliminatedOnTick,
        })
      }

      prevTick = entry.eliminatedOnTick
    }

    return result
  }, [isComplete, eliminations, winnerId, robots, playerNames])

  // Determine if this is a battle involving the current player
  const isPlayerBattle =
    currentPlayerId != null &&
    robots.some((r) => r.ownerId === currentPlayerId)

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-md p-3 lg:p-6 ${
        isPlayerBattle
          ? "border-4 border-[#f5c542] bg-[#1b5e2a] shadow-[inset_0_0_20px_rgba(0,0,0,0.4)]"
          : `${theme.card}`
      }`}
    >
      {/* Bracket name header */}
      <h2 className={`mb-2 text-center text-base lg:text-lg font-bold ${theme.headingText}`}>
        {bracketName}
      </h2>

      {isPlayerBattle && (
        <p
          className={`mb-2 text-center text-xs lg:text-sm font-semibold uppercase tracking-wide ${theme.accentText}`}
        >
          Your Battle
        </p>
      )}

      {/* Robot grid — scrollable on mobile for 5+ players */}
      <div className="min-h-0 flex-0 overflow-y-auto">
        <div className="relative">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:gap-4">
            {robots.map((robot, index) => (
              <FFARobotFighter
                key={robot.ownerId}
                robot={robot}
                index={index}
                hpState={hpStates[robot.ownerId]}
                currentEnergy={energyStates[robot.ownerId] ?? 0}
                gameSpeed={gameSpeed}
                playerName={playerNames[robot.ownerId] ?? "Unknown"}
                isWinner={isComplete && winnerId === robot.ownerId}
                cardRef={robotRefs.current[robot.ownerId]}
                svgRef={robotSvgRefs.current[robot.ownerId]}
              />
            ))}
          </div>
          <AnimationLayer
            tickEntry={currentTickEntry}
            hpStates={hpStates}
            robots={robots}
            robotColors={robotColors}
            gameSpeed={gameSpeed}
            isPlaying={isPlaying}
            isComplete={isComplete}
            mode="ffa"
            robotRefs={robotRefs.current}
            robotSvgRefs={robotSvgRefs.current}
          />
        </div>

        {/* End-of-battle winner announcement */}
        {isComplete && winnerId && (
          <div className="mt-3 text-center">
            <span
              className={`inline-block rounded-md px-3 py-1.5 text-xs lg:text-sm font-bold uppercase tracking-wide ${theme.accentText} bg-[#0f3d18] border border-[#f5c542]`}
            >
              🏆 Winner: {robots.find((r) => r.ownerId === winnerId)?.name ?? "Unknown"} —{" "}
              {playerNames[winnerId] ?? "Unknown"}
            </span>
          </div>
        )}

        {/* Elimination order rankings panel */}
        {isComplete && rankings.length > 0 && (
          <EliminationRankings
            rankings={rankings}
            currentPlayerId={currentPlayerId}
          />
        )}
      </div>
    </div>
  )
}

// ── Elimination Rankings Panel ──

interface EliminationRankingsProps {
  rankings: Array<{
    rank: number
    ownerId: string
    robotName: string
    playerName: string
    eliminatedOnTick: number | null
  }>
  currentPlayerId: string | null
}

function EliminationRankings({ rankings, currentPlayerId }: EliminationRankingsProps) {
  const theme = useTheme()

  return (
    <div className={`mt-4 rounded-md p-3 lg:p-4 ${theme.card}`}>
      <h3 className={`mb-2 text-xs font-bold uppercase tracking-wide ${theme.headingText}`}>
        FFA Complete
      </h3>
      <ol className="max-h-[180px] space-y-1.5 overflow-y-auto lg:max-h-[240px]">
        {rankings.map((entry) => {
          const isCurrentPlayer = entry.ownerId === currentPlayerId
          const isSurvivor = entry.eliminatedOnTick === null

          return (
            <li
              key={entry.ownerId}
              className={`flex items-center justify-between rounded-md px-2 py-1.5 lg:px-3 lg:py-2 ${
                isCurrentPlayer
                  ? "border border-[#f5c542] bg-[#0f3d18]"
                  : "border border-[#2a7a3a]/40 bg-[#0f3d18]/50"
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Rank badge */}
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    entry.rank === 1
                      ? "bg-[#f5c542] text-[#111111]"
                      : entry.rank === 2
                        ? "bg-[#c0c0c0] text-[#111111]"
                        : entry.rank === 3
                          ? "bg-[#cd7f32] text-[#111111]"
                          : "bg-[#2a7a3a] text-[#f0f0f0]"
                  }`}
                >
                  {entry.rank}
                </span>

                {/* Robot name and player name */}
                <span
                  className={`text-sm font-mono ${
                    isCurrentPlayer ? "text-[#f5c542]" : "text-[#f0f0f0]"
                  }`}
                >
                  {entry.robotName} — {entry.playerName}
                </span>
              </div>

              {/* Elimination info */}
              <span className={`text-xs font-mono ${theme.mutedText}`}>
                {isSurvivor ? "🏆 Survived" : `Eliminated`}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

// ── FFA Robot Fighter Card ──

interface FFARobotFighterProps {
  robot: ReplayFFAArenaProps["tickLogPayload"]["robots"][number]
  index: number
  hpState: RobotHpState | undefined
  currentEnergy: number
  gameSpeed: number
  playerName: string
  isWinner: boolean
  cardRef?: React.RefObject<HTMLDivElement>
  svgRef?: React.RefObject<HTMLDivElement>
}

function FFARobotFighter({
  robot,
  index,
  hpState,
  currentEnergy,
  gameSpeed,
  playerName,
  isWinner,
  cardRef,
  svgRef,
}: FFARobotFighterProps) {
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
    <div ref={cardRef} className="flex flex-1 flex-col items-center gap-1 lg:gap-2">
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
        ref={svgRef}
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

      {/* HP Bar + Energy Bar */}
      <div className="w-full max-w-[120px] lg:max-w-[160px]">
        <HPBar currentHp={currentHp} maxHp={maxHp} />
        <EnergyBar currentEnergy={currentEnergy} maxEnergy={100} gameSpeed={gameSpeed} isEliminated={eliminated} />
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
