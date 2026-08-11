import { render, screen } from "@testing-library/react"
import { describe, it, expect, beforeEach } from "vitest"
import { useGameStore } from "../../../store/useGameStore"
import { PlaycallerContainer } from "../PlaycallerContainer"
import { BracketVisualization } from "../BracketVisualization"
import type { RoomState, Bracket, PlaycallerGameState } from "@games-of-chance/shared"

// ── Helpers ────────────────────────────────────────────────────────────────

function buildMockBracket(overrides?: Partial<Bracket>): Bracket {
  return {
    rounds: [
      {
        roundIndex: 0,
        matchups: [
          { matchupId: "r0-m0", playerA: "p3", playerB: "p4", winner: "p3" },
        ],
        byes: ["p1", "p2"],
        resolved: true,
      },
      {
        roundIndex: 1,
        matchups: [
          { matchupId: "r1-m0", playerA: "p1", playerB: "p3", winner: null },
          { matchupId: "r1-m1", playerA: "p2", playerB: "p4", winner: null },
        ],
        byes: [],
        resolved: false,
      },
    ],
    currentRoundIndex: 1,
    totalRounds: 2,
    seeds: { p1: 1, p2: 2, p3: 3, p4: 4 },
    eliminated: {},
    ...overrides,
  }
}

function buildMockRoomState(overrides?: Partial<RoomState>): RoomState {
  return {
    room: {
      roomId: "test-room",
      gameType: "playcaller",
      maxPlayers: 10,
      scoringMode: "grand-prix",
      autoMode: false,
      autoRoundIntervalMs: 5000,
      placementPoints: [250, 125, 75, 50],
      roomSize: 4,
      progressionMode: "endless",
    },
    players: [
      { id: "p1", name: "Alice", role: "host", connected: true, connectionId: "conn-1" },
      { id: "p2", name: "Bob", role: "player", connected: true, connectionId: "conn-2" },
      { id: "p3", name: "Charlie", role: "player", connected: true, connectionId: "conn-3" },
      { id: "p4", name: "Dave", role: "player", connected: true, connectionId: "conn-4" },
    ],
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
    gameSettings: {
      roundCount: 2,
      pickWindowMs: 3000,
      tuning: {},
    },
    settingsLocked: true,
    preGameRanks: {},
    playcallerGameState: {
      bracket: buildMockBracket(),
      spectators: [],
      activeCompetitors: ["p1", "p2", "p3"],
    },
    ...overrides,
  }
}

function setStoreState(playerId: string, roomState: RoomState | null) {
  useGameStore.setState({
    playerId,
    roomState,
    _socketSend: () => {},
  })
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("PlaycallerContainer", () => {
  beforeEach(() => {
    useGameStore.setState({
      playerId: null,
      roomState: null,
      _socketSend: null,
    })
  })

  it("renders MatchPanel for active competitor showing player names", () => {
    const roomState = buildMockRoomState({
      round: {
        phase: "PICKING",
        roundNumber: 1,
        pickDeadlineMs: null,
        picks: {},
        result: null,
        resolvedAt: null,
      },
      playcallerGameState: {
        bracket: buildMockBracket(),
        spectators: ["p4"],
        activeCompetitors: ["p1", "p2", "p3"],
      },
    })
    setStoreState("p1", roomState)

    render(<PlaycallerContainer />)

    // MatchPanel renders VS and player names
    expect(screen.getByText("VS")).toBeInTheDocument()
    expect(screen.getByText("p1")).toBeInTheDocument()
  })

  it('renders "Spectating" for eliminated player', () => {
    const roomState = buildMockRoomState({
      round: {
        phase: "PICKING",
        roundNumber: 1,
        pickDeadlineMs: null,
        picks: {},
        result: null,
        resolvedAt: null,
      },
      playcallerGameState: {
        bracket: buildMockBracket({ eliminated: { p4: 0 } }),
        spectators: ["p4"],
        activeCompetitors: ["p1", "p2", "p3"],
      },
    })
    setStoreState("p4", roomState)

    render(<PlaycallerContainer />)

    expect(screen.getByText("Spectating")).toBeInTheDocument()
  })

  it("renders bracket visualization between rounds (RESULT phase)", () => {
    const roomState = buildMockRoomState({
      round: {
        phase: "RESULT",
        roundNumber: 1,
        pickDeadlineMs: null,
        picks: {},
        result: null,
        resolvedAt: null,
      },
      playcallerGameState: {
        bracket: buildMockBracket(),
        spectators: ["p4"],
        activeCompetitors: ["p1", "p2", "p3"],
      },
    })
    setStoreState("p1", roomState)

    render(<PlaycallerContainer />)

    expect(screen.getByText(/Complete/)).toBeInTheDocument()
  })
})

describe("BracketVisualization", () => {
  beforeEach(() => {
    useGameStore.setState({
      playerId: null,
      roomState: null,
      _socketSend: null,
    })
  })

  it("shows bye indicators", () => {
    const bracket = buildMockBracket({
      rounds: [
        {
          roundIndex: 0,
          matchups: [
            { matchupId: "r0-m0", playerA: "p3", playerB: "p4", winner: "p3" },
          ],
          byes: ["p1", "p2"],
          resolved: true,
        },
        {
          roundIndex: 1,
          matchups: [
            { matchupId: "r1-m0", playerA: "p1", playerB: "p3", winner: null },
            { matchupId: "r1-m1", playerA: "p2", playerB: "p4", winner: null },
          ],
          byes: [],
          resolved: false,
        },
      ],
    })

    // Set up store with players so names resolve
    const roomState = buildMockRoomState({ playcallerGameState: { bracket, spectators: [], activeCompetitors: [] } })
    setStoreState("p1", roomState)

    render(<BracketVisualization bracket={bracket} />)

    const byeElements = screen.getAllByText("BYE")
    expect(byeElements.length).toBe(2)
  })

  it("shows eliminated players with line-through class", () => {
    const bracket = buildMockBracket({
      rounds: [
        {
          roundIndex: 0,
          matchups: [
            { matchupId: "r0-m0", playerA: "p3", playerB: "p4", winner: "p3" },
          ],
          byes: ["p1", "p2"],
          resolved: true,
        },
        {
          roundIndex: 1,
          matchups: [
            { matchupId: "r1-m0", playerA: "p1", playerB: "p3", winner: null },
          ],
          byes: [],
          resolved: false,
        },
      ],
      eliminated: { p4: 0 },
    })

    const roomState = buildMockRoomState({ playcallerGameState: { bracket, spectators: ["p4"], activeCompetitors: ["p1", "p2", "p3"] } })
    setStoreState("p1", roomState)

    render(<BracketVisualization bracket={bracket} />)

    // p4 is eliminated and lost in the resolved matchup — should have line-through
    const daveElement = screen.getByText("(4) Dave")
    expect(daveElement).toHaveClass("line-through")
  })
})
