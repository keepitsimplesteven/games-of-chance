import { render, screen } from "@testing-library/react"
import { describe, it, expect, beforeEach, vi } from "vitest"
import type { ReactNode } from "react"
import type { GameLeaderboardEntry, RoomState } from "@games-of-chance/shared"
import { ThemeProvider } from "../../../theme"
import { BaseLeaderboard } from "../BaseLeaderboard"
import type { BaseLeaderboardProps } from "../BaseLeaderboard"
import GameLeaderboard from "../GameLeaderboard"
import { CoinTossLeaderboard } from "../../../games/coin-toss/CoinTossLeaderboard"
import { useGameStore } from "../../../store/useGameStore"

// jsdom does not implement scrollTo — stub it globally (mirrors sibling tests)
Element.prototype.scrollTo = vi.fn()

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<GameLeaderboardEntry> = {}): GameLeaderboardEntry {
  return {
    playerId: "p1",
    playerName: "Alice",
    score: 100,
    rank: 1,
    ...overrides,
  }
}

/** Three ranked players: Alice (1), Bob (2), Charlie (3). */
function makeEntries(): GameLeaderboardEntry[] {
  return [
    makeEntry({ playerId: "p1", playerName: "Alice", rank: 1, score: 300 }),
    makeEntry({ playerId: "p2", playerName: "Bob", rank: 2, score: 200 }),
    makeEntry({ playerId: "p3", playerName: "Charlie", rank: 3, score: 100 }),
  ]
}

function renderLeaderboard(props: BaseLeaderboardProps) {
  return render(
    <ThemeProvider themeId="retro-casino">
      <BaseLeaderboard {...props} />
    </ThemeProvider>
  )
}

// ── BaseLeaderboard ──────────────────────────────────────────────────────────

