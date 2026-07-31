import type { GameType } from "@games-of-chance/shared"
import type { GamePlugin } from "./GamePlugin"

/**
 * Registry that maps game type strings to their plugin implementations.
 * Use the exported singleton `registry` instance.
 */
export class GameRegistry {
  private plugins = new Map<GameType, GamePlugin>()

  /** Register a game plugin. Overwrites any existing plugin for the same gameType. */
  register(plugin: GamePlugin): void {
    this.plugins.set(plugin.gameType, plugin)
  }

  /** Look up a plugin by game type. Throws if not registered. */
  lookup(gameType: GameType): GamePlugin {
    const plugin = this.plugins.get(gameType)
    if (!plugin) throw new Error(`Unknown gameType: ${gameType}`)
    return plugin
  }

  /** List all registered game types. */
  list(): GameType[] {
    return Array.from(this.plugins.keys())
  }
}

/** Singleton game registry instance */
export const registry = new GameRegistry()
