import type { CSSProperties } from "react"

export interface ResponsiveTextProps {
  children: React.ReactNode
  /** Minimum font size in px. Default: 14 */
  minSize?: number
  /** Maximum font size in px. Default: 24 */
  maxSize?: number
  /** Whether to truncate with ellipsis on overflow. Default: false */
  truncate?: boolean
  className?: string
}

/**
 * ResponsiveText — fluid typography component using CSS clamp().
 * Scales text linearly between minSize (at 375px viewport) and maxSize (at 1280px viewport).
 * Optionally truncates overflowing text with an ellipsis.
 *
 * Validates: Requirements 6.1, 6.3, 6.4
 */
export function ResponsiveText({
  children,
  minSize = 14,
  maxSize = 24,
  truncate = false,
  className,
}: ResponsiveTextProps) {
  // Linear interpolation: fontSize scales from minSize at 375px to maxSize at 1280px
  // Formula: clamp(min, calc(min + (max - min) * ((100vw - 375px) / (1280 - 375))), max)
  const range = maxSize - minSize
  const viewportRange = 1280 - 375 // 905px

  const fontSize = `clamp(${minSize}px, calc(${minSize}px + ${range} * (100vw - 375px) / ${viewportRange}), ${maxSize}px)`

  const style: CSSProperties = {
    fontSize,
    ...(truncate && {
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      overflow: "hidden",
    }),
  }

  return (
    <span className={className} style={style}>
      {children}
    </span>
  )
}
