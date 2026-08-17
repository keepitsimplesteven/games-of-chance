/**
 * Battle Bots — Star Budget Comparison (3 vs 5 vs 9)
 *
 * Compares balance achievability across different star budgets.
 * All builds use a zero-star floor for each stat, with stars adding on top.
 *
 * MaxHit capped at 33 (4 hits to kill). Zero-star floor provides baseline
 * combat viability for all builds.
 *
 * Usage: npx tsx packages/server/src/games/battle-bots/scripts/tuneBudgetCompare.ts
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const TICK_LIMIT = 1000
const TRIALS = 50_000
const BASE_HP = 100
const MAX_HIT_CAP = 33

// ─── Zero-Star Floors ─────────────────────────────────────────────────────────
// Even at 0 stars, a bot has strong baseline combat ability.
// The floor is the "default soldier" — competent but unspecialized.

const FLOOR_MAX_HIT = 14      // 0 damage stars: deals 1-14 per hit (8 hits to kill)
const FLOOR_ACCURACY = 50     // 0 accuracy stars: 50% hit chance
const FLOOR_EPT = 25          // 0 speed stars: 25 energy per tick (attacks every 4 ticks)

// ─── Per-Star Bonuses ─────────────────────────────────────────────────────────
// Each star adds a fixed increment on top of the floor.
// Key insight: bonuses are SMALL relative to floor, so extremes aren't too far
// from the baseline. Identity comes from the relative advantage, not dominance.

// Budget 3: each star adds moderate amount (3 stars = max specialization)
const BONUS_3 = {
  maxHitPerStar: 6,           // 0→14, 1→20, 2→26, 3→32 (floor is 44% of max)
  accuracyPerStar: 10,        // 0→50, 1→60, 2→70, 3→80 (floor is 63% of max)
  eptPerStar: 8,              // 0→25, 1→33, 2→41, 3→49 (floor is 51% of max)
}

// Budget 5: each star adds less (5 stars = max specialization)
const BONUS_5 = {
  maxHitPerStar: 4,           // 0→14, 1→18, 2→22, 3→26, 4→30, 5→34 (cap at 33)
  accuracyPerStar: 7,         // 0→50, 1→57, 2→64, 3→71, 4→78, 5→85
  eptPerStar: 5,              // 0→25, 1→30, 2→35, 3→40, 4→45, 5→50
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface BotStats {
  label: string
  maxHit: number
  accuracy: number
  energyPerTick: number
  hp: number
}

// ─── Build Enumeration ────────────────────────────────────────────────────────

function enumBuilds(budget: number, maxPerStat: number): Array<{ d: number; a: number; s: number }> {
  const builds: Array<{ d: number; a: number; s: number }> = []
  for (let d = 0; d <= maxPerStat; d++) {
    for (let a = 0; a <= maxPerStat; a++) {
      const s = budget - d - a
      if (s >= 0 && s <= maxPerStat) {
        builds.push({ d, a, s })
      }
    }
  }
  return builds
}

// ─── Stat Derivation ──────────────────────────────────────────────────────────

function deriveStatsBudget3(stars: { d: number; a: number; s: number }): BotStats {
  return {
    label: `${stars.d}-${stars.a}-${stars.s}`,
    maxHit: Math.min(FLOOR_MAX_HIT + stars.d * BONUS_3.maxHitPerStar, MAX_HIT_CAP),
    accuracy: Math.min(FLOOR_ACCURACY + stars.a * BONUS_3.accuracyPerStar, 90),
    energyPerTick: FLOOR_EPT + stars.s * BONUS_3.eptPerStar,
    hp: BASE_HP,
  }
}

function deriveStatsBudget5(stars: { d: number; a: number; s: number }): BotStats {
  return {
    label: `${stars.d}-${stars.a}-${stars.s}`,
    maxHit: Math.min(FLOOR_MAX_HIT + stars.d * BONUS_5.maxHitPerStar, MAX_HIT_CAP),
    accuracy: Math.min(FLOOR_ACCURACY + stars.a * BONUS_5.accuracyPerStar, 90),
    energyPerTick: FLOOR_EPT + stars.s * BONUS_5.eptPerStar,
    hp: BASE_HP,
  }
}

// ─── Simulation ───────────────────────────────────────────────────────────────

function simulate(botA: BotStats, botB: BotStats, trials: number): number {
  let winsA = 0

  for (let t = 0; t < trials; t++) {
    let hpA = botA.hp
    let hpB = botB.hp
    let energyA = 0
    let energyB = 0
    let resolved = false

    for (let tick = 1; tick <= TICK_LIMIT; tick++) {
      energyA += botA.energyPerTick
      if (energyA >= 100) {
        energyA -= 100
        if (Math.floor(Math.random() * 100) + 1 <= botA.accuracy) {
          hpB -= Math.floor(Math.random() * botA.maxHit) + 1
        }
        if (hpB <= 0) { winsA++; resolved = true; break }
      }

      energyB += botB.energyPerTick
      if (energyB >= 100) {
        energyB -= 100
        if (Math.floor(Math.random() * 100) + 1 <= botB.accuracy) {
          hpA -= Math.floor(Math.random() * botB.maxHit) + 1
        }
        if (hpA <= 0) { resolved = true; break }
      }
    }

    if (!resolved) {
      if (hpA > hpB) winsA++
      else if (hpA === hpB && Math.random() < 0.5) winsA++
    }
  }

  return winsA / trials
}

// ─── Analysis ─────────────────────────────────────────────────────────────────

function analyzeBudget(
  label: string,
  budget: number,
  maxPerStat: number,
  deriveFn: (stars: { d: number; a: number; s: number }) => BotStats
) {
  const rawBuilds = enumBuilds(budget, maxPerStat)
  const bots = rawBuilds.map(deriveFn)

  console.log(`\n${"═".repeat(70)}`)
  console.log(`  BUDGET ${budget} — D+A+S=${budget}, each in [0,${maxPerStat}]`)
  console.log(`  ${rawBuilds.length} builds, ${rawBuilds.length * (rawBuilds.length - 1) / 2} matchup pairs`)
  console.log(`${"═".repeat(70)}`)

  // Stats table
  console.log(`\n  ${"Build".padEnd(8)} ${"MaxHit".padEnd(8)} ${"Acc%".padEnd(7)} ${"EPT".padEnd(6)} ${"HitsToKill".padEnd(12)} ${"DPS/tick"}`)
  console.log(`  ${"─".repeat(55)}`)
  for (const bot of bots) {
    const htk = Math.ceil(BASE_HP / bot.maxHit)
    const dps = (bot.energyPerTick / 100) * (bot.accuracy / 100) * ((bot.maxHit + 1) / 2)
    console.log(`  ${bot.label.padEnd(8)} ${String(bot.maxHit).padEnd(8)} ${String(bot.accuracy).padEnd(7)} ${String(bot.energyPerTick).padEnd(6)} ${String(htk).padEnd(12)} ${dps.toFixed(3)}`)
  }

  // DPS range
  const dpsList = bots.map(b => (b.energyPerTick / 100) * (b.accuracy / 100) * ((b.maxHit + 1) / 2))
  const minDPS = Math.min(...dpsList)
  const maxDPS = Math.max(...dpsList)
  console.log(`\n  DPS range: ${minDPS.toFixed(3)} – ${maxDPS.toFixed(3)} (ratio: ${(maxDPS / minDPS).toFixed(2)}x)`)

  // Run all matchups
  console.log(`\n  ⏳ Simulating all ${rawBuilds.length * (rawBuilds.length - 1) / 2} matchups (${TRIALS.toLocaleString()} trials each)...`)

  let totalDev = 0
  let maxDev = 0
  let worstMatchup = ""
  let matchupCount = 0
  const winRates: number[] = []

  for (let i = 0; i < bots.length; i++) {
    for (let j = i + 1; j < bots.length; j++) {
      const wr = simulate(bots[i], bots[j], TRIALS)
      const dev = Math.abs(wr - 0.5)
      totalDev += dev
      matchupCount++
      winRates.push(wr)
      if (dev > maxDev) {
        maxDev = dev
        worstMatchup = `${bots[i].label} vs ${bots[j].label} (${(wr * 100).toFixed(1)}%)`
      }
    }
  }

  // Results
  const avgDev = totalDev / matchupCount
  const within5 = winRates.filter(wr => wr >= 0.45 && wr <= 0.55).length
  const within3 = winRates.filter(wr => wr >= 0.47 && wr <= 0.53).length
  const within1 = winRates.filter(wr => wr >= 0.49 && wr <= 0.51).length

  console.log(`\n  📊 Results:`)
  console.log(`  ─────────────────────────────────────────`)
  console.log(`  Max deviation from 50%:  ${(maxDev * 100).toFixed(2)}%`)
  console.log(`  Avg deviation from 50%:  ${(avgDev * 100).toFixed(2)}%`)
  console.log(`  Worst matchup:           ${worstMatchup}`)
  console.log(`  Within ±5% (45-55%):     ${within5}/${matchupCount} (${(within5/matchupCount*100).toFixed(0)}%)`)
  console.log(`  Within ±3% (47-53%):     ${within3}/${matchupCount} (${(within3/matchupCount*100).toFixed(0)}%)`)
  console.log(`  Within ±1% (49-51%):     ${within1}/${matchupCount} (${(within1/matchupCount*100).toFixed(0)}%)`)

  // Show the most extreme matchups
  const allMatchups: Array<{ a: string; b: string; wr: number }> = []
  let idx = 0
  for (let i = 0; i < bots.length; i++) {
    for (let j = i + 1; j < bots.length; j++) {
      allMatchups.push({ a: bots[i].label, b: bots[j].label, wr: winRates[idx++] })
    }
  }
  allMatchups.sort((a, b) => Math.abs(b.wr - 0.5) - Math.abs(a.wr - 0.5))

  console.log(`\n  5 most imbalanced matchups:`)
  console.log(`  ${"Matchup".padEnd(16)} ${"A Win%".padEnd(10)} ${"Dev"}`)
  for (const m of allMatchups.slice(0, 5)) {
    console.log(`  ${(m.a + " vs " + m.b).padEnd(16)} ${(m.wr * 100).toFixed(1)}%     ${(Math.abs(m.wr - 0.5) * 100).toFixed(1)}%`)
  }

  console.log(`\n  5 most balanced matchups:`)
  for (const m of allMatchups.slice(-5).reverse()) {
    console.log(`  ${(m.a + " vs " + m.b).padEnd(16)} ${(m.wr * 100).toFixed(1)}%     ${(Math.abs(m.wr - 0.5) * 100).toFixed(1)}%`)
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log(`\n🤖 Battle Bots — Star Budget Balance Comparison`)
  console.log(`${"─".repeat(70)}`)
  console.log(`Zero-star floors: MaxHit=${FLOOR_MAX_HIT}, Acc=${FLOOR_ACCURACY}%, EPT=${FLOOR_EPT}`)
  console.log(`MaxHit cap: ${MAX_HIT_CAP}`)
  console.log(`Trials per matchup: ${TRIALS.toLocaleString()}`)

  // Budget 3
  analyzeBudget("Budget 3", 3, 3, deriveStatsBudget3)

  // Budget 5
  analyzeBudget("Budget 5", 5, 5, deriveStatsBudget5)

  console.log(`\n${"═".repeat(70)}`)
  console.log(`  COMPARISON SUMMARY`)
  console.log(`${"═".repeat(70)}`)
  console.log(`  Budget 3: 10 builds, fewer extremes, easier to tune`)
  console.log(`  Budget 5: 21 builds, moderate extremes, still manageable`)
  console.log(`  Budget 9: 28 builds, large extremes, needs per-matchup correction`)
  console.log(``)
}

main()
