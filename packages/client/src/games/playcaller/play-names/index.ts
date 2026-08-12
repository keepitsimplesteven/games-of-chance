// packages/client/src/games/playcaller/play-names/index.ts

import type { PlayPoolRegistry, PlaySlot } from "./types"
import { offensePlayPool } from "./offense-names"
import { defensePlayPool } from "./defense-names"
import { validatePlayDefinition } from "./validate"

export { offensePlayPool } from "./offense-names"
export { defensePlayPool } from "./defense-names"
export { classifyCircumstance } from "./classify"
export { selectPlay } from "./select"
export { validatePlayDefinition } from "./validate"
export type {
  Circumstance,
  PlaySlot,
  PlayDefinition,
  PlayPool,
  PlayPoolRegistry,
} from "./types"

/** Combined registry of offense and defense play pools */
export const playPoolRegistry: PlayPoolRegistry = {
  offense: offensePlayPool,
  defense: defensePlayPool,
}

/**
 * Validate all PlayDefinitions at module load time.
 * In development mode: throws on the first invalid definition.
 * In production mode: logs warnings for invalid definitions.
 */
function validateRegistry(registry: PlayPoolRegistry): void {
  const roles = ["offense", "defense"] as const
  const slots: PlaySlot[] = ["run-safe", "run-aggressive", "pass-safe", "pass-aggressive"]

  for (const role of roles) {
    const pool = registry[role]
    for (const slot of slots) {
      const definitions = pool[slot]
      for (let i = 0; i < definitions.length; i++) {
        try {
          validatePlayDefinition(definitions[i])
        } catch (error) {
          const message = `Invalid PlayDefinition in ${role}/${slot}[${i}]: ${(error as Error).message}`
          if (process.env.NODE_ENV === "development") {
            throw new Error(message)
          } else {
            console.warn(message)
          }
        }
      }
    }
  }
}

// Run validation at module load time
validateRegistry(playPoolRegistry)
