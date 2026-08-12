import type React from 'react'
import type { TickEntry } from '../ReplayController'

export interface SlideDecision {
  shouldSlide: boolean
  direction: 'left' | 'right' | 'down'
  offsetPx: number
  durationMs: number
}

export interface SlideEngineConfig {
  mode: '1v1' | 'ffa'
  slideEnabled: boolean
  gameSpeed: number
  robotWidth: number
}

export type WeaponHitType = 'blaster' | 'bazooka' | 'drill'

export interface HitEffect {
  weaponType: WeaponHitType
  color: string
  position: { x: number; y: number }
  opacity: number
  sizePct: number
  durationMs: number
}

export interface DamageNumberEffect {
  value: number
  startPosition: { x: number; y: number }
  color: string
  durationMs: number
  offsetIndex: number
}

export interface TickAnimationState {
  tickIndex: number
  slides: Map<string, SlideDecision>
  hitEffects: HitEffect[]
  damageNumbers: DamageNumberEffect[]
  startTime: number
}

export interface HitSVGProps {
  color: string
  size: number
  opacity: number
}

export interface AnimationLayerProps {
  tickEntry: TickEntry | null
  hpStates: Record<string, { currentHp: number; maxHp: number; eliminated: boolean }>
  robots: Array<{
    ownerId: string
    visual: { weapon: string; head: string; body: string; color?: string }
  }>
  robotColors: Record<string, string>
  gameSpeed: number
  isPlaying: boolean
  isComplete: boolean
  slideEnabled?: boolean
  mode: '1v1' | 'ffa'
  robotRefs: Record<string, React.RefObject<HTMLDivElement>>
  /** Refs specifically to the robot SVG container divs (for constraining hit effects) */
  robotSvgRefs?: Record<string, React.RefObject<HTMLDivElement>>
}
