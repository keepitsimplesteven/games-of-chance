import type { BattlePairing, RobotInstance } from "../types"

/**
 * Fisher-Yates (Knuth) shuffle — shuffles array in place and returns it.
 */
function fisherYatesShuffle<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * Creates random 1v1 pairings from a list of participants.
 *
 * Shuffles participant IDs using Fisher-Yates, then pairs them sequentially.
 * Assumes an even number of participants (bot persona creation handles odd counts upstream).
 *
 * @param participants - Array of player/bot persona IDs to pair
 * @param selectedRobots - Map of participant ID → their selected RobotInstance
 * @returns Array of BattlePairing objects ready for battle simulation
 */
export function createPairings(
  participants: string[],
  selectedRobots: Record<string, RobotInstance>
): BattlePairing[] {
  const shuffled = fisherYatesShuffle(participants)
  const pairings: BattlePairing[] = []

  for (let i = 0; i < shuffled.length - 1; i += 2) {
    const player1Id = shuffled[i]
    const player2Id = shuffled[i + 1]

    const pairing: BattlePairing = {
      id: crypto.randomUUID(),
      player1Id,
      player2Id,
      robot1: selectedRobots[player1Id],
      robot2: selectedRobots[player2Id],
      winnerId: null,
      loserId: null,
      tickLog: [],
    }

    pairings.push(pairing)
  }

  return pairings
}
