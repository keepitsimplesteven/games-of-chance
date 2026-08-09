/**
 * RobotParts — Composable SVG robot parts (Head, Body, Weapon).
 *
 * All parts share a common coordinate system within a 128x128 viewBox.
 * Connection points:
 *   - Head bottom: y=44 (center x=64)
 *   - Body top: y=44 (center x=64)
 *   - Body arm mounts: left x=30, right x=98, y=56
 *   - Weapon attaches at arm mount points
 *
 * Each part renders as a <g> element positioned in a shared SVG coordinate space.
 */

// ── HEAD TYPES ─────────────────────────────────────────────────────────────

export type HeadType = "square" | "rounded" | "triangular" | "hexagonal"

interface HeadProps {
  type: HeadType
  color: string
  darkColor: string
}

export function RobotHead({ type, color, darkColor }: HeadProps) {
  switch (type) {
    case "square":
      return (
        <g>
          {/* Antenna */}
          <line x1="64" y1="10" x2="64" y2="4" stroke={darkColor} strokeWidth="2" />
          <circle cx="64" cy="3" r="2" fill={color} />
          {/* Head block */}
          <rect x="44" y="10" width="40" height="32" fill={color} stroke={darkColor} strokeWidth="2" rx="2" />
          {/* Eyes */}
          <rect x="52" y="20" width="8" height="8" fill={darkColor} rx="1" />
          <rect x="68" y="20" width="8" height="8" fill={darkColor} rx="1" />
          {/* Eye glow */}
          <rect x="54" y="22" width="4" height="4" fill="#f5c542" />
          <rect x="70" y="22" width="4" height="4" fill="#f5c542" />
          {/* Mouth grill */}
          <rect x="54" y="32" width="20" height="6" fill={darkColor} rx="1" />
          <line x1="58" y1="32" x2="58" y2="38" stroke={color} strokeWidth="1" />
          <line x1="64" y1="32" x2="64" y2="38" stroke={color} strokeWidth="1" />
          <line x1="70" y1="32" x2="70" y2="38" stroke={color} strokeWidth="1" />
        </g>
      )
    case "rounded":
      return (
        <g>
          {/* Antenna */}
          <line x1="64" y1="8" x2="64" y2="2" stroke={darkColor} strokeWidth="2" />
          <circle cx="64" cy="2" r="2" fill={color} />
          {/* Head dome */}
          <ellipse cx="64" cy="26" rx="22" ry="18" fill={color} stroke={darkColor} strokeWidth="2" />
          {/* Visor */}
          <ellipse cx="64" cy="24" rx="14" ry="6" fill={darkColor} />
          {/* Eye dots */}
          <circle cx="56" cy="24" r="3" fill="#f5c542" />
          <circle cx="72" cy="24" r="3" fill="#f5c542" />
          {/* Chin plate */}
          <ellipse cx="64" cy="36" rx="10" ry="4" fill={darkColor} />
        </g>
      )
    case "triangular":
      return (
        <g>
          {/* Antenna spike */}
          <polygon points="64,0 62,10 66,10" fill={color} stroke={darkColor} strokeWidth="1" />
          {/* Head wedge */}
          <polygon points="64,6 86,42 42,42" fill={color} stroke={darkColor} strokeWidth="2" />
          {/* Eye visor */}
          <polygon points="54,24 74,24 72,30 56,30" fill={darkColor} />
          {/* Eyes */}
          <circle cx="58" cy="27" r="2" fill="#f5c542" />
          <circle cx="70" cy="27" r="2" fill="#f5c542" />
          {/* Side vents */}
          <line x1="48" y1="34" x2="52" y2="34" stroke={darkColor} strokeWidth="2" />
          <line x1="76" y1="34" x2="80" y2="34" stroke={darkColor} strokeWidth="2" />
        </g>
      )
    case "hexagonal":
      return (
        <g>
          {/* Antenna pair */}
          <line x1="54" y1="8" x2="50" y2="2" stroke={darkColor} strokeWidth="2" />
          <line x1="74" y1="8" x2="78" y2="2" stroke={darkColor} strokeWidth="2" />
          <circle cx="50" cy="2" r="2" fill={color} />
          <circle cx="78" cy="2" r="2" fill={color} />
          {/* Head hexagon */}
          <polygon points="64,8 84,18 84,34 64,44 44,34 44,18" fill={color} stroke={darkColor} strokeWidth="2" />
          {/* Eyes */}
          <polygon points="52,22 58,22 58,28 52,28" fill={darkColor} />
          <polygon points="70,22 76,22 76,28 70,28" fill={darkColor} />
          {/* Eye glow */}
          <circle cx="55" cy="25" r="2" fill="#f5c542" />
          <circle cx="73" cy="25" r="2" fill="#f5c542" />
          {/* Mouth panel */}
          <polygon points="56,32 72,32 70,38 58,38" fill={darkColor} />
        </g>
      )
  }
}

