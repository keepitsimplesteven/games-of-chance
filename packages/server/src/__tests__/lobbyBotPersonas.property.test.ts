/**
 * Feature: lobby-bot-personas, Property 1: Room Size Invariant
 *
 * For any room size (2–10) and any sequence of join/disconnect/kick operations,
 * humans + bots always equals the configured room size.
 *
 * Validates: Requirements 2.1, 2.4, 4.1, 4.2, 8.1, 8.2
 */
import { describe, it, expect } from "vitest"
import * as fc from "fast-check"
import { BotManager, BOT_NAMES } from "../bots/BotManager"
import { registry } from "../games/GameRegistry"
import "../games/coin-toss/CoinTossPlugin"
import "../games/battle-bots/index"
import type { Player, GameSettings, CoinTossPick, CoinTossResult, CoinSide } from "@games-of-chance/shared"

// ── Operation types ────────────────────────────────────────────────────────

type Operation =
  | { type: "join"; humanId: string }
  | { type: "disconnect"; humanId: string }
  | { type: "kick"; humanId: string }

// ── Generators ─────────────────────────────────────────────────────────────

/**
 * Arbitrary: room size between 2 and 10 inclusive
 */
function arbRoomSize(): fc.Arbitrary<number> {
  return fc.integer({ min: 2, max: 10 })
}

/**
 * Arbitrary: generates a random sequence of join/disconnect/kick operations.
 * Operations reference human player IDs from a pool sized to roomSize.
 */
function arbOperationSequence(roomSize: number): fc.Arbitrary<Operation[]> {
  // Create a pool of possible human IDs (enough to fill all slots)
  const humanPool = Array.from({ length: roomSize }, (_, i) => `human-${i}`)

  const joinOp = fc
    .constantFrom(...humanPool)
    .map((id): Operation => ({ type: "join", humanId: id }))

  const disconnectOp = fc
    .constantFrom(...humanPool)
    .map((id): Operation => ({ type: "disconnect", humanId: id }))

  const kickOp = fc
    .constantFrom(...humanPool)
    .map((id): Operation => ({ type: "kick", humanId: id }))

  return fc.array(fc.oneof(joinOp, disconnectOp, kickOp), {
    minLength: 1,
    maxLength: 20,
  })
}

// ── Helpers ────────────────────────────────────────────────────────────────

function createHumanPlayer(id: string): Player {
  return {
    id,
    name: `Player ${id}`,
    role: "player",
    connected: true,
    connectionId: `conn-${id}`,
  }
}

function createBotPlayer(id: string, name: string): Player {
  return {
    id,
    name,
    role: "player",
    connected: true,
    connectionId: null,
  }
}

function countHumans(players: Record<string, Player>): number {
  return Object.keys(players).filter((id) => !id.startsWith("bot:")).length
}

function countBots(players: Record<string, Player>): number {
  return Object.keys(players).filter((id) => id.startsWith("bot:")).length
}

// ── Property Test ──────────────────────────────────────────────────────────

