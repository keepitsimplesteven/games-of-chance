import { actionRegistry } from "../ActionRegistry"
import RenamePlayerIcon from "./icons/RenamePlayerIcon"
import RenamePlayerView from "./views/RenamePlayerView"

actionRegistry.register({
  id: "rename-player",
  label: "Rename Player",
  icon: RenamePlayerIcon,
  isAvailable: (roomState, currentPlayerId) => {
    // Available when at least one non-host player exists (connected or disconnected)
    return roomState.players.some(
      (p) => p.id !== currentPlayerId && p.role !== "host"
    )
  },
  component: RenamePlayerView,
})
