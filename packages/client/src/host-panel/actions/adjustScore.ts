import { actionRegistry } from "../ActionRegistry"
import AdjustScoreIcon from "./icons/AdjustScoreIcon"
import AdjustScoreView from "./views/AdjustScoreView"

actionRegistry.register({
  id: "adjust-score",
  label: "Adjust Score",
  icon: AdjustScoreIcon,
  isAvailable: (roomState) => {
    // Available when there is at least one player in the room
    return roomState.players.length > 0
  },
  component: AdjustScoreView,
})
