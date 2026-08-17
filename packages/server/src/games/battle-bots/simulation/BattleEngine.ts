import type { CombatRobot, TickEntry, AttackEvent } from "../types"
import type { RobotInstance } from "../types"
import { BATTLE_BOTS } from "../constants"
import { get1v1Scalar, getFFAScalar } from "../BalanceScalars"

// â”€â”€â”€ Result Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface BattleResult {
  winnerId: string
  tickLog: TickEntry[]
}

export interface FFAResult {
  eliminationOrder: Array<{ ownerId: string; eliminatedOnTick: number }>
  survivorId: string
  tickLog: TickEntry[]
}

// â”€â”€â”€ RNG Helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Generate a random integer in the range [min, max] (inclusive, uniform).
 * Structured as a standalone function so an injectable RNG can replace Math.random later.
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// â”€â”€â”€ 1v1 Battle Simulation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Simulate a 1v1 battle using the snapshot model + guaranteed survivor rule.
 *
 * Algorithm per tick:
 * 1. Capture snapshot: record each living robot's HP at tick start
 * 2. Determine attackers: robots whose energy accumulator reaches â‰¥100 and snapshot HP > 0
 * 3. For each attacker: roll accuracy, if hit roll damage (1 to maxHit), record attack event
 * 4. Sum damage per target from all attacks this tick
 * 5. Apply damage to get tentative new HP values
 * 6. Guaranteed Survivor Check: if ALL robots with snapshot HP > 0 would reach HP â‰¤ 0,
 *    pick one at random and negate all damage to it for this tick
 * 7. Finalize HP values, mark eliminations
 * 8. If one robot remains or tick reaches TICK_LIMIT: end simulation
 */
export function simulate1v1(robot1: CombatRobot, robot2: CombatRobot): BattleResult {
  const tickLog: TickEntry[] = []

  // Work with mutable HP copies so we don't mutate the input objects
  const hp: Record<string, number> = {
    [robot1.ownerId]: robot1.currentHp,
    [robot2.ownerId]: robot2.currentHp,
  }

  // Initialize energy accumulators to 0 for all bots at battle start
  const energy: Record<string, number> = {
    [robot1.ownerId]: 0,
    [robot2.ownerId]: 0,
  }

  const robots = [robot1, robot2]

  for (let tick = 1; tick <= BATTLE_BOTS.TICK_LIMIT; tick++) {
    // Step 1: Capture HP snapshot at start of tick
    const snapshot: Record<string, number> = {
      [robot1.ownerId]: hp[robot1.ownerId],
      [robot2.ownerId]: hp[robot2.ownerId],
    }

    // Determine which robots are alive (snapshot HP > 0)
    const livingIds = robots
      .filter((r) => snapshot[r.ownerId] > 0)
      .map((r) => r.ownerId)

    // If only one robot alive at start of tick, battle is over
    if (livingIds.length <= 1) {
      break
    }

    // Step 2: Accumulate energy for all living bots
    for (const robot of robots) {
      if (snapshot[robot.ownerId] > 0) {
        energy[robot.ownerId] += robot.energyPerTick
      }
    }

    // Step 3: Determine attackers â€” any bot with energy >= 100
    const attackers = robots.filter(
      (r) => snapshot[r.ownerId] > 0 && energy[r.ownerId] >= 100
    )

    // Step 4: Roll attacks, record events
    const attacks: AttackEvent[] = []
    const damageAccumulator: Record<string, number> = {
      [robot1.ownerId]: 0,
      [robot2.ownerId]: 0,
    }

    for (const attacker of attackers) {
      // In 1v1, target is the sole opponent
      const target = robots.find((r) => r.ownerId !== attacker.ownerId)!

      // Roll accuracy (1-100 inclusive)
      const accuracyRoll = randomInt(1, 100)
      const hit = accuracyRoll <= attacker.accuracy

      let damage = 0
      if (hit) {
        // Roll damage (1 to maxHit inclusive), apply per-matchup balance scalar
        const rawDmg = randomInt(1, attacker.maxHit)
        const scalar = get1v1Scalar(attacker.stars, target.stars)
        damage = Math.max(1, Math.round(rawDmg * scalar))
      }

      // Accumulate damage for target
      damageAccumulator[target.ownerId] += damage

      // Record the attack event (targetHpAfter will be finalized after GSR)
      attacks.push({
        attackerId: attacker.ownerId,
        targetId: target.ownerId,
        hit,
        damage,
        targetHpAfter: 0, // placeholder, finalized below
      })
    }

    // Step 5-6: Calculate tentative HP after applying all damage
    const tentativeHp: Record<string, number> = {}
    for (const id of livingIds) {
      tentativeHp[id] = Math.max(0, snapshot[id] - damageAccumulator[id])
    }

    // Step 7: Guaranteed Survivor Rule
    // Check if ALL living robots would reach HP â‰¤ 0
    const allWouldDie = livingIds.every((id) => tentativeHp[id] <= 0)

    if (allWouldDie) {
      // Pick one random robot to survive â€” negate all damage to it
      const survivorIndex = randomInt(0, livingIds.length - 1)
      const survivorId = livingIds[survivorIndex]
      tentativeHp[survivorId] = snapshot[survivorId] // restore pre-tick HP

      // Remove attack events targeting the survivor from damage
      // (they still happened but damage is negated)
      for (const attack of attacks) {
        if (attack.targetId === survivorId) {
          attack.damage = 0
        }
      }
    }

    // Step 8: Finalize HP values
    for (const id of livingIds) {
      hp[id] = tentativeHp[id]
    }

    // Update targetHpAfter in attack events
    for (const attack of attacks) {
      attack.targetHpAfter = hp[attack.targetId]
    }

    // Determine eliminations
    const eliminations = livingIds.filter((id) => hp[id] <= 0)

    // Subtract 100 from each attacker's energy (preserve overflow)
    for (const attacker of attackers) {
      energy[attacker.ownerId] -= 100
      // Cap at 99 for bots with energyPerTick >= 100
      if (attacker.energyPerTick >= 100) {
        energy[attacker.ownerId] = Math.min(energy[attacker.ownerId], 99)
      }
    }

    // Record energy states for living bots at end of tick (only bots with HP > 0)
    const energyStates: Record<string, number> = {}
    for (const id of livingIds) {
      if (hp[id] > 0) {
        energyStates[id] = energy[id]
      }
    }

    tickLog.push({
      tick,
      attacks,
      eliminations,
      energyStates,
    })

    // Step 9: Check termination â€” if one robot remains, end
    const remainingAlive = robots.filter((r) => hp[r.ownerId] > 0)
    if (remainingAlive.length <= 1) {
      break
    }
  }

  // Determine winner
  const winnerId = determineWinner(robots, hp)

  return { winnerId, tickLog }
}

