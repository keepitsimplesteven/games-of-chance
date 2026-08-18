import { useSfxMuted } from "../../sfx"
import { useTheme } from "../../theme"

/**
 * SfxMuteToggle — Small toolbar button that toggles global SFX mute state.
 * Renders a 16×16 speaker icon (unmuted) or speaker-off icon (muted).
 * Matches the styling of adjacent toolbar items (GearIconTrigger, etc.).
 */
export default function SfxMuteToggle() {
  const [muted, toggle] = useSfxMuted()
  const theme = useTheme()

  return (
    <button
      type="button"
      onClick={toggle}
      className={`inline-flex items-center justify-center p-1.5 rounded hover:bg-white/10 transition-colors ${muted ? "opacity-40" : ""} ${theme.mutedText}`}
      aria-label={muted ? "Unmute sound effects" : "Mute sound effects"}
      aria-pressed={!muted}
      title={muted ? "Sound off" : "Sound on"}
    >
      {muted ? <SpeakerOffIcon /> : <SpeakerIcon />}
    </button>
  )
}

function SpeakerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8 2L4.5 5H2a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h2.5L8 14V2z"
        fill="currentColor"
      />
      <path
        d="M10.5 5.5a3.5 3.5 0 0 1 0 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M12 3.5a6 6 0 0 1 0 9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function SpeakerOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8 2L4.5 5H2a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h2.5L8 14V2z"
        fill="currentColor"
      />
      <path
        d="M11 6l4 4M15 6l-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
