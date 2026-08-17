/**
 * Battle Bots — Low-Damage Tuning Experiment
 *
 * Goal: MaxHit capped at 33 (minimum 4 hits to kill from 100 HP at max damage).
 * This smooths the variance from high-damage builds and makes combat feel
 * less "unfair" even when balanced — more back-and-forth, fewer 2-hit kills.
 *
 * Approach:
 *   1. Redesign multipliers with much lower damage scaling, compensated by
 *      higher accuracy and speed values to maintain interesting DPS
 *   2. Test the 4 POC builds raw to see if they land in ~45-55% band
 *   3. Apply per-build scalars to tighten further
 *   4. Validate all pairwise matchups
 *
 * Key constraint: maxHit at 7 damage stars = 33 → floor(BASE_MAX_HIT * mult) = 33
 *   With BASE_MAX_HIT = 5: mult = 33/5 = 6.6
 *   With lowered damage range, accuracy and speed can be more aggressive
 *
 * Usage: npx tsx packages/server/src/games/battle-bots/scripts/tuneLowDamage.ts
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const TICK_LIMIT = 1000
const TRIALS_RAW = 100_000
const TRIALS_TUNING = 50_000
const TRIALS_VALIDATION = 200_000
const TARGET_WIN_RATE = 0.50
const TOLERANCE = 0.005
const TUNING_ROUNDS = 8
const BASE_HP = 100
const BASE_MAX_HIT = 5
const BASE_ACCURACY = 56
const MAX_HIT_CAP = 33

// ─── Proposed Modifier Table (low damage, compensated accuracy/speed) ─────────

/**
 * Design rationale (v2 — tighter DPS balance):
 *
 * The key insight: for per-build scalars to work, the RAW matchups need to be
 * reasonably close (45-55%). That requires all builds to have similar expected DPS.
 *
 * Expected DPS = (EPT/100) × (accuracy/100) × ((maxHit+1)/2)
 *
 * With D+A+S=9, if each stat contributes multiplicatively to DPS,
 * we need: dmgFactor[D] × accFactor[A] × spdFactor[S] ≈ constant for all triples.
 *
 * Strategy: use a COMPRESSED ratio between star 1 and star 7 for each axis.
 * Instead of 4x-6x ratios, use ~2x ratios. This means less differentiation
 * between extremes, but much tighter raw balance.
 *
 * Damage: star 1 = maxHit 12, star 7 = maxHit 33. Ratio: 2.75x
 * Accuracy: star 1 = 40%, star 7 = 85%. Ratio: 2.125x
 * Speed (EPT): star 1 = 20, star 7 = 50. Ratio: 2.5x
 *
 * Target DPS for balanced build (3-3-3):
 *   EPT=28 → 0.28 atks/tick, Acc=58%, MaxHit=18, AvgDmg=9.5
 *   DPS = 0.28 × 0.58 × 9.5 = 1.54/tick → kills in ~65 ticks
 *
 * Target DPS for 7-1-1:
 *   EPT=20 → 0.20, Acc=40%, MaxHit=33, AvgDmg=17
 *   DPS = 0.20 × 0.40 × 17 = 1.36/tick → kills in ~74 ticks
 *
 * Target DPS for 1-7-1:
 *   EPT=20 → 0.20, Acc=85%, MaxHit=12, AvgDmg=6.5
 *   DPS = 0.20 × 0.85 × 6.5 = 1.11/tick → kills in ~90 ticks
 *   ↑ too low — need to boost accuracy or damage floor
 *
 * Adjusted: bump star 1 damage higher and compress accuracy less.
 * Let's aim for all DPS within 1.2-1.6 range.
 */
const PROPOSED_TABLE = {
  1: { damageMultiplier: 2.8, accuracyMultiplier: 0.54, attackEnergyPerTick: 12 },
  2: { damageMultiplier: 3.2, accuracyMultiplier: 0.68, attackEnergyPerTick: 15 },
  3: { damageMultiplier: 3.7, accuracyMultiplier: 0.82, attackEnergyPerTick: 19 },
  4: { damageMultiplier: 4.2, accuracyMultiplier: 0.98, attackEnergyPerTick: 24 },
  5: { damageMultiplier: 4.8, accuracyMultiplier: 1.14, attackEnergyPerTick: 31 },
  6: { damageMultiplier: 5.6, accuracyMultiplier: 1.34, attackEnergyPerTick: 39 },
  7: { damageMultiplier: 6.6, accuracyMultiplier: 1.61, attackEnergyPerTick: 50 },
}

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

