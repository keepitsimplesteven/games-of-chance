import { useTheme } from "../../theme"

interface RoundHeaderProps {
  roundIndex: number
  totalRounds: number
  /** Optional label override — when provided, displays this instead of deriving from roundIndex */
  label?: string
}

/**
 * RoundHeader — displays the current bracket round name.
 * Maps round indices to standard tournament round names.
 *
 * Validates: Requirements 8.3, 9.1
 */
export function RoundHeader({ roundIndex, totalRounds, label }: RoundHeaderProps) {
  const theme = useTheme()

  const getRoundName = () => {
    if (label) return label
    if (roundIndex === totalRounds - 1) return "Final"
    if (roundIndex === totalRounds - 2) return "Semifinal"
    if (roundIndex === totalRounds - 3) return "Quarterfinal"
    return `Round ${roundIndex + 1}`
  }

  return (
    <div className={`text-center text-xl font-bold uppercase tracking-wider py-2 ${theme.headingText}`}>
      {getRoundName()}
    </div>
  )
}
