import { forwardRef, type ReactNode, type CSSProperties } from "react"
import "./ViewportContainer.css"
import { LandscapeInterstitial } from "./LandscapeInterstitial"

export interface ViewportContainerProps {
  children: ReactNode
  /** Optional className for additional styling */
  className?: string
  /** Grid template rows value. Default: "auto 1fr auto" */
  gridRows?: string
}

/**
 * ViewportContainer — The foundational layout primitive that enforces viewport
 * containment. Uses 100svh height with 100vh fallback, caps at 1366px height
 * and 1024px width, applies safe-area padding, and sets up CSS Grid for children.
 *
 * CSS progressive enhancement is handled in ViewportContainer.css to preserve
 * fallback declaration ordering (100vh → 100svh → min(100svh, 1366px)).
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 8.1, 8.2, 8.3, 8.4, 9.1, 9.2
 */
export const ViewportContainer = forwardRef<HTMLDivElement, ViewportContainerProps>(
  function ViewportContainer({ children, className, gridRows = "auto 1fr auto" }, ref) {
    const style: CSSProperties | undefined =
      gridRows !== "auto 1fr auto"
        ? { gridTemplateRows: gridRows }
        : undefined

    return (
      <div
        ref={ref}
        className={`viewport-container${className ? ` ${className}` : ""}`}
        style={style}
      >
        <LandscapeInterstitial />
        {children}
      </div>
    )
  }
)

export default ViewportContainer
