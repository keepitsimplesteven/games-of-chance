/**
 * Battle Bots — Full 1v1 Per-Matchup Scalar Tuning (All 378 Pairs)
 *
 * Uses Table E5 values. For each of the 378 unique 1v1 matchups, binary-searches
 * a DPS scalar applied to bot A's damage that produces 50% win rate.
 *
 * Process:
 *   1. For each pair (A, B): binary-search scalar for A such that A wins 50%
 *   2. Store scalar. Inverse (1/scalar) is used when B is the attacker vs A.
 *   3. Validate all 378 pairs at high trial count
 *
 * Usage: npx tsx packages/server/src/games/battle-bots/scripts/tune1v1Matchups.ts
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const TICK_LIMIT = 1000
const SEARCH_TRIALS = 200_000
const VALIDATION_TRIALS = 1_000_000
const MAX_SEARCH_ITERS = 35
const TARGET = 0.50
const TOLERANCE = 0.001 // ±0.1% search precision
const BASE_HP = 100
const BASE_MAX_HIT = 5
const BASE_ACCURACY = 56
const MAX_HIT_CAP = 35
const MAX_ACCURACY = 92

// ─── Table E5 ─────────────────────────────────────────────────────────────────

const SPEED = [12, 14, 16, 19, 22, 25, 28]
const DAMAGE_MULT = [2.8, 3.3, 3.8, 4.4, 5.1, 5.9, 7.0]
const ACC_MULT = [0.70, 0.82, 0.96, 1.12, 1.30, 1.48, 1.64]

// ─── All 28 builds ────────────────────────────────────────────────────────────

function allBuilds(): Array<{ damage: number; accuracy: number; speed: number }> {
  const builds: Array<{ damage: number; accuracy: number; speed: number }> = []
  for (let d = 1; d <= 7; d++)
    for (let a = 1; a <= 7; a++) {
      const s = 9 - d - a
      if (s >= 1 && s <= 7) builds.push({ damage: d, accuracy: a, speed: s })
    }
  return builds
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface BotStats {
  label: string
  maxHit: number
  accuracy: number
  energyPerTick: number
}

function derive(build: { damage: number; accuracy: number; speed: number }): BotStats {
  return {
    label: `${build.damage}-${build.accuracy}-${build.speed}`,
    maxHit: Math.min(Math.max(1, Math.floor(BASE_MAX_HIT * DAMAGE_MULT[build.damage - 1])), MAX_HIT_CAP),
    accuracy: Math.min(Math.floor(BASE_ACCURACY * ACC_MULT[build.accuracy - 1]), MAX_ACCURACY),
    energyPerTick: SPEED[build.speed - 1],
  }
}

// ─── 1v1 Simulation ───────────────────────────────────────────────────────────

function simulate(botA: BotStats, scalarA: number, botB: BotStats, trials: number): number {
  let winsA = 0
  for (let t = 0; t < trials; t++) {
    let hpA = BASE_HP, hpB = BASE_HP, eA = 0, eB = 0, done = false
    for (let tick = 1; tick <= TICK_LIMIT; tick++) {
      eA += botA.energyPerTick
      if (eA >= 100) {
        eA -= 100
        if (Math.random() * 100 < botA.accuracy) {
          const raw = Math.floor(Math.random() * botA.maxHit) + 1
          hpB -= Math.max(1, Math.round(raw * scalarA))
        }
        if (hpB <= 0) { winsA++; done = true; break }
      }
      eB += botB.energyPerTick
      if (eB >= 100) {
        eB -= 100
        if (Math.random() * 100 < botB.accuracy) {
          hpA -= Math.floor(Math.random() * botB.maxHit) + 1
        }
        if (hpA <= 0) { done = true; break }
      }
    }
    if (!done) {
      if (hpA > hpB) winsA++
      else if (hpA === hpB && Math.random() < 0.5) winsA++
    }
  }
  return winsA / trials
}

// ─── Binary Search ────────────────────────────────────────────────────────────

function findScalar(botA: BotStats, botB: BotStats): number {
  let lo = 0.3, hi = 3.0
  let best = 1.0

  for (let i = 0; i < MAX_SEARCH_ITERS; i++) {
    const mid = (lo + hi) / 2
    const wr = simulate(botA, mid, botB, SEARCH_TRIALS)
    best = mid
    if (Math.abs(wr - TARGET) < TOLERANCE) break
    if (wr > TARGET) hi = mid
    else lo = mid
  }

  return best
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const all28 = allBuilds()
  const bots = all28.map(derive)
  const totalPairs = bots.length * (bots.length - 1) / 2

  console.log(`\n🤖 Battle Bots — Full 1v1 Per-Matchup Tuning`)
  console.log(`${"─".repeat(70)}`)
  console.log(`Builds: 28 | Pairs: ${totalPairs}`)
  console.log(`Search trials: ${SEARCH_TRIALS.toLocaleString()} | Validation: ${VALIDATION_TRIALS.toLocaleString()}`)
  console.log(`Target: 50% ±${(TOLERANCE * 100).toFixed(1)}%\n`)

  // ── Phase 1: Binary search all pairs ──
  console.log(`⏳ Phase 1: Finding scalars for ${totalPairs} matchups...`)

  const scalars: Map<string, number> = new Map()
  let pairsDone = 0

  for (let i = 0; i < bots.length; i++) {
    for (let j = i + 1; j < bots.length; j++) {
      const scalar = findScalar(bots[i], bots[j])
      const key = `${bots[i].label}_${bots[j].label}`
      const inverseKey = `${bots[j].label}_${bots[i].label}`
      scalars.set(key, scalar)
      scalars.set(inverseKey, 1 / scalar)
      pairsDone++
      if (pairsDone % 50 === 0 || pairsDone === totalPairs) {
        process.stdout.write(`  ${pairsDone}/${totalPairs} pairs done\r`)
      }
    }
  }
  console.log(`\n  ✅ All ${totalPairs} pairs tuned.`)

  // ── Phase 2: Validate a sample ──
  // Validate all 378 pairs at high trial count
  console.log(`\n⏳ Phase 2: Validating all ${totalPairs} pairs at ${VALIDATION_TRIALS.toLocaleString()} trials...`)

  let maxDev = 0
  let within05 = 0
  let within1 = 0
  let worstPair = ""
  let worstDev = 0
  let pairsValidated = 0

  for (let i = 0; i < bots.length; i++) {
    for (let j = i + 1; j < bots.length; j++) {
      const key = `${bots[i].label}_${bots[j].label}`
      const scalar = scalars.get(key)!
      const wr = simulate(bots[i], scalar, bots[j], VALIDATION_TRIALS)
      const dev = Math.abs(wr - 0.5)
      if (dev > maxDev) { maxDev = dev; worstPair = key; worstDev = dev }
      if (dev <= 0.005) within05++
      if (dev <= 0.01) within1++
      pairsValidated++
      if (pairsValidated % 50 === 0) {
        process.stdout.write(`  ${pairsValidated}/${totalPairs} validated\r`)
      }
    }
  }

  console.log(`\n\n📊 Validation Results:`)
  console.log(`  ${"─".repeat(50)}`)
  console.log(`  Total pairs: ${totalPairs}`)
  console.log(`  Within ±0.5%: ${within05}/${totalPairs} (${(within05/totalPairs*100).toFixed(0)}%)`)
  console.log(`  Within ±1.0%: ${within1}/${totalPairs} (${(within1/totalPairs*100).toFixed(0)}%)`)
  console.log(`  Max deviation: ${(maxDev * 100).toFixed(3)}%`)
  console.log(`  Worst pair: ${worstPair} (${(worstDev * 100).toFixed(3)}%)`)

  // ── Phase 3: Output scalar table ──
  console.log(`\n📊 MATCHUP_CORRECTIONS table (${scalars.size} entries):`)
  console.log(`  // Key: "attacker_defender" → scalar applied to attacker's damage`)

  // Print just the unique pairs (not inverses)
  console.log(`\n  // Scalar range: ${Math.min(...[...scalars.values()]).toFixed(4)} – ${Math.max(...[...scalars.values()]).toFixed(4)}`)

  // Print a sample of extremes
  const entries = [...scalars.entries()].filter(([k]) => {
    const [a, b] = k.split("_")
    return a < b // unique pairs only
  }).sort((a, b) => b[1] - a[1])

  console.log(`\n  Top 10 highest scalars (builds needing biggest boost):`)
  for (const [key, val] of entries.slice(0, 10)) {
    console.log(`    "${key}": ${val.toFixed(5)}`)
  }

  console.log(`\n  Top 10 lowest scalars (builds needing biggest nerf):`)
  for (const [key, val] of entries.slice(-10)) {
    console.log(`    "${key}": ${val.toFixed(5)}`)
  }

  // Full table output as JSON
  console.log(`\n  // Full table exported as JSON:`)
  const jsonObj: Record<string, number> = {}
  for (const [key, val] of scalars) {
    jsonObj[key] = Math.round(val * 100000) / 100000
  }
  console.log(`  const MATCHUP_CORRECTIONS = ${JSON.stringify(jsonObj, null, 2).slice(0, 500)}...`)
  console.log(`  // (${scalars.size} total entries)`)
  console.log(``)
}

main()
