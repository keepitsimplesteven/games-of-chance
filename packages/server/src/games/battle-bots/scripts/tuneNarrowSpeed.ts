/**
 * Battle Bots — Narrow Speed Range Exploration
 *
 * Key changes from previous experiments:
 *   - Speed range narrowed: 12→30 EPT (2.5x ratio, down from 4.2x)
 *   - Accuracy cap raised to 95%
 *   - MaxHit cap at 33 (4 hits to kill minimum)
 *   - No crit/dodge for now
 *
 * Tests multiple damage curves to see which brings raw matchups closest to 45-55%.
 * The idea: with speed having less leverage, damage and accuracy need to carry more
 * weight but can do so more evenly since speed isn't dominating.
 *
 * Usage: npx tsx packages/server/src/games/battle-bots/scripts/tuneNarrowSpeed.ts
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const TICK_LIMIT = 1000
const TRIALS = 100_000
const BASE_HP = 100
const BASE_MAX_HIT = 5
const BASE_ACCURACY = 56
const MAX_HIT_CAP = 33
const MAX_ACCURACY = 95

// ─── POC Builds ───────────────────────────────────────────────────────────────

const POC_BUILDS = [
  { damage: 7, accuracy: 1, speed: 1, label: "7-1-1 Glass Cannon" },
  { damage: 1, accuracy: 7, speed: 1, label: "1-7-1 Sharpshooter" },
  { damage: 1, accuracy: 1, speed: 7, label: "1-1-7 Speedster" },
  { damage: 3, accuracy: 3, speed: 3, label: "3-3-3 Balanced" },
]

// ─── Simulation ───────────────────────────────────────────────────────────────

interface BotStats {
  label: string
  maxHit: number
  accuracy: number
  energyPerTick: number
}

function simulate(botA: BotStats, botB: BotStats, trials: number): number {
  let winsA = 0
  for (let t = 0; t < trials; t++) {
    let hpA = BASE_HP
    let hpB = BASE_HP
    let energyA = 0
    let energyB = 0
    let resolved = false

    for (let tick = 1; tick <= TICK_LIMIT; tick++) {
      energyA += botA.energyPerTick
      if (energyA >= 100) {
        energyA -= 100
        if (Math.random() * 100 < botA.accuracy) {
          hpB -= Math.floor(Math.random() * botA.maxHit) + 1
        }
        if (hpB <= 0) { winsA++; resolved = true; break }
      }
      energyB += botB.energyPerTick
      if (energyB >= 100) {
        energyB -= 100
        if (Math.random() * 100 < botB.accuracy) {
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

// ─── Tables to Test ───────────────────────────────────────────────────────────

interface TableConfig {
  name: string
  description: string
  speed: number[]         // EPT values for stars 1-7
  damageMultiplier: number[]  // damage multipliers for stars 1-7
  accuracyMultiplier: number[] // accuracy multipliers for stars 1-7
}

const TABLES: TableConfig[] = [
  {
    name: "A: Conservative Damage (maxHit 10-33)",
    description: "Damage 3.3x ratio, speed 2.5x, accuracy 3.1x",
    speed: [12, 14, 17, 20, 23, 27, 30],
    damageMultiplier: [2.0, 2.6, 3.2, 3.9, 4.7, 5.6, 6.6],
    accuracyMultiplier: [0.54, 0.68, 0.82, 0.98, 1.16, 1.38, 1.70],
  },
  {
    name: "B: Compressed Damage (maxHit 14-33)",
    description: "Damage 2.4x ratio, speed 2.5x, accuracy 3.1x",
    speed: [12, 14, 17, 20, 23, 27, 30],
    damageMultiplier: [2.8, 3.2, 3.7, 4.2, 4.8, 5.6, 6.6],
    accuracyMultiplier: [0.54, 0.68, 0.82, 0.98, 1.16, 1.38, 1.70],
  },
  {
    name: "C: Compressed Damage + Compressed Accuracy (maxHit 14-33, acc 50-95)",
    description: "Damage 2.4x, speed 2.5x, accuracy 1.9x — all ratios under 2.5x",
    speed: [12, 14, 17, 20, 23, 27, 30],
    damageMultiplier: [2.8, 3.2, 3.7, 4.2, 4.8, 5.6, 6.6],
    accuracyMultiplier: [0.90, 0.98, 1.07, 1.16, 1.27, 1.40, 1.70],
  },
  {
    name: "D: High Floor (maxHit 18-33, acc 55-95)",
    description: "Damage 1.8x, speed 2.5x, accuracy 1.7x — very compressed",
    speed: [12, 14, 17, 20, 23, 27, 30],
    damageMultiplier: [3.7, 4.0, 4.4, 4.8, 5.4, 6.0, 6.6],
    accuracyMultiplier: [1.00, 1.07, 1.16, 1.25, 1.38, 1.52, 1.70],
  },
  {
    name: "E: Equal Ratios (all ~2.5x)",
    description: "Damage 2.5x, speed 2.5x, accuracy 2.5x — symmetric",
    speed: [12, 14, 17, 20, 23, 27, 30],
    damageMultiplier: [2.6, 3.1, 3.6, 4.2, 4.9, 5.7, 6.6],
    accuracyMultiplier: [0.68, 0.80, 0.95, 1.12, 1.32, 1.52, 1.70],
  },
]

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log(`\n🤖 Battle Bots — Narrow Speed (12→30 EPT) + Damage Tuning`)
  console.log(`${"─".repeat(70)}`)
  console.log(`Speed range: 12→30 EPT (2.5x ratio)`)
  console.log(`Accuracy cap: ${MAX_ACCURACY}% | MaxHit cap: ${MAX_HIT_CAP}`)
  console.log(`Trials: ${TRIALS.toLocaleString()} per matchup\n`)

  for (const table of TABLES) {
    console.log(`\n${"═".repeat(70)}`)
    console.log(`  ${table.name}`)
    console.log(`  ${table.description}`)
    console.log(`${"═".repeat(70)}`)

    // Derive stats
    const bots: BotStats[] = POC_BUILDS.map(build => {
      const d = table.damageMultiplier[build.damage - 1]
      const a = table.accuracyMultiplier[build.accuracy - 1]
      const s = table.speed[build.speed - 1]
      return {
        label: build.label,
        maxHit: Math.min(Math.max(1, Math.floor(BASE_MAX_HIT * d)), MAX_HIT_CAP),
        accuracy: Math.min(Math.floor(BASE_ACCURACY * a), MAX_ACCURACY),
        energyPerTick: s,
      }
    })

    // Print stats
    console.log(`\n  ${"Build".padEnd(22)} ${"MaxHit".padEnd(8)} ${"Acc%".padEnd(7)} ${"EPT".padEnd(6)} ${"DPS/tick"}`)
    console.log(`  ${"─".repeat(55)}`)
    for (const bot of bots) {
      const dps = (bot.energyPerTick / 100) * (bot.accuracy / 100) * ((bot.maxHit + 1) / 2)
      console.log(`  ${bot.label.padEnd(22)} ${String(bot.maxHit).padEnd(8)} ${String(bot.accuracy).padEnd(7)} ${String(bot.energyPerTick).padEnd(6)} ${dps.toFixed(3)}`)
    }

    // Simulate all matchups
    console.log(`\n  ${"Matchup".padEnd(42)} ${"A Win%".padEnd(10)} ${"OK?"}`)
    console.log(`  ${"─".repeat(55)}`)

    const winRates: number[] = []
    for (let i = 0; i < bots.length; i++) {
      for (let j = i + 1; j < bots.length; j++) {
        const wr = simulate(bots[i], bots[j], TRIALS)
        winRates.push(wr)
        const ok = wr >= 0.45 && wr <= 0.55 ? "✅" : wr >= 0.40 && wr <= 0.60 ? "⚠️" : "❌"
        console.log(`  ${(bots[i].label + " vs " + bots[j].label).padEnd(42)} ${(wr * 100).toFixed(1)}%     ${ok}`)
      }
    }

    const maxDev = Math.max(...winRates.map(wr => Math.abs(wr - 0.5)))
    const avgDev = winRates.reduce((s, wr) => s + Math.abs(wr - 0.5), 0) / winRates.length
    const in5 = winRates.filter(wr => wr >= 0.45 && wr <= 0.55).length
    const in10 = winRates.filter(wr => wr >= 0.40 && wr <= 0.60).length
    console.log(`\n  Max dev: ${(maxDev * 100).toFixed(1)}% | Avg dev: ${(avgDev * 100).toFixed(1)}% | In ±5%: ${in5}/6 | In ±10%: ${in10}/6`)
  }

  console.log(`\n${"═".repeat(70)}`)
  console.log(`  The best table is the one with lowest max deviation and most matchups in band.`)
  console.log(`  Per-matchup scalars can then fine-tune from there.`)
  console.log(``)
}

main()
