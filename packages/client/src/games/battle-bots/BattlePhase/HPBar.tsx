interface HPBarProps {
  currentHp: number
  maxHp: number
  label?: string
}

/**
 * Determines bar color based on HP percentage.
 * Green (#22c55e) when > 60%, yellow (#eab308) when 30-60%, red (#ef4444) when < 30%.
 */
function getBarColor(percentage: number): string {
  if (percentage > 60) return "#22c55e"
  if (percentage >= 30) return "#eab308"
  return "#ef4444"
}

/**
 * HPBar — Animated HP bar with smooth CSS transitions matching the 250ms tick rate.
 *
 * Displays a horizontal bar representing HP percentage with color that shifts
 * from green (full) through yellow (mid) to red (low). Width animates smoothly
 * between tick updates using CSS transitions.
 *
 * Validates: Requirements 10.2
 */
export function HPBar({ currentHp, maxHp, label }: HPBarProps) {
  const percentage = maxHp > 0 ? Math.max(0, Math.min(100, (currentHp / maxHp) * 100)) : 0
  const color = getBarColor(percentage)

  return (
    <div className="w-full">
      {label && (
        <div className="text-xs text-gray-300 mb-1 truncate">{label}</div>
      )}
      <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-[250ms] ease-out"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
      <div className="text-xs text-gray-400 mt-0.5 text-right">
        {currentHp} / {maxHp}
      </div>
    </div>
  )
}
