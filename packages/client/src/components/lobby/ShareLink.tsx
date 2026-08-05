import { useState } from "react"
import { useGameStore } from "../../store/useGameStore"
import { useTheme } from "../../theme"

/**
 * Minimal share icon — host only, placed next to the connection status dot.
 * Non-host players see nothing.
 */
export default function ShareLink() {
  const role = useGameStore((s) => s.role)
  const roomState = useGameStore((s) => s.roomState)
  const [copied, setCopied] = useState(false)
  const theme = useTheme()

  // Only show for host
  if (role !== "host") return null
  if (!roomState) return null

  const roomId = roomState.room.roomId
  const roomUrl = `${window.location.origin}/${roomId}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(roomUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: some browsers block clipboard in non-secure contexts
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`rounded-full p-1.5 transition hover:opacity-80 active:scale-90 ${theme.mutedText}`}
      title={copied ? "Copied!" : "Copy room link"}
      aria-label="Share room link"
    >
      {copied ? (
        // Checkmark icon
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`h-4 w-4 ${theme.statusSuccess}`}>
          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
        </svg>
      ) : (
        // Share/link icon
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path d="M12.232 4.232a2.5 2.5 0 013.536 3.536l-1.225 1.224a.75.75 0 001.061 1.06l1.224-1.224a4 4 0 00-5.656-5.656l-3 3a4 4 0 00.225 5.865.75.75 0 00.977-1.138 2.5 2.5 0 01-.142-3.667l3-3z" />
          <path d="M11.603 7.963a.75.75 0 00-.977 1.138 2.5 2.5 0 01.142 3.667l-3 3a2.5 2.5 0 01-3.536-3.536l1.225-1.224a.75.75 0 00-1.061-1.06l-1.224 1.224a4 4 0 005.656 5.656l3-3a4 4 0 00-.225-5.865z" />
        </svg>
      )}
    </button>
  )
}
