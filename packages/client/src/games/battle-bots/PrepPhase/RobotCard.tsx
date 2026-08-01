export interface RobotCardProps {
  id: string
  name: string
  visualId: string
  hp: number
  accuracy: number
  damageMin: number
  damageMax: number
  isSelected: boolean
  onSelect: (id: string) => void
}

/**
 * RobotCard — Displays a single robot option during the Prep Phase.
 *
 * Shows the robot's name, placeholder visual, and stats (HP, Accuracy, Damage range).
 * In V1 all robots have identical stats but the UI displays them for future extensibility.
 * Selected state shows a highlight border and checkmark indicator.
 *
 * Validates: Requirements 3.1
 */
export function RobotCard({
  id,
  name,
  visualId,
  hp,
  accuracy,
  damageMin,
  damageMax,
  isSelected,
  onSelect,
}: RobotCardProps) {
  const colorMap: Record<string, string> = {
    "robot-1": "from-red-400 to-red-600",
    "robot-2": "from-blue-400 to-blue-600",
    "robot-3": "from-green-400 to-green-600",
  }
  const gradient = colorMap[visualId] ?? "from-gray-400 to-gray-600"

  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      aria-pressed={isSelected}
      className={`relative flex flex-col items-center gap-3 rounded-xl border-2 p-4 shadow-md transition focus:outline-none focus:ring-2 focus:ring-offset-2 ${
        isSelected
          ? "border-blue-500 ring-2 ring-blue-500 bg-blue-50 focus:ring-blue-400"
          : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-lg focus:ring-gray-400"
      }`}
    >
      {/* Selected checkmark */}
      {isSelected && (
        <div className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      )}

      {/* Placeholder robot sprite */}
      <div
        className={`flex h-16 w-16 items-center justify-center rounded-lg bg-gradient-to-br ${gradient} shadow-inner`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-10 w-10 text-white/90"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 2a1 1 0 011 1v1h2a3 3 0 013 3v2h1a1 1 0 110 2h-1v2a3 3 0 01-3 3h-1v3a1 1 0 01-1 1h-2a1 1 0 01-1-1v-3H9a3 3 0 01-3-3V9H5a1 1 0 110-2h1V7a3 3 0 013-3h2V3a1 1 0 011-1zm-2 6a1 1 0 100 2 1 1 0 000-2zm4 0a1 1 0 100 2 1 1 0 000-2z" />
        </svg>
      </div>

      {/* Robot name */}
      <h3 className="text-base font-bold text-gray-900">{name}</h3>

      {/* Stats */}
      <div className="grid w-full grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <span className="font-semibold text-red-600">HP</span>
          <span>{hp}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="font-semibold text-blue-600">ACC</span>
          <span>{accuracy}%</span>
        </div>
        <div className="col-span-2 flex items-center gap-1">
          <span className="font-semibold text-amber-600">DMG</span>
          <span>
            {damageMin}–{damageMax}
          </span>
        </div>
      </div>
    </button>
  )
}
