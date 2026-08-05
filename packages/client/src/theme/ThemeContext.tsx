import { createContext, useContext, type ReactNode } from "react"
import type { ThemeId } from "@games-of-chance/shared"
import type { ThemeDefinition } from "./types"
import { getTheme, DEFAULT_THEME } from "./themes"

const ThemeContext = createContext<ThemeDefinition>(getTheme(DEFAULT_THEME))

interface ThemeProviderProps {
  themeId?: ThemeId
  children: ReactNode
}

/**
 * ThemeProvider — wraps the app (or a section) to provide theme classes
 * to all child components via useTheme().
 *
 * The themeId is typically read from game settings (synced from the server).
 * If not provided, falls back to DEFAULT_THEME.
 */
export function ThemeProvider({ themeId, children }: ThemeProviderProps) {
  const theme = getTheme(themeId)

  return (
    <ThemeContext.Provider value={theme}>
      <div className={`${theme.page} ${theme.font} min-h-screen transition-colors duration-300`}>
        {children}
      </div>
    </ThemeContext.Provider>
  )
}

/**
 * useTheme — access the current theme definition from any component.
 *
 * Usage:
 *   const theme = useTheme()
 *   <h1 className={theme.titleText}>Hello</h1>
 *   <button className={theme.btnPrimary}>Click</button>
 */
export function useTheme(): ThemeDefinition {
  return useContext(ThemeContext)
}
