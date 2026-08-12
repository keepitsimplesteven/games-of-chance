import { useEffect, useState } from "react"
import { useGameStore } from "../../store/useGameStore"
import { useTheme } from "../../theme"
import { PartCarousel } from "./PrepPhase/PartCarousel"
import { VsScreen, type VsRobot } from "./BattlePhase/VsScreen"
import { ReplayBattleArena } from "./BattlePhase/ReplayBattleArena"
import { ReplayFFAArena } from "./FFAPhase/ReplayFFAArena"
import { ReplaySidebar } from "./BattlePhase/ReplaySidebar"
import { ReplayFFASidebar } from "./FFAPhase/ReplayFFASidebar"
import { FinalRankings } from "./Results/FinalRankings"
import { CompositeRobot, type RobotVisualConfig } from "./assets/RobotParts"

// ── Types for TickLogPayload received from server ──

interface TickLogPayload {
  battleId: string
  robots: Array<{
    ownerId: string
    name: string
    stars: { damage: number; accuracy: number; speed: number }
    visual: { weapon: string; head: string; body: string; color?: string }
    maxHp: number
  }>
  tickLog: Array<{
    tick: number
    attacks: Array<{
      attackerId: string
      targetId: string
      hit: boolean
      damage: number
      targetHpAfter: number
    }>
    eliminations: string[]
  }>
  gameSpeed: number
  currentTickIndex?: number // present on reconnect — indicates replay position
}

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

/**
 * BattleBotsView — Main container that switches between PrepPhase, BattlePhase,
 * FFAPhase, and Results based on the current round number and phase.
 *
 * Reads room state from useGameStore and renders the appropriate sub-view:
 * - Round 1 + PICKING → PartCarousel
 * - Round 1 + RESULT → "Selections confirmed" message
 * - Round 2 + RESOLVING → VsScreen → ReplayBattleArena
 * - Round 2 + RESULT → Battle results summary
 * - Round 3 + RESOLVING → VsScreen → ReplayFFAArena
 * - Round 3 + RESULT → FinalRankings
 *
 * Uses retro-casino theme tokens.
 * Validates: Requirements 7.2, 7.3, 13.6, 16.1
 */
