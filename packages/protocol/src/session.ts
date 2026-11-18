import type { PlayerView, PlayerId, Token } from "@nha-choi/game-core";
import type { CommandEnvelope, CommandReply } from "./messages.js";
export interface SessionUpdate {
  connection: "connected" | "reconnecting" | "paused" | "closed";
  view: PlayerView | null;
  reason?: string;
}
export interface GameSession {
  send(command: CommandEnvelope): Promise<CommandReply>;
  subscribe(listener: (update: SessionUpdate) => void): () => void;
  close(): Promise<void>;
}
export interface LobbyView {
  roomId: string;
  code?: string;
  hostId: PlayerId;
  capacity: 6;
  players: {
    id: PlayerId;
    name: string;
    token: Token;
    ready: boolean;
    connected: boolean;
  }[];
}
export type RoomErrorCode =
  | "INVALID_ROOM"
  | "ROOM_FULL"
  | "TOKEN_TAKEN"
  | "NOT_HOST"
  | "NOT_READY"
  | "GAME_STARTED"
  | "NOT_AUTHORIZED"
  | "RATE_LIMITED";
export type RoomReply =
  | { ok: true; room: LobbyView; selfId: PlayerId; resumeToken: string }
  | { ok: false; code: RoomErrorCode };
export interface RoomSession extends GameSession {
  setReady(ready: boolean): Promise<RoomReply>;
  startGame(): Promise<RoomReply>;
  subscribeLobby(listener: (view: LobbyView) => void): () => void;
}
