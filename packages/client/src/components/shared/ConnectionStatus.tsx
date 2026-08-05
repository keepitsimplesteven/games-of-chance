import { useGameStore } from "../../store/useGameStore"
import { useTheme } from "../../theme"
import type { ConnectionStatus as ConnectionStatusType } from "../../store/useGameStore"

const statusConfig: Record<
  ConnectionStatusType,
  { dotColor: string; label: string }
> = {
  connected: { dotColor: "bg-green-500", label: "Connected" },
  connecting: { dotColor: "bg-yellow-500", label: "Connecting" },
  disconnected: { dotColor: "bg-red-500", label: "Disconnected" },
  error: { dotColor: "bg-red-500", label: "Error" },
}

export default function ConnectionStatus() {
  const connectionStatus = useGameStore((s) => s.connectionStatus)
  const theme = useTheme()
  const { dotColor, label } = statusConfig[connectionStatus]

  return (
    <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${theme.listItem} ${theme.bodyText}`}>
      <span
        className={`inline-block h-2 w-2 rounded-full ${dotColor}`}
        aria-hidden="true"
      />
      <span>{label}</span>
    </div>
  )
}
