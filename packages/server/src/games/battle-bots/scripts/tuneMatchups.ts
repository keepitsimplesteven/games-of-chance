/**
 * Battle Bots — Per-Matchup Fine-Tuning Prototype
 *
 * Explores per-matchup DPS scalars to achieve exactly 50% win rate for every
 * 1v1 pairing. Proof-of-concept with 4 builds: 7-1-1, 1-7-1, 1-1-7, 3-3-3.
 *
 * Approach:
 *   - Stars still drive base stat derivation (the "feel" layer)
 *   - MaxHit is capped at 90 (no one-shots on 100 HP bots)
 *   - For each matchup (A vs B), binary-search a DPS scalar applied to bot A's
 *     damage output that brings the matchup to 50% win rate
 *   - The scalar for A vs B implies the inverse for B vs A
 *
 * Usage: npx tsx packages/server/src/games/battle-bots/scripts/tuneMatchups.ts
 */

import { deriveCombatStats, BASE_HP } from "../ModifierTable"

// ─── Constants ────────────────────────────────────────────────────────────────

const TICK_LIMIT = 1000
const TRIALS_PER_SEARCH_STEP = 50_000    // trials per binary search iteration
const TRIALS_VALIDATION = 500_000        // trials for final validation
const MAX_HIT_CAP = 90                   // no one-shots allowed
const TARGET_WIN_RATE = 0.50
const TOLERANCE = 0.002                  // ±0.2% is close enough
const MAX_SEARCH_ITERATIONS = 30
const MAX_SCALAR = 2.0                   // cap scalar range
const MIN_SCALAR = 0.3

// ─── Proof-of-concept builds ──────────────────────────────────────────────────

