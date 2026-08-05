import type { ThemeId } from "@games-of-chance/shared"
import type { ThemeDefinition } from "./types"
import { pixelVapor } from "./pixel-vapor"
import { retroCasino } from "./retro-casino"

/**
 * Theme registry — maps ThemeId to its full definition.
 * To add a new theme:
 *   1. Create a new file (e.g. ./my-theme.ts) implementing ThemeDefinition
 *   2. Add the ID to ThemeId in packages/shared/src/types.ts
 *   3. Register it here
 */
export const THEMES: Record<ThemeId, ThemeDefinition> = {
  "pixel-vapor": pixelVapor,
  "retro-casino": retroCasino,
}

/** Default theme used before settings are loaded */
export const DEFAULT_THEME: ThemeId = "retro-casino"

/** Get a theme definition by ID, falling back to default */
export function getTheme(id: ThemeId | undefined | null): ThemeDefinition {
  return THEMES[id ?? DEFAULT_THEME] ?? THEMES[DEFAULT_THEME]
}
