interface SpinnerInfoProps {
  /** Name of the active spinner */
  spinnerName: string
  /** Whether the current user is the active spinner */
  isCurrentUser: boolean
  /** Which spin the active spinner is on (1 or 2) */
  spinNumber: 1 | 2
}

/**
 * SpinnerInfo — Displays the active spinner's name with a "(You)" indicator
 * if the current user is the spinner, and shows the spin count ("Spin 1 of 2").
 * Centered above the wheel.
 *
 * Validates: Requirements 10.2
 */
export function SpinnerInfo({ spinnerName, isCurrentUser, spinNumber }: SpinnerInfoProps) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <div className="text-lg font-bold text-gray-800">
        {spinnerName}
        {isCurrentUser && (
          <span className="ml-2 text-sm font-normal text-blue-600">(You)</span>
        )}
      </div>
      <div className="text-sm text-gray-500">
        Spin {spinNumber} of 2
      </div>
    </div>
  )
}