// ── BODY TYPES ─────────────────────────────────────────────────────────────

export type BodyType = "square" | "rounded" | "triangular" | "hexagonal"

interface BodyProps {
  type: BodyType
  color: string
  darkColor: string
}

export function RobotBody({ type, color, darkColor }: BodyProps) {
  switch (type) {
    case "square":
      return (
        <g>
          {/* Torso */}
          <rect x="38" y="44" width="52" height="40" fill={color} stroke={darkColor} strokeWidth="2" rx="2" />
          {/* Chest panel */}
          <rect x="50" y="50" width="28" height="18" fill={darkColor} rx="2" />
          <rect x="54" y="54" width="20" height="10" fill={color} opacity="0.5" rx="1" />
          {/* Belt */}
          <rect x="38" y="78" width="52" height="6" fill={darkColor} />
          {/* Legs */}
          <rect x="42" y="86" width="18" height="28" fill={color} stroke={darkColor} strokeWidth="2" rx="2" />
          <rect x="68" y="86" width="18" height="28" fill={color} stroke={darkColor} strokeWidth="2" rx="2" />
          {/* Feet */}
          <rect x="38" y="114" width="24" height="8" fill={darkColor} rx="2" />
          <rect x="66" y="114" width="24" height="8" fill={darkColor} rx="2" />
        </g>
      )
    case "rounded":
      return (
        <g>
          {/* Torso */}
          <ellipse cx="64" cy="64" rx="26" ry="22" fill={color} stroke={darkColor} strokeWidth="2" />
          {/* Core */}
          <circle cx="64" cy="60" r="8" fill={darkColor} />
          <circle cx="64" cy="60" r="5" fill="#f5c542" opacity="0.7" />
          {/* Hip */}
          <ellipse cx="64" cy="84" rx="16" ry="4" fill={darkColor} />
          {/* Legs */}
          <rect x="46" y="86" width="14" height="26" fill={color} stroke={darkColor} strokeWidth="2" rx="6" />
          <rect x="68" y="86" width="14" height="26" fill={color} stroke={darkColor} strokeWidth="2" rx="6" />
          {/* Feet */}
          <ellipse cx="53" cy="114" rx="9" ry="5" fill={darkColor} />
          <ellipse cx="75" cy="114" rx="9" ry="5" fill={darkColor} />
        </g>
      )
    case "triangular":
      return (
        <g>
          {/* Torso wedge */}
          <polygon points="64,44 92,84 36,84" fill={color} stroke={darkColor} strokeWidth="2" />
          {/* Chest diamond */}
          <polygon points="64,52 72,62 64,72 56,62" fill={darkColor} />
          <polygon points="64,56 68,62 64,68 60,62" fill="#f5c542" opacity="0.5" />
          {/* Hip bar */}
          <rect x="40" y="84" width="48" height="6" fill={darkColor} rx="2" />
          {/* Legs */}
          <polygon points="46,90 54,90 56,116 44,116" fill={color} stroke={darkColor} strokeWidth="2" />
          <polygon points="74,90 82,90 84,116 72,116" fill={color} stroke={darkColor} strokeWidth="2" />
          {/* Feet */}
          <polygon points="40,116 60,116 58,122 42,122" fill={darkColor} />
          <polygon points="68,116 88,116 86,122 70,122" fill={darkColor} />
        </g>
      )
    case "hexagonal":
      return (
        <g>
          {/* Torso hex */}
          <polygon points="64,44 88,54 88,76 64,86 40,76 40,54" fill={color} stroke={darkColor} strokeWidth="2" />
          {/* Chest hex */}
          <polygon points="64,52 74,56 74,68 64,72 54,68 54,56" fill={darkColor} />
          <polygon points="64,56 70,58 70,66 64,68 58,66 58,58" fill="#f5c542" opacity="0.4" />
          {/* Hip */}
          <rect x="44" y="86" width="40" height="4" fill={darkColor} rx="2" />
          {/* Legs */}
          <rect x="46" y="90" width="14" height="24" fill={color} stroke={darkColor} strokeWidth="2" rx="3" />
          <rect x="68" y="90" width="14" height="24" fill={color} stroke={darkColor} strokeWidth="2" rx="3" />
          {/* Feet hex */}
          <polygon points="48,114 62,114 60,122 46,122" fill={darkColor} />
          <polygon points="66,114 80,114 82,122 68,122" fill={darkColor} />
        </g>
      )
  }
}

