import { useTheme } from "../../../theme"

interface SidebarRobot {
  name: string
  currentHp: number
  maxHp: number
  eliminated: boolean
}

interface SidebarBattle {
  battleId: string
  robot1: SidebarRobot
  robot2: SidebarRobot
}

interface BattleSidebarProps {
  battles: SidebarBattle[]
}

/**
 * Determines compact HP bar color based on percentage (theme-aligned).
 */
function getCompactBarColor(percentage: number): string {
  if (percentage > 60) return "bg-[#3a9a4a]"
  if (percentage >= 30) return "bg-[#f5c542]"
  return "bg-[#cc3333]"
}

/**
 * Compact HP display for a single robot in the sidebar.
 */
function SidebarRobotEntry({ robot }: { robot: SidebarRobot }) {
  const percentage =
    robot.maxHp > 0
      ? Math.max(0, Math.min(100, (robot.currentHp / robot.maxHp) * 100))
      : 0
  const barColor = getCompactBarColor(percentage)

  return (
    <div
      className={`flex items-center gap-2 ${
        robot.eliminated ? "opacity-40" : ""
      }`}
    >
      <span
        className={`text-xs font-medium truncate max-w-[80px] font-mono ${
          robot.eliminated ? "line-through text-[#3a9a4a]/40" : "text-[#f0f0f0]"
        }`}
      >
        {robot.eliminated && (
          <span className="text-[#cc3333] mr-0.5" aria-label="eliminated">
            ✕
          </span>
        )}
        {robot.name}
      </span>
      <div className="flex-1 bg-[#0f3d18] rounded-full h-2 min-w-[40px] overflow-hidden border border-[#2a7a3a]">
        <div
          className={`h-full rounded-full transition-all duration-[250ms] ease-out ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-[10px] text-[#3a9a4a] tabular-nums w-[40px] text-right font-mono">
        {robot.currentHp}/{robot.maxHp}
      </span>
    </div>
  )
}

/**
 * BattleSidebar — Displays a compact vertical list of other active battles.
 *
 * Shows each battle as a pair of robots with their names and compact HP bars.
 * Eliminated robots are greyed out with strikethrough text and an ✕ indicator.
 * Uses retro-casino theme tokens.
 *
 * Validates: Requirements 10.3
 */
export function BattleSidebar({ battles }: BattleSidebarProps) {
  const theme = useTheme()

  if (battles.length === 0) {
    return null
  }

  return (
    <aside className={`flex flex-col gap-3 rounded-md p-3 ${theme.card}`}>
      <h3 className={`text-xs font-semibold uppercase tracking-wide ${theme.mutedText}`}>
        Other Battles
      </h3>
      <div className="flex flex-col gap-2">
        {battles.map((battle) => (
          <div
            key={battle.battleId}
            className="flex flex-col gap-1 rounded-md bg-[#0f3d18] px-2 py-1.5 border border-[#2a7a3a]"
          >
            <SidebarRobotEntry robot={battle.robot1} />
            <div className="text-[10px] text-[#3a9a4a] text-center font-medium font-mono">
              vs
            </div>
            <SidebarRobotEntry robot={battle.robot2} />
          </div>
        ))}
      </div>
    </aside>
  )
}