const POC_BUILDS = [
  { damage: 7, accuracy: 1, speed: 1 },  // "Glass Cannon" — huge hits, slow, inaccurate
  { damage: 1, accuracy: 7, speed: 1 },  // "Sharpshooter" — small hits, very accurate, slow
  { damage: 1, accuracy: 1, speed: 7 },  // "Speedster"    — small hits, inaccurate, very fast
  { damage: 3, accuracy: 3, speed: 3 },  // "Balanced"     — middle of the road
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

interface MatchupResult {
  botA: string
  botB: string
  rawWinRateA: number         // without any scalar
  tunedScalar: number         // scalar applied to A's damage to reach 50%
  validatedWinRateA: number   // win rate after applying scalar (validation run)
}

// ─── Stat Derivation (with maxHit cap) ────────────────────────────────────────

function deriveStats(stars: { damage: number; accuracy: number; speed: number }): BotStats {
  const raw = deriveCombatStats(stars)
  const maxHit = Math.min(raw.maxHit, MAX_HIT_CAP)  // cap at 90

  const label = `${stars.damage}-${stars.accuracy}-${stars.speed}`
  return {
    label,
    stars,
    maxHit,
    accuracy: raw.accuracy,
    energyPerTick: raw.energyPerTick,
    hp: raw.hp,
  }
}

// ─── Simulation ───────────────────────────────────────────────────────────────

/**
 * Simulate a 1v1 matchup with optional DPS scalar applied to bot A's damage.
 * Returns win rate for bot A over `trials` runs.
 */
function simulateMatchup(
  botA: BotStats,
  botB: BotStats,
  scalarA: number,
  trials: number
): number {
  let winsA = 0

  for (let t = 0; t < trials; t++) {
    let hpA = botA.hp
    let hpB = botB.hp
    let energyA = 0
    let energyB = 0

    for (let tick = 1; tick <= TICK_LIMIT; tick++) {
      // Bot A accumulates energy and attacks
      energyA += botA.energyPerTick
      if (energyA >= 100) {
        energyA -= 100
        const hit = Math.floor(Math.random() * 100) + 1 <= botA.accuracy
        if (hit) {
          // Apply scalar to A's damage
          const rawDamage = Math.floor(Math.random() * botA.maxHit) + 1
          const damage = Math.max(1, Math.round(rawDamage * scalarA))
          hpB = Math.max(0, hpB - damage)
        }
        if (hpB <= 0) { winsA++; break }
      }

      // Bot B accumulates energy and attacks (no scalar — B uses base stats)
      energyB += botB.energyPerTick
      if (energyB >= 100) {
        energyB -= 100
        const hit = Math.floor(Math.random() * 100) + 1 <= botB.accuracy
        if (hit) {
          const damage = Math.floor(Math.random() * botB.maxHit) + 1
          hpB !== undefined // just to keep flow — B attacks A
          hpA = Math.max(0, hpA - damage)
        }
        if (hpA <= 0) { break } // B wins, don't increment winsA
      }
    }

    // Timeout: whoever has more HP wins
    if (hpA > 0 && hpB > 0) {
      if (hpA > hpB) winsA++
      else if (hpA === hpB) {
        // Coin flip on tie
        if (Math.random() < 0.5) winsA++
      }
    }
  }

  return winsA / trials
}

// ─── Binary Search for Scalar ─────────────────────────────────────────────────

/**
 * Binary-search the DPS scalar for bot A that produces ~50% win rate vs bot B.
 * Returns the scalar value.
 */
function findScalar(botA: BotStats, botB: BotStats): { scalar: number; winRate: number } {
  let lo = MIN_SCALAR
  let hi = MAX_SCALAR
  let bestScalar = 1.0
  let bestWinRate = 0.5

  for (let iter = 0; iter < MAX_SEARCH_ITERATIONS; iter++) {
    const mid = (lo + hi) / 2
    const winRate = simulateMatchup(botA, botB, mid, TRIALS_PER_SEARCH_STEP)

    bestScalar = mid
    bestWinRate = winRate

    if (Math.abs(winRate - TARGET_WIN_RATE) < TOLERANCE) {
      break // close enough
    }

    if (winRate > TARGET_WIN_RATE) {
      // A is winning too much, reduce scalar
      hi = mid
    } else {
      // A is losing too much, increase scalar
      lo = mid
    }
  }

  return { scalar: bestScalar, winRate: bestWinRate }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log(`\n🤖 Battle Bots — Per-Matchup Fine-Tuning Prototype`)
  console.log(`${"─".repeat(70)}`)
  console.log(`MaxHit cap: ${MAX_HIT_CAP} (no one-shots)`)
  console.log(`Target win rate: ${TARGET_WIN_RATE * 100}% (±${TOLERANCE * 100}%)`)
  console.log(`Trials per search step: ${TRIALS_PER_SEARCH_STEP.toLocaleString()}`)
  console.log(`Validation trials: ${TRIALS_VALIDATION.toLocaleString()}`)
  console.log(`Proof-of-concept builds: ${POC_BUILDS.map(b => `${b.damage}-${b.accuracy}-${b.speed}`).join(", ")}`)

  // Derive stats
  const bots = POC_BUILDS.map(deriveStats)

  console.log(`\n📋 Derived Stats (with maxHit cap at ${MAX_HIT_CAP}):`)
  console.log(`${"─".repeat(70)}`)
  console.log(`  ${"Build".padEnd(10)} ${"MaxHit".padEnd(8)} ${"Accuracy".padEnd(10)} ${"EnergyPerTick".padEnd(15)} ${"HP"}`)
  console.log(`  ${"─".repeat(55)}`)
  for (const bot of bots) {
    console.log(`  ${bot.label.padEnd(10)} ${String(bot.maxHit).padEnd(8)} ${String(bot.accuracy).padEnd(10)} ${String(bot.energyPerTick).padEnd(15)} ${bot.hp}`)
  }

  // Phase 1: Raw matchups (no scalar) to see baseline
  console.log(`\n⏳ Phase 1: Measuring raw matchup win rates (scalar = 1.0)...`)
  console.log(`${"─".repeat(70)}`)
  console.log(`  ${"A vs B".padEnd(16)} ${"A Win Rate".padEnd(12)} ${"Fair?"}`)
  console.log(`  ${"─".repeat(40)}`)

  const rawResults: Array<{ a: BotStats; b: BotStats; winRateA: number }> = []

  for (let i = 0; i < bots.length; i++) {
    for (let j = i + 1; j < bots.length; j++) {
      const winRateA = simulateMatchup(bots[i], bots[j], 1.0, TRIALS_PER_SEARCH_STEP)
      rawResults.push({ a: bots[i], b: bots[j], winRateA })
      const fair = Math.abs(winRateA - 0.5) < TOLERANCE ? "✅" : "❌"
      console.log(`  ${(bots[i].label + " vs " + bots[j].label).padEnd(16)} ${(winRateA * 100).toFixed(2)}%      ${fair}`)
    }
  }

  // Phase 2: Binary search per-matchup scalars
  console.log(`\n⏳ Phase 2: Binary-searching per-matchup DPS scalars...`)
  console.log(`${"─".repeat(70)}`)

  const matchupScalars: MatchupResult[] = []

  for (let i = 0; i < bots.length; i++) {
    for (let j = i + 1; j < bots.length; j++) {
      const botA = bots[i]
      const botB = bots[j]

      process.stdout.write(`  Tuning ${botA.label} vs ${botB.label}... `)
      const { scalar, winRate } = findScalar(botA, botB)
      console.log(`scalar = ${scalar.toFixed(4)}, search win rate = ${(winRate * 100).toFixed(2)}%`)

      matchupScalars.push({
        botA: botA.label,
        botB: botB.label,
        rawWinRateA: rawResults.find(r => r.a === botA && r.b === botB)!.winRateA,
        tunedScalar: scalar,
        validatedWinRateA: 0, // filled in phase 3
      })
    }
  }

  // Phase 3: Validate with higher trial count
  console.log(`\n⏳ Phase 3: Validating scalars with ${TRIALS_VALIDATION.toLocaleString()} trials...`)
  console.log(`${"─".repeat(70)}`)
  console.log(`  ${"Matchup".padEnd(16)} ${"Raw A%".padEnd(10)} ${"Scalar".padEnd(10)} ${"Validated A%".padEnd(14)} ${"Fair?"}`)
  console.log(`  ${"─".repeat(60)}`)

  for (const result of matchupScalars) {
    const botA = bots.find(b => b.label === result.botA)!
    const botB = bots.find(b => b.label === result.botB)!
    const validatedWinRate = simulateMatchup(botA, botB, result.tunedScalar, TRIALS_VALIDATION)
    result.validatedWinRateA = validatedWinRate

    const fair = Math.abs(validatedWinRate - 0.5) < TOLERANCE ? "✅" : "⚠️"
    console.log(`  ${(result.botA + " vs " + result.botB).padEnd(16)} ${(result.rawWinRateA * 100).toFixed(1)}%     ${result.tunedScalar.toFixed(4)}    ${(validatedWinRate * 100).toFixed(2)}%        ${fair}`)
  }

  // Summary: Output the correction table
  console.log(`\n📊 Per-Matchup Correction Table (prototype):`)
  console.log(`${"─".repeat(70)}`)
  console.log(`  // Key: "botA_botB" → scalar applied to bot A's damage when fighting bot B`)
  console.log(`  // Inverse: bot B gets scalar (1/s) when it's the "A" in a reversed lookup`)
  console.log(`  const MATCHUP_CORRECTIONS = {`)
  for (const result of matchupScalars) {
    const inverseScalar = 1 / result.tunedScalar
    console.log(`    "${result.botA}_${result.botB}": ${result.tunedScalar.toFixed(4)},  // A raw: ${(result.rawWinRateA * 100).toFixed(1)}% → validated: ${(result.validatedWinRateA * 100).toFixed(2)}%`)
    console.log(`    "${result.botB}_${result.botA}": ${inverseScalar.toFixed(4)},  // (inverse)`)
  }
  console.log(`  }`)

  // Note on how this would work in the real engine
  console.log(`\n💡 Integration Notes:`)
  console.log(`${"─".repeat(70)}`)
  console.log(`  - In the real BattleEngine, before applying damage, look up the scalar:`)
  console.log(`    const key = buildKey(attacker) + "_" + buildKey(target)`)
  console.log(`    const scalar = MATCHUP_CORRECTIONS[key] ?? 1.0`)
  console.log(`    const finalDamage = Math.max(1, Math.round(rawDamage * scalar))`)
  console.log(`  - Stars still drive the "feel" (fast bot feels fast, heavy feels heavy)`)
  console.log(`  - The scalar only nudges damage output to equalize win rates`)
  console.log(`  - For FFA: could use average scalar across all opponents, or skip corrections`)
  console.log(`  - Full table: 28 builds × 27 opponents = 756 entries (378 unique pairs)`)
  console.log(``)
}

main()
