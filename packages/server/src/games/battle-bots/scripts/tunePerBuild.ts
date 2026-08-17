/**
 * Battle Bots — Per-Build Scalar Prototype
 *
 * Instead of per-matchup scalars (378 entries), tries a simpler approach:
 * each build gets ONE scalar applied to its damage in ALL matchups.
 *
 * Question: Can a single per-build scalar achieve ~50% win rate across
 * all opponents, or does the correction need to be opponent-specific?
 *
 * Approach:
 *   1. For each build, find a scalar such that its AVERAGE win rate
 *      across all other builds is 50%
 *   2. Apply all scalars simultaneously and validate every pairwise matchup
 *   3. Report how close we get — if residual imbalance is small (< 2%),
 *      per-build scalars may be sufficient
 *
 * POC builds: 7-1-1, 1-7-1, 1-1-7, 3-3-3
 *
 * Usage: npx tsx packages/server/src/games/battle-bots/scripts/tunePerBuild.ts
 */

import { deriveCombatStats, BASE_HP } from "../ModifierTable"

// ─── Constants ────────────────────────────────────────────────────────────────

const TICK_LIMIT = 1000
const TRIALS_PER_STEP = 50_000
const TRIALS_VALIDATION = 200_000
const MAX_HIT_CAP = 90
const TARGET_WIN_RATE = 0.50
const TOLERANCE = 0.005      // ±0.5% for per-build average
const MAX_ITERATIONS = 20
const TUNING_ROUNDS = 5      // rounds of iterative adjustment

// ─── POC Builds ───────────────────────────────────────────────────────────────

const POC_BUILDS = [
  { damage: 7, accuracy: 1, speed: 1 },
  { damage: 1, accuracy: 7, speed: 1 },
  { damage: 1, accuracy: 1, speed: 7 },
  { damage: 3, accuracy: 3, speed: 3 },
]

// ─── Types ────────────────────────────────────────────────────────────────────

interface BotStats {
  label: string
  stars: { damage: number; accuracy: number; speed: number }
  maxHit: number
  accuracy: number
  energyPerTick: number
  hp: number
}

// ─── Stat Derivation ──────────────────────────────────────────────────────────

function deriveStats(stars: { damage: number; accuracy: number; speed: number }): BotStats {
  const raw = deriveCombatStats(stars)
  return {
    label: `${stars.damage}-${stars.accuracy}-${stars.speed}`,
    stars,
    maxHit: Math.min(raw.maxHit, MAX_HIT_CAP),
    accuracy: raw.accuracy,
    energyPerTick: raw.energyPerTick,
    hp: raw.hp,
  }
}

// ─── Simulation (both bots get their own scalar) ──────────────────────────────

function simulate1v1(
  botA: BotStats,
  scalarA: number,
  botB: BotStats,
  scalarB: number,
  trials: number
): number {
  let winsA = 0

  for (let t = 0; t < trials; t++) {
    let hpA = botA.hp
    let hpB = botB.hp
    let energyA = 0
    let energyB = 0
    let winner: "A" | "B" | null = null

    for (let tick = 1; tick <= TICK_LIMIT; tick++) {
      // Bot A
      energyA += botA.energyPerTick
      if (energyA >= 100) {
        energyA -= 100
        if (Math.floor(Math.random() * 100) + 1 <= botA.accuracy) {
          const raw = Math.floor(Math.random() * botA.maxHit) + 1
          const dmg = Math.max(1, Math.round(raw * scalarA))
          hpB = Math.max(0, hpB - dmg)
        }
        if (hpB <= 0) { winner = "A"; break }
      }

      // Bot B
      energyB += botB.energyPerTick
      if (energyB >= 100) {
        energyB -= 100
        if (Math.floor(Math.random() * 100) + 1 <= botB.accuracy) {
          const raw = Math.floor(Math.random() * botB.maxHit) + 1
          const dmg = Math.max(1, Math.round(raw * scalarB))
          hpA = Math.max(0, hpA - dmg)
        }
        if (hpA <= 0) { winner = "B"; break }
      }
    }

    if (winner === "A") { winsA++ }
    else if (winner === null) {
      // Timeout
      if (hpA > hpB) winsA++
      else if (hpA === hpB && Math.random() < 0.5) winsA++
    }
  }

  return winsA / trials
}

// ─── Measure average win rate for one build vs all others ─────────────────────

