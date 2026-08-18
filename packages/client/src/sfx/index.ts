import { useSyncExternalStore, useCallback } from "react"

const MUTE_KEY = "sfx-muted"

/** Module-level mute state + subscribers for useSyncExternalStore */
let currentMuted = localStorage.getItem(MUTE_KEY) === "true"
const listeners = new Set<() => void>()

/** Track all currently-playing audio elements so mute can pause them */
const activeSounds = new Set<HTMLAudioElement>()

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

function getSnapshot() {
  return currentMuted
}

function setMuted(value: boolean) {
  currentMuted = value
  localStorage.setItem(MUTE_KEY, String(value))

  // Pause or resume all active sounds immediately
  for (const audio of activeSounds) {
    if (value) {
      audio.pause()
    } else {
      audio.play().catch(() => {})
    }
  }

  listeners.forEach((cb) => cb())
}

/**
 * Check if SFX is currently muted (non-hook, for imperative use).
 */
export function isSfxMuted(): boolean {
  return currentMuted
}

/**
 * Create a managed audio instance that responds to mute toggling.
 * Returns controls to play, stop, and clean up the audio.
 * Unlike `playSound`, this gives the caller lifecycle control.
 */
export function createManagedSound(src: string, volume = 0.1) {
  const audio = new Audio(src)
  audio.volume = volume

  function play() {
    activeSounds.add(audio)
    if (!currentMuted) {
      audio.play().catch(() => {})
    }
  }

  function stop() {
    audio.pause()
    audio.currentTime = 0
    activeSounds.delete(audio)
  }

  // Auto-remove from tracking when playback ends naturally
  audio.addEventListener("ended", () => { activeSounds.delete(audio) })
  audio.addEventListener("error", () => { activeSounds.delete(audio) })

  return { audio, play, stop }
}

/**
 * Play a one-shot sound from the given src path.
 * Respects the global sfx-muted state.
 * For short SFX only — does NOT get resumed on unmute.
 * Silently swallows autoplay rejections (browser policy).
 */
export function playSound(src: string): Promise<void> {
  if (currentMuted) {
    return Promise.resolve()
  }
  const audio = new Audio(src)
  return audio.play().catch(() => {
    // Browser blocked autoplay — swallow silently
  })
}

/**
 * React hook for reading/toggling the global SFX mute state.
 * All components using this hook share the same state (module-level singleton).
 * Persists to localStorage under the "sfx-muted" key.
 */
export function useSfxMuted(): [muted: boolean, toggle: () => void] {
  const muted = useSyncExternalStore(subscribe, getSnapshot)

  const toggle = useCallback(() => {
    setMuted(!getSnapshot())
  }, [])

  return [muted, toggle]
}
