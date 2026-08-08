import { useTheme } from "../../theme"

/**
 * Displays the current round number and total rounds in "Round X of Y" format.
 * Styled with retro-casino theme.
 */

interface RoundCounterProps {
  currentRound: number
  totalRounds: number
}

export function RoundCounter({ currentRound, totalRounds }: RoundCounterProps) {
  const theme = useTheme()

  return (
    <div className={`text-center text-sm font-bold py-1 ${theme.mutedText}`}>
      Round {currentRound} of {totalRounds}
    </div>
  )
}
