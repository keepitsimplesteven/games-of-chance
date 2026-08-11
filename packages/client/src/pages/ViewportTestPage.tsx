import { useRef } from "react"
import { ViewportContainer } from "../components/layout/ViewportContainer"
import { useDiagnosticInfo } from "./useDiagnosticInfo"

/**
 * ViewportTestPage — Standalone test harness for validating viewport containment
 * on real mobile devices. Renders a representative game-like layout inside
 * ViewportContainer with visible boundary indicators at safe area edges and
 * container boundary.
 *
 * Accessible at /viewport-test without room connection or game state.
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */
export default function ViewportTestPage() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const diagnostics = useDiagnosticInfo(containerRef)

  return (
    <ViewportContainer className="viewport-test-page" ref={containerRef}>
      {/* Safe area edge indicators — visible borders marking inset boundaries */}
      <div className="pointer-events-none absolute inset-0 z-50">
        {/* Top safe area indicator */}
        <div className="absolute top-0 left-0 right-0 h-px bg-cyan-400 opacity-80" />
        {/* Bottom safe area indicator */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-cyan-400 opacity-80" />
        {/* Left safe area indicator */}
        <div className="absolute top-0 bottom-0 left-0 w-px bg-cyan-400 opacity-80" />
        {/* Right safe area indicator */}
        <div className="absolute top-0 bottom-0 right-0 w-px bg-cyan-400 opacity-80" />
        {/* Container boundary indicator */}
        <div className="absolute inset-0 border-2 border-dashed border-yellow-400 opacity-60" />
      </div>

      {/* Diagnostic overlay — top-right semi-transparent panel */}
      <div
        className={`pointer-events-none absolute top-2 right-2 z-[60] rounded-md px-3 py-2 font-mono text-[10px] leading-tight shadow-lg ${
          diagnostics.containmentViolation
            ? "border-2 border-red-500 bg-red-900/90 text-red-200"
            : "border border-zinc-600 bg-zinc-900/85 text-zinc-300"
        }`}
      >
        <div className="mb-1 text-[11px] font-bold uppercase tracking-wider">
          Diagnostics
        </div>
        <div>Height: {diagnostics.viewportHeight}px</div>
        <div>Safe Top: {diagnostics.safeAreaTop}px</div>
        <div>Safe Bottom: {diagnostics.safeAreaBottom}px</div>
        <div>Safe Left: {diagnostics.safeAreaLeft}px</div>
        <div>Safe Right: {diagnostics.safeAreaRight}px</div>
        <div>
          Scroll:{" "}
          <span
            className={
              diagnostics.scrollDetected ? "text-red-400 font-bold" : "text-emerald-400"
            }
          >
            {diagnostics.scrollDetected ? "YES" : "no"}
          </span>
        </div>
        {diagnostics.containmentViolation && (
          <div className="mt-1 font-bold text-red-400 uppercase">
            ⚠ Containment Violation
          </div>
        )}
      </div>

      {/* Row 1: Mock header */}
      <header className="flex items-center justify-between border-b border-zinc-700 bg-zinc-900/80 px-4 py-3">
        <span className="text-sm font-bold uppercase tracking-wider text-zinc-300">
          Viewport Test
        </span>
        <span className="rounded bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">
          Harness
        </span>
      </header>

      {/* Row 2: Content area */}
      <section className="flex flex-col items-center justify-center gap-3 overflow-hidden px-4">
        <h2 className="text-xl font-bold text-white">Content Area</h2>
        <p className="max-w-xs text-center text-sm text-zinc-400">
          This area simulates the primary game region. It should fill available
          space between header and card grid without scrolling.
        </p>
        <div className="mt-2 flex h-16 w-16 items-center justify-center rounded-full border-2 border-zinc-600 bg-zinc-800 text-2xl">
          🎲
        </div>
      </section>

      {/* Row 3: Card grid with 4 placeholder cards */}
      <section className="border-t border-zinc-700 bg-zinc-900/60 px-4 py-3">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
          Play Cards
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="flex h-16 items-center justify-center rounded border border-zinc-600 bg-zinc-800 text-sm font-semibold text-zinc-300"
            >
              Card {n}
            </div>
          ))}
        </div>
      </section>
    </ViewportContainer>
  )
}