/**
 * Determine the winner at end of simulation.
 * If one robot is alive, it wins.
 * If timeout (1000 ticks), highest HP wins.
 * If HP is tied at timeout, pick randomly.
 */
function determineWinner(
  robots: CombatRobot[],
  hp: Record<string, number>
): string {
  const alive = robots.filter((r) => hp[r.ownerId] > 0)

  if (alive.length === 1) {
    return alive[0].ownerId
  }

  // Timeout case â€” highest HP wins
  if (alive.length > 1) {
    const sorted = [...alive].sort((a, b) => hp[b.ownerId] - hp[a.ownerId])
    // If tied HP, pick randomly among the tied robots
    const maxHp = hp[sorted[0].ownerId]
    const tied = sorted.filter((r) => hp[r.ownerId] === maxHp)
    if (tied.length === 1) {
      return tied[0].ownerId
    }
    return tied[randomInt(0, tied.length - 1)].ownerId
  }

  // Should not happen due to GSR, but fallback
  return robots[randomInt(0, robots.length - 1)].ownerId
}

// â”€â”€â”€ FFA Battle Simulation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Simulate a Free-For-All battle using the snapshot model + guaranteed survivor rule.
 *
 * Algorithm per tick:
 * 1. Capture snapshot: record each living robot's HP at tick start
 * 2. Determine attackers: robots whose energy accumulator reaches â‰¥100 and snapshot HP > 0
 * 3. For each attacker: select random living target (not self, snapshot HP > 0),
 *    roll accuracy, if hit roll damage (1 to maxHit), record attack event
 * 4. Sum damage per target from all attacks this tick
 * 5. Apply damage to get tentative new HP values
 * 6. Guaranteed Survivor Check: if ALL robots with snapshot HP > 0 would reach HP â‰¤ 0,
 *    pick one at random and negate all damage to it for this tick
 * 7. Finalize HP values, mark eliminations, record in eliminationOrder
 * 8. If one robot remains or tick reaches TICK_LIMIT: end simulation
 */
