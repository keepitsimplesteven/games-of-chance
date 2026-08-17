/**
 * Battle Bots - 1v1 Refinement Pass
 *
 * Runs full binary search on all 378 pairs at 400k trials/step (tighter than initial).
 * Only validates the "loose" pairs that did not converge cleanly during search.
 * Tight pairs (converged within tolerance) auto-pass without validation.
 *
 * Usage: npx tsx packages/server/src/games/battle-bots/scripts/tune1v1Refine.ts
 */

const TICK_LIMIT = 1000
const SEARCH_TRIALS = 400_000
const VALIDATION_TRIALS = 200_000
const MAX_SEARCH_ITERS = 40
const TARGET = 0.50
const TOLERANCE = 0.0005
const BASE_HP = 100
const BASE_MAX_HIT = 5
const BASE_ACCURACY = 56
const MAX_HIT_CAP = 35
const MAX_ACCURACY = 92

const SPEED = [12, 14, 16, 19, 22, 25, 28]
const DAMAGE_MULT = [2.8, 3.3, 3.8, 4.4, 5.1, 5.9, 7.0]
const ACC_MULT = [0.70, 0.82, 0.96, 1.12, 1.30, 1.48, 1.64]

function allBuilds() {
  const builds: Array<{ damage: number; accuracy: number; speed: number }> = []
  for (let d = 1; d <= 7; d++)
    for (let a = 1; a <= 7; a++) {
      const s = 9 - d - a
      if (s >= 1 && s <= 7) builds.push({ damage: d, accuracy: a, speed: s })
    }
  return builds
}

interface BotStats { label: string; maxHit: number; accuracy: number; energyPerTick: number }

function derive(b: { damage: number; accuracy: number; speed: number }): BotStats {
  return {
    label: `${b.damage}-${b.accuracy}-${b.speed}`,
    maxHit: Math.min(Math.max(1, Math.floor(BASE_MAX_HIT * DAMAGE_MULT[b.damage - 1])), MAX_HIT_CAP),
    accuracy: Math.min(Math.floor(BASE_ACCURACY * ACC_MULT[b.accuracy - 1]), MAX_ACCURACY),
    energyPerTick: SPEED[b.speed - 1],
  }
}

function simulate(a: BotStats, scalarA: number, b: BotStats, trials: number): number {
  let winsA = 0
  for (let t = 0; t < trials; t++) {
    let hpA = BASE_HP, hpB = BASE_HP, eA = 0, eB = 0, done = false
    for (let tick = 1; tick <= TICK_LIMIT; tick++) {
      eA += a.energyPerTick
      if (eA >= 100) {
        eA -= 100
        if (Math.random() * 100 < a.accuracy) {
          hpB -= Math.max(1, Math.round((Math.floor(Math.random() * a.maxHit) + 1) * scalarA))
        }
        if (hpB <= 0) { winsA++; done = true; break }
      }
      eB += b.energyPerTick
      if (eB >= 100) {
        eB -= 100
        if (Math.random() * 100 < b.accuracy) {
          hpA -= Math.floor(Math.random() * b.maxHit) + 1
        }
        if (hpA <= 0) { done = true; break }
      }
    }
    if (!done) { if (hpA > hpB) winsA++; else if (hpA === hpB && Math.random() < 0.5) winsA++ }
  }
  return winsA / trials
}

function main() {
  const bots = allBuilds().map(derive)
  const botMap = new Map<string, BotStats>()
  for (const b of bots) botMap.set(b.label, b)

  console.log(`\n Battle Bots - 1v1 Refinement (400k search, validate loose only)`)
  console.log("─".repeat(70))
  console.log(`Search: ${SEARCH_TRIALS.toLocaleString()} | Validate: ${VALIDATION_TRIALS.toLocaleString()} | Tolerance: +/-${(TOLERANCE * 100).toFixed(2)}%\n`)

  console.log(`Phase 1: Binary search all 378 pairs...`)
  const scalars = new Map<string, number>()
  const tightPairs: string[] = []
  const loosePairs: string[] = []

  let done = 0
  for (let i = 0; i < bots.length; i++) {
    for (let j = i + 1; j < bots.length; j++) {
      const key = `${bots[i].label}_${bots[j].label}`
      let lo = 0.3, hi = 3.0, best = 1.0, lastWR = 0.5, converged = false

      for (let iter = 0; iter < MAX_SEARCH_ITERS; iter++) {
        const mid = (lo + hi) / 2
        const wr = simulate(bots[i], mid, bots[j], SEARCH_TRIALS)
        best = mid
        lastWR = wr
        if (Math.abs(wr - TARGET) < TOLERANCE) { converged = true; break }
        if (wr > TARGET) hi = mid; else lo = mid
      }

      scalars.set(key, best)
      if (converged && Math.abs(lastWR - 0.5) <= 0.003) tightPairs.push(key)
      else loosePairs.push(key)

      done++
      if (done % 25 === 0) console.log(`  ${done}/378 searched`)
    }
  }

  console.log(`\n  Search complete. Tight: ${tightPairs.length} | Loose: ${loosePairs.length}`)
  console.log(`\nPhase 2: Validating ${loosePairs.length} loose pairs at ${VALIDATION_TRIALS.toLocaleString()} trials...`)

  let maxDev = 0, within05 = 0, worstPair = ""
  for (let p = 0; p < loosePairs.length; p++) {
    const key = loosePairs[p]
    const [aLabel, bLabel] = key.split("_")
    const botA = botMap.get(aLabel)!
    const botB = botMap.get(bLabel)!
    const scalar = scalars.get(key)!
    const wr = simulate(botA, scalar, botB, VALIDATION_TRIALS)
    const dev = Math.abs(wr - 0.5)
    if (dev > maxDev) { maxDev = dev; worstPair = key }
    if (dev <= 0.005) within05++
    if ((p + 1) % 10 === 0 || p === loosePairs.length - 1) console.log(`  ${p + 1}/${loosePairs.length} validated`)
  }

  const totalIn05 = within05 + tightPairs.length
  console.log(`\nResults:`)
  console.log(`  Tight (auto-pass): ${tightPairs.length}`)
  console.log(`  Loose within +/-0.5%: ${within05}/${loosePairs.length}`)
  console.log(`  Total within +/-0.5%: ${totalIn05}/378 (${(totalIn05 / 378 * 100).toFixed(0)}%)`)
  console.log(`  Max deviation (loose): ${(maxDev * 100).toFixed(3)}%`)
  console.log(`  Worst pair: ${worstPair}`)
  console.log(`  Scalar range: ${Math.min(...scalars.values()).toFixed(5)} - ${Math.max(...scalars.values()).toFixed(5)}`)
  console.log("")
}

main()
