import * as readline from "node:readline"
import { createDriveState, resolveDown, isDriveComplete, getDriveCompletion } from "./engine"
import { DEFAULT_PLAY_CONFIG, DEFAULT_PLAY_MATRIX } from "./config"
import type { DefensivePlayId, OffensivePlayId, DriveState } from "./types"
import {
  OFFENSE_STRATEGIES,
  DEFENSE_STRATEGIES,
  type OffenseStrategy,
  type DefenseStrategy,
} from "./strategies"

const rng = () => Math.random()

const OFFENSIVE_PLAYS: OffensivePlayId[] = ["run-safe", "run-aggressive", "pass-safe", "pass-aggressive"]
const DEFENSIVE_PLAYS: DefensivePlayId[] = ["run-safe", "run-aggressive", "pass-safe", "pass-aggressive"]

const OFFENSE_LABELS: Record<string, string> = {
  "1": "Inside Run (run-safe)",
  "2": "Outside Run (run-aggressive)",
  "3": "Short Pass (pass-safe)",
  "4": "Deep Pass (pass-aggressive)",
}

const DEFENSE_LABELS: Record<string, string> = {
  "1": "Run Contain (run-safe)",
  "2": "Blitz (run-aggressive)",
  "3": "Zone Coverage (pass-safe)",
  "4": "Man Press (pass-aggressive)",
}

function inputToOffensivePlay(input: string): OffensivePlayId | null {
  switch (input.trim()) {
    case "1": return "run-safe"
    case "2": return "run-aggressive"
    case "3": return "pass-safe"
    case "4": return "pass-aggressive"
    default: return null
  }
}

function inputToDefensivePlay(input: string): DefensivePlayId | null {
  switch (input.trim()) {
    case "1": return "run-safe"
    case "2": return "run-aggressive"
    case "3": return "pass-safe"
    case "4": return "pass-aggressive"
    default: return null
  }
}

function formatDown(down: number): string {
  switch (down) {
    case 1: return "1st"
    case 2: return "2nd"
    case 3: return "3rd"
    case 4: return "4th"
    default: return `${down}th`
  }
}

type Side = "offense" | "defense"

