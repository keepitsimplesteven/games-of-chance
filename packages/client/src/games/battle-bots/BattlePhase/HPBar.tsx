interface HPBarProps {
  currentHp: number
  maxHp: number
  label?: string
}

/**
 * Determines bar color based on HP percentage.
 * Green when > 60%, gold/yellow when 30-60%, red when < 30%.
 * Uses theme-aligned colors.
 */
function getBarColor(percentage: number): string {
  if (percentage > 60) return "#3a9a4a"
  if (percentage >= 30) return "#f5c542"
  return "#cc3333"
}

/**
 * HPBar — Animated HP bar with smooth CSS transitions matching the 250ms tick rate.
 *
 * Displays a horizontal bar representing HP percentage with color that shifts
 * from green (full) through gold (mid) to red (low). Width animates smoothly
 * between tick updates using CSS transitions.
 * Uses retro-casino theme-aligned colors.
 *
 * Validates: Requirements 10.2
 */
export function HPBar({ currentHp, maxHp, label }: HPBarProps) {
  const percentage = maxHp > 0 ? Math.max(0, Math.min(100, (currentHp / maxHp) * 100)) : 0
  const color = getBarColor(percentage)

  return (
    <div className="w-full">
      {label && (
        <div className="text-xs text-[#3a9a4a] mb-1 truncate">{label}</div>
      )}
      <div className="w-full bg-[#0f3d18] rounded-full h-4 overflow-hidden border border-[#2a7a3a]">
        <div
          className="h-full rounded-full transition-all duration-[250ms] ease-out"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
      <div className="text-xs text-[#3a9a4a] mt-0.5 text-right font-mono tabular-nums">
        {currentHp} / {maxHp}
      </div>
    </div>
  )
}
