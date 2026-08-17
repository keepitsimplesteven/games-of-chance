/**
 * Battle Bots — Crit & Dodge Exploration
 *
 * Tests how adding crit rate (from accuracy stars) and/or dodge (from accuracy stars)
 * affects balance between the extreme builds and the balanced build.
 *
 * Crit: On hit, roll crit chance. If crit, damage is multiplied by critMultiplier.
 *   - Crit chance scales with accuracy stars: low at 1 star, high at 7 stars
 *   - Gives accuracy builds burst potential to compensate for lower base DPS
 *
 * Dodge: On being attacked, roll dodge chance. If dodged, take 0 damage.
 *   - Dodge chance scales with accuracy stars
 *   - Gives accuracy builds survivability
 *
 * Uses maxHit cap of 33, same modifier table as tuneMatchupsLowDmg.
 *
 * Usage: npx tsx packages/server/src/games/battle-bots/scripts/tuneCritDodge.ts
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const TICK_LIMIT = 1000
const TRIALS = 100_000
const BASE_HP = 100
const BASE_MAX_HIT = 5
const BASE_ACCURACY = 56
const MAX_HIT_CAP = 33
const MAX_ACCURACY = 95 // raised from 90

// ─── Modifier Table ───────────────────────────────────────────────────────────

const TABLE = {
  1: { damageMultiplier: 2.8, accuracyMultiplier: 0.54, attackEnergyPerTick: 12 },
  2: { damageMultiplier: 3.2, accuracyMultiplier: 0.68, attackEnergyPerTick: 15 },
  3: { damageMultiplier: 3.7, accuracyMultiplier: 0.82, attackEnergyPerTick: 19 },
  4: { damageMultiplier: 4.2, accuracyMultiplier: 0.98, attackEnergyPerTick: 24 },
  5: { damageMultiplier: 4.8, accuracyMultiplier: 1.14, attackEnergyPerTick: 31 },
  6: { damageMultiplier: 5.6, accuracyMultiplier: 1.34, attackEnergyPerTick: 39 },
  7: { damageMultiplier: 6.6, accuracyMultiplier: 1.70, attackEnergyPerTick: 50 },
}

// ─── Crit Table (scales with accuracy stars) ─────────────────────────────────
// Low/no crit at low accuracy, large crit at high accuracy

const CRIT_TABLE: Record<number, { critChance: number; critMultiplier: number }> = {
  1: { critChance: 0.00, critMultiplier: 1.0 },  // no crit
  2: { critChance: 0.03, critMultiplier: 1.5 },  // 3% chance, 1.5x
  3: { critChance: 0.06, critMultiplier: 1.5 },  // 6% chance, 1.5x
  4: { critChance: 0.10, critMultiplier: 1.75 }, // 10% chance, 1.75x
  5: { critChance: 0.15, critMultiplier: 2.0 },  // 15% chance, 2x
  6: { critChance: 0.22, critMultiplier: 2.0 },  // 22% chance, 2x
  7: { critChance: 0.30, critMultiplier: 2.5 },  // 30% chance, 2.5x — big payoff for full investment
}

// ─── Dodge Table (scales with accuracy stars) ─────────────────────────────────

const DODGE_TABLE: Record<number, number> = {
  1: 0.00,  // no dodge
  2: 0.03,  // 3%
  3: 0.06,  // 6%
  4: 0.10,  // 10%
  5: 0.14,  // 14%
  6: 0.18,  // 18%
  7: 0.25,  // 25% — significant but not dominant
}

// ─── POC Builds ───────────────────────────────────────────────────────────────

const POC_BUILDS = [
  { damage: 7, accuracy: 1, speed: 1, label: "7-1-1 Glass Cannon" },
  { damage: 1, accuracy: 7, speed: 1, label: "1-7-1 Sharpshooter" },
  { damage: 1, accuracy: 1, speed: 7, label: "1-1-7 Speedster" },
  { damage: 3, accuracy: 3, speed: 3, label: "3-3-3 Balanced" },
]

// ─── Types ────────────────────────────────────────────────────────────────────

interface BotStats {
  label: string
  maxHit: number
  accuracy: number
  energyPerTick: number
  critChance: number
  critMultiplier: number
  dodge: number
  hp: number
}

// ─── Stat Derivation ──────────────────────────────────────────────────────────

function deriveStats(build: typeof POC_BUILDS[0]): BotStats {
  const d = TABLE[build.damage as keyof typeof TABLE]
  const a = TABLE[build.accuracy as keyof typeof TABLE]
  const s = TABLE[build.speed as keyof typeof TABLE]
  const crit = CRIT_TABLE[build.accuracy]
  const dodge = DODGE_TABLE[build.accuracy]

  return {
    label: build.label,
    maxHit: Math.min(Math.max(1, Math.floor(BASE_MAX_HIT * d.damageMultiplier)), MAX_HIT_CAP),
    accuracy: Math.min(Math.floor(BASE_ACCURACY * a.accuracyMultiplier), MAX_ACCURACY),
    energyPerTick: s.attackEnergyPerTick,
    critChance: crit.critChance,
    critMultiplier: crit.critMultiplier,
    dodge,
    hp: BASE_HP,
  }
}

// ─── Simulation Modes ─────────────────────────────────────────────────────────

type Mode = "base" | "crit" | "dodge" | "crit+dodge"

function simulate(botA: BotStats, botB: BotStats, mode: Mode, trials: number): number {
  const useCrit = mode === "crit" || mode === "crit+dodge"
  const useDodge = mode === "dodge" || mode === "crit+dodge"
  let winsA = 0

  for (let t = 0; t < trials; t++) {
    let hpA = botA.hp
    let hpB = botB.hp
    let energyA = 0
    let energyB = 0
    let resolved = false

    for (let tick = 1; tick <= TICK_LIMIT; tick++) {
      // Bot A attacks
      energyA += botA.energyPerTick
      if (energyA >= 100) {
        energyA -= 100
        if (Math.random() * 100 < botA.accuracy) {
          // Dodge check (B dodges based on B's accuracy stars)
          if (useDodge && Math.random() < botB.dodge) {
            // dodged — no damage
          } else {
            let dmg = Math.floor(Math.random() * botA.maxHit) + 1
            // Crit check (A crits based on A's accuracy stars)
            if (useCrit && Math.random() < botA.critChance) {
              dmg = Math.min(MAX_HIT_CAP, Math.round(dmg * botA.critMultiplier))
            }
            hpB -= dmg
          }
        }
        if (hpB <= 0) { winsA++; resolved = true; break }
      }

      // Bot B attacks
      energyB += botB.energyPerTick
      if (energyB >= 100) {
        energyB -= 100
        if (Math.random() * 100 < botB.accuracy) {
          if (useDodge && Math.random() < botA.dodge) {
            // dodged
          } else {
            let dmg = Math.floor(Math.random() * botB.maxHit) + 1
            if (useCrit && Math.random() < botB.critChance) {
              dmg = Math.min(MAX_HIT_CAP, Math.round(dmg * botB.critMultiplier))
            }
            hpA -= dmg
          }
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

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log(`\n🤖 Battle Bots — Crit & Dodge Exploration`)
  console.log(`${"─".repeat(70)}`)
  console.log(`MaxHit cap: ${MAX_HIT_CAP} | Max accuracy: ${MAX_ACCURACY}%`)
  console.log(`Trials per matchup: ${TRIALS.toLocaleString()}`)

  const bots = POC_BUILDS.map(deriveStats)

  // Stats table
  console.log(`\n📋 Derived Stats:`)
  console.log(`  ${"Build".padEnd(22)} ${"MaxHit".padEnd(8)} ${"Acc%".padEnd(7)} ${"EPT".padEnd(6)} ${"Crit%".padEnd(8)} ${"CritX".padEnd(8)} ${"Dodge%"}`)
  console.log(`  ${"─".repeat(65)}`)
  for (const bot of bots) {
    console.log(`  ${bot.label.padEnd(22)} ${String(bot.maxHit).padEnd(8)} ${String(bot.accuracy).padEnd(7)} ${String(bot.energyPerTick).padEnd(6)} ${(bot.critChance * 100).toFixed(0).padEnd(8)} ${bot.critMultiplier.toFixed(1).padEnd(8)} ${(bot.dodge * 100).toFixed(0)}`)
  }

  // Expected DPS with crit factored in
  console.log(`\n📋 Expected DPS (with crit bonus):`)
  console.log(`  ${"Build".padEnd(22)} ${"Base DPS".padEnd(10)} ${"+ Crit DPS".padEnd(12)} ${"Effective DPS"}`)
  console.log(`  ${"─".repeat(55)}`)
  for (const bot of bots) {
    const atkRate = bot.energyPerTick / 100
    const avgDmg = (bot.maxHit + 1) / 2
    const baseDps = atkRate * (bot.accuracy / 100) * avgDmg
    const critBonus = bot.critChance * (bot.critMultiplier - 1)
    const effectiveDps = baseDps * (1 + critBonus)
    console.log(`  ${bot.label.padEnd(22)} ${baseDps.toFixed(3).padEnd(10)} ${effectiveDps.toFixed(3).padEnd(12)} ${effectiveDps.toFixed(3)}`)
  }

  const modes: Mode[] = ["base", "crit", "dodge", "crit+dodge"]

  for (const mode of modes) {
    console.log(`\n${"═".repeat(70)}`)
    console.log(`  MODE: ${mode.toUpperCase()}`)
    console.log(`${"═".repeat(70)}`)
    console.log(`  ${"Matchup".padEnd(35)} ${"A Win%".padEnd(10)} ${"In 45-55%?"}`)
    console.log(`  ${"─".repeat(55)}`)

    const winRates: number[] = []
    for (let i = 0; i < bots.length; i++) {
      for (let j = i + 1; j < bots.length; j++) {
        const wr = simulate(bots[i], bots[j], mode, TRIALS)
        winRates.push(wr)
        const inRange = wr >= 0.45 && wr <= 0.55
        console.log(`  ${(bots[i].label + " vs " + bots[j].label).padEnd(35)} ${(wr * 100).toFixed(1)}%     ${inRange ? "✅" : "❌"}`)
      }
    }

    const maxDev = Math.max(...winRates.map(wr => Math.abs(wr - 0.5)))
    const avgDev = winRates.reduce((sum, wr) => sum + Math.abs(wr - 0.5), 0) / winRates.length
    const within5 = winRates.filter(wr => wr >= 0.45 && wr <= 0.55).length
    console.log(`\n  Max deviation: ${(maxDev * 100).toFixed(1)}% | Avg: ${(avgDev * 100).toFixed(1)}% | In band: ${within5}/${winRates.length}`)
  }

  console.log(`\n${"═".repeat(70)}`)
  console.log(`  ANALYSIS`)
  console.log(`${"═".repeat(70)}`)
  console.log(`  Compare how each mode shifts the sharpshooter's (1-7-1) matchups.`)
  console.log(`  Crit should help 1-7-1 by giving it burst damage on its frequent hits.`)
  console.log(`  Dodge should help 1-7-1 by letting it survive longer against heavy hitters.`)
  console.log(``)
}

main()
