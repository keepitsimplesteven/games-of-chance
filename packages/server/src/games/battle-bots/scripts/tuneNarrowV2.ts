/**
 * Battle Bots — Narrow Speed V2: Fine-Nudge Extremes + FFA Simulation
 *
 * Starting from Table E (equal 2.5x ratios), nudge the extreme values:
 *   - Max accuracy: try 90, 92, 95, 98
 *   - Max speed: try 28, 30, 32, 33
 *   - Max damage: try 30, 33, 35, 38
 *
 * Goal: all POC 1v1 matchups within ±5% of 50%.
 *
 * Also includes an FFA simulation: drop random builds into FFA matches
 * and tally which builds win most often.
 *
 * Usage: npx tsx packages/server/src/games/battle-bots/scripts/tuneNarrowV2.ts
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const TICK_LIMIT = 1000
const TRIALS_1V1 = 100_000
const FFA_MATCHES = 200_000
const FFA_PLAYERS = 4
const BASE_HP = 100
const BASE_MAX_HIT = 5
const BASE_ACCURACY = 56

// ─── POC Builds ───────────────────────────────────────────────────────────────

const POC_BUILDS = [
  { damage: 7, accuracy: 1, speed: 1, label: "7-1-1" },
  { damage: 1, accuracy: 7, speed: 1, label: "1-7-1" },
  { damage: 1, accuracy: 1, speed: 7, label: "1-1-7" },
  { damage: 3, accuracy: 3, speed: 3, label: "3-3-3" },
]

// All 28 builds for FFA
function allBuilds(): Array<{ damage: number; accuracy: number; speed: number }> {
  const builds: Array<{ damage: number; accuracy: number; speed: number }> = []
  for (let d = 1; d <= 7; d++) {
    for (let a = 1; a <= 7; a++) {
      const s = 9 - d - a
      if (s >= 1 && s <= 7) builds.push({ damage: d, accuracy: a, speed: s })
    }
  }
  return builds
}

// ─── Table Config ─────────────────────────────────────────────────────────────

interface TableConfig {
  name: string
  speed: number[]
  damageMultiplier: number[]
  accuracyMultiplier: number[]
  maxHitCap: number
  maxAccuracy: number
}

// Table E baseline
const BASE_SPEED = [12, 14, 17, 20, 23, 27, 30]
const BASE_DMG = [2.6, 3.1, 3.6, 4.2, 4.9, 5.7, 6.6]
const BASE_ACC = [0.68, 0.80, 0.95, 1.12, 1.32, 1.52, 1.70]

// Nudge variants
const VARIANTS: TableConfig[] = [
  {
    name: "E-base (reference)",
    speed: [12, 14, 17, 20, 23, 27, 30],
    damageMultiplier: [2.6, 3.1, 3.6, 4.2, 4.9, 5.7, 6.6],
    accuracyMultiplier: [0.68, 0.80, 0.95, 1.12, 1.32, 1.52, 1.70],
    maxHitCap: 33,
    maxAccuracy: 95,
  },
  {
    name: "E1: lower max speed to 28, raise max dmg to 35",
    speed: [12, 14, 16, 19, 22, 25, 28],
    damageMultiplier: [2.6, 3.1, 3.7, 4.4, 5.1, 5.9, 7.0],
    accuracyMultiplier: [0.68, 0.80, 0.95, 1.12, 1.32, 1.52, 1.70],
    maxHitCap: 35,
    maxAccuracy: 95,
  },
  {
    name: "E2: raise max speed to 32, lower max dmg to 30",
    speed: [12, 15, 18, 21, 25, 28, 32],
    damageMultiplier: [2.6, 3.0, 3.4, 3.9, 4.5, 5.2, 6.0],
    accuracyMultiplier: [0.68, 0.80, 0.95, 1.12, 1.32, 1.52, 1.70],
    maxHitCap: 30,
    maxAccuracy: 95,
  },
  {
    name: "E3: lower max acc to 90, boost dmg floor",
    speed: [12, 14, 17, 20, 23, 27, 30],
    damageMultiplier: [3.0, 3.4, 3.9, 4.4, 5.0, 5.7, 6.6],
    accuracyMultiplier: [0.68, 0.80, 0.95, 1.12, 1.30, 1.45, 1.61],
    maxHitCap: 33,
    maxAccuracy: 90,
  },
  {
    name: "E4: raise max acc to 98, slight speed bump",
    speed: [12, 14, 17, 20, 23, 27, 31],
    damageMultiplier: [2.6, 3.1, 3.6, 4.2, 4.9, 5.7, 6.6],
    accuracyMultiplier: [0.68, 0.80, 0.95, 1.12, 1.34, 1.56, 1.75],
    maxHitCap: 33,
    maxAccuracy: 98,
  },
  {
    name: "E5: all levers — spd 28, dmg 35, acc 92",
    speed: [12, 14, 16, 19, 22, 25, 28],
    damageMultiplier: [2.8, 3.3, 3.8, 4.4, 5.1, 5.9, 7.0],
    accuracyMultiplier: [0.70, 0.82, 0.96, 1.12, 1.30, 1.48, 1.64],
    maxHitCap: 35,
    maxAccuracy: 92,
  },
]

// ─── Stat Derivation ──────────────────────────────────────────────────────────

interface BotStats {
  label: string
  maxHit: number
  accuracy: number
  energyPerTick: number
}

function derive(build: { damage: number; accuracy: number; speed: number }, table: TableConfig): BotStats {
  const d = table.damageMultiplier[build.damage - 1]
  const a = table.accuracyMultiplier[build.accuracy - 1]
  const s = table.speed[build.speed - 1]
  return {
    label: `${build.damage}-${build.accuracy}-${build.speed}`,
    maxHit: Math.min(Math.max(1, Math.floor(BASE_MAX_HIT * d)), table.maxHitCap),
    accuracy: Math.min(Math.floor(BASE_ACCURACY * a), table.maxAccuracy),
    energyPerTick: s,
  }
}

// ─── 1v1 Simulation ───────────────────────────────────────────────────────────

function sim1v1(a: BotStats, b: BotStats, trials: number): number {
  let winsA = 0
  for (let t = 0; t < trials; t++) {
    let hpA = BASE_HP, hpB = BASE_HP, eA = 0, eB = 0, done = false
    for (let tick = 1; tick <= TICK_LIMIT; tick++) {
      eA += a.energyPerTick
      if (eA >= 100) {
        eA -= 100
        if (Math.random() * 100 < a.accuracy) hpB -= Math.floor(Math.random() * a.maxHit) + 1
        if (hpB <= 0) { winsA++; done = true; break }
      }
      eB += b.energyPerTick
      if (eB >= 100) {
        eB -= 100
        if (Math.random() * 100 < b.accuracy) hpA -= Math.floor(Math.random() * b.maxHit) + 1
        if (hpA <= 0) { done = true; break }
      }
    }
    if (!done) { if (hpA > hpB) winsA++; else if (hpA === hpB && Math.random() < 0.5) winsA++ }
  }
  return winsA / trials
}

// ─── FFA Simulation ───────────────────────────────────────────────────────────

function simFFA(bots: BotStats[]): string {
  const hp: number[] = bots.map(() => BASE_HP)
  const energy: number[] = bots.map(() => 0)

  for (let tick = 1; tick <= TICK_LIMIT; tick++) {
    const living = bots.map((_, i) => i).filter(i => hp[i] > 0)
    if (living.length <= 1) break

    for (const i of living) {
      energy[i] += bots[i].energyPerTick
      if (energy[i] >= 100) {
        energy[i] -= 100
        if (Math.random() * 100 < bots[i].accuracy) {
          // Target random living opponent
          const targets = living.filter(j => j !== i && hp[j] > 0)
          if (targets.length > 0) {
            const target = targets[Math.floor(Math.random() * targets.length)]
            hp[target] -= Math.floor(Math.random() * bots[i].maxHit) + 1
          }
        }
      }
    }
  }

  const living = bots.map((_, i) => i).filter(i => hp[i] > 0)
  if (living.length === 1) return bots[living[0]].label
  if (living.length === 0) return bots[0].label // edge case: simultaneous kill
  // Tie: highest HP wins
  let best = living[0]
  for (const i of living) { if (hp[i] > hp[best]) best = i }
  return bots[best].label
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log(`\n🤖 Battle Bots — Narrow Speed V2: Nudge Extremes + FFA`)
  console.log(`${"─".repeat(70)}`)
  console.log(`1v1 trials: ${TRIALS_1V1.toLocaleString()} | FFA matches: ${FFA_MATCHES.toLocaleString()}`)

  // ── Part 1: 1v1 variant testing ──
  let bestVariant: TableConfig | null = null
  let bestMaxDev = 999

  for (const variant of VARIANTS) {
    const bots = POC_BUILDS.map(b => derive(b, variant))

    // Quick stats line
    const dps = bots.map(b => (b.energyPerTick / 100) * (b.accuracy / 100) * ((b.maxHit + 1) / 2))
    const wrs: number[] = []
    for (let i = 0; i < bots.length; i++)
      for (let j = i + 1; j < bots.length; j++)
        wrs.push(sim1v1(bots[i], bots[j], TRIALS_1V1))

    const maxDev = Math.max(...wrs.map(wr => Math.abs(wr - 0.5)))
    const in5 = wrs.filter(wr => wr >= 0.45 && wr <= 0.55).length

    console.log(`\n  ${variant.name}`)
    console.log(`  Stats: ${bots.map(b => `${b.label}(${b.maxHit}/${b.accuracy}/${b.energyPerTick})`).join(" | ")}`)
    console.log(`  DPS: ${dps.map(d => d.toFixed(3)).join(" | ")}`)
    console.log(`  WRs: ${wrs.map(w => (w * 100).toFixed(1) + "%").join(" | ")}`)
    console.log(`  Max dev: ${(maxDev * 100).toFixed(1)}% | In ±5%: ${in5}/6 ${maxDev <= 0.05 ? "✅ TARGET MET" : ""}`)

    if (maxDev < bestMaxDev) { bestMaxDev = maxDev; bestVariant = variant }
  }

  console.log(`\n${"═".repeat(70)}`)
  console.log(`  BEST VARIANT: ${bestVariant!.name} (max dev: ${(bestMaxDev * 100).toFixed(1)}%)`)
  console.log(`${"═".repeat(70)}`)

  // ── Part 2: FFA simulation with best variant ──
  const bestTable = bestVariant!
  const all28 = allBuilds()

  console.log(`\n⏳ Running FFA simulation (${FFA_MATCHES.toLocaleString()} matches, ${FFA_PLAYERS} players each)...`)
  console.log(`  Using: ${bestTable.name}`)

  const wins: Record<string, number> = {}
  const appearances: Record<string, number> = {}

  for (const build of all28) {
    const key = `${build.damage}-${build.accuracy}-${build.speed}`
    wins[key] = 0
    appearances[key] = 0
  }

  for (let m = 0; m < FFA_MATCHES; m++) {
    // Pick FFA_PLAYERS random builds (with replacement)
    const players: BotStats[] = []
    for (let p = 0; p < FFA_PLAYERS; p++) {
      const build = all28[Math.floor(Math.random() * all28.length)]
      players.push(derive(build, bestTable))
    }

    // Track appearances
    for (const p of players) appearances[p.label] = (appearances[p.label] || 0) + 1

    // Run FFA
    const winner = simFFA(players)
    wins[winner] = (wins[winner] || 0) + 1
  }

  // Calculate win rates (wins / appearances)
  const ffaResults: Array<{ label: string; winRate: number; appearances: number; wins: number }> = []
  for (const build of all28) {
    const key = `${build.damage}-${build.accuracy}-${build.speed}`
    const a = appearances[key] || 0
    const w = wins[key] || 0
    ffaResults.push({ label: key, winRate: a > 0 ? w / a : 0, appearances: a, wins: w })
  }

  ffaResults.sort((a, b) => b.winRate - a.winRate)

  // Expected win rate in 4-player FFA = 25%
  console.log(`\n📊 FFA Win Rates (expected: 25% if perfectly balanced):`)
  console.log(`  ${"Build".padEnd(8)} ${"WinRate".padEnd(10)} ${"Wins".padEnd(8)} ${"Appearances".padEnd(14)} ${"Status"}`)
  console.log(`  ${"─".repeat(50)}`)
  for (const r of ffaResults) {
    const status = r.winRate >= 0.20 && r.winRate <= 0.30 ? "✅" : r.winRate >= 0.15 && r.winRate <= 0.35 ? "⚠️" : "❌"
    console.log(`  ${r.label.padEnd(8)} ${(r.winRate * 100).toFixed(1)}%     ${String(r.wins).padEnd(8)} ${String(r.appearances).padEnd(14)} ${status}`)
  }

  const ffaWRs = ffaResults.map(r => r.winRate).filter(wr => wr > 0)
  console.log(`\n  FFA Win Rate range: ${(Math.min(...ffaWRs) * 100).toFixed(1)}% – ${(Math.max(...ffaWRs) * 100).toFixed(1)}%`)
  console.log(`  Highest: ${ffaResults[0].label} (${(ffaResults[0].winRate * 100).toFixed(1)}%)`)
  console.log(`  Lowest:  ${ffaResults[ffaResults.length - 1].label} (${(ffaResults[ffaResults.length - 1].winRate * 100).toFixed(1)}%)`)
  console.log(``)
}

main()
