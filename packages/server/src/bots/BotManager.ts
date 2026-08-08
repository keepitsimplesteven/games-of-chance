// packages/server/src/bots/BotManager.ts

import type { Player, GameSettings } from "@games-of-chance/shared"
import { getRobotTemplates } from "../games/battle-bots/BattleBotsPlugin"

export interface BotPersona {
  id: string   // e.g., "bot:alpha"
  name: string // e.g., "[BOT] Alpha"
}

export const BOT_NAMES = [
  "Alpha",
  "Bravo",
  "Charlie",
  "Delta",
  "Echo",
  "Foxtrot",
  "Golf",
  "Hotel",
  "India",
] as const

export class BotManager {
  private bots: Map<string, BotPersona> = new Map()

  /**
   * Reconcile bot count to match target room size.
   * Adds or removes bots so that humans + bots === roomSize.
   */
  reconcile(
    players: Record<string, Player>,
    roomSize: number
  ): { added: BotPersona[]; removed: string[] } {
    const humanCount = Object.keys(players).filter(
      (id) => !this.isBot(id)
    ).length
    const desiredBotCount = roomSize - humanCount
    const currentBotCount = this.bots.size

    const added: BotPersona[] = []
    const removed: string[] = []

    if (desiredBotCount > currentBotCount) {
      // Need to add bots
      const toAdd = desiredBotCount - currentBotCount
      for (let i = 0; i < toAdd; i++) {
        const persona = this.nextAvailablePersona()
        if (persona) {
          this.bots.set(persona.id, persona)
          added.push(persona)
        }
      }
    } else if (desiredBotCount < currentBotCount) {
      // Need to remove bots (remove highest-numbered first)
      const toRemove = currentBotCount - desiredBotCount
      const sortedBots = this.getSortedBots()
      for (let i = 0; i < toRemove; i++) {
        const bot = sortedBots[sortedBots.length - 1 - i]
        if (bot) {
          this.bots.delete(bot.id)
          removed.push(bot.id)
        }
      }
    }

    return { added, removed }
  }

  /**
   * Remove the lowest-numbered bot to make room for a human.
   * Returns the removed bot's ID, or null if no bots exist.
   */
  removeLowestBot(players: Record<string, Player>): string | null {
    const sortedBots = this.getSortedBots()
    if (sortedBots.length === 0) return null

    const lowestBot = sortedBots[0]
    this.bots.delete(lowestBot.id)
    return lowestBot.id
  }

  /** Check if a player ID belongs to a bot */
  isBot(playerId: string): boolean {
    return playerId.startsWith("bot:")
  }

  /** Get all current bot IDs */
  getBotIds(): string[] {
    return Array.from(this.bots.keys())
  }

  /**
   * Generate random picks for all bots in the room.
   * Returns a map of botId → pick.
   */
  generatePicks(
    gameType: string,
    settings: GameSettings
  ): Record<string, unknown> {
    const picks: Record<string, unknown> = {}

    for (const botId of this.bots.keys()) {
      switch (gameType) {
        case "coin-toss": {
          const side = Math.random() < 0.5 ? "HEADS" : "TAILS"
          picks[botId] = { side }
          break
        }
        case "battle-bots": {
          const templates = getRobotTemplates(settings)
          const selected = templates[Math.floor(Math.random() * templates.length)]
          picks[botId] = { robotTemplateId: selected.id }
          break
        }
        case "big-wheel": {
          picks[botId] = { type: "spin" }
          break
        }
        case "playcaller": {
          // Bot picks are handled per-down by schedulePlaycallerBotPicks in room.ts
          // This case is a no-op for the standard scheduleBotPicks path
          break
        }
        default: {
          // Fallback: no pick for unknown game types
          break
        }
      }
    }

    return picks
  }

  /**
   * Get sorted bots by their index in BOT_NAMES (lowest first).
   */
  private getSortedBots(): BotPersona[] {
    return Array.from(this.bots.values()).sort((a, b) => {
      const indexA = BOT_NAMES.findIndex(
        (n) => `bot:${n.toLowerCase()}` === a.id
      )
      const indexB = BOT_NAMES.findIndex(
        (n) => `bot:${n.toLowerCase()}` === b.id
      )
      return indexA - indexB
    })
  }

  /**
   * Find the next available bot persona (one not already in use).
   */
  private nextAvailablePersona(): BotPersona | null {
    for (const name of BOT_NAMES) {
      const id = `bot:${name.toLowerCase()}`
      if (!this.bots.has(id)) {
        return { id, name: `[BOT] ${name}` }
      }
    }
    return null
  }
}