export function simulateFFA(robots: CombatRobot[]): FFAResult
export function simulateFFA(robots: RobotInstance[]): LegacyFFAResult
export function simulateFFA(robots: CombatRobot[] | RobotInstance[]): FFAResult | LegacyFFAResult {
  // Detect if input is CombatRobot[] (new system) or RobotInstance[] (legacy)
  const isNewFormat = robots.length > 0 && 'energyPerTick' in robots[0] && 'maxHit' in robots[0]

  if (isNewFormat) {
    // New API path â€” return structured eliminationOrder
    return simulateFFAInternal(robots as CombatRobot[])
  }

  // Legacy path â€” convert and return flat string eliminationOrder
  const combatRobots: CombatRobot[] = (robots as RobotInstance[]).map(robotInstanceToCombatRobot)
  const result = simulateFFAInternal(combatRobots)

  // Convert to legacy format: eliminationOrder as flat string array with survivor at end
  const eliminatedIds = result.eliminationOrder.map((e) => e.ownerId)
  const legacyEliminationOrder = [...eliminatedIds, result.survivorId]

  return {
    eliminationOrder: legacyEliminationOrder,
    survivorId: result.survivorId,
    tickLog: result.tickLog,
  } as LegacyFFAResult
}

/** Legacy-compatible FFA result with flat string eliminationOrder */
export interface LegacyFFAResult {
  eliminationOrder: string[]
  survivorId: string
  tickLog: TickEntry[]
}

