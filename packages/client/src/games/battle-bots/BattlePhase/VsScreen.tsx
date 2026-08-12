import { useEffect } from "react"
import { useTheme } from "../../../theme"
import { CompositeRobot, type RobotVisualConfig } from "../assets/RobotParts"
import { StarDisplay } from "../PrepPhase/StarDisplay"

// ── Constants ──

/** Duration the VS screen shows before auto-transitioning to replay (ms) */
const VS_SCREEN_DURATION_MS = 4000

/** Color palette assigned to robots by index */
const ROBOT_COLORS = [
  "#e53935", // red
  "#1e88e5", // blue
  "#43a047", // green
  "#fb8c00", // orange
  "#8e24aa", // purple
  "#00acc1", // cyan
  "#f4511e", // deep orange
  "#7cb342", // light green
]

// ── Types ──

export interface VsRobot {
  name: string
  ownerName: string
  visual: { weapon: string; head: string; body: string; color?: string }
  stars: { damage: number; accuracy: number; speed: number }
  isCurrentPlayer: boolean
}

export interface VsScreenProps {
  robots: VsRobot[]
  mode: "1v1" | "ffa"
  onComplete: () => void
  /** Optional bracket name to display under the title (FFA mode) */
  bracketName?: string
}

// ── Component ──

/**
 * VsScreen — Pre-combat reveal screen showing all robots before replay begins.
 *
 * Displays each robot's composed SVG, name, owner name, and star values.
 * Highlights the current player's robot with a callout box outline.
 * Supports "1v1" (VS layout) and "ffa" (bracket grid) modes.
 * Auto-transitions to replay after VS_SCREEN_DURATION_MS.
 *
 * Validates: Requirements 16.1, 16.2, 16.3, 16.4, 16.5, 16.6
 */
export function VsScreen({ robots, mode, onComplete, bracketName }: VsScreenProps) {
  const theme = useTheme()

  // Auto-transition after duration expires
  useEffect(() => {
    const timer = setTimeout(onComplete, VS_SCREEN_DURATION_MS)
    return () => clearTimeout(timer)
  }, [onComplete])

  if (mode === "1v1") {
    return <VsLayout1v1 robots={robots} />
  }

  return <VsLayoutFFA robots={robots} bracketName={bracketName} />
}

// ── 1v1 Layout ──

function VsLayout1v1({ robots }: { robots: VsRobot[] }) {
  const theme = useTheme()
  const [robot1, robot2] = robots

  return (
    <div className={`flex flex-col items-center gap-6 px-4 py-8 ${theme.font}`}>
      {/* Title */}
      <h2 className={`text-lg font-bold uppercase tracking-widest ${theme.accentText}`}>
        Battle Commencing
      </h2>

      {/* VS Layout — Vertical */}
      <div className="flex flex-col items-center gap-4">
        {/* Robot 1 */}
        {robot1 && <RobotCard robot={robot1} index={0} />}

        {/* VS Text */}
        <div className="flex items-center justify-center">
          <span className={`text-4xl font-black ${theme.mutedText}`}>VS</span>
        </div>

        {/* Robot 2 */}
        {robot2 && <RobotCard robot={robot2} index={1} />}
      </div>
    </div>
  )
}

// ── FFA Layout ──

function VsLayoutFFA({ robots, bracketName }: { robots: VsRobot[]; bracketName?: string }) {
  const theme = useTheme()

  return (
    <div className={`flex flex-col items-center gap-6 px-4 py-8 ${theme.font}`}>
      {/* Title */}
      <h2 className={`text-lg font-bold uppercase tracking-widest ${theme.accentText}`}>
        Free-For-All
      </h2>

      {/* Bracket name */}
      {bracketName && (
        <p className={`-mt-4 text-sm font-semibold uppercase tracking-wide ${theme.headingText}`}>
          {bracketName}
        </p>
      )}

      {/* Grid of robots */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {robots.map((robot, index) => (
          <RobotCard key={index} robot={robot} index={index} />
        ))}
      </div>
    </div>
  )
}

// ── Robot Card ──

function RobotCard({ robot, index }: { robot: VsRobot; index: number }) {
  const theme = useTheme()
  const color = robot.visual.color ?? ROBOT_COLORS[index % ROBOT_COLORS.length]

  const visualConfig: RobotVisualConfig = {
    weaponType: robot.visual.weapon as RobotVisualConfig["weaponType"],
    headType: robot.visual.head as RobotVisualConfig["headType"],
    bodyType: robot.visual.body as RobotVisualConfig["bodyType"],
    color,
  }

  return (
    <div
      className={`flex flex-col items-center gap-2 rounded-lg p-4 ${theme.card} ${
        robot.isCurrentPlayer
          ? `${theme.currentPlayerRing} ring-2 ring-[#f5c542]`
          : ""
      }`}
      aria-label={`${robot.name} owned by ${robot.ownerName}${robot.isCurrentPlayer ? " (you)" : ""}`}
    >
      {/* Robot SVG */}
      <CompositeRobot config={visualConfig} size={96} />

      {/* Robot name */}
      <span className={`text-sm font-bold ${theme.bodyText}`}>
        {robot.name}
      </span>

      {/* Owner name */}
      <span className={`text-xs ${theme.mutedText}`}>
        {robot.ownerName}
      </span>

      {/* Star values */}
      <StarDisplay
        damage={robot.stars.damage}
        accuracy={robot.stars.accuracy}
        speed={robot.stars.speed}
      />
    </div>
  )
}
