/**
 * Registry that maps game type strings to their plugin implementations.
 * Use the exported singleton `registry` instance.
 */
export class GameRegistry {
    plugins = new Map();
    /** Register a game plugin. Overwrites any existing plugin for the same gameType. */
    register(plugin) {
        this.plugins.set(plugin.gameType, plugin);
    }
    /** Look up a plugin by game type. Throws if not registered. */
    lookup(gameType) {
        const plugin = this.plugins.get(gameType);
        if (!plugin)
            throw new Error(`Unknown gameType: ${gameType}`);
        return plugin;
    }
    /** List all registered game types. */
    list() {
        return Array.from(this.plugins.keys());
    }
}
/** Singleton game registry instance */
export const registry = new GameRegistry();
