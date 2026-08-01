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
 * Compact HP indicator color based on percentage.
 */
function getCompactColor(percentage: number): string {
  if (percentage > 60) return "text-green-400"
  if (percentage >= 30) return "text-yellow-400"
  return "text-red-400"
}

/**
 * FFASidebar — Compact secondary view showing the other bracket's HP summary.
 *
 * Displays a list of robots from the other FFA bracket (e.g., "Losers Bracket")
 * with minimal HP indicators. Eliminated robots are dimmed with line-through text.
 * Designed to be compact and unobtrusive alongside the primary FFAArena view.
 *
 * Validates: Requirements 10.4
 */
export function FFASidebar({ bracketName, robots }: FFASidebarProps) {
  return (
    <div className="w-48 bg-gray-800 rounded-lg p-3">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 truncate">
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
                className={`truncate mr-2 ${
                  robot.eliminated
                    ? "line-through text-gray-500"
                    : "text-gray-200"
                }`}
              >
                {robot.name}
              </span>
              <span
                className={`font-mono whitespace-nowrap ${
                  robot.eliminated ? "text-gray-600" : colorClass
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
