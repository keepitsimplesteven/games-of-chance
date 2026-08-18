/**
 * Lottery Distribution Validation Script
 *
 * Runs 100,000 lottery draws and prints the observed vs expected probability
 * distribution for all 10 seeds across all 10 placements.
 *
 * Usage:
 *   npx tsx packages/server/scripts/lottery-distribution.ts
 */

import { drawPlacements, DEFAULT_LOTTERY_ODDS } from "../src/games/playcaller/lottery/odds"

const NUM_RUNS = 100_000
const PLAYER_COUNT = 10

// Count matrix: counts[seedIdx][placementIdx]
const counts: number[][] = Array.from({ length: PLAYER_COUNT }, () =>
  Array(PLAYER_COUNT).fill(0)
)

console.log(`\nRunning ${NUM_RUNS.toLocaleString()} lottery draws...\n`)

for (let run = 0; run < NUM_RUNS; run++) {
  const result = drawPlacements(PLAYER_COUNT, Math.random)
  for (let seedIdx = 0; seedIdx < PLAYER_COUNT; seedIdx++) {
    const placement = result[seedIdx] // 1-based
    counts[seedIdx][placement - 1]++
  }
}

// Print header
const header = "Seed".padStart(6) + " | " +
  Array.from({ length: PLAYER_COUNT }, (_, i) => `${i + 1}`.padStart(7)).join(" ") +
  " | " + "Avg Place"
const separator = "-".repeat(header.length)

console.log("=" .repeat(header.length))
console.log(" OBSERVED DISTRIBUTION (% of draws each seed landed in each placement)")
console.log("=".repeat(header.length))
console.log(header)
console.log(separator)

const avgPlacements: number[] = []

for (let seedIdx = 0; seedIdx < PLAYER_COUNT; seedIdx++) {
  let avgPlace = 0
  const cells = Array.from({ length: PLAYER_COUNT }, (_, placementIdx) => {
    const pct = (counts[seedIdx][placementIdx] / NUM_RUNS) * 100
    avgPlace += (placementIdx + 1) * counts[seedIdx][placementIdx]
    return `${pct.toFixed(1)}%`.padStart(7)
  })
  avgPlace /= NUM_RUNS
  avgPlacements.push(avgPlace)
  console.log(`Seed ${seedIdx + 1}`.padStart(6) + " | " + cells.join(" ") + " | " + avgPlace.toFixed(2))
}

console.log(separator)
console.log()

// Print expected table for comparison
console.log("=".repeat(header.length))
console.log(" EXPECTED DISTRIBUTION (from odds table)")
console.log("=".repeat(header.length))
console.log(header)
console.log(separator)

for (let seedIdx = 0; seedIdx < PLAYER_COUNT; seedIdx++) {
  let avgPlace = 0
  const cells = Array.from({ length: PLAYER_COUNT }, (_, placementIdx) => {
    const pct = DEFAULT_LOTTERY_ODDS[seedIdx][placementIdx] * 100
    avgPlace += (placementIdx + 1) * DEFAULT_LOTTERY_ODDS[seedIdx][placementIdx]
    return `${pct.toFixed(1)}%`.padStart(7)
  })
  console.log(`Seed ${seedIdx + 1}`.padStart(6) + " | " + cells.join(" ") + " | " + avgPlace.toFixed(2))
}

console.log(separator)
console.log()

// Print deviation table
console.log("=".repeat(header.length))
console.log(" DEVIATION (observed - expected, in percentage points)")
console.log("=".repeat(header.length))
console.log(header.replace("Avg Place", "Max Dev  "))
console.log(separator)

let worstDeviation = 0
let worstSeed = 0
let worstPlacement = 0

for (let seedIdx = 0; seedIdx < PLAYER_COUNT; seedIdx++) {
  let maxDev = 0
  const cells = Array.from({ length: PLAYER_COUNT }, (_, placementIdx) => {
    const observed = (counts[seedIdx][placementIdx] / NUM_RUNS) * 100
    const expected = DEFAULT_LOTTERY_ODDS[seedIdx][placementIdx] * 100
    const dev = observed - expected
    if (Math.abs(dev) > Math.abs(maxDev)) maxDev = dev
    if (Math.abs(dev) > Math.abs(worstDeviation)) {
      worstDeviation = dev
      worstSeed = seedIdx
      worstPlacement = placementIdx
    }
    const sign = dev >= 0 ? "+" : ""
    return `${sign}${dev.toFixed(1)}`.padStart(7)
  })
  console.log(`Seed ${seedIdx + 1}`.padStart(6) + " | " + cells.join(" ") + " | " + `${maxDev >= 0 ? "+" : ""}${maxDev.toFixed(2)}`)
}

console.log(separator)
console.log()

// Summary
console.log("=".repeat(60))
console.log(" SUMMARY")
console.log("=".repeat(60))
console.log(`  Total draws: ${NUM_RUNS.toLocaleString()}`)
console.log(`  Worst deviation: ${worstDeviation >= 0 ? "+" : ""}${worstDeviation.toFixed(2)} pp (Seed ${worstSeed + 1}, Placement ${worstPlacement + 1})`)
console.log()
console.log("  Seed 10 specific:")
const seed10_10th_observed = (counts[9][9] / NUM_RUNS) * 100
const seed10_10th_expected = DEFAULT_LOTTERY_ODDS[9][9] * 100
console.log(`    Chance of finishing 10th: ${seed10_10th_observed.toFixed(1)}% observed vs ${seed10_10th_expected.toFixed(1)}% expected`)
console.log(`    Chance of NOT finishing 10th: ${(100 - seed10_10th_observed).toFixed(1)}%`)
console.log()

// Validate pass/fail
const TOLERANCE = 2.0 // percentage points
let allPass = true
for (let seedIdx = 0; seedIdx < PLAYER_COUNT; seedIdx++) {
  for (let placementIdx = 0; placementIdx < PLAYER_COUNT; placementIdx++) {
    const observed = (counts[seedIdx][placementIdx] / NUM_RUNS) * 100
    const expected = DEFAULT_LOTTERY_ODDS[seedIdx][placementIdx] * 100
    if (Math.abs(observed - expected) > TOLERANCE) {
      allPass = false
      console.log(`  FAIL: Seed ${seedIdx + 1} Placement ${placementIdx + 1} — ${observed.toFixed(1)}% observed vs ${expected.toFixed(1)}% expected (deviation: ${(observed - expected).toFixed(2)} pp)`)
    }
  }
}

if (allPass) {
  console.log("  RESULT: PASS — All cells within ±2.0 percentage points of expected values.")
} else {
  console.log("\n  RESULT: FAIL — One or more cells exceeded ±2.0 pp tolerance.")
}

console.log()