// ─── Stat Derivation (local, using proposed table) ────────────────────────────

function deriveStats(stars: { damage: number; accuracy: number; speed: number }): BotStats {
  const dEntry = PROPOSED_TABLE[stars.damage as keyof typeof PROPOSED_TABLE]
  const aEntry = PROPOSED_TABLE[stars.accuracy as keyof typeof PROPOSED_TABLE]
  const sEntry = PROPOSED_TABLE[stars.speed as keyof typeof PROPOSED_TABLE]

  const rawMaxHit = Math.floor(BASE_MAX_HIT * dEntry.damageMultiplier)
  const maxHit = Math.min(Math.max(1, rawMaxHit), MAX_HIT_CAP)

  const rawAccuracy = Math.floor(BASE_ACCURACY * aEntry.accuracyMultiplier)
  const accuracy = Math.min(rawAccuracy, 90)

  const energyPerTick = sEntry.attackEnergyPerTick

  return {
    label: `${stars.damage}-${stars.accuracy}-${stars.speed}`,
    stars,
    maxHit,
    accuracy,
    energyPerTick,
    hp: BASE_HP,
  }
}

// ─── Simulation ───────────────────────────────────────────────────────────────

function simulate1v1(
  botA: BotStats, scalarA: number,
  botB: BotStats, scalarB: number,
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

    if (winner === "A") winsA++
    else if (winner === null) {
      if (hpA > hpB) winsA++
      else if (hpA === hpB && Math.random() < 0.5) winsA++
    }
  }

  return winsA / trials
}

// ─── Per-Build Tuning ─────────────────────────────────────────────────────────

