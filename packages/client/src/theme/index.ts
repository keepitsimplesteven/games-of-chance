/**
 * Theme System — public API
 *
 * Usage:
 *   import { ThemeProvider, useTheme } from "../theme"
 *
 *   // In App.tsx or layout wrapper:
 *   <ThemeProvider themeId={gameSettings.theme}>
 *     <App />
 *   </ThemeProvider>
 *
 *   // In any component:
 *   const theme = useTheme()
 *   <div className={theme.card}>
 *     <h2 className={`${theme.headingText} text-sm font-bold`}>Players</h2>
 *   </div>
 */

export { ThemeProvider, useTheme } from "./ThemeContext"
export { THEMES, DEFAULT_THEME, getTheme } from "./themes"
export type { ThemeDefinition } from "./types"
