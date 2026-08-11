import { useState, useEffect, useRef, useCallback } from "react"
import { DIAGNOSTIC_UPDATE_MS } from "../components/layout/viewport-constants"

export interface DiagnosticInfo {
  viewportHeight: number
  safeAreaTop: number
  safeAreaBottom: number
  safeAreaLeft: number
  safeAreaRight: number
  scrollDetected: boolean
  containmentViolation: boolean
}

const INITIAL_DIAGNOSTICS: DiagnosticInfo = {
  viewportHeight: 0,
  safeAreaTop: 0,
  safeAreaBottom: 0,
  safeAreaLeft: 0,
  safeAreaRight: 0,
  scrollDetected: false,
  containmentViolation: false,
}

/**
 * Reads a CSS env() safe-area-inset value from the computed style of an element.
 * The element must have the safe-area padding applied (e.g., viewport-container).
 */
function getSafeAreaInsets(el: HTMLElement) {
  const style = getComputedStyle(el)
  return {
    top: parseFloat(style.paddingTop) || 0,
    bottom: parseFloat(style.paddingBottom) || 0,
    left: parseFloat(style.paddingLeft) || 0,
    right: parseFloat(style.paddingRight) || 0,
  }
}

/**
 * Hook that provides real-time diagnostic info about the viewport container.
 * Updates within DIAGNOSTIC_UPDATE_MS (200ms) of any resize or orientation change.
 */
export function useDiagnosticInfo(containerRef: React.RefObject<HTMLElement | HTMLDivElement | null>) {
  const [info, setInfo] = useState<DiagnosticInfo>(INITIAL_DIAGNOSTICS)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updateDiagnostics = useCallback(() => {
    const el = containerRef.current
    if (!el) return

    const insets = getSafeAreaInsets(el)
    const scrollDetected = el.scrollHeight > el.clientHeight
    const containmentViolation = el.scrollHeight > el.clientHeight

    setInfo({
      viewportHeight: el.clientHeight,
      safeAreaTop: insets.top,
      safeAreaBottom: insets.bottom,
      safeAreaLeft: insets.left,
      safeAreaRight: insets.right,
      scrollDetected,
      containmentViolation,
    })
  }, [containerRef])

  const scheduleUpdate = useCallback(() => {
    if (timerRef.current !== null) return
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      updateDiagnostics()
    }, DIAGNOSTIC_UPDATE_MS)
  }, [updateDiagnostics])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // Initial measurement
    updateDiagnostics()

    // ResizeObserver for container size changes
    const resizeObserver = new ResizeObserver(() => {
      scheduleUpdate()
    })
    resizeObserver.observe(el)

    // Window resize and orientation change listeners
    window.addEventListener("resize", scheduleUpdate)
    window.addEventListener("orientationchange", scheduleUpdate)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener("resize", scheduleUpdate)
      window.removeEventListener("orientationchange", scheduleUpdate)
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
    }
  }, [containerRef, updateDiagnostics, scheduleUpdate])

  return info
}
