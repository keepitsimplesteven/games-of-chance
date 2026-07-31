import { useGameStore } from "../../store/useGameStore"

export default function HostControls() {
  const role = useGameStore((s) => s.role)
  const phase = useGameStore((s) => s.roomState?.round.phase)

  // Phase guard: only render for host when phase is LOBBY or RESULT
  if (role !== "host") return null
  if (phase !== "LOBBY" && phase !== "RESULT") return null

  return (
    <button
      type="button"
      className="w-full rounded-lg bg-green-600 px-4 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-green-700 active:scale-[0.98]"
    >
      Start Game
    </button>
  )
}
