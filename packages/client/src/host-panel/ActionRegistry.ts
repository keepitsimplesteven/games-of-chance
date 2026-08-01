import type { ReactNode } from "react"
import type { RoomState } from "@games-of-chance/shared"

export interface HostAction {
  id: string
  label: string
  icon: () => ReactNode
  /** Return true if this action should be available given current state */
  isAvailable: (roomState: RoomState, currentPlayerId: string) => boolean
  /** Render the action's execution UI (target picker, confirmation, etc.) */
  component: () => ReactNode
}

class ActionRegistry {
  private actions: Map<string, HostAction> = new Map()
  private insertionOrder: string[] = []

  register(action: HostAction): void {
    if (!this.actions.has(action.id)) {
      this.insertionOrder.push(action.id)
    }
    this.actions.set(action.id, action) // overwrites on duplicate id
  }

  getAll(): HostAction[] {
    return this.insertionOrder
      .filter((id) => this.actions.has(id))
      .map((id) => this.actions.get(id)!)
  }

  get(id: string): HostAction | undefined {
    return this.actions.get(id)
  }
}

export const actionRegistry = new ActionRegistry()
