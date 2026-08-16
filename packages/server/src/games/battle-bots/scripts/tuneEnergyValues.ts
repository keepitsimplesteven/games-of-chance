/**
 * Balance tuning script for Battle Bots energy meter system.
 *
 * Simulates all 48 valid build configurations (star distributions summing to 9,
 * each star in [1, 7]) against a deterministic 3-3-3 reference bot.
 *
 * The reference bot uses deterministic combat:
 *   - Accuracy always hits (no accuracy roll)
 *   - Damage = arithmetic mean of 1 to maxHit each attack: (1 + maxHit) / 2
 *
 * Challenger bots use normal random combat via the existing simulate1v1 engine.
 *
 * Reports win rates and flags builds outside the 48%–52% balance band.
 *
 * Usage: npx tsx packages/server/src/games/battle-bots/scripts/tuneEnergyValues.ts
 */

import { deriveCombatStats } from "../ModifierTable"
import type { CombatRobot } from "../types"

// ─── Types ────────────────────────────────────────────────────────────────────

interface TuningResult {
  stars: { damage: number; accuracy: number; speed: number }
  winRate: number
  matchesPlayed: number
  inBand: boolean
}

// ─── Build Enumeration ────────────────────────────────────────────────────────

/**
 * Enumerate all valid star distributions where damage + accuracy + speed = 9
 * and each value is in [1, 7]. This yields exactly 48 builds.
 */
function allBuilds(): Array<{ damage: number; accuracy: number; speed: number }> {
  const builds: Array<{ damage: number; accuracy: number; speed: number }> = []

  for (let damage = 1; damage <= 7; damage++) {
    for (let accuracy = 1; accuracy <= 7; accuracy++) {
      const speed = 9 - damage - accuracy
      if (speed >= 1 && speed <= 7) {
        builds.push({ damage, accuracy, speed })
      }
    }
  }

  return builds
}


// ─── Reference Bot ────────────────────────────────────────────────────────────

/**
 * Build the 3-3-3 reference bot with deterministic combat stats.
 * This bot's combat is handled specially in simulate1v1Deterministic —
 * accuracy always hits, damage = mean of (1, maxHit).
 */
function buildReferenceBot(): CombatRobot {
  const stats = deriveCombatStats({ damage: 3, accuracy: 3, speed: 3 })

  return {
    ownerId: "reference",
    name: "Reference-3-3-3",
    maxHit: stats.maxHit,
    accuracy: stats.accuracy,
    energyPerTick: stats.energyPerTick,
    currentEnergy: 0,
    currentHp: stats.hp,
    maxHp: stats.hp,
    stars: { damage: 3, accuracy: 3, speed: 3 },
    visual: {},
  }
}

// ─── Challenger Bot ───────────────────────────────────────────────────────────

/**
 * Build a combat robot for a given star distribution (uses normal random combat).
 */
function buildCombatRobot(stars: {
  damage: number
  accuracy: number
  speed: number
}): CombatRobot {
  const stats = deriveCombatStats(stars)

  return {
    ownerId: "challenger",
    name: `Challenger-${stars.damage}-${stars.accuracy}-${stars.speed}`,
    maxHit: stats.maxHit,
    accuracy: stats.accuracy,
    energyPerTick: stats.energyPerTick,
    currentEnergy: 0,
    currentHp: stats.hp,
    maxHp: stats.hp,
    stars,
    visual: {},
  }
}

// ─── Deterministic 1v1 Simulation ────────────────────────────────────────────

/**
 * Simulate a 1v1 match where the reference bot uses deterministic combat:
 *   - Accuracy: always hits (no roll)
 *   - Damage: arithmetic mean of 1 to maxHit = (1 + maxHit) / 2
 *
 * The challenger bot uses normal random combat (random accuracy/damage rolls).
 * This isolates the effect of star distribution on win rate.
 */
