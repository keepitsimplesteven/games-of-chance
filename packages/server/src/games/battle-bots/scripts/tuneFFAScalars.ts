/**
 * Battle Bots — FFA Per-Build Scalar Tuning (4-player)
 *
 * Iteratively finds a DPS scalar for each of the 28 builds such that all builds
 * achieve ~25% win rate in 4-player FFA with random opponents.
 *
 * Process:
 *   1. Run large FFA simulation, measure per-build win rates
 *   2. Adjust scalars: builds winning too much get nerfed, underdogs get buffed
 *   3. Repeat until convergence (all within ±1% of expected)
 *   4. Final validation with 2,000,000 matches
 *
 * Usage: npx tsx packages/server/src/games/battle-bots/scripts/tuneFFAScalars.ts
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const TICK_LIMIT = 1000
const TUNING_MATCHES = 1_000_000
const VALIDATION_MATCHES = 5_000_000
const FFA_PLAYERS = 4
const EXPECTED_WR = 1 / FFA_PLAYERS // 25%
const TARGET_TOLERANCE = 0.005 // ±0.5%
const TUNING_ROUNDS = 15
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

// ─── FFA Simulation with scalars ──────────────────────────────────────────────

function simFFA(bots: BotStats[], scalars: number[]): number {
  const hp: number[] = bots.map(() => BASE_HP)
  const energy: number[] = bots.map(() => 0)

  for (let tick = 1; tick <= TICK_LIMIT; tick++) {
    const living: number[] = []
    for (let i = 0; i < bots.length; i++) if (hp[i] > 0) living.push(i)
    if (living.length <= 1) break

    for (const i of living) {
      energy[i] += bots[i].energyPerTick
      if (energy[i] >= 100) {
        energy[i] -= 100
        if (Math.random() * 100 < bots[i].accuracy) {
          // Pick random target
          const targets: number[] = []
          for (const j of living) if (j !== i && hp[j] > 0) targets.push(j)
          if (targets.length > 0) {
            const target = targets[Math.floor(Math.random() * targets.length)]
            const raw = Math.floor(Math.random() * bots[i].maxHit) + 1
            const dmg = Math.max(1, Math.round(raw * scalars[i]))
            hp[target] -= dmg
          }
        }
      }
    }
  }

  // Find winner
  let bestIdx = 0
  let bestHp = hp[0]
  for (let i = 1; i < bots.length; i++) {
    if (hp[i] > bestHp) { bestHp = hp[i]; bestIdx = i }
  }
  return bestIdx
}

// ─── Run FFA batch and return per-build win rates ─────────────────────────────

function measureWinRates(
  scalarsMap: Map<string, number>,
  matches: number
): Map<string, { wins: number; appearances: number; winRate: number }> {
  const all28 = allBuilds()
  const stats = new Map<string, { wins: number; appearances: number; winRate: number }>()
  for (const b of all28) stats.set(`${b.damage}-${b.accuracy}-${b.speed}`, { wins: 0, appearances: 0, winRate: 0 })

  for (let m = 0; m < matches; m++) {
    // Pick random builds
    const players: BotStats[] = []
    const playerScalars: number[] = []
    for (let p = 0; p < FFA_PLAYERS; p++) {
      const build = all28[Math.floor(Math.random() * all28.length)]
      const bot = derive(build)
      players.push(bot)
      playerScalars.push(scalarsMap.get(bot.label) ?? 1.0)
    }

    // Track appearances
    for (const p of players) stats.get(p.label)!.appearances++

    // Run
    const winnerIdx = simFFA(players, playerScalars)
    stats.get(players[winnerIdx].label)!.wins++
  }

  // Calculate win rates
  for (const [, s] of stats) {
    s.winRate = s.appearances > 0 ? s.wins / s.appearances : 0
  }

  return stats
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log(`\n🤖 Battle Bots — FFA Per-Build Scalar Tuning`)
  console.log(`${"─".repeat(70)}`)
  console.log(`Group size: ${FFA_PLAYERS} | Expected win rate: ${(EXPECTED_WR * 100).toFixed(1)}%`)
  console.log(`Tuning matches: ${TUNING_MATCHES.toLocaleString()} | Validation: ${VALIDATION_MATCHES.toLocaleString()}`)
  console.log(`Target: all builds within ±${(TARGET_TOLERANCE * 100).toFixed(1)}% of expected\n`)

  const all28 = allBuilds()
  const scalarsMap = new Map<string, number>()
  for (const b of all28) scalarsMap.set(`${b.damage}-${b.accuracy}-${b.speed}`, 1.0)

  // ── Iterative tuning ──
  for (let round = 1; round <= TUNING_ROUNDS; round++) {
    console.log(`  Round ${round}: measuring...`)
    const stats = measureWinRates(scalarsMap, TUNING_MATCHES)

    let maxDev = 0
    let converged = 0

    for (const [label, s] of stats) {
      const dev = s.winRate - EXPECTED_WR
      const absDev = Math.abs(dev)
      if (absDev > maxDev) maxDev = absDev

      if (absDev <= TARGET_TOLERANCE) {
        converged++
      } else {
        // Adjust: if winning too much, nerf damage; if losing, buff
        const currentScalar = scalarsMap.get(label)!
        // Damped proportional adjustment
        const adjustment = 1 - (dev / EXPECTED_WR) * 0.3
        scalarsMap.set(label, Math.max(0.5, Math.min(1.8, currentScalar * adjustment)))
      }
    }

    console.log(`    Max dev: ${(maxDev * 100).toFixed(2)}% | Converged: ${converged}/28`)

    if (converged === 28) {
      console.log(`    ✅ All builds converged!`)
      break
    }
  }

  // ── Print final scalars ──
  console.log(`\n📊 Final FFA Scalars:`)
  console.log(`  ${"Build".padEnd(8)} ${"Scalar"}`)
  console.log(`  ${"─".repeat(20)}`)
  const sortedLabels = [...scalarsMap.entries()].sort((a, b) => b[1] - a[1])
  for (const [label, scalar] of sortedLabels) {
    console.log(`  ${label.padEnd(8)} ${scalar.toFixed(4)}`)
  }

  // ── Validation ──
  console.log(`\n⏳ Validating with ${VALIDATION_MATCHES.toLocaleString()} matches...`)
  const validation = measureWinRates(scalarsMap, VALIDATION_MATCHES)

  console.log(`\n📊 Validated FFA Win Rates (expected: ${(EXPECTED_WR * 100).toFixed(1)}%):`)
  console.log(`  ${"Build".padEnd(8)} ${"WinRate".padEnd(10)} ${"Dev".padEnd(8)} ${"Scalar".padEnd(10)} ${"Status"}`)
  console.log(`  ${"─".repeat(50)}`)

  const sortedResults = [...validation.entries()].sort((a, b) => b[1].winRate - a[1].winRate)
  let valMaxDev = 0
  let valIn1 = 0

  for (const [label, s] of sortedResults) {
    const dev = s.winRate - EXPECTED_WR
    const absDev = Math.abs(dev)
    if (absDev > valMaxDev) valMaxDev = absDev
    if (absDev <= 0.01) valIn1++
    const status = absDev <= 0.005 ? "✅" : absDev <= 0.01 ? "⚠️" : "❌"
    const scalar = scalarsMap.get(label)!
    console.log(`  ${label.padEnd(8)} ${(s.winRate * 100).toFixed(2)}%    ${(dev * 100 >= 0 ? "+" : "") + (dev * 100).toFixed(2)}%   ${scalar.toFixed(4)}    ${status}`)
  }

  console.log(`\n  Max validated deviation: ${(valMaxDev * 100).toFixed(2)}%`)
  console.log(`  Within ±1%: ${valIn1}/28`)
  console.log(`  Within ±0.5%: ${sortedResults.filter(([,s]) => Math.abs(s.winRate - EXPECTED_WR) <= 0.005).length}/28`)
  console.log(``)
}

main()