function measureAverageWinRate(
  buildIdx: number,
  bots: BotStats[],
  scalars: number[],
  trials: number
): number {
  let totalWinRate = 0
  let matchups = 0

  for (let j = 0; j < bots.length; j++) {
    if (j === buildIdx) continue
    const wr = simulate1v1(bots[buildIdx], scalars[buildIdx], bots[j], scalars[j], trials)
    totalWinRate += wr
    matchups++
  }

  return totalWinRate / matchups
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log(`\n🤖 Battle Bots — Per-Build Scalar Prototype`)
  console.log(`${"─".repeat(70)}`)
  console.log(`MaxHit cap: ${MAX_HIT_CAP}`)
  console.log(`Builds: ${POC_BUILDS.map(b => `${b.damage}-${b.accuracy}-${b.speed}`).join(", ")}`)
  console.log(`Tuning rounds: ${TUNING_ROUNDS}`)
  console.log(`Trials per measurement: ${TRIALS_PER_STEP.toLocaleString()}`)

  const bots = POC_BUILDS.map(deriveStats)
  const scalars = bots.map(() => 1.0) // start at 1.0 for all

  console.log(`\n📋 Derived Stats:`)
  console.log(`  ${"Build".padEnd(10)} ${"MaxHit".padEnd(8)} ${"Acc".padEnd(6)} ${"EPT".padEnd(6)} ${"HP"}`)
  for (const bot of bots) {
    console.log(`  ${bot.label.padEnd(10)} ${String(bot.maxHit).padEnd(8)} ${String(bot.accuracy).padEnd(6)} ${String(bot.energyPerTick).padEnd(6)} ${bot.hp}`)
  }

  // Iterative tuning: adjust each build's scalar to bring its average win rate to 50%
  console.log(`\n⏳ Iterative Per-Build Tuning...`)
  console.log(`${"─".repeat(70)}`)

  for (let round = 1; round <= TUNING_ROUNDS; round++) {
    console.log(`\n  Round ${round}:`)

    for (let i = 0; i < bots.length; i++) {
      const avgWR = measureAverageWinRate(i, bots, scalars, TRIALS_PER_STEP)
      const deviation = avgWR - TARGET_WIN_RATE

      // Adjust scalar: if winning too much, reduce; if losing, increase
      // Use proportional adjustment (damped to avoid oscillation)
      const adjustment = 1 - (deviation * 0.8)
      scalars[i] *= adjustment

      // Clamp to reasonable range
      scalars[i] = Math.max(0.3, Math.min(2.5, scalars[i]))

      const status = Math.abs(deviation) < TOLERANCE ? "✅" : deviation > 0 ? "🔺" : "🔻"
      console.log(`    ${bots[i].label}: avg WR = ${(avgWR * 100).toFixed(2)}%, scalar adjusted to ${scalars[i].toFixed(4)} ${status}`)
    }
  }

  // Final scalars
  console.log(`\n📊 Final Per-Build Scalars:`)
  console.log(`${"─".repeat(70)}`)
  console.log(`  const BUILD_SCALARS: Record<string, number> = {`)
  for (let i = 0; i < bots.length; i++) {
    console.log(`    "${bots[i].label}": ${scalars[i].toFixed(4)},`)
  }
  console.log(`  }`)

  // Validation: check every pairwise matchup with final scalars
  console.log(`\n⏳ Validating all pairwise matchups (${TRIALS_VALIDATION.toLocaleString()} trials each)...`)
  console.log(`${"─".repeat(70)}`)
  console.log(`  ${"Matchup".padEnd(18)} ${"A Win%".padEnd(10)} ${"B Win%".padEnd(10)} ${"Deviation".padEnd(12)} ${"Fair?"}`)
  console.log(`  ${"─".repeat(60)}`)

  let maxDeviation = 0
  let totalDeviation = 0
  let matchupCount = 0

  for (let i = 0; i < bots.length; i++) {
    for (let j = i + 1; j < bots.length; j++) {
      const wrA = simulate1v1(bots[i], scalars[i], bots[j], scalars[j], TRIALS_VALIDATION)
      const wrB = 1 - wrA
      const dev = Math.abs(wrA - 0.5)
      maxDeviation = Math.max(maxDeviation, dev)
      totalDeviation += dev
      matchupCount++

      const fair = dev < 0.01 ? "✅" : dev < 0.02 ? "⚠️" : "❌"
      console.log(`  ${(bots[i].label + " vs " + bots[j].label).padEnd(18)} ${(wrA * 100).toFixed(2)}%    ${(wrB * 100).toFixed(2)}%    ${(dev * 100).toFixed(2)}%        ${fair}`)
    }
  }

  console.log(`\n📈 Summary:`)
  console.log(`  Max pairwise deviation from 50%: ${(maxDeviation * 100).toFixed(2)}%`)
  console.log(`  Average deviation: ${((totalDeviation / matchupCount) * 100).toFixed(2)}%`)
  console.log(`  Verdict: ${maxDeviation < 0.02 ? "✅ Per-build scalars are sufficient!" : maxDeviation < 0.03 ? "⚠️ Close but some residual imbalance — per-matchup may be better" : "❌ Per-build scalars leave too much imbalance — need per-matchup tuning"}`)
  console.log(``)
}

main()
