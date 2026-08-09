import { useTheme } from "../../../theme"
import { HPBar } from "./HPBar"

export interface BattleRobot {
  ownerId: string
  name: string
  currentHp: number
  maxHp: number
  eliminated: boolean
}

export interface BattleArenaProps {
  player1: BattleRobot
  player2: BattleRobot
  isPlayerBattle: boolean
}

/**
 * BattleArena — Primary 1v1 battle display showing two robots facing each other.
 *
 * Displays robots in a left-vs-right layout with name labels, placeholder sprites,
 * and animated HP bars. Shows "WINNER!" over the surviving robot and "KO" with
 * greyed-out styling for the eliminated robot.
 * Uses retro-casino theme tokens.
 *
 * Validates: Requirements 10.3
 */
export function BattleArena({ player1, player2, isPlayerBattle }: BattleArenaProps) {
  const theme = useTheme()
  const p1Won = player2.eliminated && !player1.eliminated
  const p2Won = player1.eliminated && !player2.eliminated

  return (
    <div
      className={`rounded-md p-6 ${
        isPlayerBattle
          ? "border-4 border-[#f5c542] bg-[#1b5e2a] shadow-[inset_0_0_20px_rgba(0,0,0,0.4)]"
          : `${theme.card}`
      }`}
    >
      {isPlayerBattle && (
        <h2 className={`mb-4 text-center text-sm font-semibold uppercase tracking-wide ${theme.accentText}`}>
          Your Battle
        </h2>
      )}

      <div className="flex items-center justify-between gap-4">
        {/* Player 1 (left side) */}
        <RobotFighter robot={player1} side="left" isWinner={p1Won} />

        {/* VS divider */}
        <div className="flex flex-col items-center gap-1">
          <span className={`text-2xl font-black ${theme.mutedText}`}>VS</span>
        </div>

        {/* Player 2 (right side) */}
        <RobotFighter robot={player2} side="right" isWinner={p2Won} />
      </div>
    </div>
  )
}

interface RobotFighterProps {
  robot: BattleRobot
  side: "left" | "right"
  isWinner: boolean
}

function RobotFighter({ robot, side, isWinner }: RobotFighterProps) {
  const theme = useTheme()
  const isEliminated = robot.eliminated

  return (
    <div className="flex flex-1 flex-col items-center gap-2">
      {/* Status label */}
      <div className="h-6">
        {isWinner && (
          <span className={`animate-pulse text-sm font-bold ${theme.accentText}`}>
            🏆 WINNER!
          </span>
        )}
        {isEliminated && (
          <span className={`text-sm font-bold ${theme.statusDanger}`}>KO</span>
        )}
      </div>

      {/* Robot sprite placeholder */}
      <div
        className={`relative flex h-20 w-20 items-center justify-center rounded-md border-2 transition-all ${
          isEliminated
            ? "border-[#2a7a3a]/40 bg-[#0f3d18] opacity-50 grayscale"
            : "border-[#2a7a3a] bg-[#0f3d18]"
        }`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-12 w-12 ${isEliminated ? "text-[#2a7a3a]/40" : "text-[#3a9a4a]"}`}
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
          style={{ transform: side === "right" ? "scaleX(-1)" : undefined }}
        >
          <path d="M12 2a1 1 0 011 1v1h2a3 3 0 013 3v2h1a1 1 0 110 2h-1v2a3 3 0 01-3 3h-1v3a1 1 0 01-1 1h-2a1 1 0 01-1-1v-3H9a3 3 0 01-3-3V9H5a1 1 0 110-2h1V7a3 3 0 013-3h2V3a1 1 0 011-1zm-2 6a1 1 0 100 2 1 1 0 000-2zm4 0a1 1 0 100 2 1 1 0 000-2z" />
        </svg>

        {/* KO overlay */}
        {isEliminated && (
          <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/40">
            <span className={`text-2xl font-black ${theme.statusDanger}`}>✕</span>
          </div>
        )}
      </div>

      {/* Robot name */}
      <span
        className={`text-sm font-semibold ${
          isEliminated ? "text-[#3a9a4a]/40 line-through" : theme.bodyText
        }`}
      >
        {robot.name}
      </span>

      {/* HP Bar */}
      <div className="w-full max-w-[160px]">
        <HPBar currentHp={robot.currentHp} maxHp={robot.maxHp} />
      </div>
    </div>
  )
}