describe("BaseLeaderboard", () => {
  it("renders one row per entry with player name and score", () => {
    const entries = makeEntries()
    const { container } = renderLeaderboard({ entries, currentPlayerId: null })

    const items = container.querySelectorAll("li")
    expect(items).toHaveLength(3)

    expect(screen.getByText("Alice")).toBeInTheDocument()
    expect(screen.getByText("Bob")).toBeInTheDocument()
    expect(screen.getByText("Charlie")).toBeInTheDocument()

    expect(screen.getByText("300")).toBeInTheDocument()
    expect(screen.getByText("200")).toBeInTheDocument()
    expect(screen.getByText("100")).toBeInTheDocument()
  })

  it("renders the numeric rank badge for each entry", () => {
    renderLeaderboard({ entries: makeEntries(), currentPlayerId: null })

    // RankBadge renders the numeric rank text for every row.
    expect(screen.getByText("1")).toBeInTheDocument()
    expect(screen.getByText("2")).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument()
  })

  it("gives ranks 1/2/3 distinct badge classes vs the default badge", () => {
    const entries = [
      makeEntry({ playerId: "p1", playerName: "Alice", rank: 1, score: 400 }),
      makeEntry({ playerId: "p2", playerName: "Bob", rank: 2, score: 300 }),
      makeEntry({ playerId: "p3", playerName: "Charlie", rank: 3, score: 200 }),
      makeEntry({ playerId: "p4", playerName: "Dave", rank: 4, score: 100 }),
    ]
    renderLeaderboard({ entries, currentPlayerId: null })

    const badge1 = screen.getByText("1").className
    const badge2 = screen.getByText("2").className
    const badge3 = screen.getByText("3").className
    const badge4 = screen.getByText("4").className

    // Top-three badges each differ from the default (rank 4) badge and each other.
    expect(badge1).not.toEqual(badge4)
    expect(badge2).not.toEqual(badge4)
    expect(badge3).not.toEqual(badge4)
    expect(badge1).not.toEqual(badge2)
    expect(badge2).not.toEqual(badge3)
  })

  it("marks the current player row with a '(you)' suffix and leaves others unmarked", () => {
    renderLeaderboard({ entries: makeEntries(), currentPlayerId: "p2" })

    // Only the current player (Bob) gets the suffix.
    expect(screen.getByText("(you)")).toBeInTheDocument()

    const youMatches = screen.getAllByText((_, el) => el?.textContent === "Bob(you)")
    expect(youMatches.length).toBeGreaterThan(0)

    // Alice / Charlie rows do not contain the suffix.
    expect(screen.queryByText("Alice(you)")).not.toBeInTheDocument()
    expect(screen.queryByText("Charlie(you)")).not.toBeInTheDocument()
  })

  it("renders nothing when entries is empty", () => {
    const { container } = renderLeaderboard({ entries: [], currentPlayerId: null })

    expect(container.querySelectorAll("li")).toHaveLength(0)
    expect(container.textContent).toBe("")
  })

  it("renders renderHeader, renderRow, and renderScore slot content in the default variant", () => {
    const props: BaseLeaderboardProps = {
      entries: makeEntries(),
      currentPlayerId: null,
      renderHeader: (entries) => (
        <div data-testid="slot-header">header:{entries.length}</div>
      ),
      renderRow: (entry) => (
        <div data-testid={`slot-row-${entry.playerId}`}>row:{entry.playerName}</div>
      ),
      renderScore: (entry) => (
        <span data-testid={`slot-score-${entry.playerId}`}>+{entry.rank}</span>
      ),
    }
    renderLeaderboard(props)

    expect(screen.getByTestId("slot-header")).toHaveTextContent("header:3")
    expect(screen.getByTestId("slot-row-p1")).toHaveTextContent("row:Alice")
    expect(screen.getByTestId("slot-row-p2")).toBeInTheDocument()
    expect(screen.getByTestId("slot-score-p1")).toBeInTheDocument()
    expect(screen.getByTestId("slot-score-p3")).toBeInTheDocument()
  })

  it("suppresses renderRow and renderScore in the compact variant but keeps renderHeader", () => {
    const slots: Pick<BaseLeaderboardProps, "renderHeader" | "renderRow" | "renderScore"> = {
      renderHeader: () => <div data-testid="slot-header">header</div>,
      renderRow: (entry) => <div data-testid={`slot-row-${entry.playerId}`}>row</div>,
      renderScore: (entry) => <span data-testid={`slot-score-${entry.playerId}`}>score</span>,
    }

    // Default variant: row + score slots present.
    const def = renderLeaderboard({
      entries: makeEntries(),
      currentPlayerId: null,
      ...slots,
    })
    expect(def.getByTestId("slot-row-p1")).toBeInTheDocument()
    expect(def.getByTestId("slot-score-p1")).toBeInTheDocument()
    def.unmount()

    // Compact variant: renderRow/renderScore suppressed, renderHeader kept, rows still render.
    const compact = renderLeaderboard({
      entries: makeEntries(),
      currentPlayerId: null,
      variant: "compact",
      ...slots,
    })
    expect(compact.getByTestId("slot-header")).toBeInTheDocument()
    expect(compact.queryByTestId("slot-row-p1")).not.toBeInTheDocument()
    expect(compact.queryByTestId("slot-score-p1")).not.toBeInTheDocument()
    // Rows themselves still render in compact mode.
    expect(compact.container.querySelectorAll("li")).toHaveLength(3)
    expect(compact.getByText("Alice")).toBeInTheDocument()
  })

  it("renders fire / ice streak indicators based on streak and coldStreak", () => {
    const entries: GameLeaderboardEntry[] = [
      makeEntry({ playerId: "p1", playerName: "Hot3", rank: 1, score: 500, streak: 3 }),
      makeEntry({ playerId: "p2", playerName: "Hot2", rank: 2, score: 400, streak: 2 }),
      makeEntry({ playerId: "p3", playerName: "Cold3", rank: 3, score: 300, coldStreak: 3 }),
      makeEntry({ playerId: "p4", playerName: "Cold2", rank: 4, score: 200, coldStreak: 2 }),
      makeEntry({ playerId: "p5", playerName: "None", rank: 5, score: 100 }),
    ]
    renderLeaderboard({ entries, currentPlayerId: null })

    expect(screen.getByText("🔥🔥")).toBeInTheDocument()
    expect(screen.getByText("🔥")).toBeInTheDocument()
    expect(screen.getByText("🧊🧊")).toBeInTheDocument()
    expect(screen.getByText("🧊")).toBeInTheDocument()

    // The no-streak player renders no indicator emoji.
    expect(screen.queryByText("None🔥")).not.toBeInTheDocument()
  })
})

