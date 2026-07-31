import type * as Party from "partykit/server";
export default class GameRoom implements Party.Server {
    readonly room: Party.Room;
    private state;
    private deadlineTimerId;
    constructor(room: Party.Room);
    onStart(): Promise<void>;
    onConnect(connection: Party.Connection): Promise<void>;
    onMessage(message: string, sender: Party.Connection): Promise<void>;
    onClose(connection: Party.Connection): Promise<void>;
    private handleJoin;
    /** Check if there's a connected host in the room */
    private hasConnectedHost;
    /** Cancel the deadline timer — idempotent (no-op if no timer) */
    private cancelDeadlineTimer;
    /** Broadcast full STATE_SYNC to all connected clients */
    private broadcastState;
    /** Send an ERROR message to a specific connection */
    private sendError;
    /**
     * Convert internal LiveRoomState to the client-facing RoomState.
     * Converts players from Record to Array for the client.
     */
    private getPublicState;
}
