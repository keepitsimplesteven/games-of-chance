import { useGameStore } from "../../store/useGameStore"
import { useTheme } from "../../theme"

/**
 * HostControls — "Start Game" and "Simulate Game" buttons in the lobby.
 *
 * Visible ONLY to host when phase ∈ {LOBBY, RESULT} (phase guard).
 * When a simulation is active, shows a "Simulation Running" indicator
 * and a "Stop Simulation" button instead of the start controls.
 */
export default function HostControls() {
  const role = useGameStore((s) => s.role)
  const phase = useGameStore((s) => s.roomState?.round.phase)
  const roomState = useGameStore((s) => s.roomState)
  const startRound = useGameStore((s) => s.startRound)
  const startSimulation = useGameStore((s) => s.startSimulation)
  const stopSimulation = useGameStore((s) => s.stopSimulation)
  const theme = useTheme()

  // Only render for host
  if (role !== "host") return null

  // Detect if simulation is active via STATE_SYNC metadata
  const isSimulationActive = !!(roomState as any)?.simulation

  // When simulation is running, show indicator and stop button regardless of phase
  if (isSimulationActive) {
    return (
      <div className="flex flex-col gap-3">
        <div className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${theme.listItem} ${theme.accentText}`}>
          <span className={`inline-block h-2 w-2 animate-pulse rounded-full bg-current`} />
          Simulation Running
        </div>
        <button
          type="button"
          onClick={stopSimulation}
          className={`w-full rounded-lg px-4 py-3 text-base font-semibold shadow-sm transition active:scale-[0.98] ${theme.btnPrimary}`}
        >
          Stop Simulation
        </button>
      </div>
    )
  }

  // Phase guard: only show start controls when phase is LOBBY or RESULT
  if (phase !== "LOBBY" && phase !== "RESULT") return null

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={startRound}
        className={`w-full rounded-lg px-4 py-3 text-base font-semibold shadow-sm transition active:scale-[0.98] ${theme.btnPrimary}`}
      >
        Start Game
      </button>
      <button
        type="button"
        onClick={() => startSimulation()}
        className={`w-full rounded-lg px-4 py-3 text-base font-semibold shadow-sm transition active:scale-[0.98] ${theme.btnSecondary}`}
      >
        Simulate Game
      </button>
    </div>
  )
}
