import { CompositeRobot, type RobotVisualConfig } from "../assets/RobotParts"

// ── Props ──

export interface RobotPreviewProps {
  config: RobotVisualConfig
  size?: number
}

/**
 * RobotPreview — Renders a live preview of the composed robot SVG.
 *
 * Wraps the existing CompositeRobot component with a consistent size
 * for use in the PartCarousel prep phase UI.
 *
 * Validates: Requirements 9.3
 */
export function RobotPreview({ config, size = 128 }: RobotPreviewProps) {
  return (
    <div className="flex items-center justify-center">
      <CompositeRobot config={config} size={size} />
    </div>
  )
}
