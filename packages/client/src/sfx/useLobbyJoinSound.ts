import { useEffect, useRef } from "react"
import { useGameStore } from "../store/useGameStore"
import { createManagedSound } from "./index"

/**
 * Plays the lobby join sound when the player connects to a lottery-mode room.
 * Stops the sound when the phase leaves LOBBY (game starts).
 * Mount this in LobbyShell so it runs regardless of which sub-view is active.
 */
export function useLobbyJoinSound() {
  const joinState = useGameStore((s) => s.joinState)
  const connectionStatus = useGameStore((s) => s.connectionStatus)
  const progressionMode = useGameStore((s) => s.roomState?.room.progressionMode)
  const phase = useGameStore((s) => s.roomState?.round.phase)

  const soundRef = useRef<ReturnType<typeof createManagedSound> | null>(null)

  const shouldPlay =
    joinState === "IN_ROOM" &&
    connectionStatus === "connected" &&
    progressionMode === "lottery" &&
    (!phase || phase === "LOBBY")

  useEffect(() => {
    if (shouldPlay && !soundRef.current) {
      const sound = createManagedSound("/sfx/lobby-join.mp3")
      soundRef.current = sound
      sound.play()
    }

    if (!shouldPlay && soundRef.current) {
      soundRef.current.stop()
      soundRef.current = null
    }

    return () => {
      if (soundRef.current) {
        soundRef.current.stop()
        soundRef.current = null
      }
    }
  }, [shouldPlay])
}