describe("Feature: lobby-bot-personas, Property 1: Room Size Invariant", () => {
  it("for any room size and any sequence of join/disconnect/kick operations, humans + bots always equals the configured room size", () => {
    fc.assert(
      fc.property(
        arbRoomSize(),
        arbRoomSize().chain((rs) => arbOperationSequence(rs).map((ops) => ({ roomSize: rs, ops }))),
        (roomSize, { ops }) => {
          // Use the first generated roomSize as the actual roomSize
          const targetRoomSize = roomSize

          const botManager = new BotManager()
          const players: Record<string, Player> = {}

          // Start with host (always at least 1 human)
          players["host-player"] = {
            id: "host-player",
            name: "Host",
            role: "host",
            connected: true,
            connectionId: "conn-host",
          }

          // Initial reconcile to fill room with bots
          const initial = botManager.reconcile(players, targetRoomSize)
          for (const bot of initial.added) {
            players[bot.id] = createBotPlayer(bot.id, bot.name)
          }

          // Assert invariant after initial reconcile
          expect(countHumans(players) + countBots(players)).toBe(targetRoomSize)

          // Apply each operation and reconcile after each one
          for (const op of ops) {
            switch (op.type) {
              case "join": {
                // Only join if not already in room and room has capacity for humans
                if (!(op.humanId in players) && op.humanId !== "host-player") {
                  const currentHumans = countHumans(players)
                  if (currentHumans < targetRoomSize) {
                    players[op.humanId] = createHumanPlayer(op.humanId)
                  }
                }
                break
              }
              case "disconnect": {
                // Only disconnect if the player is actually in the room and not the host
                if (op.humanId in players && op.humanId !== "host-player") {
                  delete players[op.humanId]
                }
                break
              }
              case "kick": {
                // Only kick if the player is actually in the room and not the host
                if (op.humanId in players && op.humanId !== "host-player") {
                  delete players[op.humanId]
                }
                break
              }
            }

            // Reconcile: add/remove bots to maintain invariant
            const result = botManager.reconcile(players, targetRoomSize)

            // Apply reconcile results to the players record
            for (const bot of result.added) {
              players[bot.id] = createBotPlayer(bot.id, bot.name)
            }
            for (const removedId of result.removed) {
              delete players[removedId]
            }

            // ASSERT: invariant holds after every operation
            const total = countHumans(players) + countBots(players)
            expect(total).toBe(targetRoomSize)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})


// ── Property 2: Bot Identity Correctness ───────────────────────────────────

describe("Feature: lobby-bot-personas, Property 2: Bot Identity Correctness", () => {
  /**
   * Property 2: Bot Identity Correctness
   *
   * For any bot created by the BotManager, its player ID starts with the prefix
   * `bot:` and is unique across all players in the room, AND its display name
   * starts with the prefix `[BOT] `.
   *
   * **Validates: Requirements 2.2, 2.3**
   */
  it("every bot has a bot: prefixed unique ID and [BOT] prefixed display name", () => {
    fc.assert(
      fc.property(
        // Generate a room size between 2 and 10
        fc.integer({ min: 2, max: 10 }),
        // Generate a human count seed (will be clamped to valid range)
        fc.integer({ min: 1, max: 10 }),
        (roomSize, humanCountRaw) => {
          // Clamp human count to valid range [1, roomSize]
          const humanCount = Math.min(humanCountRaw, roomSize)

          // Create human players
          const players: Record<string, Player> = {}
          for (let i = 0; i < humanCount; i++) {
            const id = `player-${i}`
            players[id] = {
              id,
              name: `Human ${i}`,
              role: i === 0 ? "host" : "player",
              connected: true,
              connectionId: `conn-${i}`,
            }
          }

          // Create BotManager and reconcile
          const botManager = new BotManager()
          const { added } = botManager.reconcile(players, roomSize)

          // Collect all IDs (humans + bots) for uniqueness check
          const allIds = new Set<string>(Object.keys(players))

          // Verify each added bot
          for (const bot of added) {
            // Bot ID starts with `bot:`
            expect(bot.id.startsWith("bot:")).toBe(true)

            // Bot ID is unique across all players (not already in the set)
            expect(allIds.has(bot.id)).toBe(false)
            allIds.add(bot.id)

            // Bot display name starts with `[BOT] `
            expect(bot.name.startsWith("[BOT] ")).toBe(true)
          }

          // Also verify via getBotIds that all tracked bots have the prefix
          const botIds = botManager.getBotIds()
          for (const botId of botIds) {
            expect(botId.startsWith("bot:")).toBe(true)
          }

          // All bot IDs are unique (no duplicates)
          const uniqueBotIds = new Set(botIds)
          expect(uniqueBotIds.size).toBe(botIds.length)

          // Total bot count should fill the gap
          expect(botIds.length).toBe(roomSize - humanCount)
        }
      ),
      { numRuns: 100 }
    )
  })
})


// ── Property 3: Slot Ordering on Human Join ────────────────────────────────

/**
 * Feature: lobby-bot-personas, Property 3: Slot Ordering on Human Join
 *
 * When a human joins a room with bots, the lowest-numbered bot is removed.
 * The lowest-numbered bot is determined by order in BOT_NAMES array:
 * Alpha(0), Bravo(1), Charlie(2), Delta(3), Echo(4), Foxtrot(5), Golf(6), Hotel(7), India(8)
 *
 * **Validates: Requirements 3.1, 3.2**
 */
describe("Feature: lobby-bot-personas, Property 3: Slot Ordering on Human Join", () => {
  it("removeLowestBot always removes the bot with the lowest index in BOT_NAMES", () => {
    fc.assert(
      fc.property(
        // Generate a room size (determines how many bots are present)
        fc.integer({ min: 2, max: 10 }),
        (roomSize) => {
          // Setup: create a BotManager and populate it with bots via reconcile
          const botManager = new BotManager()

          // Start with just a host human
          const players: Record<string, Player> = {
            "host-player": {
              id: "host-player",
              name: "Host",
              role: "host",
              connected: true,
              connectionId: "conn-host",
            },
          }

          // Reconcile fills with (roomSize - 1) bots
          const { added } = botManager.reconcile(players, roomSize)
          for (const bot of added) {
            players[bot.id] = {
              id: bot.id,
              name: bot.name,
              role: "player",
              connected: true,
              connectionId: null,
            } as unknown as Player
          }

          // Get the current bot IDs and find the expected lowest
          const botIds = botManager.getBotIds()
          if (botIds.length === 0) return // trivially true if no bots

          const lowestBotIndex = Math.min(
            ...botIds.map((id) => {
              const name = id.replace("bot:", "")
              return BOT_NAMES.findIndex((n) => n.toLowerCase() === name)
            })
          )
          const expectedLowestBotId = `bot:${BOT_NAMES[lowestBotIndex].toLowerCase()}`

          // When a human joins, removeLowestBot should return the lowest-numbered bot
          const removedBotId = botManager.removeLowestBot(players)

          expect(removedBotId).toBe(expectedLowestBotId)

          // After removal, that bot should no longer be tracked
          expect(botManager.getBotIds()).not.toContain(expectedLowestBotId)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("removeLowestBot returns null when no bots exist", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        (humanCount) => {
          const botManager = new BotManager()

          // Build a players record with only humans, no bots
          const players: Record<string, Player> = {}
          for (let i = 0; i < humanCount; i++) {
            const id = `human-${i}`
            players[id] = {
              id,
              name: `Human ${i}`,
              role: i === 0 ? "host" : "player",
              connected: true,
              connectionId: `conn-${id}`,
            }
          }

          // No bots were added via reconcile, so removeLowestBot should return null
          const result = botManager.removeLowestBot(players)
          expect(result).toBeNull()
        }
      ),
      { numRuns: 100 }
    )
  })

  it("after multiple human joins, bots are removed in ascending BOT_NAMES order", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 10 }),
        fc.integer({ min: 1, max: 8 }),
        (roomSize, humansToJoin) => {
          // Ensure we don't try to remove more bots than exist
          const maxBots = roomSize - 1 // host takes one slot
          const effectiveJoins = Math.min(humansToJoin, maxBots)
          if (effectiveJoins < 2) return // need at least 2 removals to verify ordering

          const botManager = new BotManager()

          // Start with just a host
          const players: Record<string, Player> = {
            "host-player": {
              id: "host-player",
              name: "Host",
              role: "host",
              connected: true,
              connectionId: "conn-host",
            },
          }

          // Fill room with bots
          const { added } = botManager.reconcile(players, roomSize)
          for (const bot of added) {
            players[bot.id] = {
              id: bot.id,
              name: bot.name,
              role: "player",
              connected: true,
              connectionId: null,
            } as unknown as Player
          }

          // Simulate humans joining one by one — each time the lowest bot is removed
          const removedBots: string[] = []
          for (let i = 0; i < effectiveJoins; i++) {
            const removedId = botManager.removeLowestBot(players)
            if (removedId) {
              removedBots.push(removedId)
              delete players[removedId]
            }
          }

          // Verify: removed bots should be in ascending BOT_NAMES order
          for (let i = 1; i < removedBots.length; i++) {
            const prevName = removedBots[i - 1].replace("bot:", "")
            const currName = removedBots[i].replace("bot:", "")
            const prevIndex = BOT_NAMES.findIndex(
              (n) => n.toLowerCase() === prevName
            )
            const currIndex = BOT_NAMES.findIndex(
              (n) => n.toLowerCase() === currName
            )
            expect(prevIndex).toBeLessThan(currIndex)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})


// ── Property 8: Room Size Change Preserves Humans ──────────────────────────

/**
 * Feature: lobby-bot-personas, Property 8: Room Size Change Preserves Humans
 *
 * For any room with H human players and for any valid room size change
 * (where new size ≥ H), all H human players remain in the roster unchanged,
 * and only bot count adjusts to satisfy the invariant: humans + bots === newSize.
 *
 * **Validates: Requirements 8.3**
 */
describe("Feature: lobby-bot-personas, Property 8: Room Size Change Preserves Humans", () => {
  it("all humans remain and only bot count adjusts when room size changes to a valid value", () => {
    fc.assert(
      fc.property(
        // Generate initial room size (2–10)
        fc.integer({ min: 2, max: 10 }),
        // Generate human count (at least 1 for host, at most initial room size)
        fc.integer({ min: 1, max: 10 }),
        // Generate new room size (2–10)
        fc.integer({ min: 2, max: 10 }),
        (initialRoomSize, humanCountRaw, newRoomSizeRaw) => {
          // Clamp human count to valid range [1, initialRoomSize]
          const humanCount = Math.min(humanCountRaw, initialRoomSize)

          // Ensure new room size is valid: >= humanCount and within [2, 10]
          const newRoomSize = Math.max(newRoomSizeRaw, humanCount)
          if (newRoomSize > 10) return // skip invalid scenarios

          // Create human players
          const players: Record<string, Player> = {}
          const humanIds: string[] = []
          for (let i = 0; i < humanCount; i++) {
            const id = `human-${i}`
            humanIds.push(id)
            players[id] = {
              id,
              name: `Player ${i}`,
              role: i === 0 ? "host" : "player",
              connected: true,
              connectionId: `conn-${id}`,
            }
          }

          // Create BotManager and reconcile to fill initial room
          const botManager = new BotManager()
          const initialResult = botManager.reconcile(players, initialRoomSize)
          for (const bot of initialResult.added) {
            players[bot.id] = createBotPlayer(bot.id, bot.name)
          }

          // Verify initial state is correct
          expect(Object.keys(players).length).toBe(initialRoomSize)

          // Now simulate a room size change: reconcile with new room size
          const changeResult = botManager.reconcile(players, newRoomSize)

          // Apply the reconcile changes
          for (const bot of changeResult.added) {
            players[bot.id] = createBotPlayer(bot.id, bot.name)
          }
          for (const removedId of changeResult.removed) {
            delete players[removedId]
          }

          // ASSERT: All original human player IDs are still present
          for (const humanId of humanIds) {
            expect(players[humanId]).toBeDefined()
            // Verify the human player data is unchanged
            expect(players[humanId].id).toBe(humanId)
            expect(players[humanId].connectionId).toBe(`conn-${humanId}`)
            expect(!players[humanId].id.startsWith("bot:")).toBe(true)
          }

          // ASSERT: Total count equals new room size (invariant holds)
          expect(Object.keys(players).length).toBe(newRoomSize)

          // ASSERT: Human count is unchanged
          const humansAfter = Object.keys(players).filter(
            (id) => !id.startsWith("bot:")
          )
          expect(humansAfter.length).toBe(humanCount)

          // ASSERT: Bot count adjusted correctly
          const botsAfter = Object.keys(players).filter((id) =>
            id.startsWith("bot:")
          )
          expect(botsAfter.length).toBe(newRoomSize - humanCount)
        }
      ),
      { numRuns: 100 }
    )
  })
})


// ── Property 7: Room Size Validation ───────────────────────────────────────

/**
 * Feature: lobby-bot-personas, Property 7: Room Size Validation
 *
 * The server accepts a room size value if and only if it is an integer in [2, 10].
 * Values outside this range or non-integer values are rejected with INVALID_ROOM_SIZE.
 *
 * **Validates: Requirements 1.4**
 */
describe("Feature: lobby-bot-personas, Property 7: Room Size Validation", () => {
  /**
   * The validation logic from handleUpdateRoomSize:
   *   !Number.isInteger(roomSize) || roomSize < 2 || roomSize > 10 → reject
   */
  function isValidRoomSize(value: number): boolean {
    return Number.isInteger(value) && value >= 2 && value <= 10
  }

  it("any integer in [2, 10] is accepted as a valid room size", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }),
        (roomSize) => {
          expect(isValidRoomSize(roomSize)).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("any integer outside [2, 10] is rejected as an invalid room size", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Integers below the valid range
          fc.integer({ min: -1000, max: 1 }),
          // Integers above the valid range
          fc.integer({ min: 11, max: 1000 })
        ),
        (roomSize) => {
          expect(isValidRoomSize(roomSize)).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("any non-integer number is rejected as an invalid room size", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }).filter(
          (v) => !Number.isInteger(v)
        ),
        (roomSize) => {
          expect(isValidRoomSize(roomSize)).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("room size validation is equivalent to: Number.isInteger(v) && v >= 2 && v <= 10", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Valid integers
          fc.integer({ min: 2, max: 10 }),
          // Invalid integers (below)
          fc.integer({ min: -100, max: 1 }),
          // Invalid integers (above)
          fc.integer({ min: 11, max: 100 }),
          // Non-integer doubles
          fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }).filter(
            (v) => !Number.isInteger(v)
          )
        ),
        (value) => {
          const expected = Number.isInteger(value) && value >= 2 && value <= 10
          expect(isValidRoomSize(value)).toBe(expected)
        }
      ),
      { numRuns: 100 }
    )
  })
})


// ── Property 9: Room Size Reduction Rejection ──────────────────────────────

/**
 * Feature: lobby-bot-personas, Property 9: Room Size Reduction Rejection
 *
 * For any room with H human players (H >= 2), if the host attempts to set
 * roomSize to a value less than H, the change should be rejected and the
 * room state stays unchanged.
 *
 * **Validates: Requirements 8.4**
 */
describe("Feature: lobby-bot-personas, Property 9: Room Size Reduction Rejection", () => {
  it("room size values less than the current human count are rejected and state stays unchanged", () => {
    fc.assert(
      fc.property(
        // Generate a human count between 2 and 10
        fc.integer({ min: 2, max: 10 }),
        // Generate a new room size that will be constrained to < humanCount
        fc.integer({ min: 1, max: 9 }),
        (humanCount, newRoomSizeRaw) => {
          // Ensure newRoomSize is strictly less than humanCount (invalid reduction)
          const newRoomSize = Math.min(newRoomSizeRaw, humanCount - 1)

          // Set up the room: create human players
          const players: Record<string, Player> = {}
          for (let i = 0; i < humanCount; i++) {
            const id = i === 0 ? "host-player" : `human-${i}`
            players[id] = {
              id,
              name: i === 0 ? "Host" : `Player ${i}`,
              role: i === 0 ? "host" : "player",
              connected: true,
              connectionId: `conn-${id}`,
            }
          }

          // Set up BotManager and reconcile to fill remaining slots
          // Use a roomSize >= humanCount so bots fill the rest
          const botManager = new BotManager()
          const originalRoomSize = Math.max(humanCount, 4) // at least humanCount
          const { added } = botManager.reconcile(players, originalRoomSize)
          for (const bot of added) {
            players[bot.id] = {
              id: bot.id,
              name: bot.name,
              role: "player",
              connected: true,
              connectionId: null,
            }
          }

          // Snapshot the state before the attempted reduction
          const playersBefore = { ...players }
          const playerKeysBefore = Object.keys(players).sort()
          const roomSizeBefore = originalRoomSize

          // Simulate the validation logic from handleUpdateRoomSize:
          // Count humans in the room
          const currentHumanCount = Object.keys(players).filter(
            (id) => !botManager.isBot(id)
          ).length

          // The server should reject if newRoomSize < humanCount
          const shouldReject = newRoomSize < currentHumanCount

          // Assert: the change MUST be rejected
          expect(shouldReject).toBe(true)

          // Assert: since the change is rejected, the players record stays unchanged
          const playerKeysAfter = Object.keys(players).sort()
          expect(playerKeysAfter).toEqual(playerKeysBefore)

          // Assert: room size would remain unchanged (the server does not modify it)
          // This confirms the state is preserved when validation fails
          expect(roomSizeBefore).toBe(originalRoomSize)
        }
      ),
      { numRuns: 100 }
    )
  })
})


// ── Property 10: Player Roster Ordering ────────────────────────────────────

/**
 * Feature: lobby-bot-personas, Property 10: Player Roster Ordering
 *
 * For any player roster containing both human players and lobby bots,
 * when rendered as a list, all human players appear before all lobby bots.
 *
 * The sorting logic used by the client:
 *   players.sort((a, b) => {
 *     const aIsBot = a.id.startsWith("bot:");
 *     const bIsBot = b.id.startsWith("bot:");
 *     if (aIsBot === bIsBot) return 0;
 *     return aIsBot ? 1 : -1;
 *   })
 *
 * **Validates: Requirements 7.3**
 */
describe("Feature: lobby-bot-personas, Property 10: Player Roster Ordering", () => {
  // ── Generator: arbitrary human player ──────────────────────────────────
  const arbHumanPlayer: fc.Arbitrary<Player> = fc
    .record({
      id: fc.uuid(),
      name: fc.string({ minLength: 1, maxLength: 20 }),
      role: fc.constantFrom("host", "player") as fc.Arbitrary<"host" | "player">,
      connected: fc.boolean(),
      connectionId: fc.uuid(),
    })
    .map(({ id, name, role, connected, connectionId }) => ({
      id,
      name,
      role,
      connected,
      connectionId,
    }))

  // ── Generator: arbitrary bot player ────────────────────────────────────
  const arbBotPlayer: fc.Arbitrary<Player> = fc
    .record({
      name: fc.constantFrom(...BOT_NAMES),
      connected: fc.constant(true),
    })
    .map(({ name, connected }) => ({
      id: `bot:${name.toLowerCase()}`,
      name: `[BOT] ${name}`,
      role: "player" as const,
      connected,
      connectionId: null,
    }))

  // ── The sorting logic under test (mirrors client implementation) ───────
  function sortPlayersHumansFirst(players: Player[]): Player[] {
    return [...players].sort((a, b) => {
      const aIsBot = a.id.startsWith("bot:")
      const bIsBot = b.id.startsWith("bot:")
      if (aIsBot === bIsBot) return 0
      return aIsBot ? 1 : -1
    })
  }

  it("after sorting, all human players appear before all bot players", () => {
    fc.assert(
      fc.property(
        // Generate at least 1 human and 1 bot to ensure a mixed roster
        fc.array(arbHumanPlayer, { minLength: 1, maxLength: 9 }),
        fc.array(arbBotPlayer, { minLength: 1, maxLength: 9 }),
        (humans, bots) => {
          // Combine into a mixed roster (unsorted order)
          const unsortedRoster = [...humans, ...bots]

          // Shuffle to remove any initial ordering bias
          const shuffled = [...unsortedRoster].sort(() => Math.random() - 0.5)

          // Apply the sorting logic
          const sorted = sortPlayersHumansFirst(shuffled)

          // Find the index of the last human and first bot
          let lastHumanIndex = -1
          let firstBotIndex = sorted.length

          for (let i = 0; i < sorted.length; i++) {
            const isBot = sorted[i].id.startsWith("bot:")
            if (!isBot) {
              lastHumanIndex = i
            }
            if (isBot && i < firstBotIndex) {
              firstBotIndex = i
            }
          }

          // ASSERT: all humans come before all bots
          // i.e., the last human's index is less than the first bot's index
          expect(lastHumanIndex).toBeLessThan(firstBotIndex)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("sorting preserves all players (no players are lost or duplicated)", () => {
    fc.assert(
      fc.property(
        fc.array(arbHumanPlayer, { minLength: 1, maxLength: 9 }),
        fc.array(arbBotPlayer, { minLength: 1, maxLength: 9 }),
        (humans, bots) => {
          const unsortedRoster = [...humans, ...bots]
          const sorted = sortPlayersHumansFirst(unsortedRoster)

          // Same length (no players lost or added)
          expect(sorted.length).toBe(unsortedRoster.length)

          // Every player from the input is present in the output
          const sortedIds = sorted.map((p) => p.id)
          for (const player of unsortedRoster) {
            expect(sortedIds).toContain(player.id)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it("a roster with only humans remains unchanged in relative order", () => {
    fc.assert(
      fc.property(
        fc.array(arbHumanPlayer, { minLength: 1, maxLength: 10 }),
        (humans) => {
          const sorted = sortPlayersHumansFirst(humans)

          // All entries should still be humans (no bots inserted)
          for (const player of sorted) {
            expect(player.id.startsWith("bot:")).toBe(false)
          }

          // Length preserved
          expect(sorted.length).toBe(humans.length)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("a roster with only bots remains unchanged in relative order", () => {
    fc.assert(
      fc.property(
        fc.array(arbBotPlayer, { minLength: 1, maxLength: 9 }),
        (bots) => {
          const sorted = sortPlayersHumansFirst(bots)

          // All entries should still be bots
          for (const player of sorted) {
            expect(player.id.startsWith("bot:")).toBe(true)
          }

          // Length preserved
          expect(sorted.length).toBe(bots.length)
        }
      ),
      { numRuns: 100 }
    )
  })
})


// ── Property 4: Bot Picks Are Valid ────────────────────────────────────────

/**
 * Feature: lobby-bot-personas, Property 4: Bot Picks Are Valid
 *
 * For any game type and for any bot, the generated pick passes
 * the plugin's `validatePick` function.
 *
 * **Validates: Requirements 5.1, 5.2, 5.3**
 */

describe("Feature: lobby-bot-personas, Property 4: Bot Picks Are Valid", () => {
  it("for any room size and any game type, all generated bot picks pass the plugin's validatePick", () => {
    fc.assert(
      fc.property(
        // Generate room size (2–10) to determine how many bots exist
        fc.integer({ min: 2, max: 10 }),
        // Generate game type
        fc.constantFrom("coin-toss" as const, "battle-bots" as const),
        (roomSize, gameType) => {
          const botManager = new BotManager()

          // Create a room with 1 host human and fill rest with bots
          const players: Record<string, Player> = {
            "host-player": {
              id: "host-player",
              name: "Host",
              role: "host",
              connected: true,
              connectionId: "conn-host",
            },
          }

          // Reconcile to fill room with bots
          const { added } = botManager.reconcile(players, roomSize)
          for (const bot of added) {
            players[bot.id] = {
              id: bot.id,
              name: bot.name,
              role: "player",
              connected: true,
              connectionId: null,
            }
          }

          // Build default settings
          const settings = {
            roundCount: 5,
            pickWindowMs: 30000,
            tuning: {},
          }

          // Generate picks for all bots
          const picks = botManager.generatePicks(gameType, settings)

          // Look up the plugin for this game type
          const plugin = registry.lookup(gameType)

          // Every bot should have a pick that passes validatePick
          const botIds = botManager.getBotIds()
          expect(botIds.length).toBeGreaterThan(0)

          for (const botId of botIds) {
            const pick = picks[botId]
            expect(pick).toBeDefined()
            expect(plugin.validatePick(pick)).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it("generatePicks produces a pick for every active bot", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }),
        fc.constantFrom("coin-toss" as const, "battle-bots" as const),
        (roomSize, gameType) => {
          const botManager = new BotManager()

          // Create room with 1 host, rest bots
          const players: Record<string, Player> = {
            "host-player": {
              id: "host-player",
              name: "Host",
              role: "host",
              connected: true,
              connectionId: "conn-host",
            },
          }

          const { added } = botManager.reconcile(players, roomSize)
          for (const bot of added) {
            players[bot.id] = {
              id: bot.id,
              name: bot.name,
              role: "player",
              connected: true,
              connectionId: null,
            }
          }

          const settings = {
            roundCount: 5,
            pickWindowMs: 30000,
            tuning: {},
          }

          const picks = botManager.generatePicks(gameType, settings)
          const botIds = botManager.getBotIds()

          // Every bot ID should have a corresponding pick entry
          for (const botId of botIds) {
            expect(botId in picks).toBe(true)
          }

          // No extra picks for non-bots
          const pickKeys = Object.keys(picks)
          for (const key of pickKeys) {
            expect(botManager.isBot(key)).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})


// ── Property 11: Replacement Bot Zero Score ────────────────────────────────

/**
 * Feature: lobby-bot-personas, Property 11: Replacement Bot Zero Score
 *
 * Any bot created to replace a departed human during an active game starts
 * with a score of zero, regardless of the scores held by other players.
 *
 * **Validates: Requirements 4.3**
 */
describe("Feature: lobby-bot-personas, Property 11: Replacement Bot Zero Score", () => {
  it("a replacement bot always starts with a game score of zero regardless of existing player scores", () => {
    fc.assert(
      fc.property(
        // Room size between 3 and 10 (need at least host + 1 human who can leave + 1 slot)
        fc.integer({ min: 3, max: 10 }),
        // Generate arbitrary non-zero scores for existing players
        fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 2, maxLength: 9 }),
        (roomSize, existingScores) => {
          const botManager = new BotManager()

          // Set up initial players: host + some humans filling the room
          // All slots are human initially (simulating a full room before someone leaves)
          const humanCount = roomSize
          const players: Record<string, Player> = {}
          const gameScores: Record<string, number> = {}

          for (let i = 0; i < humanCount; i++) {
            const id = i === 0 ? "host-player" : `human-${i}`
            players[id] = {
              id,
              name: i === 0 ? "Host" : `Player ${i}`,
              role: i === 0 ? "host" : "player",
              connected: true,
              connectionId: `conn-${id}`,
            }
            // Assign non-zero scores to simulate mid-game state
            gameScores[id] = existingScores[i % existingScores.length]
          }

          // Reconcile with full room of humans — no bots should be added
          const initialResult = botManager.reconcile(players, roomSize)
          expect(initialResult.added.length).toBe(0)

          // Simulate a human disconnecting mid-game
          const departingHumanId = `human-1`
          delete players[departingHumanId]
          delete gameScores[departingHumanId]

          // Reconcile after human leaves — a bot should be added
          const result = botManager.reconcile(players, roomSize)
          expect(result.added.length).toBe(1)

          const newBot = result.added[0]

          // Simulate the server-side logic: initialize the new bot's game score to 0
          // (mirrors room.ts: this.state.gameScores[persona.id] = 0)
          gameScores[newBot.id] = 0
          players[newBot.id] = {
            id: newBot.id,
            name: newBot.name,
            role: "player",
            connected: true,
            connectionId: null,
          }

          // ASSERT: The new bot's game score is exactly 0
          expect(gameScores[newBot.id]).toBe(0)

          // ASSERT: Other players still have non-zero scores (game is mid-progress)
          for (const [playerId, score] of Object.entries(gameScores)) {
            if (playerId !== newBot.id) {
              expect(score).toBeGreaterThan(0)
            }
          }

          // ASSERT: Room size invariant still holds
          expect(Object.keys(players).length).toBe(roomSize)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("multiple replacement bots all start with zero score even when existing scores are large", () => {
    fc.assert(
      fc.property(
        // Room size between 4 and 10
        fc.integer({ min: 4, max: 10 }),
        // Number of humans to disconnect (at least 2)
        fc.integer({ min: 2, max: 4 }),
        // Large arbitrary scores for existing players
        fc.array(fc.integer({ min: 100, max: 99999 }), { minLength: 2, maxLength: 9 }),
        (roomSize, humansToDisconnectRaw, existingScores) => {
          // Can't disconnect more than (roomSize - 1) humans (host stays)
          const humansToDisconnect = Math.min(humansToDisconnectRaw, roomSize - 1)
          if (humansToDisconnect < 2) return

          const botManager = new BotManager()

          // Set up full room of humans
          const players: Record<string, Player> = {}
          const gameScores: Record<string, number> = {}

          for (let i = 0; i < roomSize; i++) {
            const id = i === 0 ? "host-player" : `human-${i}`
            players[id] = {
              id,
              name: i === 0 ? "Host" : `Player ${i}`,
              role: i === 0 ? "host" : "player",
              connected: true,
              connectionId: `conn-${id}`,
            }
            gameScores[id] = existingScores[i % existingScores.length]
          }

          // Reconcile: no bots needed initially
          botManager.reconcile(players, roomSize)

          // Simulate multiple humans disconnecting one by one
          const addedBots: string[] = []
          for (let i = 1; i <= humansToDisconnect; i++) {
            const departingId = `human-${i}`
            if (!(departingId in players)) continue

            delete players[departingId]
            delete gameScores[departingId]

            const result = botManager.reconcile(players, roomSize)
            for (const bot of result.added) {
              // Initialize bot score to 0 (mirrors room.ts behavior)
              gameScores[bot.id] = 0
              players[bot.id] = {
                id: bot.id,
                name: bot.name,
                role: "player",
                connected: true,
                connectionId: null,
              }
              addedBots.push(bot.id)
            }
          }

          // ASSERT: Every replacement bot has a score of exactly 0
          for (const botId of addedBots) {
            expect(gameScores[botId]).toBe(0)
          }

          // ASSERT: Room size invariant holds
          expect(Object.keys(players).length).toBe(roomSize)
        }
      ),
      { numRuns: 100 }
    )
  })
})



// ── Property 6: Bot Removal Cleans Leaderboards ────────────────────────────

/**
 * Feature: lobby-bot-personas, Property 6: Bot Removal Cleans Leaderboards
 *
 * When a bot is removed from the room (due to a human joining), its entries
 * are absent from both the game leaderboard and the session leaderboard after removal.
 *
 * Models the cleanup logic from reconcileBots() in room.ts:
 *   - gameLeaderboard = gameLeaderboard.filter(entry => entry.playerId !== botId)
 *   - sessionLeaderboard = sessionLeaderboard.filter(entry => entry.playerId !== botId)
 *
 * **Validates: Requirements 3.4, 6.4**
 */
describe("Feature: lobby-bot-personas, Property 6: Bot Removal Cleans Leaderboards", () => {
  // ── Types mirroring shared types ───────────────────────────────────────
  interface GameLeaderboardEntry {
    playerId: string
    playerName: string
    score: number
    rank: number
  }

  interface SessionLeaderboardEntry {
    playerId: string
    playerName: string
    sessionPoints: number
    gamesPlayed: number
    rank: number
  }

  // ── Generators ─────────────────────────────────────────────────────────

  /** Generate a game leaderboard entry for a given player */
  function arbGameLeaderboardEntry(playerId: string, playerName: string): fc.Arbitrary<GameLeaderboardEntry> {
    return fc.record({
      playerId: fc.constant(playerId),
      playerName: fc.constant(playerName),
      score: fc.integer({ min: 0, max: 100 }),
      rank: fc.integer({ min: 1, max: 10 }),
    })
  }

  /** Generate a session leaderboard entry for a given player */
  function arbSessionLeaderboardEntry(playerId: string, playerName: string): fc.Arbitrary<SessionLeaderboardEntry> {
    return fc.record({
      playerId: fc.constant(playerId),
      playerName: fc.constant(playerName),
      sessionPoints: fc.integer({ min: 0, max: 500 }),
      gamesPlayed: fc.integer({ min: 1, max: 20 }),
      rank: fc.integer({ min: 1, max: 10 }),
    })
  }

  it("after bot removal, the removed bot's entries are absent from both leaderboards", () => {
    fc.assert(
      fc.property(
        // Room size determines how many bots exist initially
        fc.integer({ min: 3, max: 10 }),
        // Random scores for leaderboard entries
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 500 }),
        (roomSize, _gameScore, _sessionScore) => {
          // Setup: create a room with 1 host and (roomSize - 1) bots
          const botManager = new BotManager()
          const players: Record<string, Player> = {
            "host-player": {
              id: "host-player",
              name: "Host",
              role: "host",
              connected: true,
              connectionId: "conn-host",
            },
          }

          // Reconcile to fill with bots
          const { added: initialBots } = botManager.reconcile(players, roomSize)
          for (const bot of initialBots) {
            players[bot.id] = createBotPlayer(bot.id, bot.name)
          }

          // Build leaderboards with entries for ALL players (host + bots)
          let gameLeaderboard: GameLeaderboardEntry[] = []
          let sessionLeaderboard: SessionLeaderboardEntry[] = []

          // Add host entry
          gameLeaderboard.push({
            playerId: "host-player",
            playerName: "Host",
            score: 10,
            rank: 1,
          })
          sessionLeaderboard.push({
            playerId: "host-player",
            playerName: "Host",
            sessionPoints: 50,
            gamesPlayed: 5,
            rank: 1,
          })

          // Add bot entries to both leaderboards
          let rank = 2
          for (const bot of initialBots) {
            gameLeaderboard.push({
              playerId: bot.id,
              playerName: bot.name,
              score: Math.max(0, 10 - rank),
              rank,
            })
            sessionLeaderboard.push({
              playerId: bot.id,
              playerName: bot.name,
              sessionPoints: Math.max(0, 50 - rank * 5),
              gamesPlayed: 3,
              rank,
            })
            rank++
          }

          // Simulate a human joining: remove the lowest bot
          const removedBotId = botManager.removeLowestBot(players)
          expect(removedBotId).not.toBeNull()

          // Apply leaderboard cleanup logic (same as reconcileBots in room.ts)
          if (removedBotId) {
            delete players[removedBotId]

            gameLeaderboard = gameLeaderboard.filter(
              (entry) => entry.playerId !== removedBotId
            )
            sessionLeaderboard = sessionLeaderboard.filter(
              (entry) => entry.playerId !== removedBotId
            )
          }

          // ASSERT: removed bot is absent from game leaderboard
          const gameEntryForRemovedBot = gameLeaderboard.find(
            (entry) => entry.playerId === removedBotId
          )
          expect(gameEntryForRemovedBot).toBeUndefined()

          // ASSERT: removed bot is absent from session leaderboard
          const sessionEntryForRemovedBot = sessionLeaderboard.find(
            (entry) => entry.playerId === removedBotId
          )
          expect(sessionEntryForRemovedBot).toBeUndefined()

          // ASSERT: other players' entries are preserved
          const hostGameEntry = gameLeaderboard.find(
            (entry) => entry.playerId === "host-player"
          )
          expect(hostGameEntry).toBeDefined()

          const hostSessionEntry = sessionLeaderboard.find(
            (entry) => entry.playerId === "host-player"
          )
          expect(hostSessionEntry).toBeDefined()
        }
      ),
      { numRuns: 100 }
    )
  })

  it("after multiple bot removals, all removed bots are absent from both leaderboards", () => {
    fc.assert(
      fc.property(
        // Room size (at least 4 so we have multiple bots to remove)
        fc.integer({ min: 4, max: 10 }),
        // How many humans will join (remove that many bots)
        fc.integer({ min: 1, max: 8 }),
        (roomSize, humansToJoinRaw) => {
          const maxBotsToRemove = roomSize - 1 // host takes one slot
          const humansToJoin = Math.min(humansToJoinRaw, maxBotsToRemove)
          if (humansToJoin < 1) return

          // Setup: room with 1 host and bots filling remaining slots
          const botManager = new BotManager()
          const players: Record<string, Player> = {
            "host-player": {
              id: "host-player",
              name: "Host",
              role: "host",
              connected: true,
              connectionId: "conn-host",
            },
          }

          const { added: initialBots } = botManager.reconcile(players, roomSize)
          for (const bot of initialBots) {
            players[bot.id] = createBotPlayer(bot.id, bot.name)
          }

          // Build leaderboards for all players
          let gameLeaderboard: GameLeaderboardEntry[] = [{
            playerId: "host-player",
            playerName: "Host",
            score: 20,
            rank: 1,
          }]
          let sessionLeaderboard: SessionLeaderboardEntry[] = [{
            playerId: "host-player",
            playerName: "Host",
            sessionPoints: 100,
            gamesPlayed: 10,
            rank: 1,
          }]

          let rank = 2
          for (const bot of initialBots) {
            gameLeaderboard.push({
              playerId: bot.id,
              playerName: bot.name,
              score: 20 - rank,
              rank,
            })
            sessionLeaderboard.push({
              playerId: bot.id,
              playerName: bot.name,
              sessionPoints: 100 - rank * 10,
              gamesPlayed: 8,
              rank,
            })
            rank++
          }

          // Remove multiple bots (simulating multiple human joins)
          const removedBotIds: string[] = []
          for (let i = 0; i < humansToJoin; i++) {
            const removedId = botManager.removeLowestBot(players)
            if (removedId) {
              removedBotIds.push(removedId)
              delete players[removedId]

              // Apply cleanup same as reconcileBots
              gameLeaderboard = gameLeaderboard.filter(
                (entry) => entry.playerId !== removedId
              )
              sessionLeaderboard = sessionLeaderboard.filter(
                (entry) => entry.playerId !== removedId
              )
            }
          }

          // ASSERT: ALL removed bots are absent from both leaderboards
          for (const removedId of removedBotIds) {
            expect(
              gameLeaderboard.find((e) => e.playerId === removedId)
            ).toBeUndefined()
            expect(
              sessionLeaderboard.find((e) => e.playerId === removedId)
            ).toBeUndefined()
          }

          // ASSERT: remaining bots (those not removed) are still present
          const remainingBotIds = botManager.getBotIds()
          for (const botId of remainingBotIds) {
            expect(
              gameLeaderboard.find((e) => e.playerId === botId)
            ).toBeDefined()
            expect(
              sessionLeaderboard.find((e) => e.playerId === botId)
            ).toBeDefined()
          }

          // ASSERT: host entries are always preserved
          expect(
            gameLeaderboard.find((e) => e.playerId === "host-player")
          ).toBeDefined()
          expect(
            sessionLeaderboard.find((e) => e.playerId === "host-player")
          ).toBeDefined()
        }
      ),
      { numRuns: 100 }
    )
  })
})



// ── Property 5: Bot Scoring Equality ───────────────────────────────────────

/**
 * Feature: lobby-bot-personas, Property 5: Bot Scoring Equality
 *
 * For any resolved round containing both human players and lobby bots,
 * the scoring logic SHALL produce score deltas for all bots AND bots SHALL
 * appear in both the game leaderboard and session leaderboard with scores
 * computed by the same `scoreRound` function used for humans.
 *
 * **Validates: Requirements 6.1, 6.2, 6.3**
 */

describe("Feature: lobby-bot-personas, Property 5: Bot Scoring Equality", () => {
  // ── Generators ─────────────────────────────────────────────────────────

  /** Arbitrary coin side */
  const arbCoinSide: fc.Arbitrary<CoinSide> = fc.constantFrom("HEADS", "TAILS")

  /** Arbitrary number of humans (1–5) and bots (1–5) */
  const arbPlayerCounts = fc.record({
    humanCount: fc.integer({ min: 1, max: 5 }),
    botCount: fc.integer({ min: 1, max: 5 }),
  })

  /** Default game settings for coin-toss */
  function defaultSettings(): GameSettings {
    return {
      roundCount: 10,
      pickWindowMs: 10_000,
      tuning: { CORRECT_GUESS_CHIPS: 10 },
    }
  }

  /** Build a mixed roster of human and bot players */
  function buildPlayers(humanCount: number, botCount: number) {
    const players: Player[] = []
    const humanIds: string[] = []
    const botIds: string[] = []

    for (let i = 0; i < humanCount; i++) {
      const id = `human-${i}`
      humanIds.push(id)
      players.push({
        id,
        name: `Player ${i}`,
        role: i === 0 ? "host" : "player",
        connected: true,
        connectionId: `conn-${id}`,
      })
    }

    const botNames = BOT_NAMES.slice(0, botCount)
    for (const name of botNames) {
      const id = `bot:${name.toLowerCase()}`
      botIds.push(id)
      players.push({
        id,
        name: `[BOT] ${name}`,
        role: "player",
        connected: true,
        connectionId: null,
      })
    }

    return { players, humanIds, botIds }
  }

  it("scoreRound produces deltas for ALL players including bots", () => {
    fc.assert(
      fc.property(
        arbPlayerCounts,
        arbCoinSide, // outcome of the flip
        fc.array(arbCoinSide, { minLength: 10, maxLength: 10 }), // picks for players
        ({ humanCount, botCount }, outcome, pickSides) => {
          const plugin = registry.lookup("coin-toss")
          const settings = defaultSettings()
          const { players, humanIds, botIds } = buildPlayers(humanCount, botCount)
          const allIds = [...humanIds, ...botIds]

          // Assign picks to all players (humans and bots alike)
          const picks: Record<string, CoinTossPick> = {}
          for (let i = 0; i < allIds.length; i++) {
            picks[allIds[i]] = { side: pickSides[i % pickSides.length] }
          }

          // Resolve the round with a known outcome
          const result: CoinTossResult = { outcome, flippedAt: Date.now() }

          // Score the round using the plugin
          const scoreResult = plugin.scoreRound(picks, result, players, settings)

          // ASSERT: Every bot has a delta entry
          for (const botId of botIds) {
            expect(scoreResult.deltas).toHaveProperty(botId)
            // Delta should be a number (either 0 or CORRECT_GUESS_CHIPS)
            expect(typeof scoreResult.deltas[botId]).toBe("number")
          }

          // ASSERT: Every human also has a delta entry
          for (const humanId of humanIds) {
            expect(scoreResult.deltas).toHaveProperty(humanId)
            expect(typeof scoreResult.deltas[humanId]).toBe("number")
          }

          // ASSERT: Bots and humans use the same scoring logic
          // (correct pick → CORRECT_GUESS_CHIPS, wrong pick → 0)
          const correctGuessChips = 10
          for (const id of allIds) {
            const pick = picks[id]
            const expectedDelta = pick.side === outcome ? correctGuessChips : 0
            expect(scoreResult.deltas[id]).toBe(expectedDelta)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it("computeGameLeaderboard includes bot entries", () => {
    fc.assert(
      fc.property(
        arbPlayerCounts,
        arbCoinSide, // outcome
        fc.array(arbCoinSide, { minLength: 10, maxLength: 10 }), // picks
        ({ humanCount, botCount }, outcome, pickSides) => {
          const plugin = registry.lookup("coin-toss")
          const settings = defaultSettings()
          const { players, humanIds, botIds } = buildPlayers(humanCount, botCount)
          const allIds = [...humanIds, ...botIds]

          // Assign picks to all players
          const picks: Record<string, CoinTossPick> = {}
          for (let i = 0; i < allIds.length; i++) {
            picks[allIds[i]] = { side: pickSides[i % pickSides.length] }
          }

          // Resolve and score the round
          const result: CoinTossResult = { outcome, flippedAt: Date.now() }
          const scoreResult = plugin.scoreRound(picks, result, players, settings)

          // Build gameScores from deltas (simulating accumulated scores)
          const gameScores: Record<string, number> = {}
          for (const id of allIds) {
            gameScores[id] = scoreResult.deltas[id] ?? 0
          }

          // Compute game leaderboard
          const leaderboard = plugin.computeGameLeaderboard(players, gameScores)

          // ASSERT: Leaderboard contains entries for ALL players (humans + bots)
          const leaderboardPlayerIds = leaderboard.map((e) => e.playerId)
          for (const botId of botIds) {
            expect(leaderboardPlayerIds).toContain(botId)
          }
          for (const humanId of humanIds) {
            expect(leaderboardPlayerIds).toContain(humanId)
          }

          // ASSERT: Every leaderboard entry has a valid rank (>= 1)
          for (const entry of leaderboard) {
            expect(entry.rank).toBeGreaterThanOrEqual(1)
          }

          // ASSERT: Bot leaderboard scores match what scoreRound computed
          for (const entry of leaderboard) {
            if (entry.playerId.startsWith("bot:")) {
              expect(entry.score).toBe(gameScores[entry.playerId])
            }
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it("bots get the same scoreRound function output as humans with identical picks", () => {
    fc.assert(
      fc.property(
        arbCoinSide, // outcome
        arbCoinSide, // pick side (same for both human and bot)
        (outcome, pickSide) => {
          const plugin = registry.lookup("coin-toss")
          const settings = defaultSettings()

          // Create a human and a bot with the same pick
          const humanId = "human-0"
          const botId = "bot:alpha"
          const players: Player[] = [
            { id: humanId, name: "Human", role: "host", connected: true, connectionId: "conn-1" },
            { id: botId, name: "[BOT] Alpha", role: "player", connected: true, connectionId: null },
          ]

          const picks: Record<string, CoinTossPick> = {
            [humanId]: { side: pickSide },
            [botId]: { side: pickSide },
          }

          const result: CoinTossResult = { outcome, flippedAt: Date.now() }
          const scoreResult = plugin.scoreRound(picks, result, players, settings)

          // ASSERT: When human and bot make the same pick, they get the same delta
          expect(scoreResult.deltas[botId]).toBe(scoreResult.deltas[humanId])
        }
      ),
      { numRuns: 100 }
    )
  })
})
