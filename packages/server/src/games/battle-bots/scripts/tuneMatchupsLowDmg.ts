/**
 * Battle Bots — Per-Matchup Tuner (Low-Damage, MaxHit 33)
 *
 * Uses the low-damage modifier table (maxHit capped at 33, min 4 hits to kill)
 * with per-matchup DPS scalars to achieve precise 50% win rates.
 *
 * Both bots in a matchup receive a scalar — the tuner finds the single scalar
 * applied to bot A such that A wins exactly 50%. Bot B always uses scalar 1.0
 * during the search; the inverse is stored for the reverse lookup.
 *
 * POC builds: 7-1-1, 1-7-1, 1-1-7, 3-3-3
 *
 * Usage: npx tsx packages/server/src/games/battle-bots/scripts/tuneMatchupsLowDmg.ts
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const TICK_LIMIT = 1000
const TRIALS_SEARCH = 100_000
const TRIALS_VALIDATION = 500_000
const MAX_HIT_CAP = 33
const TARGET = 0.50
const TOLERANCE = 0.001        // ±0.1% precision
const MAX_SEARCH_ITERS = 40
const BASE_HP = 100
const BASE_MAX_HIT = 5
const BASE_ACCURACY = 56

// ─── Modifier Table (low damage, geometric speed) ─────────────────────────────

const TABLE = {
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

// ─── Stat Derivation ──────────────────────────────────────────────────────────

function deriveStats(stars: { damage: number; accuracy: number; speed: number }): BotStats {
  const d = TABLE[stars.damage as keyof typeof TABLE]
  const a = TABLE[stars.accuracy as keyof typeof TABLE]
  const s = TABLE[stars.speed as keyof typeof TABLE]

  return {
    label: `${stars.damage}-${stars.accuracy}-${stars.speed}`,
    stars,
    maxHit: Math.min(Math.max(1, Math.floor(BASE_MAX_HIT * d.damageMultiplier)), MAX_HIT_CAP),
    accuracy: Math.min(Math.floor(BASE_ACCURACY * a.accuracyMultiplier), 90),
    energyPerTick: s.attackEnergyPerTick,
    hp: BASE_HP,
  }
}

// ─── Simulation ───────────────────────────────────────────────────────────────

/**
 * Simulate A vs B. scalarA is applied to A's damage output.
 * B always fights at full strength (scalar 1.0).
 */
function simulate(botA: BotStats, scalarA: number, botB: BotStats, trials: number): number {
  let winsA = 0

  for (let t = 0; t < trials; t++) {
    let hpA = botA.hp
    let hpB = botB.hp
    let energyA = 0
    let energyB = 0
    let resolved = false

    for (let tick = 1; tick <= TICK_LIMIT; tick++) {
      // Bot A
      energyA += botA.energyPerTick
      if (energyA >= 100) {
        energyA -= 100
        if (Math.floor(Math.random() * 100) + 1 <= botA.accuracy) {
          const raw = Math.floor(Math.random() * botA.maxHit) + 1
          const dmg = Math.max(1, Math.round(raw * scalarA))
          hpB -= dmg
        }
        if (hpB <= 0) { winsA++; resolved = true; break }
      }

      // Bot B (no scalar)
      energyB += botB.energyPerTick
      if (energyB >= 100) {
        energyB -= 100
        if (Math.floor(Math.random() * 100) + 1 <= botB.accuracy) {
          const dmg = Math.floor(Math.random() * botB.maxHit) + 1
          hpA -= dmg
        }
        if (hpA <= 0) { resolved = true; break }
      }
    }

    // Timeout
    if (!resolved) {
      if (hpA > hpB) winsA++
      else if (hpA === hpB && Math.random() < 0.5) winsA++
    }
  }

  return winsA / trials
}

// ─── Binary Search ────────────────────────────────────────────────────────────

