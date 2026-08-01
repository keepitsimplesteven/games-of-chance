export default function AdjustScoreIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      {/* Plus/minus in a circle — score adjustment */}
      <circle cx="12" cy="12" r="10" />
      <line x1="8" y1="9" x2="16" y2="9" />
      <line x1="12" y1="5" x2="12" y2="13" />
      <line x1="8" y1="16" x2="16" y2="16" />
    </svg>
  )
}
