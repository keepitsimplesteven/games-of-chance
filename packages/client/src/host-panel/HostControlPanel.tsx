import { useState } from "react"
import { useGameStore } from "../store/useGameStore"
import { actionRegistry } from "./ActionRegistry"

// Side-effect imports: register actions in the ActionRegistry
import "./actions/kickPlayer"
import "./actions/reassignHost"
import "./actions/adjustScore"

export default function HostControlPanel() {
  const role = useGameStore((s) => s.role)
  const roomState = useGameStore((s) => s.roomState)
  const playerId = useGameStore((s) => s.playerId)
  const [isOpen, setIsOpen] = useState(false)
  const [activeAction, setActiveAction] = useState<string | null>(null)

  // Auto-close when demoted from host
  if (role !== "host") {
    if (isOpen) setIsOpen(false)
    return null
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-gray-800 text-white shadow-lg"
        aria-label="Open Host Control Panel"
      >
        ⚙️
      </button>
    )
  }

  const actions = actionRegistry.getAll()
  const ActiveComponent = activeAction
    ? actionRegistry.get(activeAction)?.component
    : null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-lg font-bold">Host Controls</h2>
        <button
          type="button"
          onClick={() => { setIsOpen(false); setActiveAction(null) }}
          className="text-2xl text-gray-500"
          aria-label="Close"
        >
          ×
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {ActiveComponent ? (
          <div>
            <button
              type="button"
              onClick={() => setActiveAction(null)}
              className="mb-4 text-sm text-blue-600"
            >
              ← Back
            </button>
            <ActiveComponent />
          </div>
        ) : (
          <ul className="space-y-3">
            {actions.map((action) => {
              const available = roomState && playerId
                ? action.isAvailable(roomState, playerId)
                : false
              return (
                <li key={action.id}>
                  <button
                    type="button"
                    disabled={!available}
                    onClick={() => setActiveAction(action.id)}
                    className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left ${
                      available
                        ? "border-gray-200 bg-white hover:bg-gray-50"
                        : "border-gray-100 bg-gray-50 opacity-50"
                    }`}
                  >
                    <span className="text-xl">{action.icon()}</span>
                    <span className="font-medium">{action.label}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
