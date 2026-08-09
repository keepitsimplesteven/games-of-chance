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
 * Compact HP indicator color based on percentage (theme-aligned).
 */
function getCompactColor(percentage: number): string {
  if (percentage > 60) return "text-[#3a9a4a]"
  if (percentage >= 30) return "text-[#f5c542]"
  return "text-[#cc3333]"
}

/**
 * FFASidebar — Compact secondary view showing the other bracket's HP summary.
 *
 * Displays a list of robots from the other FFA bracket with minimal HP indicators.
 * Eliminated robots are dimmed with line-through text.
 * Uses retro-casino theme tokens.
 *
 * Validates: Requirements 10.4
 */
export function FFASidebar({ bracketName, robots }: FFASidebarProps) {
  const theme = useTheme()

  return (
    <div className={`w-48 rounded-md p-3 ${theme.card}`}>
      <h3 className={`text-xs font-semibold uppercase tracking-wide mb-2 truncate ${theme.mutedText}`}>
        {bracketName}
      </h3>
      <ul className="space-y-1">
        {robots.map((robot) => {
          const percentage =
            robot.maxHp > 0
              ? Math.max(0, Math.min(100, (robot.currentHp / robot.maxHp) * 100))
              : 0
          const colorClass = getCompactColor(percentage)

          return (
            <li
              key={robot.ownerId}
              className={`flex items-center justify-between text-xs ${
                robot.eliminated ? "opacity-40" : ""
              }`}
            >
              <span
                className={`truncate mr-2 font-mono ${
                  robot.eliminated
                    ? "line-through text-[#3a9a4a]/40"
                    : "text-[#f0f0f0]"
                }`}
              >
                {robot.name}
              </span>
              <span
                className={`font-mono whitespace-nowrap ${
                  robot.eliminated ? "text-[#2a7a3a]/40" : colorClass
                }`}
              >
                {robot.eliminated ? "0" : robot.currentHp}/{robot.maxHp}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
