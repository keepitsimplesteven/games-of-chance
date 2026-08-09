import { useTheme } from "../../../theme"
import { CompositeRobot, type RobotVisualConfig } from "../assets/RobotParts"

export interface RobotCardProps {
  id: string
  name: string
  visualId: string
  visual?: RobotVisualConfig
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
 * Shows a composed robot SVG, the robot's name, and its weapon type label.
 * Selected state shows a gold highlight border.
 * Uses retro-casino theme tokens.
 *
 * Validates: Requirements 3.1
 */
export function RobotCard({
  id,
  name,
  visual,
  hp,
  accuracy,
  damageMin,
  damageMax,
  isSelected,
  onSelect,
}: RobotCardProps) {
  const theme = useTheme()

  // Weapon display label
  const weaponLabel = visual?.weaponType
    ? visual.weaponType.charAt(0).toUpperCase() + visual.weaponType.slice(1)
    : "Standard"

  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      aria-pressed={isSelected}
      className={`relative flex flex-col items-center gap-3 rounded-md p-4 transition focus:outline-none focus:ring-2 focus:ring-[#f5c542] ${
        isSelected
          ? "border-4 border-[#f5c542] bg-[#0f3d18] shadow-[0_0_12px_rgba(245,197,66,0.4)]"
          : `${theme.listItem} hover:border-[#3a9a4a]`
      }`}
    >
      {/* Selected checkmark */}
      {isSelected && (
        <div className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#f5c542] text-[#111111]">
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

      {/* Robot composite sprite */}
      <div className="flex h-20 w-20 items-center justify-center">
        {visual ? (
          <CompositeRobot config={visual} size={80} />
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-12 w-12 text-[#3a9a4a]"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 2a1 1 0 011 1v1h2a3 3 0 013 3v2h1a1 1 0 110 2h-1v2a3 3 0 01-3 3h-1v3a1 1 0 01-1 1h-2a1 1 0 01-1-1v-3H9a3 3 0 01-3-3V9H5a1 1 0 110-2h1V7a3 3 0 013-3h2V3a1 1 0 011-1zm-2 6a1 1 0 100 2 1 1 0 000-2zm4 0a1 1 0 100 2 1 1 0 000-2z" />
          </svg>
        )}
      </div>

      {/* Robot name */}
      <h3 className={`text-base font-bold ${theme.bodyText}`}>{name}</h3>

      {/* Weapon type badge */}
      <span className={`text-xs px-2 py-0.5 rounded border-2 border-[#2a7a3a] ${theme.mutedText} font-semibold uppercase tracking-wide`}>
        {weaponLabel}
      </span>

      {/* Stats */}
      <div className={`grid w-full grid-cols-2 gap-x-3 gap-y-1 text-xs ${theme.bodyText}`}>
        <div className="flex items-center gap-1">
          <span className={`font-semibold ${theme.statusDanger}`}>HP</span>
          <span>{hp}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="font-semibold text-[#2255aa]">ACC</span>
          <span>{accuracy}%</span>
        </div>
        <div className="col-span-2 flex items-center gap-1">
          <span className={`font-semibold ${theme.accentText}`}>DMG</span>
          <span>
            {damageMin}–{damageMax}
          </span>
        </div>
      </div>
    </button>
  )
}
