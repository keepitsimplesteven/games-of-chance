/** Visual configuration for a composed robot */
export interface RobotVisual {
  headType: "square" | "rounded" | "triangular" | "hexagonal"
  bodyType: "square" | "rounded" | "triangular" | "hexagonal"
  weaponType: "drill" | "blaster" | "bazooka"
  color: string                 // hex color from theme palette
}

/** A robot template defining base stats */
export interface RobotTemplate {
  id: string                    // unique template identifier
  name: string                  // display name (e.g., "Iron Crusher")
  hp: number                    // base hit points
  accuracy: number              // hit chance percentage (1-100)
  damageMin: number             // minimum damage per hit
  damageMax: number             // maximum damage per hit
  visualId: string              // legacy: kept for compatibility
  visual: RobotVisual           // composed robot visual config
}

/** A robot instance assigned to a player for a game */
export interface RobotInstance {
  templateId: string            // references RobotTemplate.id
  ownerId: string               // player ID or bot persona ID
  currentHp: number             // mutable during battle
  maxHp: number                 // for HP bar percentage display
  accuracy: number              // copied from template at creation
  damageMin: number
  damageMax: number
}

/** Robot selection options presented to a player */
export interface RobotOptions {
  playerId: string
  options: RobotTemplate[]      // exactly 3 options
}

/** A player's pick in Round 1 */
export interface BattleBotsPick {
  robotTemplateId: string       // which of the 3 options they chose
}

/** A 1v1 battle pairing */
export interface BattlePairing {
  id: string                    // unique battle ID
  player1Id: string
  player2Id: string
  robot1: RobotInstance
  robot2: RobotInstance
  winnerId: string | null       // set when battle concludes
  loserId: string | null
  tickLog: TickEvent[]          // full history for replay
}

/** A single tick event for battle log */
export interface TickEvent {
  tick: number
  attacks: AttackResult[]
}

export interface AttackResult {
  attackerId: string            // robot owner ID
  targetId: string              // target owner ID
  hit: boolean                  // whether accuracy roll succeeded
  damage: number                // 0 if miss, actual damage if hit
  targetHpAfter: number         // HP of target after this attack
}

/** FFA bracket state */
export interface FFABracket {
  id: string                    // "winners" or "losers"
  participants: RobotInstance[]
  eliminationOrder: string[]    // player IDs in order eliminated (first = eliminated first)
  tickLog: TickEvent[]
}

/** Bot persona — system-generated filler player */
export interface BotPersona {
  id: string                    // prefixed with "bot_" for easy identification
  name: string                  // generated name (e.g., "MechBot-7")
  isBot: true                   // discriminator
}

/** Overall game state tracked across all 3 rounds */
export interface BattleBotsGameState {
  participants: string[]                    // all player IDs + bot persona IDs
  botPersonas: BotPersona[]                 // bot personas created for this game
  robotOptions: Record<string, RobotOptions>// per-player options in prep phase
  selectedRobots: Record<string, RobotInstance>  // final selections after Round 1
  pairings: BattlePairing[]                 // Round 2 matchups
  winnersBracket: FFABracket | null         // Round 3 winners
  losersBracket: FFABracket | null          // Round 3 losers
  finalRankings: FinalRanking[]             // computed after Round 3
}

export interface FinalRanking {
  playerId: string
  playerName: string
  rank: number
  bracket: "winners" | "losers"
  isBot: boolean
}

/** Tick update sent to clients during battles */
export interface BattleTickUpdate {
  type: "BATTLE_TICK"
  payload: {
    tick: number
    battles: BattleHPSnapshot[]
  }
}

export interface BattleHPSnapshot {
  battleId: string              // pairing ID or bracket ID
  robots: { ownerId: string; currentHp: number; eliminated: boolean }[]
}
