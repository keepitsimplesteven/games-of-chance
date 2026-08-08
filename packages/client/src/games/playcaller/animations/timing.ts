import type { BallAnimationType, DramaLevel } from "./types"

/**
 * Play outcome type matching the server's DriveEngine PlayOutcome.
 * Defined locally until shared package exports it.
 */
export type PlayOutcome =
  | "success"
  | "critical_success"
  | "incomplete_pass"
  | "tackle_for_loss"
  | "interception"
  | "fumble"

export function getDramaLevel(outcome: PlayOutcome): DramaLevel {
  switch (outcome) {
    case "critical_success":
    case "interception":
    case "fumble":
      return "critical"
    case "tackle_for_loss":
      return "high"
    default:
      return "normal"
  }
}

export function getAnimationDuration(dramaLevel: DramaLevel): number {
  switch (dramaLevel) {
    case "critical":
      return 1.2
    case "high":
      return 0.9
    case "normal":
      return 0.6
  }
}

export function getBallAnimationType(
  outcome: PlayOutcome,
  playAxis: "run" | "pass"
): BallAnimationType {
  if (outcome === "interception" || outcome === "fumble") return "turnover"
  if (playAxis === "pass") return "pass"
  return "run"
}
