import {
  type ReactNode,
  type CSSProperties,
  useRef,
  useLayoutEffect,
  useState,
} from "react"
import {
  OVERLAY_MAX_HEIGHT_PERCENT,
  OVERLAY_EDGE_CLEARANCE,
} from "./viewport-constants"

export interface OverlayContainerProps {
  children: ReactNode
  /** Maximum height as percentage of viewport. Default: 60 */
  maxHeightPercent?: number
  /** Minimum clearance from viewport edges in px. Default: 8 */
  edgeClearance?: number
  /** Whether to auto-reposition when clipped */
  autoReposition?: boolean
  /** Optional className */
  className?: string
}

/**
 * Calculates the translation offset needed to keep an element fully within viewport bounds.
 * Exported for testing.
 */
export function calculateRepositionOffset(
  rect: { top: number; right: number; bottom: number; left: number },
  viewportWidth: number,
  viewportHeight: number,
  edgeClearance: number
): { translateX: number; translateY: number } {
  let translateX = 0
  let translateY = 0

  // Check if bottom edge clips viewport
  if (rect.bottom + edgeClearance > viewportHeight) {
    translateY = -(rect.bottom + edgeClearance - viewportHeight)
  }
  // Check if top edge clips viewport
  if (rect.top - edgeClearance < 0) {
    translateY = -(rect.top - edgeClearance)
  }

  // Check if right edge clips viewport
  if (rect.right + edgeClearance > viewportWidth) {
    translateX = -(rect.right + edgeClearance - viewportWidth)
  }
  // Check if left edge clips viewport
  if (rect.left - edgeClearance < 0) {
    translateX = -(rect.left - edgeClearance)
  }

  return { translateX, translateY }
}

/**
 * OverlayContainer — A wrapper for popovers, drawers, and modals that enforces
 * viewport-bounded positioning. Limits max-height to a percentage of the viewport,
 * enables internal scrolling when content overflows, and maintains minimum edge
 * clearance from all viewport sides.
 *
 * When `autoReposition` is true, measures the element after mount and applies a
 * transform: translate() correction if any edge extends beyond the viewport minus
 * the edge clearance.
 *
 * Validates: Requirements 5.1, 5.2, 5.3, 5.5
 */
export function OverlayContainer({
  children,
  maxHeightPercent = OVERLAY_MAX_HEIGHT_PERCENT,
  edgeClearance = OVERLAY_EDGE_CLEARANCE,
  autoReposition = false,
  className,
}: OverlayContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState<{
    translateX: number
    translateY: number
  } | null>(null)

  useLayoutEffect(() => {
    if (!autoReposition || !containerRef.current) return

    const el = containerRef.current
    const rect = el.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    const { translateX, translateY } = calculateRepositionOffset(
      rect,
      viewportWidth,
      viewportHeight,
      edgeClearance
    )

    if (translateX !== 0 || translateY !== 0) {
      setOffset({ translateX, translateY })
    } else {
      setOffset(null)
    }
  }, [autoReposition, edgeClearance])

  const style: CSSProperties = {
    maxHeight: `${maxHeightPercent}svh`,
    overflowY: "auto",
    margin: `${edgeClearance}px`,
    ...(offset && {
      transform: `translate(${offset.translateX}px, ${offset.translateY}px)`,
    }),
  }

  return (
    <div
      ref={containerRef}
      className={`overlay-container${className ? ` ${className}` : ""}`}
      style={style}
      data-auto-reposition={autoReposition || undefined}
    >
      {children}
    </div>
  )
}

export default OverlayContainer
