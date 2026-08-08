import { useTheme } from "../../theme"

interface RoundHeaderProps {
  roundIndex: number
  totalRounds: number
}

/**
 * RoundHeader — displays the current bracket round name.
 * Maps round indices to standard tournament round names.
 *
 * Validates: Requirements 8.3, 9.1
 */
export function RoundHeader({ roundIndex, totalRounds }: RoundHeaderProps) {
  const theme = useTheme()

  const getRoundName = () => {
    if (roundIndex === totalRounds - 1) return "Final"
    if (roundIndex === totalRounds - 2) return "Semi-Finals"
    if (roundIndex === totalRounds - 3) return "Quarter-Finals"
    return `Round ${roundIndex + 1}`
  }

  return (
    <div className={`text-center text-xl font-bold uppercase tracking-wider py-2 ${theme.headingText}`}>
      {getRoundName()}
    </div>
  )
}
