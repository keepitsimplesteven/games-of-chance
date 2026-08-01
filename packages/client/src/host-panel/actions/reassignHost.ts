import { actionRegistry } from "../ActionRegistry"
import ReassignHostIcon from "./icons/ReassignHostIcon"
import ReassignHostView from "./views/ReassignHostView"

actionRegistry.register({
  id: "reassign-host",
  label: "Reassign Host",
  icon: ReassignHostIcon,
  isAvailable: (roomState, currentPlayerId) => {
    // Available when there are connected non-host players
    return roomState.players.some(
      (p) => p.id !== currentPlayerId && p.connected && p.role !== "host"
    )
  },
  component: ReassignHostView,
})
