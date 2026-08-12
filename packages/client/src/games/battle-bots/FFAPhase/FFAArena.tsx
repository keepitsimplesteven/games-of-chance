import { useTheme } from "../../../theme"
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
 * Uses retro-casino theme tokens.
 *
 * Validates: Requirements 10.4
 */
export function FFAArena({ bracketName, combatants }: FFAArenaProps) {
  const theme = useTheme()
  const livingCount = combatants.filter((c) => !c.eliminated).length
  const isFinished = livingCount === 1
  const winnerId = isFinished
    ? combatants.find((c) => !c.eliminated)?.ownerId ?? null
    : null
  console.log("replay arena")

  return (
    <div className={`flex flex-col gap-4 p-4 rounded-md ${theme.card}`}>
      <h2 className={`text-lg font-bold ${theme.headingText}`}>{bracketName}</h2>

      <div className="grid gap-3">
        {combatants.map((combatant) => {
          const isWinner = winnerId === combatant.ownerId

          return (
            <div
              key={combatant.ownerId}
              className={`relative flex flex-col gap-1 p-3 rounded-md border-2 ${
                combatant.eliminated
                  ? "opacity-50 border-[#2a7a3a]/40 bg-[#0f3d18]/50"
                  : isWinner
                    ? "border-[#f5c542] bg-[#0f3d18] shadow-[0_0_8px_rgba(245,197,66,0.3)]"
                    : "border-[#2a7a3a] bg-[#0f3d18]"
              }`}
            >
              {/* Eliminated X overlay */}
              {combatant.eliminated && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-4xl font-bold text-[#cc3333]/70">✕</span>
                </div>
              )}

              {/* Winner badge */}
              {isWinner && (
                <div className="absolute -top-2 -right-2 animate-bounce">
                  <span className="px-2 py-0.5 text-xs font-bold text-[#111111] bg-[#f5c542] rounded-full">
                    WINNER!
                  </span>
                </div>
              )}

              {/* Combatant name */}
              <span
                className={`text-sm font-medium font-mono ${
                  combatant.eliminated
                    ? "text-[#3a9a4a]/40 line-through"
                    : isWinner
                      ? "text-[#f5c542]"
                      : "text-[#f0f0f0]"
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
