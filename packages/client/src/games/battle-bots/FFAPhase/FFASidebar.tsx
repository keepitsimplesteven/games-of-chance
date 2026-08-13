import { useTheme } from "../../../theme"

interface FFASidebarRobot {
  ownerId: string
  name: string
  currentHp: number
  maxHp: number
  eliminated: boolean
}

interface FFASidebarProps {
  bracketName: string
  robots: FFASidebarRobot[]
}

/**
 * Compact HP bar color based on percentage (theme-aligned).
 */
function getCompactBarColor(percentage: number): string {
  if (percentage > 60) return "bg-[#3a9a4a]"
  if (percentage >= 30) return "bg-[#f5c542]"
  return "bg-[#cc3333]"
}

/**
 * Compact HP display for a single robot in the FFA sidebar.
 * Mirrors the mini-lifebar style from BattleSidebar's SidebarRobotEntry.
 */
function FFARobotEntry({ robot }: { robot: FFASidebarRobot }) {
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
        className={`text-xs font-medium truncate w-[80%] font-mono ${
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
 * FFASidebar — Compact secondary view showing the other bracket's HP summary.
 *
 * Displays a list of robots from the other FFA bracket with mini HP bars.
 * Eliminated robots are dimmed with line-through text and an ✕ indicator.
 * Uses retro-casino theme tokens.
 *
 * Validates: Requirements 10.4
 */
export function FFASidebar({ bracketName, robots }: FFASidebarProps) {
  const theme = useTheme()

  return (
    <div className={`w-full rounded-md p-3 ${theme.card}`}>
      <h3 className={`text-xs font-semibold uppercase tracking-wide mb-2 truncate ${theme.mutedText}`}>
        {bracketName}
      </h3>
      <div className="flex flex-col gap-1.5">
        {robots.map((robot) => (
          <FFARobotEntry key={robot.ownerId} robot={robot} />
        ))}
      </div>
    </div>
  )
}
