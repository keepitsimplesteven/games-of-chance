import type { ComponentType } from 'react'
import type { HitSVGProps, WeaponHitType } from '../types'
import { BlasterHitSVG } from './BlasterHitSVG'
import { BazookaHitSVG } from './BazookaHitSVG'
import { DrillHitSVG } from './DrillHitSVG'

export const HIT_SVG_COMPONENTS: Record<WeaponHitType, ComponentType<HitSVGProps>> = {
  blaster: BlasterHitSVG,
  bazooka: BazookaHitSVG,
  drill: DrillHitSVG,
}

export { BlasterHitSVG, BazookaHitSVG, DrillHitSVG }