export function BattleBotsView() {
  const theme = useTheme()
  const roomState = useGameStore((s) => s.roomState)
  const playerId = useGameStore((s) => s.playerId)

  // VsScreen → Replay transition state for Round 2 and Round 3
  const [phase2ShowVs, setPhase2ShowVs] = useState(true)
  const [phase3ShowVs, setPhase3ShowVs] = useState(true)

  if (!roomState) return null

  const { phase, roundNumber, pickDeadlineMs, result } = roomState.round

  // Reset VsScreen state when round/phase changes
  useEffect(() => {
    if (roundNumber === 2 && phase === "RESOLVING") {
      setPhase2ShowVs(true)
    }
    if (roundNumber === 3 && phase === "RESOLVING") {
      setPhase3ShowVs(true)
    }
  }, [roundNumber, phase])

  // Battle-bots has no RESULT animation — mark animation as done immediately
  // so the "Next Round" button becomes enabled
  useEffect(() => {
    if (phase === "RESULT") {
      useGameStore.setState({ roundAnimationDone: true })
    }
  }, [phase, roundNumber])

  // ── Helper: build playerNames map from roomState.players ──

  const playerNames: Record<string, string> = {}
  for (const player of roomState.players) {
    playerNames[player.id] = player.name
  }

  // ── Round 1: Prep Phase ────────────────────────────────────────────────

  if (roundNumber === 1 && phase === "PICKING") {
    return <PartCarousel pickDeadlineMs={pickDeadlineMs} />
  }

  if (roundNumber === 1 && phase === "RESULT") {
    const roundResult = result as Record<string, unknown> | null
    const builds = (roundResult?.builds ?? {}) as Record<string, {
      ownerId: string
      name: string
      stars: { damage: number; accuracy: number; speed: number }
      visual: { weapon: string; head: string; body: string; color?: string }
      maxHp: number
    }>

    const myRobot = playerId ? builds[playerId] : null
    const buildEntries = Object.entries(builds)

    return (
      <div className={`flex h-full flex-col gap-3 overflow-hidden px-3 py-3 ${theme.font}`}>
        {/* Player's robot name reveal */}
        {myRobot && (
          <div className="text-center">
            <p className={`text-xs uppercase tracking-wide ${theme.mutedText}`}>Your robot</p>
            <h2 className={`text-lg font-bold ${theme.accentText}`}>{myRobot.name}</h2>
          </div>
        )}

        {/* Title */}
        <h3 className={`text-center text-sm font-bold uppercase tracking-wide ${theme.headingText}`}>
          Battle Ready!
        </h3>

        {/* Grid of all robots */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {buildEntries.map(([pid, robot]) => {
              const isCurrentPlayer = pid === playerId
              const ownerName = playerNames[robot.ownerId] ?? robot.ownerId.slice(0, 8)
              const color = robot.visual.color ?? ROBOT_COLORS[0]
              const visualConfig: RobotVisualConfig = {
                weaponType: robot.visual.weapon as RobotVisualConfig["weaponType"],
                headType: robot.visual.head as RobotVisualConfig["headType"],
                bodyType: robot.visual.body as RobotVisualConfig["bodyType"],
                color,
              }

              return (
                <div
                  key={pid}
                  className={`flex flex-col items-center gap-1 rounded-lg p-2 ${theme.card} ${
                    isCurrentPlayer ? "ring-2 ring-[#f5c542]" : ""
                  }`}
                  aria-label={`${robot.name} owned by ${ownerName}${isCurrentPlayer ? " (you)" : ""}`}
                >
                  <CompositeRobot config={visualConfig} size={48} />
                  <span className={`text-xs font-bold leading-tight text-center ${theme.bodyText}`}>
                    {robot.name}
                  </span>
                  <span className={`text-xs leading-tight ${theme.mutedText}`}>
                    {ownerName}
                  </span>
                  <div className="flex items-center gap-2 text-xs">
                    <span>⚔️{robot.stars.damage}</span>
                    <span>🎯{robot.stars.accuracy}</span>
                    <span>⚡{robot.stars.speed}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <p className={`text-center text-xs ${theme.mutedText}`}>
          Waiting for host to start battles…
        </p>
      </div>
    )
  }

  // ── Round 2: Battle Phase (1v1) ────────────────────────────────────────

  if (roundNumber === 2 && phase === "RESOLVING") {
    return renderBattlePhase()
  }

  if (roundNumber === 2 && phase === "RESULT") {
    const roundResult = result as Record<string, unknown> | null
    const pairings = (roundResult?.pairings ?? []) as Array<{
      player1Id: string
      player2Id: string
      winnerId: string | null
      robot1: { ownerId: string }
      robot2: { ownerId: string }
    }>

    // Categorize winners and losers from pairings
    const winners: string[] = []
    const losers: string[] = []
    for (const pairing of pairings) {
      if (pairing.winnerId) {
        winners.push(pairing.winnerId)
        const loserId = pairing.player1Id === pairing.winnerId
          ? pairing.player2Id
          : pairing.player1Id
        losers.push(loserId)
      }
    }

    const getName = (id: string) =>
      roomState.players.find((p) => p.id === id)?.name ?? getParticipantName(id)

    return (
      <div className={`flex h-full flex-col gap-3 overflow-hidden px-4 py-4 ${theme.font}`}>
        <h2 className={`text-center text-xl font-bold ${theme.titleText}`}>
          Battle Results
        </h2>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
          {/* Winners bracket */}
          <div>
            <h3 className={`mb-1 text-sm font-bold uppercase tracking-wide ${theme.accentText}`}>
              Winners Bracket
            </h3>
            <div className="flex flex-col gap-1">
              {winners.map((id) => (
                <div
                  key={id}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 ${theme.listItem}`}
                >
                  <span className="text-sm">🏆</span>
                  <span className={`text-sm font-medium ${theme.bodyText}`}>
                    {getName(id)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {/* Losers bracket */}
          <div>
            <h3 className={`mb-1 text-sm font-bold uppercase tracking-wide ${theme.mutedText}`}>
              Losers Bracket
            </h3>
            <div className="flex flex-col gap-1">
              {losers.map((id) => (
                <div
                  key={id}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 ${theme.listItem}`}
                >
                  <span className={`text-sm font-medium ${theme.mutedText}`}>
                    {getName(id)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className={`text-center text-sm ${theme.mutedText}`}>
          Waiting for host to start the Free-For-All…
        </p>
      </div>
    )
  }

  // ── Round 3: FFA Phase ─────────────────────────────────────────────────

  if (roundNumber === 3 && phase === "RESOLVING") {
    return renderFFAPhase()
  }

  if (roundNumber === 3 && phase === "RESULT") {
    const roundResult = result as Record<string, unknown> | null
    const finalRankings = (roundResult?.finalRankings ?? []) as Array<{
      playerId: string
      playerName: string
      rank: number
      bracket: "winners" | "losers"
      isBot: boolean
      score: number
    }>

    // Filter out bot personas and use actual cumulative score
    const humanRankings = finalRankings
      .filter((r) => !r.isBot)
      .map((r) => ({
        ...r,
        points: r.score,
      }))

    return <FinalRankings rankings={humanRankings} />
  }

  // ── Fallback: RESOLVING on Round 1 or other unexpected states ──────────

  return (
    <div className={`py-8 text-center ${theme.mutedText} ${theme.font}`}>
      Preparing battle…
    </div>
  )

  // ── Render helpers ─────────────────────────────────────────────────────

  function renderBattlePhase() {
    const roundResult = result as Record<string, unknown> | null
    const tickLogPayloads = (roundResult?.tickLogPayloads ?? []) as TickLogPayload[]

    if (!tickLogPayloads.length || !playerId) {
      return (
        <div className={`py-8 text-center ${theme.mutedText} ${theme.font}`}>
          Battle complete.
        </div>
      )
    }

    // Find the player's own battle payload
    const myPayload = tickLogPayloads.find((p) =>
      p.robots?.some((r) => r.ownerId === playerId)
    )
    const otherPayloads = tickLogPayloads.filter((p) => p !== myPayload)

    if (!myPayload) {
      // Player not found in any battle — show first battle as spectator
      const spectatorPayload = tickLogPayloads[0]
      // Fallback: if spectator payload has empty robots or tickLog, show complete state
      if (!spectatorPayload.robots?.length || !spectatorPayload.tickLog?.length) {
        return (
          <div className={`py-8 text-center ${theme.mutedText} ${theme.font}`}>
            Battle complete — winner determined.
          </div>
        )
      }
      return (
        <ReplayBattleArena
          tickLogPayload={spectatorPayload}
          playerNames={playerNames}
          currentPlayerId={playerId}
          initialTickIndex={spectatorPayload.currentTickIndex}
        />
      )
    }

    // Fallback: if payload has empty robots or tickLog, show complete state
    if (!myPayload.robots?.length) {
      return (
        <div className={`py-8 text-center ${theme.mutedText} ${theme.font}`}>
          Battle complete — winner determined.
        </div>
      )
    }

    if (!myPayload.tickLog?.length) {
      return (
        <div className={`py-8 text-center ${theme.mutedText} ${theme.font}`}>
          Battle complete — winner determined.
        </div>
      )
    }

    // Determine if we should skip VsScreen (reconnect mid-replay)
    const isReconnect = (myPayload.currentTickIndex ?? 0) > 0

    // Show VsScreen first (unless reconnecting), then transition to replay
    if (phase2ShowVs && !isReconnect) {
      const vsRobots: VsRobot[] = myPayload.robots.map((r) => ({
        name: r.name,
        ownerName: playerNames[r.ownerId] ?? getParticipantName(r.ownerId),
        visual: r.visual ?? { weapon: "drill", head: "square", body: "square" },
        stars: r.stars,
        isCurrentPlayer: r.ownerId === playerId,
      }))

      return (
        <VsScreen
          robots={vsRobots}
          mode="1v1"
          onComplete={() => setPhase2ShowVs(false)}
        />
      )
    }

    return (
      <div className="flex h-full flex-col gap-2 overflow-hidden lg:flex-row">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ReplayBattleArena
            tickLogPayload={myPayload}
            playerNames={playerNames}
            currentPlayerId={playerId}
            initialTickIndex={myPayload.currentTickIndex}
          />
        </div>
        {otherPayloads.length > 0 && (
          <div className="max-h-[160px] shrink-0 overflow-y-auto lg:max-h-full lg:w-64">
            <ReplaySidebar
              payloads={otherPayloads}
              playerNames={playerNames}
            />
          </div>
        )}
      </div>
    )
  }

  function renderFFAPhase() {
    const roundResult = result as Record<string, unknown> | null
    const tickLogPayloads = (roundResult?.tickLogPayloads ?? []) as TickLogPayload[]

    if (!tickLogPayloads.length || !playerId) {
      return (
        <div className={`py-8 text-center ${theme.mutedText} ${theme.font}`}>
          Battle complete.
        </div>
      )
    }

    // Find the player's own bracket payload
    const myPayload = tickLogPayloads.find((p) =>
      p.robots?.some((r) => r.ownerId === playerId)
    )
    const otherPayload = tickLogPayloads.find((p) => p !== myPayload)

    if (!myPayload) {
      // Player not found — show first bracket as spectator
      const spectatorPayload = tickLogPayloads[0]
      // Fallback: if spectator payload has empty robots or tickLog, show complete state
      if (!spectatorPayload.robots?.length || !spectatorPayload.tickLog?.length) {
        return (
          <div className={`py-8 text-center ${theme.mutedText} ${theme.font}`}>
            Battle complete — winner determined.
          </div>
        )
      }
      const bracketNameFallback = spectatorPayload.battleId.includes("winner")
        ? "Winners Bracket"
        : "Losers Bracket"
      return (
        <ReplayFFAArena
          tickLogPayload={spectatorPayload}
          playerNames={playerNames}
          currentPlayerId={playerId}
          bracketName={bracketNameFallback}
          initialTickIndex={spectatorPayload.currentTickIndex}
        />
      )
    }

    // Fallback: if payload has empty robots or tickLog, show complete state
    if (!myPayload.robots?.length) {
      return (
        <div className={`py-8 text-center ${theme.mutedText} ${theme.font}`}>
          Battle complete — winner determined.
        </div>
      )
    }

    if (!myPayload.tickLog?.length) {
      return (
        <div className={`py-8 text-center ${theme.mutedText} ${theme.font}`}>
          Battle complete — winner determined.
        </div>
      )
    }

    // Determine bracket name from battleId
    const myBracketName = myPayload.battleId.includes("winner")
      ? "Winners Bracket"
      : "Losers Bracket"
    const otherBracketName = otherPayload?.battleId.includes("winner")
      ? "Winners Bracket"
      : "Losers Bracket"

    // Determine if we should skip VsScreen (reconnect mid-replay)
    const isReconnect = (myPayload.currentTickIndex ?? 0) > 0

    // Show VsScreen first (unless reconnecting), then transition to replay
    if (phase3ShowVs && !isReconnect) {
      const vsRobots: VsRobot[] = myPayload.robots.map((r) => ({
        name: r.name,
        ownerName: playerNames[r.ownerId] ?? getParticipantName(r.ownerId),
        visual: r.visual ?? { weapon: "drill", head: "square", body: "square" },
        stars: r.stars,
        isCurrentPlayer: r.ownerId === playerId,
      }))

      return (
        <VsScreen
          robots={vsRobots}
          mode="ffa"
          bracketName={myBracketName}
          onComplete={() => setPhase3ShowVs(false)}
        />
      )
    }

    return (
      <div className="flex h-full flex-col gap-2 overflow-hidden lg:flex-row">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ReplayFFAArena
            tickLogPayload={myPayload}
            playerNames={playerNames}
            currentPlayerId={playerId}
            bracketName={myBracketName}
            initialTickIndex={myPayload.currentTickIndex}
          />
        </div>
        {otherPayload && otherPayload.robots?.length > 0 && otherBracketName && (
          <div className="max-h-[160px] shrink-0 overflow-y-auto lg:max-h-full lg:w-48">
            <ReplayFFASidebar
              payload={otherPayload}
              bracketName={otherBracketName}
              playerNames={playerNames}
            />
          </div>
        )}
      </div>
    )
  }

  function getParticipantName(ownerId: string | undefined): string {
    if (!ownerId) return "Unknown"
    const player = roomState?.players.find((p) => p.id === ownerId)
    if (player) return player.name
    // Could be a bot persona — show a fallback
    if (ownerId.startsWith("bot_")) return `Bot ${ownerId.slice(4, 8)}`
    return ownerId.slice(0, 8)
  }
}
