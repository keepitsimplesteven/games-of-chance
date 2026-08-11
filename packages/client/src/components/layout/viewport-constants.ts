/** ViewportContainer dimension caps */
export const VIEWPORT_MAX_WIDTH = 1024 // px — iPad Pro portrait width
export const VIEWPORT_MAX_HEIGHT = 1366 // px — iPad Pro portrait height

/** Scroll fallback threshold */
export const MIN_VIEWPORT_HEIGHT = 600 // px

/** Overlay constraints */
export const OVERLAY_MAX_HEIGHT_PERCENT = 60
export const OVERLAY_EDGE_CLEARANCE = 8 // px

/** Diagnostic update debounce */
export const DIAGNOSTIC_UPDATE_MS = 200

export interface GameGridConfig {
  /** CSS grid-template-rows value using svh units */
  rows: string
  /** Minimum viewport height before enabling scroll fallback */
  minHeight: number
}

export const GAME_GRID_CONFIGS: Record<string, GameGridConfig> = {
  "coin-toss": {
    rows: "auto minmax(40svh, 1fr) auto",
    minHeight: 600,
  },
  "battle-bots": {
    rows: "auto minmax(40svh, 1fr) auto",
    minHeight: 600,
  },
  "big-wheel": {
    rows: "auto minmax(45svh, 1fr) auto",
    minHeight: 600,
  },
  "playcaller": {
    rows: "auto minmax(40svh, 1fr) auto",
    minHeight: 600,
  },
}
