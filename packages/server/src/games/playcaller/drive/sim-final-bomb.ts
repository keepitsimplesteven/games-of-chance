/**
 * Simulation script: "24-yard bomb on play 1" in a Final with minPlays=8
 *
 * Demonstrates the edge case where the offense gains 24 yards on the first play
 * (1st & goal at the 1) and the suppressEarlyEnding logic kicks in.
 *
 * Usage: npx tsx packages/server/src/games/playcaller/drive/sim-final-bomb.ts
 */

import { createDriveState } from "./engine"
import { resolveLotteryDown } from "../lottery/lotteryDriveResolver"
import { DEFAULT_PLAY_CONFIG, DEFAULT_PLAY_MATRIX } from "./config"
import type { DriveState, OffensivePlayId, DefensivePlayId } from "./types"
import { PLAYCALLER } from "../constants"

const OFFENSIVE_PLAYS: OffensivePlayId[] = ["run-safe", "run-aggressive", "pass-safe", "pass-aggressive"]
const DEFENSIVE_PLAYS: DefensivePlayId[] = ["run-safe", "run-aggressive", "pass-safe", "pass-aggressive"]

function formatDown(down: number): string {
  switch (down) {
    case 1: return "1st"
    case 2: return "2nd"
    case 3: return "3rd"
    case 4: return "4th"
    default: return `${down}th`
  }
}

/**
 * Creates a rigged RNG that forces a critical success with ~24 yards on play 1,
 * then falls back to real Math.random for all subsequent rolls.
 *
 * The resolveDown roll sequence for a success path is:
 *   1. successRoll (< successRate → success)
 *   2. critSuccessRoll (< critSuccess → critical)
 *   3. bonusRoll (determines yards: max + bonusRoll * max * 0.2)
 *
 * For pass-aggressive vs run-safe (weak counter):
 *   - successRate ~0.45 + 0.10 = 0.55 → need roll < 0.55
 *   - critSuccess ~0.15 + 0.05 = 0.20 → need roll < 0.20
 *   - yardageRange max = 15 + 5 = 20, crit max = 20 + 20*0.2 = 24
 *   - bonusRoll of 1.0 → round(20 + 1.0 * 4) = 24 yards
 */
function createRiggedRng(): () => number {
  let callCount = 0
  const riggedValues = [
    0.1,  // successRoll: < 0.55 → success
    0.05, // critSuccessRoll: < 0.20 → critical success
    1.0,  // bonusRoll: max bonus → 24 yards
  ]

  return () => {
    callCount++
    if (callCount <= riggedValues.length) {
      return riggedValues[callCount - 1]
    }
    return Math.random()
  }
}

function randomPlay<T>(plays: T[]): T {
  return plays[Math.floor(Math.random() * plays.length)]
}

// --- Run the simulation ---

console.log("=== FINAL GAME SIMULATION: 24-Yard Bomb on Play 1 ===")
console.log(`minPlays = ${PLAYCALLER.FINAL_MIN_PLAYS}`)
console.log("")

// Offense is the predetermined winner (they must win the drive)
const predeterminedWinner = "offense-player"

let state: DriveState = createDriveState("offense-player", "defense-player", 10, 1)
const rng = createRiggedRng()

// Play 1: force pass-aggressive vs run-safe for maximum yardage potential
const play1Offense: OffensivePlayId = "pass-aggressive"
const play1Defense: DefensivePlayId = "run-safe"

console.log(`--- ${formatDown(state.down)} & ${state.yardsToGo} | Ball on ${state.yardLine}-yard line ---`)
console.log(`  Offense: ${play1Offense} | Defense: ${play1Defense}`)

const result1 = resolveLotteryDown(
  state,
  play1Offense,
  play1Defense,
  rng,
  DEFAULT_PLAY_CONFIG,
  DEFAULT_PLAY_MATRIX,
  predeterminedWinner,
  PLAYCALLER.FINAL_MIN_PLAYS
)

state = result1.state
console.log(`  >> ${result1.result.playByPlayText}`)
console.log(`  Outcome: ${result1.result.outcome}, Yards: ${result1.result.yardsGained}`)
console.log(`  New yard line: ${state.yardLine}, Down: ${formatDown(state.down)} & ${state.yardsToGo}`)
console.log("")

// Remaining plays: random picks, real RNG (rng already falls through to Math.random)
let playNum = 2
while (!state.isComplete) {
  const offPlay = randomPlay(OFFENSIVE_PLAYS)
  const defPlay = randomPlay(DEFENSIVE_PLAYS)

  console.log(`--- ${formatDown(state.down)} & ${state.yardsToGo} | Ball on ${state.yardLine}-yard line ---`)
  console.log(`  Offense: ${offPlay} | Defense: ${defPlay}`)

  const resolved = resolveLotteryDown(
    state,
    offPlay,
    defPlay,
    Math.random, // real RNG from play 2 onward
    DEFAULT_PLAY_CONFIG,
    DEFAULT_PLAY_MATRIX,
    predeterminedWinner,
    PLAYCALLER.FINAL_MIN_PLAYS
  )

  state = resolved.state
  console.log(`  >> ${resolved.result.playByPlayText}`)
  console.log(`  Outcome: ${resolved.result.outcome}, Yards: ${resolved.result.yardsGained}`)
  console.log(`  New yard line: ${state.yardLine}, Down: ${formatDown(state.down)} & ${state.yardsToGo}`)
  console.log("")
  playNum++

  // Safety valve
  if (playNum > 30) {
    console.log("!!! Safety valve hit — 30 plays exceeded !!!")
    break
  }
}

if (state.completion) {
  console.log("=== DRIVE COMPLETE ===")
  console.log(`Result: ${state.completion.endingType.replace(/_/g, " ").toUpperCase()}`)
  console.log(`Winner: ${state.completion.winner}`)
  console.log(`Total plays: ${state.playHistory.length}`)
}