function simulate1v1Deterministic(
  challenger: CombatRobot,
  reference: CombatRobot
): { winnerId: string } {
  const TICK_LIMIT = 1000

  const hp: Record<string, number> = {
    [challenger.ownerId]: challenger.currentHp,
    [reference.ownerId]: reference.currentHp,
  }

  const energy: Record<string, number> = {
    [challenger.ownerId]: 0,
    [reference.ownerId]: 0,
  }

  const robots = [challenger, reference]

  for (let tick = 1; tick <= TICK_LIMIT; tick++) {
    // Snapshot HP at tick start
    const snapshot: Record<string, number> = {
      [challenger.ownerId]: hp[challenger.ownerId],
      [reference.ownerId]: hp[reference.ownerId],
    }

    // Determine living bots
    const livingIds = robots
      .filter((r) => snapshot[r.ownerId] > 0)
      .map((r) => r.ownerId)

    if (livingIds.length <= 1) break

    // Accumulate energy for living bots
    for (const robot of robots) {
      if (snapshot[robot.ownerId] > 0) {
        energy[robot.ownerId] += robot.energyPerTick
      }
    }

    // Determine attackers (energy >= 100)
    const attackers = robots.filter(
      (r) => snapshot[r.ownerId] > 0 && energy[r.ownerId] >= 100
    )

    // Process attacks — accumulate damage per target
    const damageAccumulator: Record<string, number> = {
      [challenger.ownerId]: 0,
      [reference.ownerId]: 0,
    }

    for (const attacker of attackers) {
      const target = robots.find((r) => r.ownerId !== attacker.ownerId)!

      if (attacker.ownerId === reference.ownerId) {
        // Reference bot: deterministic — always hits, damage = mean
        const meanDamage = (1 + attacker.maxHit) / 2
        damageAccumulator[target.ownerId] += meanDamage
      } else {
        // Challenger bot: normal random rolls
        const accuracyRoll = Math.floor(Math.random() * 100) + 1
        const hit = accuracyRoll <= attacker.accuracy

        if (hit) {
          const damage = Math.floor(Math.random() * attacker.maxHit) + 1
          damageAccumulator[target.ownerId] += damage
        }
      }
    }

    // Calculate tentative HP
    const tentativeHp: Record<string, number> = {}
    for (const id of livingIds) {
      tentativeHp[id] = Math.max(0, snapshot[id] - damageAccumulator[id])
    }

    // Guaranteed Survivor Rule: if all would die, one survives
    const allWouldDie = livingIds.every((id) => tentativeHp[id] <= 0)
    if (allWouldDie) {
      const survivorIndex = Math.floor(Math.random() * livingIds.length)
      tentativeHp[livingIds[survivorIndex]] = snapshot[livingIds[survivorIndex]]
    }

    // Finalize HP
    for (const id of livingIds) {
      hp[id] = tentativeHp[id]
    }

    // Subtract 100 from each attacker's energy (preserve overflow)
    for (const attacker of attackers) {
      energy[attacker.ownerId] -= 100
      if (attacker.energyPerTick >= 100) {
        energy[attacker.ownerId] = Math.min(energy[attacker.ownerId], 99)
      }
    }

    // Check termination
    const remainingAlive = robots.filter((r) => hp[r.ownerId] > 0)
    if (remainingAlive.length <= 1) break
  }

  // Determine winner: highest HP, or random if tied
  const aliveRobots = robots.filter((r) => hp[r.ownerId] > 0)
  if (aliveRobots.length === 1) {
    return { winnerId: aliveRobots[0].ownerId }
  }

  // Timeout — highest HP wins
  const sorted = robots.sort((a, b) => hp[b.ownerId] - hp[a.ownerId])
  if (hp[sorted[0].ownerId] > hp[sorted[1].ownerId]) {
    return { winnerId: sorted[0].ownerId }
  }

  // Tied — pick randomly
  return { winnerId: robots[Math.floor(Math.random() * robots.length)].ownerId }
}

// ─── Main Tuning Function ─────────────────────────────────────────────────────

function tuneEnergyValues(): TuningResult[] {
  const reference = buildReferenceBot()
  const builds = allBuilds()
  const results: TuningResult[] = []
  const TRIALS = 10_000

  console.log(`\n🤖 Battle Bots Energy Meter — Balance Tuning`)
  console.log(`${"─".repeat(60)}`)
  console.log(`Reference bot: 3-3-3 (deterministic: always hits, damage = mean)`)
  console.log(`Trials per build: ${TRIALS.toLocaleString()}`)
  console.log(`Total builds: ${builds.length}`)
  console.log(`Balance band: 48% – 52%\n`)

  for (const build of builds) {
    let wins = 0

    for (let i = 0; i < TRIALS; i++) {
      const challenger = buildCombatRobot(build)
      const result = simulate1v1Deterministic(challenger, reference)
      if (result.winnerId === challenger.ownerId) wins++
    }

    const winRate = wins / TRIALS
    const inBand = winRate >= 0.48 && winRate <= 0.52

    results.push({
      stars: build,
      winRate,
      matchesPlayed: TRIALS,
      inBand,
    })
  }

  return results
}

// ─── Report Output ────────────────────────────────────────────────────────────

function printResults(results: TuningResult[]): void {
  const outOfBand = results.filter((r) => !r.inBand)
  const inBand = results.filter((r) => r.inBand)

  console.log(`\n📊 Results Summary`)
  console.log(`${"─".repeat(60)}`)
  console.log(`  In band (48-52%): ${inBand.length} / ${results.length} builds`)
  console.log(`  Out of band:      ${outOfBand.length} / ${results.length} builds`)

  if (outOfBand.length > 0) {
    console.log(`\n⚠️  Builds Outside 48%–52% Band:`)
    console.log(`${"─".repeat(60)}`)
    console.log(`  ${"Stars (D-A-S)".padEnd(16)} ${"Win Rate".padEnd(12)} ${"Status"}`)
    console.log(`  ${"─".repeat(44)}`)

    for (const r of outOfBand.sort((a, b) => a.winRate - b.winRate)) {
      const starsStr = `${r.stars.damage}-${r.stars.accuracy}-${r.stars.speed}`
      const winPct = `${(r.winRate * 100).toFixed(1)}%`
      const status = r.winRate < 0.48 ? "🔻 TOO LOW" : "🔺 TOO HIGH"
      console.log(`  ${starsStr.padEnd(16)} ${winPct.padEnd(12)} ${status}`)
    }
  }

  console.log(`\n📋 All Builds:`)
  console.log(`${"─".repeat(60)}`)
  console.log(`  ${"Stars (D-A-S)".padEnd(16)} ${"Win Rate".padEnd(12)} ${"Status"}`)
  console.log(`  ${"─".repeat(44)}`)

  for (const r of results.sort(
    (a, b) =>
      a.stars.damage - b.stars.damage ||
      a.stars.accuracy - b.stars.accuracy ||
      a.stars.speed - b.stars.speed
  )) {
    const starsStr = `${r.stars.damage}-${r.stars.accuracy}-${r.stars.speed}`
    const winPct = `${(r.winRate * 100).toFixed(1)}%`
    const status = r.inBand ? "✅" : r.winRate < 0.48 ? "🔻" : "🔺"
    console.log(`  ${starsStr.padEnd(16)} ${winPct.padEnd(12)} ${status}`)
  }

  console.log("")
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

const results = tuneEnergyValues()
printResults(results)
