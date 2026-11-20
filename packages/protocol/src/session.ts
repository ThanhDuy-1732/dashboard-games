import type { PlayerView, PlayerId, Token, BoardSize } from "@nha-choi/game-core";
import type { CommandEnvelope, CommandReply } from "./messages.js";
export interface SessionUpdate {
  canEndInterrupted?: boolean;
  connection: "connected" | "reconnecting" | "paused" | "closed";
  view: PlayerView | null;
  reason?: string;
}
export interface GameSession {
  setActive(active: boolean): Promise<void>;
  send(command: CommandEnvelope): Promise<CommandReply>;
  subscribe(listener: (update: SessionUpdate) => void): () => void;
  close(): Promise<void>;
}
export interface LobbyView {
  started: boolean;
  closed: boolean;
  roomId: string;
  code?: string;
  hostId: PlayerId;
  capacity: 6;
  boardSize?: BoardSize;
  players: {
    id: PlayerId;
    name: string;
    token: Token;
    ready: boolean;
    connected: boolean;
  }[];
}
export type RoomErrorCode =
  | "STORAGE_UNAVAILABLE"
  | "SERVER_CLOSING"
  | "INVALID_INPUT"
  | "SERVER_ERROR"
  | "INVALID_ROOM"
  | "ROOM_FULL"
  | "TOKEN_TAKEN"
  | "NOT_HOST"
  | "NOT_READY"
  | "GAME_STARTED"
  | "UNSUPPORTED_BOARD"
  | "NOT_AUTHORIZED"
  | "RATE_LIMITED";
export type RoomReply =
  | { ok: true; room: LobbyView; selfId: PlayerId; resumeToken?: string }
  | { ok: false; code: RoomErrorCode };
export interface RoomSession extends GameSession {
  endInterrupted(): Promise<RoomReply>;
  setReady(ready: boolean): Promise<RoomReply>;
  startGame(): Promise<RoomReply>;
  subscribeLobby(listener: (view: LobbyView) => void): () => void;
}
