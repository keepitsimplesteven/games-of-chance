import { useState } from "react"
import { useGameStore } from "../store/useGameStore"
import { actionRegistry } from "./ActionRegistry"

// Side-effect imports: register actions in the ActionRegistry
import "./actions/kickPlayer"
import "./actions/reassignHost"
import "./actions/adjustScore"
import "./actions/renamePlayer"
import "./actions/setSeeds"

export default function HostControlPanel() {
  const role = useGameStore((s) => s.role)
  const roomState = useGameStore((s) => s.roomState)
  const playerId = useGameStore((s) => s.playerId)
  const isOpen = useGameStore((s) => s.hostPanelOpen)
  const setHostPanelOpen = useGameStore((s) => s.setHostPanelOpen)
  const [activeAction, setActiveAction] = useState<string | null>(null)
  const [confirmingNewGame, setConfirmingNewGame] = useState(false)

  // Auto-close when demoted from host
  if (role !== "host") {
    if (isOpen) setHostPanelOpen(false)
    return null
  }

  if (!isOpen) return null

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
          onClick={() => { setHostPanelOpen(false); setActiveAction(null) }}
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

            {/* New Game — navigates back to main lobby */}
            <li className="pt-4 border-t border-zinc-700 mt-4">
              {!confirmingNewGame ? (
                <button
                  type="button"
                  onClick={() => setConfirmingNewGame(true)}
                  className="flex w-full items-center gap-3 rounded-lg border border-zinc-600 bg-zinc-800 hover:bg-zinc-700 px-4 py-3 text-left"
                >
                  <span className="text-xl">🚪</span>
                  <span className="font-medium">New Game</span>
                </button>
              ) : (
                <div className="rounded-lg border border-amber-600 bg-zinc-800 px-4 py-3">
                  <p className="text-sm text-amber-300 mb-3">
                    Are you sure you want to create a new room? This will leave the current game.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        window.location.href = "/"
                      }}
                      className="flex-1 rounded bg-amber-600 hover:bg-amber-500 px-3 py-2 text-sm font-bold text-white"
                    >
                      Yes, leave
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingNewGame(false)}
                      className="flex-1 rounded bg-zinc-700 hover:bg-zinc-600 px-3 py-2 text-sm font-medium text-zinc-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </li>
          </ul>
        )}
      </div>
    </div>
  )
}