// ── Wrapper: GameLeaderboard (store-driven, no theme) ────────────────────────

function baseRoomState(overrides: Partial<RoomState> = {}): RoomState {
  return {
    room: {
      roomId: "room-1",
      gameType: "coin-toss",
      maxPlayers: 10,
      scoringMode: "grand-prix",
      autoMode: false,
      autoRoundIntervalMs: 5000,
      placementPoints: [250, 125, 75, 50],
      roomSize: 4,
      progressionMode: "endless",
    },
    players: [],
    round: {
      phase: "PICKING",
      roundNumber: 1,
      pickDeadlineMs: null,
      picks: {},
      result: null,
      resolvedAt: null,
    },
    gameLeaderboard: [],
    sessionLeaderboard: [],
    adjustmentLog: [],
    gameSettings: { roundCount: 2, pickWindowMs: 3000, tuning: {} },
    settingsLocked: false,
    preGameRanks: {},
    playerSeeds: {},
    ...overrides,
  } as unknown as RoomState
}

describe("GameLeaderboard (wrapper)", () => {
  beforeEach(() => {
    useGameStore.setState({ playerId: null, roomState: null, _socketSend: null })
  })

  it("renders nothing when there is no room state", () => {
    useGameStore.setState({ playerId: "p1", roomState: null, _socketSend: () => {} })
    const { container } = render(<GameLeaderboard />)
    expect(container.textContent).toBe("")
  })

  it("renders rank, name, and '<score> pts' rows with a current-player highlight", () => {
    const roomState = baseRoomState({ gameLeaderboard: makeEntries() })
    useGameStore.setState({ playerId: "p2", roomState, _socketSend: () => {} })

    render(<GameLeaderboard />)

    expect(screen.getByText("Leaderboard")).toBeInTheDocument()
    expect(screen.getByText("Alice")).toBeInTheDocument()
    expect(screen.getByText("300 pts")).toBeInTheDocument()
    expect(screen.getByText("200 pts")).toBeInTheDocument()

    // Current player (Bob = p2) is marked with "(you)".
    expect(screen.getByText("(you)")).toBeInTheDocument()
  })

  it("renders nothing when the game leaderboard is empty", () => {
    const roomState = baseRoomState({ gameLeaderboard: [] })
    useGameStore.setState({ playerId: "p1", roomState, _socketSend: () => {} })

    const { container } = render(<GameLeaderboard />)
    expect(container.textContent).toBe("")
  })
})

// ── Wrapper: CoinTossLeaderboard (BaseLeaderboard-backed, proves slot wiring) ──

describe("CoinTossLeaderboard (wrapper)", () => {
  beforeEach(() => {
    useGameStore.setState({ playerId: null, roomState: null, _socketSend: null })
  })

  it("renders BaseLeaderboard rows and the toss-sequence header slot from store state", () => {
    const roomState = baseRoomState({
      gameLeaderboard: makeEntries(),
      coinTossGameState: {
        tossHistory: [
          {
            outcome: "HEADS",
            picks: { p1: "HEADS", p2: "TAILS" },
            deltas: { p1: 10, p2: 0 },
          },
        ],
      },
    } as unknown as Partial<RoomState>)
    useGameStore.setState({ playerId: "p1", roomState, _socketSend: () => {} })

    render(
      <ThemeProvider themeId="retro-casino">
        <CoinTossLeaderboard />
      </ThemeProvider>
    )

    // Rows from BaseLeaderboard.
    expect(screen.getByText("Alice")).toBeInTheDocument()
    expect(screen.getByText("Bob")).toBeInTheDocument()
    // Header slot (TossSequenceRow) renders the "Flips:" label + coin tokens.
    expect(screen.getByText("Flips:")).toBeInTheDocument()
    // Current player (p1) highlight.
    expect(screen.getByText("(you)")).toBeInTheDocument()
  })

  it("renders nothing when there is no leaderboard data", () => {
    const roomState = baseRoomState({ gameLeaderboard: [] })
    useGameStore.setState({ playerId: "p1", roomState, _socketSend: () => {} })

    const { container } = render(
      <ThemeProvider themeId="retro-casino">
        <CoinTossLeaderboard />
      </ThemeProvider>
    )
    expect(container.textContent).toBe("")
  })
})
