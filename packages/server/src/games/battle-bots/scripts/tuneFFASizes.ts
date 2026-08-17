/**
 * Battle Bots — FFA Win Rates by Group Size (3, 4, 5 players)
 *
 * Uses Table E5 values. Runs 200k FFA matches per group size with random builds.
 * Reports per-build win rates for each group size to see how balance shifts.
 *
 * Usage: npx tsx packages/server/src/games/battle-bots/scripts/tuneFFASizes.ts
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const TICK_LIMIT = 1000
const FFA_MATCHES = 200_000
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
  if (living.length === 0) return bots[0].label
  let best = living[0]
  for (const i of living) { if (hp[i] > hp[best]) best = i }
  return bots[best].label
}

// ─── Run FFA for a given group size ───────────────────────────────────────────

function runFFA(groupSize: number): Map<string, { wins: number; appearances: number }> {
  const all28 = allBuilds()
  const stats = new Map<string, { wins: number; appearances: number }>()
  for (const b of all28) stats.set(`${b.damage}-${b.accuracy}-${b.speed}`, { wins: 0, appearances: 0 })

  for (let m = 0; m < FFA_MATCHES; m++) {
    const players: BotStats[] = []
    for (let p = 0; p < groupSize; p++) {
      const build = all28[Math.floor(Math.random() * all28.length)]
      players.push(derive(build))
    }

    for (const p of players) {
      const s = stats.get(p.label)!
      s.appearances++
    }

    const winner = simFFA(players)
    const s = stats.get(winner)!
    s.wins++
  }

  return stats
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log(`\n🤖 Battle Bots — FFA Win Rates by Group Size`)
  console.log(`${"─".repeat(70)}`)
  console.log(`Table E5: speed [12-28], dmg [14-35], acc [39-91]`)
  console.log(`Matches per size: ${FFA_MATCHES.toLocaleString()}\n`)

  const sizes = [3, 4, 5]
  const allResults: Map<number, Map<string, { wins: number; appearances: number }>> = new Map()

  for (const size of sizes) {
    console.log(`⏳ Running ${size}-player FFA...`)
    allResults.set(size, runFFA(size))
  }

  // Print results side by side
  const all28 = allBuilds()
  const buildLabels = all28.map(b => `${b.damage}-${b.accuracy}-${b.speed}`)

  // Compute win rates
  type BuildRow = { label: string; wr3: number; wr4: number; wr5: number }
  const rows: BuildRow[] = buildLabels.map(label => {
    const r3 = allResults.get(3)!.get(label)!
    const r4 = allResults.get(4)!.get(label)!
    const r5 = allResults.get(5)!.get(label)!
    return {
      label,
      wr3: r3.appearances > 0 ? r3.wins / r3.appearances : 0,
      wr4: r4.appearances > 0 ? r4.wins / r4.appearances : 0,
      wr5: r5.appearances > 0 ? r5.wins / r5.appearances : 0,
    }
  })

  // Sort by average win rate across all sizes
  rows.sort((a, b) => ((b.wr3 + b.wr4 + b.wr5) / 3) - ((a.wr3 + a.wr4 + a.wr5) / 3))

  console.log(`\n📊 FFA Win Rates by Group Size:`)
  console.log(`  Expected: 3p=33.3%, 4p=25.0%, 5p=20.0%`)
  console.log(`  ${"Build".padEnd(8)} ${"3-player".padEnd(11)} ${"4-player".padEnd(11)} ${"5-player".padEnd(11)} ${"Avg Dev"}`)
  console.log(`  ${"─".repeat(55)}`)

  for (const row of rows) {
    const dev3 = Math.abs(row.wr3 - 1/3)
    const dev4 = Math.abs(row.wr4 - 0.25)
    const dev5 = Math.abs(row.wr5 - 0.20)
    const avgDev = ((dev3 + dev4 + dev5) / 3) * 100
    console.log(`  ${row.label.padEnd(8)} ${(row.wr3 * 100).toFixed(1)}%      ${(row.wr4 * 100).toFixed(1)}%      ${(row.wr5 * 100).toFixed(1)}%      ${avgDev.toFixed(1)}%`)
  }

  // Summary stats
  for (const size of sizes) {
    const expected = 1 / size
    const wrs = buildLabels.map(l => {
      const r = allResults.get(size)!.get(l)!
      return r.appearances > 0 ? r.wins / r.appearances : 0
    }).filter(w => w > 0)
    const min = Math.min(...wrs)
    const max = Math.max(...wrs)
    const maxDev = Math.max(Math.abs(min - expected), Math.abs(max - expected))
    console.log(`\n  ${size}-player: range ${(min*100).toFixed(1)}%–${(max*100).toFixed(1)}% (expected ${(expected*100).toFixed(1)}%), max dev ${(maxDev*100).toFixed(1)}%`)
  }

  // Top 5 and bottom 5 overall
  console.log(`\n  🏆 Top 5 FFA builds (avg across sizes):`)
  for (const row of rows.slice(0, 5)) {
    console.log(`    ${row.label}: 3p=${(row.wr3*100).toFixed(1)}% 4p=${(row.wr4*100).toFixed(1)}% 5p=${(row.wr5*100).toFixed(1)}%`)
  }
  console.log(`\n  📉 Bottom 5 FFA builds:`)
  for (const row of rows.slice(-5)) {
    console.log(`    ${row.label}: 3p=${(row.wr3*100).toFixed(1)}% 4p=${(row.wr4*100).toFixed(1)}% 5p=${(row.wr5*100).toFixed(1)}%`)
  }
  console.log(``)
}

main()
