import type { GameType } from "@games-of-chance/shared";
import type { GamePlugin } from "./GamePlugin";
/**
 * Registry that maps game type strings to their plugin implementations.
 * Use the exported singleton `registry` instance.
 */
export declare class GameRegistry {
    private plugins;
    /** Register a game plugin. Overwrites any existing plugin for the same gameType. */
    register(plugin: GamePlugin): void;
    /** Look up a plugin by game type. Throws if not registered. */
    lookup(gameType: GameType): GamePlugin;
    /** List all registered game types. */
    list(): GameType[];
}
/** Singleton game registry instance */
export declare const registry: GameRegistry;
