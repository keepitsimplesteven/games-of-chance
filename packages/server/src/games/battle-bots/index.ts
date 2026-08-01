// Side-effect import: registers the battle-bots plugin in the global registry
import { registry } from "../GameRegistry"
import { battleBotsPlugin } from "./BattleBotsPlugin"

registry.register(battleBotsPlugin)
