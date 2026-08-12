import type { WeaponType, HeadType, BodyType } from "./types"

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface StarContribution {
  damage: number // 0-3
  accuracy: number // 0-3
  speed: number // 0-3
}

export interface PartDefinition {
  id: string
  name: string
  stars: StarContribution
}

// ─── Part Definitions ─────────────────────────────────────────────────────────

export const WEAPON_PARTS: Record<WeaponType, PartDefinition> = {
  drill: { id: "drill", name: "Drill", stars: { damage: 1, accuracy: 0, speed: 2 } },
  blaster: { id: "blaster", name: "Blaster", stars: { damage: 1, accuracy: 2, speed: 0 } },
  bazooka: { id: "bazooka", name: "Bazooka", stars: { damage: 3, accuracy: 0, speed: 0 } },
}

export const HEAD_PARTS: Record<HeadType, PartDefinition> = {
  square: { id: "square", name: "Square", stars: { damage: 1, accuracy: 1, speed: 1 } },
  rounded: { id: "rounded", name: "Rounded", stars: { damage: 0, accuracy: 1, speed: 2 } },
  triangular: { id: "triangular", name: "Triangular", stars: { damage: 0, accuracy: 3, speed: 0 } },
  hexagonal: { id: "hexagonal", name: "Hexagonal", stars: { damage: 2, accuracy: 1, speed: 0 } },
}

export const BODY_PARTS: Record<BodyType, PartDefinition> = {
  square: { id: "square", name: "Square", stars: { damage: 1, accuracy: 1, speed: 1 } },
  rounded: { id: "rounded", name: "Rounded", stars: { damage: 0, accuracy: 0, speed: 3 } },
  triangular: { id: "triangular", name: "Triangular", stars: { damage: 0, accuracy: 2, speed: 1 } },
  hexagonal: { id: "hexagonal", name: "Hexagonal", stars: { damage: 2, accuracy: 0, speed: 1 } },
}

// ─── Functions ────────────────────────────────────────────────────────────────

/** Computes combined star distribution from three parts */
export function computeStars(
  weapon: WeaponType,
  head: HeadType,
  body: BodyType
): { damage: number; accuracy: number; speed: number } {
  const w = WEAPON_PARTS[weapon].stars
  const h = HEAD_PARTS[head].stars
  const b = BODY_PARTS[body].stars

  return {
    damage: w.damage + h.damage + b.damage,
    accuracy: w.accuracy + h.accuracy + b.accuracy,
    speed: w.speed + h.speed + b.speed,
  }
}

/** Validates a build's star budget (must sum to 9, each stat in [1,7]) */
export function validateBuild(
  weapon: WeaponType,
  head: HeadType,
  body: BodyType
):
  | { valid: true; stars: { damage: number; accuracy: number; speed: number } }
  | { valid: false; reason: string } {
  const stars = computeStars(weapon, head, body)
  const total = stars.damage + stars.accuracy + stars.speed

  if (total !== 9) {
    return { valid: false, reason: `Star total is ${total}, expected 9` }
  }

  if (stars.damage < 1 || stars.damage > 7) {
    return { valid: false, reason: `Damage stars ${stars.damage} outside valid range [1, 7]` }
  }

  if (stars.accuracy < 1 || stars.accuracy > 7) {
    return { valid: false, reason: `Accuracy stars ${stars.accuracy} outside valid range [1, 7]` }
  }

  if (stars.speed < 1 || stars.speed > 7) {
    return { valid: false, reason: `Speed stars ${stars.speed} outside valid range [1, 7]` }
  }

  return { valid: true, stars }
}
