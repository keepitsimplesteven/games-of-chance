import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, beforeEach } from "vitest"
import { useGameStore } from "../../../store/useGameStore"
import SettingsPanel from "../SettingsPanel"
import type { RoomState } from "@games-of-chance/shared"

// ── Helpers ────────────────────────────────────────────────────────────────

function buildMockRoomState(overrides?: Partial<RoomState>): RoomState {
  return {
    room: {
      roomId: "test-room",
      gameType: "coin-toss",
      maxPlayers: 10,
      scoringMode: "grand-prix",
      autoMode: false,
      autoRoundIntervalMs: 5000,
      placementPoints: [10, 5, 3, 1, 1, 1, 1, 0, 0, 0],
    },
    players: [
      { id: "host-1", name: "Host", role: "host", connected: true, connectionId: "conn-1" },
    ],
    round: {
      phase: "LOBBY",
      roundNumber: 0,
      pickDeadlineMs: null,
      picks: {},
      result: null,
      resolvedAt: null,
    },
    gameLeaderboard: [],
    sessionLeaderboard: [],
    adjustmentLog: [],
    gameSettings: {
      roundCount: 10,
      pickWindowMs: 10000,
      tuning: {
        CORRECT_GUESS_CHIPS: 10,
        STREAK_MULTIPLIER: 2,
        STREAK_THRESHOLD: 3,
      },
    },
    settingsLocked: false,
    ...overrides,
  }
}

