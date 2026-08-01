import { useEffect } from "react"
import { useGameStore } from "../../store/useGameStore"
import { RobotSelector } from "./PrepPhase/RobotSelector"
import type { RobotOption } from "./PrepPhase/RobotSelector"
import { BattleArena } from "./BattlePhase/BattleArena"
import { BattleSidebar } from "./BattlePhase/BattleSidebar"
import { FFAArena } from "./FFAPhase/FFAArena"
import { FFASidebar } from "./FFAPhase/FFASidebar"
import { FinalRankings } from "./Results/FinalRankings"

/**
 * BattleBotsView — Main container that switches between PrepPhase, BattlePhase,
 * FFAPhase, and Results based on the current round number and phase.
 *
 * Reads room state from useGameStore and renders the appropriate sub-view:
 * - Round 1 + PICKING → RobotSelector
 * - Round 1 + RESULT → "Selections confirmed" message
 * - Round 2 + RESOLVING → BattleArena + BattleSidebar
 * - Round 2 + RESULT → Battle results summary
 * - Round 3 + RESOLVING → FFAArena + FFASidebar
 * - Round 3 + RESULT → FinalRankings
 *
 * Validates: Requirements 12.1
 */
export function BattleBotsView() {
  const roomState = useGameStore((s) => s.roomState)
  const battleHPState = useGameStore((s) => s.battleHPState)
  const playerId = useGameStore((s) => s.playerId)

  if (!roomState) return null

  const { phase, roundNumber, pickDeadlineMs, result } = roomState.round

  // Battle-bots has no RESULT animation — mark animation as done immediately
  // so the "Next Round" button becomes enabled
  useEffect(() => {
    if (phase === "RESULT") {
      useGameStore.setState({ roundAnimationDone: true })
    }
  }, [phase, roundNumber])

  // ── Round 1: Prep Phase ────────────────────────────────────────────────

  if (roundNumber === 1 && phase === "PICKING") {
    // Extract robot options for the current player from the round result or picks
    // The server sends per-player options in the round state
    const roundResult = result as Record<string, unknown> | null
    const robotOptions = roundResult?.robotOptions as
      | Record<string, { options: RobotOption[] }>
      | undefined

    const myOptions = playerId ? robotOptions?.[playerId]?.options : undefined

    return (
      <RobotSelector
        options={myOptions ?? []}
        pickDeadlineMs={pickDeadlineMs}
      />
    )
  }

  if (roundNumber === 1 && phase === "RESULT") {
    return (
      <div className="flex flex-col items-center gap-4 px-4 py-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-10 w-10 text-green-600"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900">
          All Selections Confirmed
        </h2>
        <p className="text-sm text-gray-500">
          Robots locked in. Waiting for host to start battles…
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

    return (
      <div className="flex flex-col gap-4 px-4 py-8">
        <h2 className="text-center text-xl font-bold text-gray-900">
          Battle Results
        </h2>
        <div className="flex flex-col gap-2">
          {pairings.map((pairing, i) => {
            const winnerName =
              roomState.players.find((p) => p.id === pairing.winnerId)?.name ??
              pairing.winnerId
            return (
              <div
                key={i}
                className="flex items-center justify-center gap-2 rounded-lg bg-gray-100 px-4 py-3"
              >
                <span className="text-sm font-medium text-gray-700">
                  🏆 {winnerName} wins
                </span>
              </div>
            )
          })}
        </div>
        <p className="text-center text-sm text-gray-500">
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
    }>

    // Filter out bot personas and compute display points (higher rank = more points)
    const totalParticipants = finalRankings.length
    const humanRankings = finalRankings
      .filter((r) => !r.isBot)
      .map((r) => ({
        ...r,
        points: Math.max(0, totalParticipants - r.rank),
      }))

    return <FinalRankings rankings={humanRankings} />
  }

  // ── Fallback: RESOLVING on Round 1 or other unexpected states ──────────

  return (
    <div className="py-8 text-center text-gray-500">
      Preparing battle…
    </div>
  )

  // ── Render helpers ─────────────────────────────────────────────────────

  function renderBattlePhase() {
    if (!battleHPState || !playerId) {
      return (
        <div className="py-8 text-center text-gray-500">
          Battles starting…
        </div>
      )
    }

    // Find the player's own battle and other battles
    let myBattleId: string | null = null
    for (const [battleId, robots] of Object.entries(battleHPState)) {
      if (robots.some((r) => r.ownerId === playerId)) {
        myBattleId = battleId
        break
      }
    }

    const otherBattles = Object.entries(battleHPState)
      .filter(([id]) => id !== myBattleId)
      .map(([battleId, robots]) => ({
        battleId,
        robot1: {
          name: getParticipantName(robots[0]?.ownerId),
          currentHp: robots[0]?.currentHp ?? 0,
          maxHp: getMaxHp(),
          eliminated: robots[0]?.eliminated ?? false,
        },
        robot2: {
          name: getParticipantName(robots[1]?.ownerId),
          currentHp: robots[1]?.currentHp ?? 0,
          maxHp: getMaxHp(),
          eliminated: robots[1]?.eliminated ?? false,
        },
      }))

    if (myBattleId && battleHPState[myBattleId]) {
      const myRobots = battleHPState[myBattleId]
      const maxHp = getMaxHp()

      const player1 = {
        ownerId: myRobots[0]?.ownerId ?? "",
        name: getParticipantName(myRobots[0]?.ownerId),
        currentHp: myRobots[0]?.currentHp ?? 0,
        maxHp,
        eliminated: myRobots[0]?.eliminated ?? false,
      }
      const player2 = {
        ownerId: myRobots[1]?.ownerId ?? "",
        name: getParticipantName(myRobots[1]?.ownerId),
        currentHp: myRobots[1]?.currentHp ?? 0,
        maxHp,
        eliminated: myRobots[1]?.eliminated ?? false,
      }

      return (
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="flex-1">
            <BattleArena
              player1={player1}
              player2={player2}
              isPlayerBattle={true}
            />
          </div>
          {otherBattles.length > 0 && (
            <div className="lg:w-64">
              <BattleSidebar battles={otherBattles} />
            </div>
          )}
        </div>
      )
    }

    // Player not found in any battle (spectator?) — show all battles in sidebar style
    return <BattleSidebar battles={otherBattles} />
  }

  function renderFFAPhase() {
    if (!battleHPState || !playerId) {
      return (
        <div className="py-8 text-center text-gray-500">
          Free-for-all starting…
        </div>
      )
    }

    // Find which bracket the player is in
    let myBracketId: string | null = null
    let otherBracketId: string | null = null

    for (const [bracketId, robots] of Object.entries(battleHPState)) {
      if (robots.some((r) => r.ownerId === playerId)) {
        myBracketId = bracketId
      } else {
        otherBracketId = bracketId
      }
    }

    const maxHp = getMaxHp()

    const myBracketName = myBracketId?.includes("winner")
      ? "Winners Bracket"
      : "Losers Bracket"
    const otherBracketName = otherBracketId?.includes("winner")
      ? "Winners Bracket"
      : "Losers Bracket"

    const myCombatants = myBracketId
      ? (battleHPState[myBracketId] ?? []).map((r) => ({
          ownerId: r.ownerId,
          name: getParticipantName(r.ownerId),
          currentHp: r.currentHp,
          maxHp,
          eliminated: r.eliminated,
        }))
      : []

    const otherRobots = otherBracketId
      ? (battleHPState[otherBracketId] ?? []).map((r) => ({
          ownerId: r.ownerId,
          name: getParticipantName(r.ownerId),
          currentHp: r.currentHp,
          maxHp,
          eliminated: r.eliminated,
        }))
      : []

    return (
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex-1">
          <FFAArena bracketName={myBracketName} combatants={myCombatants} />
        </div>
        {otherRobots.length > 0 && (
          <div className="lg:w-48">
            <FFASidebar bracketName={otherBracketName} robots={otherRobots} />
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

  function getMaxHp(): number {
    // Read from game settings or fall back to default
    const tuning = roomState?.gameSettings?.tuning
    return Number(tuning?.BOT_HP) || 100
  }
}
