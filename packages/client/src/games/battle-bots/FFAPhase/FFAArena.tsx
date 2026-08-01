import { HPBar } from "../BattlePhase/HPBar"

interface FFACombatant {
  ownerId: string
  name: string
  currentHp: number
  maxHp: number
  eliminated: boolean
}

interface FFAArenaProps {
  bracketName: string
  combatants: FFACombatant[]
}

/**
 * FFAArena — Displays all combatants in a player's FFA bracket with HP bars.
 *
 * Eliminated robots are greyed out with an X overlay.
 * The last robot standing gets a "WINNER!" badge with animation.
 *
 * Validates: Requirements 10.4
 */
export function FFAArena({ bracketName, combatants }: FFAArenaProps) {
  const livingCount = combatants.filter((c) => !c.eliminated).length
  const isFinished = livingCount === 1
  const winnerId = isFinished
    ? combatants.find((c) => !c.eliminated)?.ownerId ?? null
    : null

  return (
    <div className="flex flex-col gap-4 p-4 bg-gray-900 rounded-lg">
      <h2 className="text-lg font-bold text-white">{bracketName}</h2>

      <div className="grid gap-3">
        {combatants.map((combatant) => {
          const isWinner = winnerId === combatant.ownerId

          return (
            <div
              key={combatant.ownerId}
              className={`relative flex flex-col gap-1 p-3 rounded-md border ${
                combatant.eliminated
                  ? "opacity-50 border-gray-700 bg-gray-800/50"
                  : isWinner
                    ? "border-yellow-500 bg-gray-800"
                    : "border-gray-700 bg-gray-800"
              }`}
            >
              {/* Eliminated X overlay */}
              {combatant.eliminated && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-4xl font-bold text-red-500/70">✕</span>
                </div>
              )}

              {/* Winner badge */}
              {isWinner && (
                <div className="absolute -top-2 -right-2 animate-bounce">
                  <span className="px-2 py-0.5 text-xs font-bold text-yellow-900 bg-yellow-400 rounded-full">
                    WINNER!
                  </span>
                </div>
              )}

              {/* Combatant name */}
              <span
                className={`text-sm font-medium ${
                  combatant.eliminated
                    ? "text-gray-500 line-through"
                    : isWinner
                      ? "text-yellow-300"
                      : "text-gray-200"
                }`}
              >
                {combatant.name}
              </span>

              {/* HP Bar */}
              <HPBar currentHp={combatant.currentHp} maxHp={combatant.maxHp} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export type { FFACombatant, FFAArenaProps }
