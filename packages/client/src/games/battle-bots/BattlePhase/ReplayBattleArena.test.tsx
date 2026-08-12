import { render, screen, act } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { ReplayBattleArena, type ReplayBattleArenaProps } from "./ReplayBattleArena"

// ── Helpers ──

function makeProps(overrides?: Partial<ReplayBattleArenaProps>): ReplayBattleArenaProps {
  return {
    tickLogPayload: {
      battleId: "battle-1",
      robots: [
        {
          ownerId: "p1",
          name: "Drillbot",
          stars: { damage: 4, accuracy: 3, speed: 2 },
          visual: { weapon: "drill", head: "square", body: "square" },
          maxHp: 100,
        },
        {
          ownerId: "p2",
          name: "Blastbot",
          stars: { damage: 2, accuracy: 5, speed: 2 },
          visual: { weapon: "blaster", head: "rounded", body: "triangular" },
          maxHp: 100,
        },
      ],
      tickLog: [
        {
          tick: 1,
          attacks: [
            { attackerId: "p1", targetId: "p2", hit: true, damage: 20, targetHpAfter: 80 },
          ],
          eliminations: [],
        },
        {
          tick: 2,
          attacks: [
            { attackerId: "p2", targetId: "p1", hit: true, damage: 15, targetHpAfter: 85 },
            { attackerId: "p1", targetId: "p2", hit: true, damage: 25, targetHpAfter: 55 },
          ],
          eliminations: [],
        },
        {
          tick: 3,
          attacks: [
            { attackerId: "p1", targetId: "p2", hit: true, damage: 55, targetHpAfter: 0 },
          ],
          eliminations: ["p2"],
        },
      ],
      gameSpeed: 100,
    },
    playerNames: { p1: "Alice", p2: "Bob" },
    currentPlayerId: "p1",
    onComplete: vi.fn(),
    ...overrides,
  }
}

describe("ReplayBattleArena", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders robot names in 'RobotName - PlayerName' format", () => {
    const props = makeProps()
    render(<ReplayBattleArena {...props} />)

    expect(screen.getByText("Drillbot - Alice")).toBeInTheDocument()
    expect(screen.getByText("Blastbot - Bob")).toBeInTheDocument()
  })

  it("renders star values for each robot", () => {
    const props = makeProps()
    render(<ReplayBattleArena {...props} />)

    // StarDisplay renders emoji labels with stat values
    // Robot 1: damage=4, accuracy=3, speed=2
    // Robot 2: damage=2, accuracy=5, speed=2
    const statLabels = screen.getAllByLabelText(/Stats:/)
    expect(statLabels).toHaveLength(2)
    expect(statLabels[0]).toHaveTextContent("4")
    expect(statLabels[0]).toHaveTextContent("3")
    expect(statLabels[0]).toHaveTextContent("2")
    expect(statLabels[1]).toHaveTextContent("2")
    expect(statLabels[1]).toHaveTextContent("5")
  })

  it("displays 'Your Battle' when currentPlayerId is a participant", () => {
    const props = makeProps({ currentPlayerId: "p1" })
    render(<ReplayBattleArena {...props} />)

    expect(screen.getByText("Your Battle")).toBeInTheDocument()
  })

  it("does not display 'Your Battle' when currentPlayerId is null", () => {
    const props = makeProps({ currentPlayerId: null })
    render(<ReplayBattleArena {...props} />)

    expect(screen.queryByText("Your Battle")).not.toBeInTheDocument()
  })

  it("shows VS divider in 1v1 mode (2 robots)", () => {
    const props = makeProps()
    render(<ReplayBattleArena {...props} />)

    expect(screen.getByText("VS")).toBeInTheDocument()
  })

  it("updates HP as ticks advance", async () => {
    const props = makeProps()
    render(<ReplayBattleArena {...props} />)

    // After first tick fires immediately: p2 should have 80 HP
    expect(screen.getByText("80 / 100")).toBeInTheDocument()

    // Advance to tick 2
    act(() => {
      vi.advanceTimersByTime(100)
    })

    // p1 should have 85 HP, p2 should have 55 HP
    expect(screen.getByText("85 / 100")).toBeInTheDocument()
    expect(screen.getByText("55 / 100")).toBeInTheDocument()
  })

  it("shows winner and defeated state after replay completes", () => {
    const props = makeProps()
    render(<ReplayBattleArena {...props} />)

    // Advance through all ticks
    act(() => {
      vi.advanceTimersByTime(200) // tick 2 at 100ms, tick 3 at 200ms
    })

    // Poll interval needs to fire to detect completion
    act(() => {
      vi.advanceTimersByTime(100)
    })

    // Winner announcement
    expect(screen.getByText(/Winner:.*Drillbot/)).toBeInTheDocument()

    // WINNER! indicator for p1
    expect(screen.getByText("🏆 WINNER!")).toBeInTheDocument()

    // DEFEATED indicator for p2
    expect(screen.getByText("DEFEATED")).toBeInTheDocument()
  })

  it("calls onComplete when replay finishes", () => {
    const onComplete = vi.fn()
    const props = makeProps({ onComplete })
    render(<ReplayBattleArena {...props} />)

    // Advance through all ticks + poll
    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(onComplete).toHaveBeenCalled()
  })

  it("renders FFA grid layout when more than 2 robots", () => {
    const props = makeProps({
      tickLogPayload: {
        battleId: "ffa-1",
        robots: [
          {
            ownerId: "p1",
            name: "Drillbot",
            stars: { damage: 4, accuracy: 3, speed: 2 },
            visual: { weapon: "drill", head: "square", body: "square" },
            maxHp: 100,
          },
          {
            ownerId: "p2",
            name: "Blastbot",
            stars: { damage: 2, accuracy: 5, speed: 2 },
            visual: { weapon: "blaster", head: "rounded", body: "triangular" },
            maxHp: 100,
          },
          {
            ownerId: "p3",
            name: "Zookbot",
            stars: { damage: 6, accuracy: 1, speed: 2 },
            visual: { weapon: "bazooka", head: "hexagonal", body: "hexagonal" },
            maxHp: 100,
          },
        ],
        tickLog: [],
        gameSpeed: 100,
      },
      playerNames: { p1: "Alice", p2: "Bob", p3: "Charlie" },
    })
    render(<ReplayBattleArena {...props} />)

    // FFA layout renders all three robot names
    expect(screen.getByText("Drillbot - Alice")).toBeInTheDocument()
    expect(screen.getByText("Blastbot - Bob")).toBeInTheDocument()
    expect(screen.getByText("Zookbot - Charlie")).toBeInTheDocument()

    // No VS divider in FFA
    expect(screen.queryByText("VS")).not.toBeInTheDocument()
  })
})
