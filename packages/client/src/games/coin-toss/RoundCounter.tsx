// packages/client/src/games/coin-toss/RoundCounter.tsx

/**
 * Displays the current round number and total rounds in "Round X of Y" format.
 * Positioned at the top of the coin-toss game UI above game-specific content.
 *
 * Validates: Requirements 3.1, 3.2, 3.3
 */

interface RoundCounterProps {
  currentRound: number
  totalRounds: number
}

export function RoundCounter({ currentRound, totalRounds }: RoundCounterProps) {
  return (
    <div className="text-center text-sm font-medium text-gray-500 py-2">
      Round {currentRound} of {totalRounds}
    </div>
  )
}
