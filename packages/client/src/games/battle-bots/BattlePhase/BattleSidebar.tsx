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
 * Determines compact HP bar color based on percentage.
 */
function getCompactBarColor(percentage: number): string {
  if (percentage > 60) return "bg-green-500"
  if (percentage >= 30) return "bg-yellow-500"
  return "bg-red-500"
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
        className={`text-xs font-medium truncate max-w-[80px] ${
          robot.eliminated ? "line-through text-gray-500" : "text-gray-200"
        }`}
      >
        {robot.eliminated && (
          <span className="text-red-400 mr-0.5" aria-label="eliminated">
            ✕
          </span>
        )}
        {robot.name}
      </span>
      <div className="flex-1 bg-gray-700 rounded-full h-2 min-w-[40px] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-[250ms] ease-out ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-[10px] text-gray-400 tabular-nums w-[40px] text-right">
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
 * Designed as a secondary view to keep players aware of other battles' progress.
 *
 * Validates: Requirements 10.3
 */
export function BattleSidebar({ battles }: BattleSidebarProps) {
  if (battles.length === 0) {
    return null
  }

  return (
    <aside className="flex flex-col gap-3 rounded-lg bg-gray-800/60 p-3 border border-gray-700">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
        Other Battles
      </h3>
      <div className="flex flex-col gap-2">
        {battles.map((battle) => (
          <div
            key={battle.battleId}
            className="flex flex-col gap-1 rounded-md bg-gray-900/50 px-2 py-1.5"
          >
            <SidebarRobotEntry robot={battle.robot1} />
            <div className="text-[10px] text-gray-500 text-center font-medium">
              vs
            </div>
            <SidebarRobotEntry robot={battle.robot2} />
          </div>
        ))}
      </div>
    </aside>
  )
}
