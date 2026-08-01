import type { RobotInstance, TickEvent, AttackResult } from "../types"

// --- Result Types ---

export interface Battle1v1Result {
  winnerId: string
  loserId: string
  tickLog: TickEvent[]
}

export interface FFAResult {
  /** Player IDs in elimination order: first eliminated → last standing */
  eliminationOrder: string[]
  tickLog: TickEvent[]
}

// --- Helpers ---

/**
 * Generate a random integer in the range [min, max] (inclusive).
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// --- 1v1 Battle Simulation ---

/**
 * Simulate a 1v1 battle between two robots.
 * Synchronous — processes all ticks until one (or both) robots reach 0 HP.
 * Robot1 always attacks first within each tick (deterministic attack order).
 */
export function simulateBattle1v1(
  robot1: RobotInstance,
  robot2: RobotInstance
): Battle1v1Result {
  const tickLog: TickEvent[] = []
  let tick = 0

  while (robot1.currentHp > 0 && robot2.currentHp > 0) {
    tick++
    const attacks: AttackResult[] = []

    // Robot 1 attacks Robot 2
    const roll1 = randomInt(1, 100)
    if (roll1 <= robot1.accuracy) {
      const damage1 = randomInt(robot1.damageMin, robot1.damageMax)
      robot2.currentHp = Math.max(0, robot2.currentHp - damage1)
      attacks.push({
        attackerId: robot1.ownerId,
        targetId: robot2.ownerId,
        hit: true,
        damage: damage1,
        targetHpAfter: robot2.currentHp,
      })
    } else {
      attacks.push({
        attackerId: robot1.ownerId,
        targetId: robot2.ownerId,
        hit: false,
        damage: 0,
        targetHpAfter: robot2.currentHp,
      })
    }

    // Robot 2 attacks Robot 1
    const roll2 = randomInt(1, 100)
    if (roll2 <= robot2.accuracy) {
      const damage2 = randomInt(robot2.damageMin, robot2.damageMax)
      robot1.currentHp = Math.max(0, robot1.currentHp - damage2)
      attacks.push({
        attackerId: robot2.ownerId,
        targetId: robot1.ownerId,
        hit: true,
        damage: damage2,
        targetHpAfter: robot1.currentHp,
      })
    } else {
      attacks.push({
        attackerId: robot2.ownerId,
        targetId: robot1.ownerId,
        hit: false,
        damage: 0,
        targetHpAfter: robot1.currentHp,
      })
    }

    tickLog.push({ tick, attacks })
  }

  // Determine winner
  if (robot1.currentHp <= 0 && robot2.currentHp <= 0) {
    // Simultaneous KO — run tiebreaker
    const winnerId = resolveTiebreaker(robot1, robot2)
    const loserId = winnerId === robot1.ownerId ? robot2.ownerId : robot1.ownerId
    return { winnerId, loserId, tickLog }
  } else if (robot2.currentHp <= 0) {
    return { winnerId: robot1.ownerId, loserId: robot2.ownerId, tickLog }
  } else {
    return { winnerId: robot2.ownerId, loserId: robot1.ownerId, tickLog }
  }
}

/**
 * Resolve a simultaneous KO tiebreaker.
 * Up to 3 additional attack rolls. If still tied, 50/50 coin flip.
 */
function resolveTiebreaker(robot1: RobotInstance, robot2: RobotInstance): string {
  for (let attempt = 0; attempt < 3; attempt++) {
    const roll1 = randomInt(1, 100)
    const hit1 = roll1 <= robot1.accuracy
    const damage1 = hit1 ? randomInt(robot1.damageMin, robot1.damageMax) : 0

    const roll2 = randomInt(1, 100)
    const hit2 = roll2 <= robot2.accuracy
    const damage2 = hit2 ? randomInt(robot2.damageMin, robot2.damageMax) : 0

    // If one hit and the other missed, the hitter wins
    if (hit1 && !hit2) return robot1.ownerId
    if (hit2 && !hit1) return robot2.ownerId

    // If both hit, higher damage wins
    if (hit1 && hit2) {
      if (damage1 > damage2) return robot1.ownerId
      if (damage2 > damage1) return robot2.ownerId
      // Equal damage — continue to next attempt
    }
    // Both missed — continue to next attempt
  }

  // After 3 failed tiebreaker rolls, 50/50 coin flip
  const coinFlip = randomInt(1, 2)
  return coinFlip === 1 ? robot1.ownerId : robot2.ownerId
}

// --- FFA Battle Simulation ---

/**
 * Simulate a free-for-all battle among multiple robots.
 * Synchronous — processes all ticks until only one robot remains.
 *
 * Key rules:
 * - Each tick: every living robot picks a random living target and attacks
 * - All attacks resolve before removing eliminated robots (overkill within a tick is valid)
 * - Eliminated robots are removed from the target pool for the next tick
 * - Tracks elimination order; last standing is the final survivor
 */
export function simulateFFA(participants: RobotInstance[]): FFAResult {
  const tickLog: TickEvent[] = []
  const eliminationOrder: string[] = []
  let tick = 0
  let living = participants.filter((r) => r.currentHp > 0)

  while (living.length > 1) {
    tick++
    const attacks: AttackResult[] = []

    // Each living robot selects a random target and attacks
    for (const robot of living) {
      const targets = living.filter((r) => r.ownerId !== robot.ownerId)
      if (targets.length === 0) continue

      const target = targets[randomInt(0, targets.length - 1)]

      const roll = randomInt(1, 100)
      if (roll <= robot.accuracy) {
        const damage = randomInt(robot.damageMin, robot.damageMax)
        target.currentHp = Math.max(0, target.currentHp - damage)
        attacks.push({
          attackerId: robot.ownerId,
          targetId: target.ownerId,
          hit: true,
          damage,
          targetHpAfter: target.currentHp,
        })
      } else {
        attacks.push({
          attackerId: robot.ownerId,
          targetId: target.ownerId,
          hit: false,
          damage: 0,
          targetHpAfter: target.currentHp,
        })
      }
    }

    // AFTER all attacks resolve, remove eliminated robots
    const newlyEliminated = living.filter((r) => r.currentHp <= 0)
    for (const eliminated of newlyEliminated) {
      eliminationOrder.push(eliminated.ownerId)
    }
    living = living.filter((r) => r.currentHp > 0)

    tickLog.push({ tick, attacks })
  }

  // Last robot standing — append to elimination order last (highest rank)
  if (living.length === 1) {
    eliminationOrder.push(living[0].ownerId)
  }

  return { eliminationOrder, tickLog }
}
