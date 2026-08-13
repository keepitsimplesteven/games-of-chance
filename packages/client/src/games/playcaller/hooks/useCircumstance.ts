import { useMemo } from "react"
import { classifyCircumstance } from "../play-names/classify"
import type { Circumstance } from "../play-names/types"
import type { DriveState } from "../field-utils.types"

export function useCircumstance(driveState: DriveState | null): Circumstance {
  return useMemo(() => {
    if (!driveState) return "standard"
    return classifyCircumstance(driveState.down, driveState.yardsToGo, driveState.yardLine)
  }, [driveState?.down, driveState?.yardsToGo, driveState?.yardLine])
}
