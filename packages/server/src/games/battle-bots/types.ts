// ─── Union Types ───────────────────────────────────────────────────────────────

export type WeaponType = "drill" | "blaster" | "bazooka"
export type HeadType = "square" | "rounded" | "triangular" | "hexagonal"
export type BodyType = "square" | "rounded" | "triangular" | "hexagonal"

// ─── Visual Config ────────────────────────────────────────────────────────────

/** Visual configuration for a composed robot (new system) */
export interface RobotVisual {
  weapon?: WeaponType
  head?: HeadType
  body?: BodyType
  // Legacy fields (used by existing plugin before task 4 overhaul)
  weaponType?: WeaponType
  headType?: HeadType
  bodyType?: BodyType
  color?: string
}

// ─── Build / Pick ─────────────────────────────────────────────────────────────

/** Player's build pick submitted during prep phase */
export interface BattleBotsPick {
  weapon: WeaponType
  head: HeadType
  body: BodyType
  color?: string
}

// ─── Combat Entities ──────────────────────────────────────────────────────────

/** A robot's complete combat-ready state */
export interface CombatRobot {
  ownerId: string
  name: string
  maxHit: number
  accuracy: number       // capped at 90
  tickInterval: number
  currentHp: number
  maxHp: number          // always BASE_HP (100)
  stars: { damage: number; accuracy: number; speed: number }
  visual: RobotVisual
}

// ─── Tick Log Types ───────────────────────────────────────────────────────────

/** An individual attack event within a tick */
export interface AttackEvent {
  attackerId: string
  targetId: string
  hit: boolean
  damage: number          // 0 if miss
  targetHpAfter: number   // HP after damage (minimum 0)
}

/** A single tick in the battle log */
export interface TickEntry {
  tick: number
  attacks: AttackEvent[]
  eliminations: string[]  // ownerIds eliminated this tick
}

/** Complete tick log payload sent to clients */
export interface TickLogPayload {
  battleId: string
  robots: Array<{
    ownerId: string
    name: string
    stars: { damage: number; accuracy: number; speed: number }
    visual: RobotVisual
    maxHp: number
  }>
  tickLog: TickEntry[]
  gameSpeed: number       // ms per tick for client playback
}

// ─── Game State ───────────────────────────────────────────────────────────────

/** Updated battle pairing */
export interface BattlePairing {
  id: string
  player1Id: string
  player2Id: string
  winnerId: string | null
  loserId?: string | null
  tickLog: TickEntry[]
  // Legacy fields (used by PairingEngine before task 4 overhaul)
  robot1?: RobotInstance
  robot2?: RobotInstance
}

/** FFA bracket state */
export interface FFABracketState {
  id: string              // "winners" | "losers"
  participantIds: string[]
  eliminationOrder: Array<{ ownerId: string; eliminatedOnTick: number }>
  survivorId: string | null
  tickLog: TickEntry[]
}

/** Bot persona — system-generated filler player */
export interface BotPersona {
  id: string              // prefixed with "bot_" for easy identification
  name: string            // generated name (e.g., "MechBot-7")
  isBot: true             // discriminator
}

/** Final ranking entry for a player */
export interface FinalRanking {
  playerId: string
  playerName: string
  rank: number
  bracket: "winners" | "losers"
  isBot: boolean
  score: number
}

/** Overall game state tracked across all 3 rounds */
export interface BattleBotsGameState {
  participants: string[]
  botPersonas: BotPersona[]
  builds?: Record<string, CombatRobot>   // new system (task 4)
  pairings: BattlePairing[]
  winnersBracket: FFABracketState | FFABracket | null
  losersBracket: FFABracketState | FFABracket | null
  finalRankings: FinalRanking[]
  // Legacy fields (used by pre-overhaul code, will be removed in task 4)
  robotOptions?: Record<string, RobotOptions>
  selectedRobots?: Record<string, RobotInstance>
}


// ─── Legacy Types (used by pre-overhaul code, will be removed in task 4) ──────

/** Legacy robot instance — flat-stat model before part-based system */
export interface RobotInstance {
  templateId: string
  ownerId: string
  currentHp: number
  maxHp: number
  accuracy: number
  damageMin: number
  damageMax: number
}

/** Legacy robot template — generated options for player selection */
export interface RobotTemplate {
  id: string
  name: string
  hp: number
  accuracy: number
  damageMin: number
  damageMax: number
  visualId: string
  visual: RobotVisual
}

/** Legacy robot options — set of templates offered to a player */
export interface RobotOptions {
  playerId: string
  options: RobotTemplate[]
}

/** Legacy tick event — used by RankingEngine for elimination detection */
export interface TickEvent {
  tick: number
  attacks: AttackEvent[]
  eliminations?: string[]
}

/** Legacy FFA bracket — used by RankingEngine */
export interface FFABracket {
  id?: string
  participants: RobotInstance[] | string[]
  eliminationOrder: string[]
  tickLog: TickEvent[]
}

/** Legacy battle pairing — used by PairingEngine with robot1/robot2 */
export interface LegacyBattlePairing {
  id: string
  player1Id: string
  player2Id: string
  robot1: RobotInstance
  robot2: RobotInstance
  winnerId: string | null
  loserId: string | null
  tickLog: TickEntry[]
}
