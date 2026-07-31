import type * as Party from "partykit/server"
import GameRoom from "../room"

/**
 * Creates a mock Party.Connection that tracks sent messages.
 */
export function createMockConnection(id: string): Party.Connection & { _sent: string[] } {
  const sent: string[] = []
  return {
    id,
    send(data: string) {
      sent.push(data)
    },
    _sent: sent,
    // Stubs for the rest of the Connection interface
    close() {},
    socket: {} as any,
    state: undefined as any,
    setState(state: any) { this.state = state },
    serializeAttachment() {},
    deserializeAttachment() { return undefined },
    uri: "",
    unstable_initial: { url: "" } as any,
  } as any
}

/**
 * Creates a mock Party.Room that tracks broadcasts.
 */
export function createMockRoom(id: string): Party.Room & { _broadcasts: string[] } {
  const broadcasts: string[] = []
  return {
    id,
    env: {} as any,
    storage: {
      get: async () => undefined,
      put: async () => {},
      delete: async () => false,
      list: async () => new Map(),
      deleteAll: async () => {},
      getAlarm: async () => null,
      setAlarm: async () => {},
      deleteAlarm: async () => {},
      transaction: async (fn: any) => fn(),
    } as any,
    context: { parties: {} } as any,
    parties: {} as any,
    name: id,
    internalID: id,
    broadcast(data: string, _without?: string[]) {
      broadcasts.push(data)
    },
    _broadcasts: broadcasts,
    getConnections() {
      return [][Symbol.iterator]()
    },
    getConnection(_id: string) {
      return undefined
    },
  } as any
}

/**
 * Helper: creates a GameRoom with mock room, calls onStart, and returns the room + mock.
 */
export async function createTestGameRoom(roomId = "test-room") {
  const mockRoom = createMockRoom(roomId)
  const gameRoom = new GameRoom(mockRoom as any)
  await gameRoom.onStart()
  return { gameRoom, mockRoom }
}

/**
 * Helper: joins a player and returns their connection and parsed messages.
 */
export async function joinPlayer(
  gameRoom: GameRoom,
  opts: { name: string; role?: "host" | "player"; clientId: string }
): Promise<ReturnType<typeof createMockConnection>> {
  const conn = createMockConnection(`conn-${opts.clientId}`)
  // First connect (triggers STATE_SYNC)
  await gameRoom.onConnect(conn as any)
  // Then send JOIN message
  const joinMsg = JSON.stringify({
    type: "JOIN",
    payload: { name: opts.name, role: opts.role ?? "player", clientId: opts.clientId },
  })
  await gameRoom.onMessage(joinMsg, conn as any)
  return conn
}

/**
 * Helper: parse the last broadcast from the mock room.
 */
export function getLastBroadcast(mockRoom: { _broadcasts: string[] }) {
  const last = mockRoom._broadcasts[mockRoom._broadcasts.length - 1]
  return last ? JSON.parse(last) : null
}

/**
 * Helper: parse the last message sent to a connection.
 */
export function getLastSent(conn: { _sent: string[] }) {
  const last = conn._sent[conn._sent.length - 1]
  return last ? JSON.parse(last) : null
}

/**
 * Helper: get the current state from the latest broadcast.
 */
export function getStateFromBroadcast(mockRoom: { _broadcasts: string[] }) {
  const msg = getLastBroadcast(mockRoom)
  return msg?.payload ?? null
}
