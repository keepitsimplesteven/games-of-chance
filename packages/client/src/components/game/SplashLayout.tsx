import type { ReactNode } from "react"
import { useTheme } from "../../theme"

export interface SplashLayoutProps {
  /** Game emoji displayed at the top */
  emoji: string
  /** Game title */
  title: string
  /** Optional additional content (rules, scoring, etc.) rendered below the title */
  children?: ReactNode
  /** Action slot: typically a button for host or waiting text for non-host */
  action: ReactNode
}

/**
 * SplashLayout — The canonical no-scroll-compatible splash screen container.
 *
 * All game splash screens MUST use this component as their outer layout.
 * It provides:
 * - Full-height flex centering that adapts to the ViewportContainer grid slot
 * - Compact spacing that doesn't overflow on small (600px) viewports
 * - Internal scroll for custom content that might exceed available space
 * - Consistent card styling via the active theme
 *
 * Usage:
 *   <SplashLayout emoji="🪙" title="Coin Toss" action={<button>Play</button>}>
 *     <YourCustomContent />
 *   </SplashLayout>
 *
 * IMPORTANT: Do NOT build splash screens with custom fixed-height layouts.
 * Always use SplashLayout to guarantee viewport containment compatibility.
 */
export function SplashLayout({ emoji, title, children, action }: SplashLayoutProps) {
  const theme = useTheme()

  return (
    <div className="flex h-full min-h-0 flex-col items-center overflow-y-auto px-4 py-4">
      <div className={`flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl px-5 py-5 shadow-lg my-auto ${theme.listItem}`}>
        <span className="shrink-0 text-5xl" aria-hidden="true">
          {emoji}
        </span>
        <h2 className={`shrink-0 text-xl font-bold ${theme.titleText}`}>
          {title}
        </h2>

        {/* Custom content slot */}
        {children && (
          <div className="w-full shrink-0">
            {children}
          </div>
        )}

        {/* Action slot (play button / waiting text) */}
        <div className="w-full shrink-0">
          {action}
        </div>
      </div>
    </div>
  )
}

export default SplashLayout
