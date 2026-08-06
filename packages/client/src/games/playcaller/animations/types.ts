export type BallAnimationType = "run" | "pass" | "turnover" | "touchdown"

export interface BallAnimationConfig {
  type: BallAnimationType
  duration: number // seconds
  fromY: number // pixel position (previous yard line)
  toY: number // pixel position (new yard line)
}

export type DramaLevel = "normal" | "high" | "critical"
