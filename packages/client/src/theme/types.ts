/**
 * Theme Definition — the contract every theme must implement.
 *
 * Each slot is a Tailwind class string. Components read from this interface
 * via the useTheme() hook. To add a new theme, create a new file that
 * satisfies this interface and register it in ./themes.ts.
 *
 * Slots are organized by category:
 * - page: top-level page/body styles
 * - text: typography colors and styles
 * - card: container/panel styles
 * - button: interactive element styles
 * - field: game-specific field/board styles
 */
export interface ThemeDefinition {
  /** Unique identifier (matches ThemeId from shared) */
  id: string
  /** Display name */
  name: string

  // ── Page-level ──
  /** Applied to the root page container */
  page: string
  /** Font family class (font-mono, font-sans, etc.) */
  font: string

  // ── Typography ──
  /** Primary heading text (titles, game names) */
  titleText: string
  /** Secondary heading (card headers, section labels) */
  headingText: string
  /** Body/primary text color */
  bodyText: string
  /** Muted/secondary text */
  mutedText: string
  /** Accent/highlight text (scores, emphasis) */
  accentText: string

  // ── Containers ──
  /** Primary card/panel background + border */
  card: string
  /** Card header/title styling */
  cardHeader: string
  /** List item within a card */
  listItem: string

  // ── Buttons ──
  /** Primary action button (e.g. HEADS, confirm) */
  btnPrimary: string
  /** Secondary action button (e.g. TAILS, cancel) */
  btnSecondary: string
  /** Tertiary/ghost button */
  btnGhost: string

  // ── Status indicators ──
  /** Success state (correct guess, touchdown) */
  statusSuccess: string
  /** Danger state (turnover, wrong guess) */
  statusDanger: string
  /** Neutral/pending state */
  statusNeutral: string

  // ── Leaderboard ──
  /** Ring class applied to the current player's row */
  currentPlayerRing: string
  /** Rank badge style for 1st place (gold) */
  rankBadge1: string
  /** Rank badge style for 2nd place (silver) */
  rankBadge2: string
  /** Rank badge style for 3rd place (bronze) */
  rankBadge3: string
  /** Rank badge style for 4th place and below */
  rankBadgeDefault: string

  // ── Game-specific field colors (for SVG use) ──
  field: {
    background: string
    surface: string
    line: string
    accent: string
    ballFill: string
    ballStroke: string
    glow: string
  }
}
