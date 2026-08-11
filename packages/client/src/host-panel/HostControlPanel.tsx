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
        className="fixed z-40 flex h-12 w-12 items-center justify-center rounded-full bg-gray-800 text-white shadow-lg"
        style={{
          bottom: 'calc(1rem + var(--safe-area-bottom, 0px))',
          right: 'calc(1rem + var(--safe-area-right, 0px))',
        }}
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
    <div
      className="fixed inset-0 z-50 flex flex-col bg-zinc-900 text-white"
      style={{
        paddingTop: 'var(--safe-area-top, 0px)',
        paddingBottom: 'var(--safe-area-bottom, 0px)',
        paddingLeft: 'var(--safe-area-left, 0px)',
        paddingRight: 'var(--safe-area-right, 0px)',
      }}
    >
      <header className="flex items-center justify-between border-b border-zinc-700 px-4 py-3">
        <h2 className="text-lg font-bold">Host Controls</h2>
        <button
          type="button"
          onClick={() => { setIsOpen(false); setActiveAction(null) }}
          className="text-2xl text-zinc-400"
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
              className="mb-4 text-sm text-blue-400"
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
                        ? "border-zinc-600 bg-zinc-800 hover:bg-zinc-700"
                        : "border-zinc-700 bg-zinc-800 opacity-50"
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