function setStoreState(role: "host" | "player" | null, roomState: RoomState | null) {
  useGameStore.setState({
    role,
    roomState,
    _socketSend: () => {},
  })
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("SettingsPanel", () => {
  beforeEach(() => {
    // Reset store to defaults between tests
    useGameStore.setState({
      role: null,
      roomState: null,
      _socketSend: null,
    })
  })

  // ── Host-only rendering (Requirement 8.1, 8.3) ─────────────────────────

  describe("host-only access control", () => {
    it("renders the settings panel for host role", () => {
      const roomState = buildMockRoomState()
      setStoreState("host", roomState)

      render(<SettingsPanel />)

      expect(screen.getByRole("region", { name: "Game Settings" })).toBeInTheDocument()
      expect(screen.getByText("Settings")).toBeInTheDocument()
    })

    it("does not render for player role", () => {
      const roomState = buildMockRoomState()
      setStoreState("player", roomState)

      const { container } = render(<SettingsPanel />)

      expect(container.firstChild).toBeNull()
    })

    it("does not render when role is null", () => {
      const roomState = buildMockRoomState()
      setStoreState(null, roomState)

      const { container } = render(<SettingsPanel />)

      expect(container.firstChild).toBeNull()
    })
  })

  // ── Locked state (Requirement 7.2) ─────────────────────────────────────

  describe("locked state", () => {
    it("shows lock indicator when settingsLocked is true", () => {
      const roomState = buildMockRoomState({ settingsLocked: true })
      setStoreState("host", roomState)

      render(<SettingsPanel />)

      expect(screen.getByLabelText("Settings locked")).toBeInTheDocument()
      expect(screen.getByText("Locked")).toBeInTheDocument()
    })

    it("disables all inputs when settingsLocked is true", () => {
      const roomState = buildMockRoomState({ settingsLocked: true })
      setStoreState("host", roomState)

      render(<SettingsPanel />)

      const roundCountInput = screen.getByLabelText("Rounds per game") as HTMLInputElement
      const pickWindowInput = screen.getByLabelText("Pick window (seconds)") as HTMLInputElement
      const scoringModeSelect = screen.getByLabelText("Scoring mode") as HTMLSelectElement
      const autoModeToggle = screen.getByRole("switch")

      expect(roundCountInput).toBeDisabled()
      expect(pickWindowInput).toBeDisabled()
      expect(scoringModeSelect).toBeDisabled()
      expect(autoModeToggle).toBeDisabled()
    })

    it("does not show lock indicator when settingsLocked is false", () => {
      const roomState = buildMockRoomState({ settingsLocked: false })
      setStoreState("host", roomState)

      render(<SettingsPanel />)

      expect(screen.queryByLabelText("Settings locked")).not.toBeInTheDocument()
    })
  })

  // ── Scoring mode dropdown (Requirement 5.1) ────────────────────────────

  describe("scoring mode dropdown", () => {
    it("shows current value 'grand-prix' as selected", () => {
      const roomState = buildMockRoomState()
      setStoreState("host", roomState)

      render(<SettingsPanel />)

      const select = screen.getByLabelText("Scoring mode") as HTMLSelectElement
      expect(select.value).toBe("grand-prix")
    })

    it("shows current value 'chips' as selected when room uses chips", () => {
      const roomState = buildMockRoomState({
        room: {
          roomId: "test-room",
          gameType: "coin-toss",
          maxPlayers: 10,
          scoringMode: "chips",
          autoMode: false,
          autoRoundIntervalMs: 5000,
          placementPoints: [10, 5, 3, 1, 1, 1, 1, 0, 0, 0],
        },
      })
      setStoreState("host", roomState)

      render(<SettingsPanel />)

      const select = screen.getByLabelText("Scoring mode") as HTMLSelectElement
      expect(select.value).toBe("chips")
    })

    it("has Grand Prix and Chips options available", () => {
      const roomState = buildMockRoomState()
      setStoreState("host", roomState)

      render(<SettingsPanel />)

      const select = screen.getByLabelText("Scoring mode") as HTMLSelectElement
      const options = select.querySelectorAll("option")
      expect(options).toHaveLength(2)
      expect(options[0].textContent).toBe("Grand Prix")
      expect(options[0].value).toBe("grand-prix")
      expect(options[1].textContent).toBe("Chips")
      expect(options[1].value).toBe("chips")
    })
  })

  // ── Auto-mode toggle reveals interval (Requirement 5.2) ────────────────

  describe("auto-mode toggle and interval", () => {
    it("does not show interval input when auto-mode is off", () => {
      const roomState = buildMockRoomState()
      setStoreState("host", roomState)

      render(<SettingsPanel />)

      expect(screen.queryByLabelText("Auto-round interval (seconds)")).not.toBeInTheDocument()
    })

    it("reveals interval input when auto-mode is enabled", () => {
      const roomState = buildMockRoomState({
        room: {
          roomId: "test-room",
          gameType: "coin-toss",
          maxPlayers: 10,
          scoringMode: "grand-prix",
          autoMode: true,
          autoRoundIntervalMs: 5000,
          placementPoints: [10, 5, 3, 1, 1, 1, 1, 0, 0, 0],
        },
      })
      setStoreState("host", roomState)

      render(<SettingsPanel />)

      const intervalInput = screen.getByLabelText("Auto-round interval (seconds)") as HTMLInputElement
      expect(intervalInput).toBeInTheDocument()
      expect(intervalInput.value).toBe("5")
    })

    it("shows auto-mode toggle with correct aria-checked state when off", () => {
      const roomState = buildMockRoomState()
      setStoreState("host", roomState)

      render(<SettingsPanel />)

      const toggle = screen.getByRole("switch")
      expect(toggle).toHaveAttribute("aria-checked", "false")
    })

    it("shows auto-mode toggle with correct aria-checked state when on", () => {
      const roomState = buildMockRoomState({
        room: {
          roomId: "test-room",
          gameType: "coin-toss",
          maxPlayers: 10,
          scoringMode: "grand-prix",
          autoMode: true,
          autoRoundIntervalMs: 5000,
          placementPoints: [10, 5, 3, 1, 1, 1, 1, 0, 0, 0],
        },
      })
      setStoreState("host", roomState)

      render(<SettingsPanel />)

      const toggle = screen.getByRole("switch")
      expect(toggle).toHaveAttribute("aria-checked", "true")
    })
  })

  // ── Collapsible tuning section ─────────────────────────────────────────

  describe("collapsible tuning section", () => {
    it("renders Game Tuning section when schema exists for the game type", () => {
      const roomState = buildMockRoomState()
      setStoreState("host", roomState)

      render(<SettingsPanel />)

      expect(screen.getByText("Game Tuning")).toBeInTheDocument()
    })

    it("tuning section starts expanded by default", () => {
      const roomState = buildMockRoomState()
      setStoreState("host", roomState)

      render(<SettingsPanel />)

      const toggleButton = screen.getByRole("button", { name: /Game Tuning/i })
      expect(toggleButton).toHaveAttribute("aria-expanded", "true")

      // Tuning fields should be visible
      expect(screen.getByText("Points per correct guess")).toBeInTheDocument()
      expect(screen.getByText("Streak multiplier")).toBeInTheDocument()
      expect(screen.getByText("Streak threshold")).toBeInTheDocument()
    })

    it("collapses tuning section when toggle button is clicked", () => {
      const roomState = buildMockRoomState()
      setStoreState("host", roomState)

      render(<SettingsPanel />)

      const toggleButton = screen.getByRole("button", { name: /Game Tuning/i })
      fireEvent.click(toggleButton)

      expect(toggleButton).toHaveAttribute("aria-expanded", "false")
      // Tuning fields should no longer be visible
      expect(screen.queryByText("Points per correct guess")).not.toBeInTheDocument()
    })

    it("expands tuning section again when toggle button is clicked twice", () => {
      const roomState = buildMockRoomState()
      setStoreState("host", roomState)

      render(<SettingsPanel />)

      const toggleButton = screen.getByRole("button", { name: /Game Tuning/i })
      fireEvent.click(toggleButton) // collapse
      fireEvent.click(toggleButton) // expand again

      expect(toggleButton).toHaveAttribute("aria-expanded", "true")
      expect(screen.getByText("Points per correct guess")).toBeInTheDocument()
    })
  })
})
