import { actionRegistry } from "../ActionRegistry"
import KickPlayerIcon from "./icons/KickPlayerIcon"
import KickPlayerView from "./views/KickPlayerView"

actionRegistry.register({
  id: "kick-player",
  label: "Kick Player",
  icon: KickPlayerIcon,
  isAvailable: (roomState, currentPlayerId) => {
    // Available when there are connected non-host players to kick
    return roomState.players.some(
      (p) => p.id !== currentPlayerId && p.connected && p.role !== "host"
    )
  },
  component: KickPlayerView,
})