// ── WEAPON (ARM) TYPES ─────────────────────────────────────────────────────

export type WeaponType = "drill" | "blaster" | "bazooka"

interface WeaponProps {
  type: WeaponType
  color: string
  darkColor: string
}

export function RobotWeapons({ type, color, darkColor }: WeaponProps) {
  switch (type) {
    case "drill":
      return (
        <g>
          {/* Left arm */}
          <rect x="16" y="48" width="16" height="32" fill={color} stroke={darkColor} strokeWidth="2" rx="3" />
          {/* Left drill */}
          <polygon points="24,80 18,96 30,96" fill={darkColor} />
          <polygon points="24,96 20,108 28,108" fill={color} stroke={darkColor} strokeWidth="1" />
          <line x1="24" y1="96" x2="24" y2="108" stroke={darkColor} strokeWidth="1" />
          {/* Right arm */}
          <rect x="96" y="48" width="16" height="32" fill={color} stroke={darkColor} strokeWidth="2" rx="3" />
          {/* Right drill */}
          <polygon points="104,80 98,96 110,96" fill={darkColor} />
          <polygon points="104,96 100,108 108,108" fill={color} stroke={darkColor} strokeWidth="1" />
          <line x1="104" y1="96" x2="104" y2="108" stroke={darkColor} strokeWidth="1" />
        </g>
      )
    case "blaster":
      return (
        <g>
          {/* Left arm */}
          <rect x="18" y="48" width="14" height="28" fill={color} stroke={darkColor} strokeWidth="2" rx="3" />
          {/* Left blaster barrel */}
          <rect x="16" y="76" width="18" height="10" fill={darkColor} rx="2" />
          <rect x="18" y="86" width="6" height="12" fill={color} stroke={darkColor} strokeWidth="1" rx="1" />
          <circle cx="21" cy="100" r="3" fill="#f5c542" opacity="0.8" />
          {/* Right arm */}
          <rect x="96" y="48" width="14" height="28" fill={color} stroke={darkColor} strokeWidth="2" rx="3" />
          {/* Right blaster barrel */}
          <rect x="94" y="76" width="18" height="10" fill={darkColor} rx="2" />
          <rect x="104" y="86" width="6" height="12" fill={color} stroke={darkColor} strokeWidth="1" rx="1" />
          <circle cx="107" cy="100" r="3" fill="#f5c542" opacity="0.8" />
        </g>
      )
    case "bazooka":
      return (
        <g>
          {/* Left arm (support arm, smaller) */}
          <rect x="20" y="48" width="12" height="30" fill={color} stroke={darkColor} strokeWidth="2" rx="3" />
          <rect x="18" y="78" width="16" height="8" fill={darkColor} rx="2" />
          {/* Right arm (bazooka arm) */}
          <rect x="96" y="48" width="14" height="24" fill={color} stroke={darkColor} strokeWidth="2" rx="3" />
          {/* Bazooka barrel */}
          <rect x="92" y="56" width="28" height="12" fill={darkColor} rx="3" />
          <rect x="116" y="54" width="8" height="16" fill={color} stroke={darkColor} strokeWidth="1" rx="2" />
          {/* Barrel opening */}
          <circle cx="126" cy="62" r="4" fill={darkColor} />
          <circle cx="126" cy="62" r="2" fill="#f5c542" opacity="0.6" />
          {/* Ammo belt detail */}
          <rect x="96" y="72" width="10" height="6" fill={darkColor} rx="1" />
          <rect x="96" y="80" width="10" height="6" fill={darkColor} rx="1" />
        </g>
      )
  }
}

// ── COMPOSITE ROBOT ────────────────────────────────────────────────────────

export interface RobotVisualConfig {
  headType: HeadType
  bodyType: BodyType
  weaponType: WeaponType
  color: string
}

/** Derives a darker shade for outlines/detail from a base hex color */
function darkenColor(hex: string): string {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - 60)
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - 60)
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - 60)
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
}

interface CompositeRobotProps {
  config: RobotVisualConfig
  size?: number
  className?: string
}

/**
 * CompositeRobot — Renders a complete robot from head + body + weapons.
 * All parts layer on the same 128x128 coordinate grid.
 */
export function CompositeRobot({ config, size = 128, className }: CompositeRobotProps) {
  const { headType, bodyType, weaponType, color } = config
  const darkColor = darkenColor(color)

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 128 128"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      <RobotBody type={bodyType} color={color} darkColor={darkColor} />
      <RobotWeapons type={weaponType} color={color} darkColor={darkColor} />
      <RobotHead type={headType} color={color} darkColor={darkColor} />
    </svg>
  )
}
