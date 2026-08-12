import type { BotPersona, RobotTemplate, BattleBotsPick, WeaponType, HeadType, BodyType } from "./types"

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
 * Selects random parts for a bot persona with uniform probability.
 * Bot personas participate identically to human players — they just auto-select parts.
 * (Req 10.4: Bot persona selects parts with uniform probability)
 */
export function botPersonaSelectParts(): BattleBotsPick {
  const weapons: WeaponType[] = ["drill", "blaster", "bazooka"]
  const heads: HeadType[] = ["square", "rounded", "triangular", "hexagonal"]
  const bodies: BodyType[] = ["square", "rounded", "triangular", "hexagonal"]
  const colors = [
    "#e53935", "#1e88e5", "#43a047", "#fb8c00",
    "#8e24aa", "#00acc1", "#f4511e", "#7cb342",
  ]
  return {
    weapon: weapons[Math.floor(Math.random() * weapons.length)],
    head: heads[Math.floor(Math.random() * heads.length)],
    body: bodies[Math.floor(Math.random() * bodies.length)],
    color: colors[Math.floor(Math.random() * colors.length)],
  }
}

/**
 * @deprecated Use botPersonaSelectParts() instead. Kept for backward compatibility.
 * Selects a random robot from the given options for a bot persona.
 */
export function botPersonaSelectRobot(options: RobotTemplate[]): string {
  const index = Math.floor(Math.random() * options.length)
  return options[index].id
}
