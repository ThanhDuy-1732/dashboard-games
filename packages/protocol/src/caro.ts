import type { CaroGame, CaroMark } from "@nha-choi/game-core";

export interface CaroRoomView {
  code: string;
  players: {
    name: string;
    mark: CaroMark;
    connected: boolean;
    readyForRematch: boolean;
  }[];
  game: CaroGame;
  round: number;
  revision: number;
}
export type CaroRoomError =
  | "INVALID_INPUT"
  | "INVALID_ROOM"
  | "ROOM_FULL"
  | "NOT_AUTHORIZED"
  | "BUSY"
  | "WAITING"
  | "STALE_REVISION"
  | "INVALID_MOVE"
  | "RATE_LIMITED";
export type CaroRoomReply =
  | { ok: true; room: CaroRoomView; mark: CaroMark }
  | { ok: false; code: CaroRoomError };