function simulateFFAInternal(robots: CombatRobot[]): FFAResult {
  const tickLog: TickEntry[] = []
  const eliminationOrder: Array<{ ownerId: string; eliminatedOnTick: number }> = []

  // Work with mutable HP copies so we don't mutate the input objects
  const hp: Record<string, number> = {}
  for (const robot of robots) {
    hp[robot.ownerId] = robot.currentHp
  }

  // Initialize energy accumulators for all bots
  const energy: Record<string, number> = {}
  for (const robot of robots) {
    energy[robot.ownerId] = 0
  }

  for (let tick = 1; tick <= BATTLE_BOTS.TICK_LIMIT; tick++) {
    // Step 1: Capture HP snapshot at start of tick
    const snapshot: Record<string, number> = {}
    for (const robot of robots) {
      snapshot[robot.ownerId] = hp[robot.ownerId]
    }

    // Determine which robots are alive (snapshot HP > 0)
    const livingIds = robots
      .filter((r) => snapshot[r.ownerId] > 0)
      .map((r) => r.ownerId)

    // If only one robot alive at start of tick, battle is over
    if (livingIds.length <= 1) {
      break
    }

    // Step 2: Accumulate energy for all living bots
    for (const robot of robots) {
      if (snapshot[robot.ownerId] > 0) {
        energy[robot.ownerId] += robot.energyPerTick
      }
    }

    // Step 3: Determine attackers â€” any bot with energy >= 100
    const attackers = robots.filter(
      (r) => snapshot[r.ownerId] > 0 && energy[r.ownerId] >= 100
    )

    // Step 4: Roll attacks with random target selection, record events
    const attacks: AttackEvent[] = []
    const damageAccumulator: Record<string, number> = {}
    for (const id of livingIds) {
      damageAccumulator[id] = 0
    }

    for (const attacker of attackers) {
      // FFA target selection: random living target excluding self
      const possibleTargets = livingIds.filter((id) => id !== attacker.ownerId)

      // Should not happen (living count > 1 guarantees at least 1 target), but guard
      if (possibleTargets.length === 0) continue

      const targetId = possibleTargets[randomInt(0, possibleTargets.length - 1)]

      // Roll accuracy (1-100 inclusive)
      const accuracyRoll = randomInt(1, 100)
      const hit = accuracyRoll <= attacker.accuracy

      let damage = 0
      if (hit) {
        // Roll damage (1 to maxHit inclusive), apply per-build FFA balance scalar
        const rawDmg = randomInt(1, attacker.maxHit)
        const scalar = getFFAScalar(attacker.stars)
        damage = Math.max(1, Math.round(rawDmg * scalar))
      }

      // Accumulate damage for target
      damageAccumulator[targetId] += damage

      // Record the attack event (targetHpAfter will be finalized after GSR)
      attacks.push({
        attackerId: attacker.ownerId,
        targetId,
        hit,
        damage,
        targetHpAfter: 0, // placeholder, finalized below
      })
    }

    // Step 5: Calculate tentative HP after applying all damage
    const tentativeHp: Record<string, number> = {}
    for (const id of livingIds) {
      tentativeHp[id] = Math.max(0, snapshot[id] - damageAccumulator[id])
    }

    // Step 6: Guaranteed Survivor Rule
    // Check if ALL living robots would reach HP â‰¤ 0
    const allWouldDie = livingIds.every((id) => tentativeHp[id] <= 0)

    if (allWouldDie) {
      // Pick one random robot to survive â€” negate all damage to it
      const survivorIndex = randomInt(0, livingIds.length - 1)
      const survivorId = livingIds[survivorIndex]
      tentativeHp[survivorId] = snapshot[survivorId] // restore pre-tick HP

      // Remove damage from attacks targeting the survivor
      for (const attack of attacks) {
        if (attack.targetId === survivorId) {
          attack.damage = 0
        }
      }
    }

    // Step 7: Finalize HP values
    for (const id of livingIds) {
      hp[id] = tentativeHp[id]
    }

    // Update targetHpAfter in attack events
    for (const attack of attacks) {
      attack.targetHpAfter = hp[attack.targetId]
    }

    // Subtract 100 from each attacker's energy (preserve overflow)
    for (const attacker of attackers) {
      energy[attacker.ownerId] -= 100
      // Cap at 99 for bots with energyPerTick >= 100
      if (attacker.energyPerTick >= 100) {
        energy[attacker.ownerId] = Math.min(energy[attacker.ownerId], 99)
      }
    }

    // Determine eliminations
    const eliminations = livingIds.filter((id) => hp[id] <= 0)

    // Record eliminations with tick number
    for (const eliminatedId of eliminations) {
      eliminationOrder.push({ ownerId: eliminatedId, eliminatedOnTick: tick })
    }

    // Record energy states for living bots at end of tick (after damage applied)
    const energyStates: Record<string, number> = {}
    for (const id of livingIds) {
      if (hp[id] > 0) {
        energyStates[id] = energy[id]
      }
    }

    tickLog.push({
      tick,
      attacks,
      eliminations,
      energyStates,
    })

    // Step 8: Check termination â€” if one robot remains, end
    const remainingAlive = robots.filter((r) => hp[r.ownerId] > 0)
    if (remainingAlive.length <= 1) {
      break
    }
  }

  // Determine survivor
  const survivorId = determineWinner(robots, hp)

  return { eliminationOrder, survivorId, tickLog }
}


// â”€â”€â”€ Legacy Adapter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Adapts a legacy RobotInstance to a CombatRobot for use with the new engine.
 * Used by pre-overhaul code (BattleBotsPlugin, old prop tests) until task 4 migration.
 */
function robotInstanceToCombatRobot(robot: RobotInstance): CombatRobot {
  return {
    ownerId: robot.ownerId,
    name: robot.templateId ?? "Robot",
    maxHit: robot.damageMax,
    accuracy: robot.accuracy,
    energyPerTick: 100,    // attacks every tick (legacy behavior)
    currentEnergy: 0,
    currentHp: robot.currentHp,
    maxHp: robot.maxHp,
    stars: { damage: 3, accuracy: 3, speed: 3 },
    visual: {},
  }
}

/**
 * Legacy wrapper: accepts old RobotInstance objects, converts to CombatRobot,
 * and runs the new simulate1v1 engine.
 */
export function simulateBattle1v1(
  robot1: RobotInstance,
  robot2: RobotInstance
): BattleResult & { loserId: string } {
  const combatRobot1 = robotInstanceToCombatRobot(robot1)
  const combatRobot2 = robotInstanceToCombatRobot(robot2)
  const result = simulate1v1(combatRobot1, combatRobot2)
  const loserId =
    result.winnerId === combatRobot1.ownerId
      ? combatRobot2.ownerId
      : combatRobot1.ownerId
  return { ...result, loserId }
}