function parseArgs(): { side: Side | null; botStrategy: string | null; count: number } {
  const args = process.argv.slice(2)
  let side: Side | null = null
  let botStrategy: string | null = null
  let count = 1

  for (let i = 0; i < args.length; i++) {
    const arg = args[i].toLowerCase().replace(/^--?/, "")
    if (arg === "offense" || arg === "o") side = "offense"
    else if (arg === "defense" || arg === "d") side = "defense"
    else if (arg === "bot" && args[i + 1]) { botStrategy = args[++i]; }
    else if (arg.startsWith("bot=")) botStrategy = arg.split("=")[1]
    else if (arg === "count" && args[i + 1]) { count = parseInt(args[++i], 10) || 1; }
    else if (arg.startsWith("count=")) count = parseInt(arg.split("=")[1], 10) || 1
  }

  return { side, botStrategy, count }
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const ask = (question: string): Promise<string> =>
    new Promise((resolve) => rl.question(question, resolve))

  const { side: argSide, botStrategy: argBot, count } = parseArgs()

  console.log("=== PLAYCALLER DRIVE ENGINE - CLI ===")
  console.log("")

  // Determine side
  let side: Side = argSide ?? "offense"
  if (!argSide) {
    console.log("Which side do you want to play?")
    console.log("  1) Offense")
    console.log("  2) Defense")
    let chosen = false
    while (!chosen) {
      const input = await ask("> ")
      if (input.trim() === "1" || input.trim().toLowerCase() === "offense") {
        side = "offense"
        chosen = true
      } else if (input.trim() === "2" || input.trim().toLowerCase() === "defense") {
        side = "defense"
        chosen = true
      } else {
        console.log("Enter 1 or 2.")
      }
    }
  }

  // Determine bot strategy
  let botStrategyName = argBot ?? "random"
  const availableStrategies = side === "offense" ? DEFENSE_STRATEGIES : OFFENSE_STRATEGIES

  if (!argBot) {
    console.log("")
    console.log("Choose bot strategy:")
    const entries = Object.entries(availableStrategies)
    entries.forEach(([key, { info }], idx) => {
      console.log(`  ${idx + 1}) ${info.name} — ${info.description}`)
    })

    let chosen = false
    while (!chosen) {
      const input = await ask("> ")
      const num = parseInt(input.trim(), 10)
      if (num >= 1 && num <= entries.length) {
        botStrategyName = entries[num - 1][0]
        chosen = true
      } else if (entries.some(([key]) => key === input.trim().toLowerCase())) {
        botStrategyName = input.trim().toLowerCase()
        chosen = true
      } else {
        console.log(`Enter 1-${entries.length} or a strategy name.`)
      }
    }
  }

  if (!availableStrategies[botStrategyName]) {
    console.log(`Unknown strategy "${botStrategyName}". Available: ${Object.keys(availableStrategies).join(", ")}`)
    rl.close()
    return
  }

  const playingOffense = side === "offense"
  const botInfo = availableStrategies[botStrategyName].info

  console.log("")
  if (playingOffense) {
    console.log(`You are on OFFENSE vs Bot (${botInfo.name}). Drive 25 yards for a touchdown!`)
  } else {
    console.log(`You are on DEFENSE vs Bot (${botInfo.name}). Stop them from scoring!`)
  }
  console.log("")

  let wins = 0
  let losses = 0

  for (let game = 0; game < count; game++) {
    if (count > 1) console.log(`--- Game ${game + 1} of ${count} ---`)

    let state: DriveState = playingOffense
      ? createDriveState("player-you", "bot", 10, 1)
      : createDriveState("bot", "player-you", 10, 1)

    while (!isDriveComplete(state)) {
      console.log(`--- ${formatDown(state.down)} & ${state.yardsToGo} | Ball on ${state.yardLine}-yard line ---`)

      let offensivePlay: OffensivePlayId
      let defensivePlay: DefensivePlayId

      if (playingOffense) {
        // Player picks offense
        if (count === 1) {
          console.log("Pick your play:")
          console.log("  1) Inside Run")
          console.log("  2) Outside Run")
          console.log("  3) Short Pass")
          console.log("  4) Deep Pass")

          let picked: OffensivePlayId | null = null
          while (!picked) {
            const input = await ask("> ")
            picked = inputToOffensivePlay(input)
            if (!picked) console.log("Invalid selection. Enter 1, 2, 3, or 4.")
          }
          offensivePlay = picked
        } else {
          // In multi-game mode, use fundamentals for the player
          offensivePlay = OFFENSE_STRATEGIES.fundamentals.strategy(state, rng)
        }

        // Bot picks defense
        const botStrat = (availableStrategies[botStrategyName] as { strategy: DefenseStrategy }).strategy
        defensivePlay = botStrat(state, rng)
      } else {
        // Bot picks offense
        const botStrat = (availableStrategies[botStrategyName] as { strategy: OffenseStrategy }).strategy
        offensivePlay = botStrat(state, rng)

        // Player picks defense
        if (count === 1) {
          console.log("Pick your defensive play:")
          console.log("  1) Run Contain")
          console.log("  2) Blitz")
          console.log("  3) Zone Coverage")
          console.log("  4) Man Press")

          let picked: DefensivePlayId | null = null
          while (!picked) {
            const input = await ask("> ")
            picked = inputToDefensivePlay(input)
            if (!picked) console.log("Invalid selection. Enter 1, 2, 3, or 4.")
          }
          defensivePlay = picked
        } else {
          defensivePlay = DEFENSE_STRATEGIES.fundamentals.strategy(state, rng)
        }
      }

      const resolved = resolveDown(state, offensivePlay, defensivePlay, rng, DEFAULT_PLAY_CONFIG, DEFAULT_PLAY_MATRIX)
      state = resolved.state
      const result = resolved.result

      if (count === 1) {
        console.log("")
        if (playingOffense) {
          console.log(`  You: ${OFFENSE_LABELS[(OFFENSIVE_PLAYS.indexOf(offensivePlay) + 1).toString()]}`)
          console.log(`  Bot: ${DEFAULT_PLAY_CONFIG.defensivePlays[defensivePlay].name} (${defensivePlay})`)
        } else {
          console.log(`  Bot: ${DEFAULT_PLAY_CONFIG.offensivePlays[offensivePlay].name} (${offensivePlay})`)
          console.log(`  You: ${DEFENSE_LABELS[(DEFENSIVE_PLAYS.indexOf(defensivePlay) + 1).toString()]}`)
        }
        console.log(`  >> ${result.playByPlayText}`)
        console.log("")
      }
    }

    const completion = getDriveCompletion(state)
    const youWon = completion.winner === "player-you"

    if (count === 1) {
      console.log("=== DRIVE COMPLETE ===")
      console.log(`Result: ${completion.endingType.replace(/_/g, " ").toUpperCase()}`)
      console.log(`Winner: ${youWon ? "YOU" : "BOT"}`)
      console.log(`Plays run: ${state.playHistory.length}`)
    } else {
      const icon = youWon ? "✓" : "✗"
      console.log(`  ${icon} ${completion.endingType.replace(/_/g, " ")} (${state.playHistory.length} plays) — ${youWon ? "YOU" : "BOT"}`)
    }

    if (youWon) wins++
    else losses++
  }

  if (count > 1) {
    console.log("")
    console.log(`=== RESULTS: ${wins}W - ${losses}L (${(wins / count * 100).toFixed(1)}% win rate) ===`)
  }

  rl.close()
}

main().catch((err) => {
  console.error("Error:", err)
  process.exit(1)
})