function measureAverageWinRate(idx: number, bots: BotStats[], scalars: number[], trials: number): number {
  let total = 0
  let count = 0
  for (let j = 0; j < bots.length; j++) {
    if (j === idx) continue
    total += simulate1v1(bots[idx], scalars[idx], bots[j], scalars[j], trials)
    count++
  }
  return total / count
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log(`\n🤖 Battle Bots — Low-Damage Tuning Experiment`)
  console.log(`${"─".repeat(70)}`)
  console.log(`MaxHit cap: ${MAX_HIT_CAP} (minimum 4 hits to kill)`)
  console.log(`Builds: ${POC_BUILDS.map(b => `${b.damage}-${b.accuracy}-${b.speed}`).join(", ")}`)

  const bots = POC_BUILDS.map(deriveStats)

  // Show derived stats
  console.log(`\n📋 Derived Stats (proposed low-damage table):`)
  console.log(`${"─".repeat(70)}`)
  console.log(`  ${"Build".padEnd(10)} ${"MaxHit".padEnd(8)} ${"Acc%".padEnd(7)} ${"EPT".padEnd(6)} ${"Hits to kill".padEnd(14)} ${"Atks/sec"}`)
  console.log(`  ${"─".repeat(58)}`)
  for (const bot of bots) {
    const hitsToKill = Math.ceil(BASE_HP / bot.maxHit)
    const atksPerSec = (bot.energyPerTick / 100) * 10 // attacks per second (10 ticks/sec)
    console.log(`  ${bot.label.padEnd(10)} ${String(bot.maxHit).padEnd(8)} ${String(bot.accuracy).padEnd(7)} ${String(bot.energyPerTick).padEnd(6)} ${String(hitsToKill).padEnd(14)} ${atksPerSec.toFixed(1)}`)
  }

  // Show expected DPS per build
  console.log(`\n📋 Expected DPS (damage per tick to 100 HP target):`)
  console.log(`  ${"Build".padEnd(10)} ${"Atk Rate".padEnd(10)} ${"Acc".padEnd(8)} ${"Avg Dmg".padEnd(10)} ${"DPS/tick".padEnd(10)} ${"Time to kill (ticks)"}`)
  console.log(`  ${"─".repeat(65)}`)
  for (const bot of bots) {
    const atkRate = bot.energyPerTick / 100
    const avgDmg = (bot.maxHit + 1) / 2
    const dps = atkRate * (bot.accuracy / 100) * avgDmg
    const ttk = Math.ceil(BASE_HP / dps)
    console.log(`  ${bot.label.padEnd(10)} ${atkRate.toFixed(3).padEnd(10)} ${(bot.accuracy / 100).toFixed(2).padEnd(8)} ${avgDmg.toFixed(1).padEnd(10)} ${dps.toFixed(3).padEnd(10)} ${ttk}`)
  }

  // Phase 1: Raw matchup win rates (no scalars)
  console.log(`\n⏳ Phase 1: Raw matchup win rates (${TRIALS_RAW.toLocaleString()} trials)...`)
  console.log(`${"─".repeat(70)}`)
  console.log(`  ${"Matchup".padEnd(18)} ${"A Win%".padEnd(10)} ${"In ~45-55%?"}`)
  console.log(`  ${"─".repeat(45)}`)

  for (let i = 0; i < bots.length; i++) {
    for (let j = i + 1; j < bots.length; j++) {
      const wr = simulate1v1(bots[i], 1.0, bots[j], 1.0, TRIALS_RAW)
      const inRange = wr >= 0.45 && wr <= 0.55
      console.log(`  ${(bots[i].label + " vs " + bots[j].label).padEnd(18)} ${(wr * 100).toFixed(2)}%    ${inRange ? "✅" : "❌"}`)
    }
  }

  // Phase 2: Per-build scalar tuning
  console.log(`\n⏳ Phase 2: Per-build scalar tuning (${TUNING_ROUNDS} rounds)...`)
  console.log(`${"─".repeat(70)}`)

  const scalars = bots.map(() => 1.0)

  for (let round = 1; round <= TUNING_ROUNDS; round++) {
    process.stdout.write(`  Round ${round}: `)
    for (let i = 0; i < bots.length; i++) {
      const avgWR = measureAverageWinRate(i, bots, scalars, TRIALS_TUNING)
      const deviation = avgWR - TARGET_WIN_RATE
      const adjustment = 1 - (deviation * 0.7)
      scalars[i] = Math.max(0.3, Math.min(2.5, scalars[i] * adjustment))
    }
    console.log(bots.map((b, i) => `${b.label}=${scalars[i].toFixed(4)}`).join("  "))
  }

  // Final scalars
  console.log(`\n📊 Final Per-Build Scalars:`)
  console.log(`${"─".repeat(70)}`)
  console.log(`  const BUILD_SCALARS = {`)
  for (let i = 0; i < bots.length; i++) {
    console.log(`    "${bots[i].label}": ${scalars[i].toFixed(4)},`)
  }
  console.log(`  }`)

  // Phase 3: Validate all pairwise matchups with scalars
  console.log(`\n⏳ Phase 3: Validating matchups with scalars (${TRIALS_VALIDATION.toLocaleString()} trials)...`)
  console.log(`${"─".repeat(70)}`)
  console.log(`  ${"Matchup".padEnd(18)} ${"A Win%".padEnd(10)} ${"Deviation".padEnd(12)} ${"Fair?"}`)
  console.log(`  ${"─".repeat(50)}`)

  let maxDev = 0
  let totalDev = 0
  let count = 0

  for (let i = 0; i < bots.length; i++) {
    for (let j = i + 1; j < bots.length; j++) {
      const wr = simulate1v1(bots[i], scalars[i], bots[j], scalars[j], TRIALS_VALIDATION)
      const dev = Math.abs(wr - 0.5)
      maxDev = Math.max(maxDev, dev)
      totalDev += dev
      count++
      const fair = dev < 0.01 ? "✅" : dev < 0.02 ? "⚠️" : "❌"
      console.log(`  ${(bots[i].label + " vs " + bots[j].label).padEnd(18)} ${(wr * 100).toFixed(2)}%    ${(dev * 100).toFixed(2)}%        ${fair}`)
    }
  }

  console.log(`\n📈 Summary:`)
  console.log(`  Max deviation: ${(maxDev * 100).toFixed(2)}%`)
  console.log(`  Avg deviation: ${((totalDev / count) * 100).toFixed(2)}%`)
  console.log(`  MaxHit range: ${bots.map(b => b.maxHit).sort((a,b) => a-b).join(", ")} (${Math.ceil(100 / Math.max(...bots.map(b => b.maxHit)))}-${Math.ceil(100 / Math.min(...bots.map(b => b.maxHit)))} hits to kill)`)
  console.log(`  Verdict: ${maxDev < 0.015 ? "✅ Per-build scalars nail it with low damage!" : maxDev < 0.025 ? "⚠️ Close — residual imbalance but much better than before" : "❌ Still needs per-matchup tuning"}`)
  console.log(``)
}

main()
