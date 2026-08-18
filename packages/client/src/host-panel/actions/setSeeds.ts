import { actionRegistry } from "../ActionRegistry"
import SetSeedsIcon from "./icons/SetSeedsIcon"
import SetSeedsView from "./views/SetSeedsView"

actionRegistry.register({
  id: "set-seeds",
  label: "Set Seeds",
  icon: SetSeedsIcon,
  isAvailable: (roomState) =>
    roomState.round.phase === "LOBBY" && roomState.players.length >= 2,
  component: SetSeedsView,
})
