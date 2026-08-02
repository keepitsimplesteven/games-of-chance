/**
 * WheelPointer — Fixed triangular flapper/pointer at the top of the wheel.
 *
 * SVG triangle pointing downward toward the wheel with a metallic/silver appearance.
 * Positioned at the top center of the wheel frame to indicate the winning segment.
 *
 * Validates: Requirements 9.1, 9.2
 */
export function WheelPointer() {
  return (
    <svg
      className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10"
      width="40"
      height="40"
      viewBox="0 0 40 40"
      aria-label="Wheel pointer"
    >
      <defs>
        <linearGradient id="pointer-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e0e0e0" />
          <stop offset="50%" stopColor="#a0a0a0" />
          <stop offset="100%" stopColor="#c0c0c0" />
        </linearGradient>
      </defs>
      {/* Triangular pointer pointing down */}
      <polygon
        points="20,36 8,8 32,8"
        fill="url(#pointer-gradient)"
        stroke="#555"
        strokeWidth="1.5"
      />
      {/* Small highlight circle at top for metallic look */}
      <circle cx="20" cy="12" r="3" fill="#f0f0f0" opacity="0.6" />
    </svg>
  )
}
