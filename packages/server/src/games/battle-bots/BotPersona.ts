import type { BotPersona, RobotTemplate } from "./types"

/**
 * Ensures even participant count for battle pairing.
 * Creates a BotPersona when player count is odd or equals 1.
 *
 * @param players - Array of player IDs currently in the game
 * @returns Array of BotPersona (0 or 1 elements)
 */
export function ensureEvenParticipants(players: string[]): BotPersona[] {
  const botPersonas: BotPersona[] = []

  if (players.length % 2 !== 0 || players.length === 1) {
    const shortId = crypto.randomUUID().slice(0, 8)
    const botNumber = Math.floor(Math.random() * 99) + 1

    const bot: BotPersona = {
      id: `bot_${shortId}`,
      name: `MechBot-${botNumber}`,
      isBot: true,
    }

    botPersonas.push(bot)
  }

  return botPersonas
}

/**
 * Selects a random robot from the given options for a bot persona.
 * Bot personas participate identically to human players — they just auto-select.
 */
export function botPersonaSelectRobot(options: RobotTemplate[]): string {
  const index = Math.floor(Math.random() * options.length)
  return options[index].id
}