function findScalar(botA: BotStats, botB: BotStats): { scalar: number; wr: number } {
  let lo = 0.2
  let hi = 3.0
  let best = 1.0
  let bestWR = 0.5

  for (let i = 0; i < MAX_SEARCH_ITERS; i++) {
    const mid = (lo + hi) / 2
    const wr = simulate(botA, mid, botB, TRIALS_SEARCH)
    best = mid
    bestWR = wr

    if (Math.abs(wr - TARGET) < TOLERANCE) break

    if (wr > TARGET) hi = mid
    else lo = mid
  }

  return { scalar: best, wr: bestWR }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log(`\n🤖 Battle Bots — Per-Matchup Tuner (Low Damage, MaxHit ${MAX_HIT_CAP})`)
  console.log(`${"─".repeat(70)}`)
  console.log(`Precision target: 50% ±${TOLERANCE * 100}%`)
  console.log(`Search trials: ${TRIALS_SEARCH.toLocaleString()} | Validation: ${TRIALS_VALIDATION.toLocaleString()}`)
  console.log(`Builds: ${POC_BUILDS.map(b => `${b.damage}-${b.accuracy}-${b.speed}`).join(", ")}`)

  const bots = POC_BUILDS.map(deriveStats)

  // Stats
  console.log(`\n📋 Derived Stats:`)
  console.log(`  ${"Build".padEnd(10)} ${"MaxHit".padEnd(8)} ${"Acc%".padEnd(7)} ${"EPT".padEnd(6)} ${"Min Hits".padEnd(10)} ${"Atks/sec"}`)
  console.log(`  ${"─".repeat(50)}`)
  for (const b of bots) {
    const minHits = Math.ceil(BASE_HP / b.maxHit)
    const aps = (b.energyPerTick / 100) * 10
    console.log(`  ${b.label.padEnd(10)} ${String(b.maxHit).padEnd(8)} ${String(b.accuracy).padEnd(7)} ${String(b.energyPerTick).padEnd(6)} ${String(minHits).padEnd(10)} ${aps.toFixed(1)}`)
  }

  // Raw matchups
  console.log(`\n⏳ Raw matchup win rates (no correction)...`)
  console.log(`  ${"Matchup".padEnd(18)} ${"A Win%".padEnd(10)}`)
  console.log(`  ${"─".repeat(30)}`)
  for (let i = 0; i < bots.length; i++) {
    for (let j = i + 1; j < bots.length; j++) {
      const wr = simulate(bots[i], 1.0, bots[j], TRIALS_SEARCH)
      console.log(`  ${(bots[i].label + " vs " + bots[j].label).padEnd(18)} ${(wr * 100).toFixed(2)}%`)
    }
  }

  // Per-matchup binary search
  console.log(`\n⏳ Finding per-matchup scalars...`)
  console.log(`${"─".repeat(70)}`)

  interface MatchupEntry {
    a: string; b: string; scalar: number; searchWR: number
  }
  const entries: MatchupEntry[] = []

  for (let i = 0; i < bots.length; i++) {
    for (let j = i + 1; j < bots.length; j++) {
      process.stdout.write(`  ${bots[i].label} vs ${bots[j].label}: `)
      const { scalar, wr } = findScalar(bots[i], bots[j])
      console.log(`scalar = ${scalar.toFixed(5)}, search WR = ${(wr * 100).toFixed(2)}%`)
      entries.push({ a: bots[i].label, b: bots[j].label, scalar, searchWR: wr })
    }
  }

  // Validation
  console.log(`\n⏳ Validating with ${TRIALS_VALIDATION.toLocaleString()} trials...`)
  console.log(`${"─".repeat(70)}`)
  console.log(`  ${"Matchup".padEnd(18)} ${"Scalar".padEnd(10)} ${"A Win%".padEnd(10)} ${"Dev".padEnd(8)} ${"Fair?"}`)
  console.log(`  ${"─".repeat(55)}`)

  let maxDev = 0

  for (const entry of entries) {
    const botA = bots.find(b => b.label === entry.a)!
    const botB = bots.find(b => b.label === entry.b)!
    const wr = simulate(botA, entry.scalar, botB, TRIALS_VALIDATION)
    const dev = Math.abs(wr - 0.5)
    maxDev = Math.max(maxDev, dev)
    const fair = dev < 0.005 ? "✅" : dev < 0.01 ? "⚠️" : "❌"
    console.log(`  ${(entry.a + " vs " + entry.b).padEnd(18)} ${entry.scalar.toFixed(4).padEnd(10)} ${(wr * 100).toFixed(2)}%    ${(dev * 100).toFixed(2)}%    ${fair}`)
  }

  // Output the correction table
  console.log(`\n📊 MATCHUP_CORRECTIONS Table:`)
  console.log(`${"─".repeat(70)}`)
  console.log(`  // When A attacks B, multiply A's raw damage by this scalar.`)
  console.log(`  // The reverse lookup (B attacks A) uses 1/scalar.`)
  console.log(`  const MATCHUP_CORRECTIONS: Record<string, number> = {`)
  for (const e of entries) {
    console.log(`    "${e.a}_${e.b}": ${e.scalar.toFixed(5)},`)
    console.log(`    "${e.b}_${e.a}": ${(1 / e.scalar).toFixed(5)},`)
  }
  console.log(`  }`)

  console.log(`\n📈 Max validated deviation: ${(maxDev * 100).toFixed(2)}%`)
  console.log(`   Target: < 0.5%`)
  console.log(`   Verdict: ${maxDev < 0.005 ? "✅ All matchups within ±0.5%!" : maxDev < 0.01 ? "⚠️ Close — within ±1%" : "❌ Some matchups need tighter search"}`)
  console.log(``)
}

main()
