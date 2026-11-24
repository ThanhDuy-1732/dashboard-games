import { randomBytes } from "node:crypto";
import { expect, it } from "vitest";
import type { Server, Socket } from "socket.io";
import type { CaroRoomReply, CaroRoomView, TelemetryEvent } from "@nha-choi/protocol";
import { CaroRooms } from "../src/caro-rooms.js";

class TestSocket {
  readonly handshake = { address: "test" };
  readonly handlers = new Map<string, (...args: unknown[]) => void>();
  view: CaroRoomView | undefined;
  closed: string | undefined;

  constructor(readonly id: string) {}

  on(event: string, handler: (...args: unknown[]) => void) {
    this.handlers.set(event, handler);
  }

  emit(event: string, data: CaroRoomView | string) {
    if (event === "caro:update" && typeof data !== "string") this.view = data;
    if (event === "caro:closed" && typeof data === "string") this.closed = data;
  }

  send(event: string, input: unknown): CaroRoomReply {
    let reply: CaroRoomReply | undefined;
    this.handlers.get(`caro:${event}`)?.(input, (value: CaroRoomReply) => {
      reply = value;
    });
    if (!reply) throw new Error(`Missing ack for ${event}`);
    return reply;
  }
  disconnect() {
    this.handlers.get("disconnect")?.();
  }
}

function harness() {
  let now = 0;
  const sockets = new Map<string, TestSocket>();
  const io = {
    sockets: { sockets },
    to: (id: string) => sockets.get(id),
  } as unknown as Server;
  const events: TelemetryEvent[] = [];
  const rooms = new CaroRooms(io, () => now, (event) => events.push(event));
  return {
    rooms,
    events,
    advance: (milliseconds: number) => {
      now += milliseconds;
    },
    connect(id: string) {
      const socket = new TestSocket(id);
      sockets.set(id, socket);
      rooms.attach(socket as unknown as Socket, () => true);
      return socket;
    },
  };
}

function entry(name: string) {
  return { name, resumeToken: randomBytes(32).toString("base64url") };
}

function accepted(result: CaroRoomReply) {
  if (!result.ok) throw new Error(result.code);
  return result;
}

it("authorizes turns, restores a disconnected seat and swaps marks on mutual rematch", () => {
  const { connect, events } = harness();
  const host = connect("host");
  const guest = connect("guest");
  const stranger = connect("stranger");
  const hostEntry = entry("Duy");
  const guestEntry = entry("Bạn");
  const created = accepted(host.send("enter", hostEntry));
  expect(accepted(host.send("enter", hostEntry)).room.code).toBe(
    created.room.code,
  );
  const { code } = created.room;
  let { room } = accepted(guest.send("enter", { ...guestEntry, code }));
  const move = (player: TestSocket, index: number, revision = room.revision) =>
    player.send("move", { index, revision });
  expect(move(stranger, 0)).toMatchObject({ code: "NOT_AUTHORIZED" });
  expect(stranger.send("enter", { ...entry("Ba"), code })).toMatchObject({
    code: "ROOM_FULL",
  });
  expect(move(guest, 0)).toMatchObject({ code: "INVALID_MOVE" });
  expect(move(host, 0, room.revision - 1)).toMatchObject({
    code: "STALE_REVISION",
  });
  ({ room } = accepted(move(host, 1)));

  guest.disconnect();
  room = host.view!;
  expect(room.players[1]?.connected).toBe(false);
  expect(move(host, 1)).toMatchObject({ code: "WAITING" });
  const returned = connect("returned");
  const resumed = accepted(
    returned.send("resume", { resumeToken: guestEntry.resumeToken }),
  );
  expect(resumed.mark).toBe("O");
  expect(resumed.room.game.moves).toEqual([1]);
  room = resumed.room;
  for (const [o, x] of [[0, 2], [6, 3], [20, 4], [40, 5]] as const) {
    ({ room } = accepted(move(returned, o)));
    ({ room } = accepted(move(host, x)));
  }
  const result = { winner: "X", line: [1, 2, 3, 4, 5] };
  expect(room.game.result).toEqual(result);
  expect(returned.view?.game.result).toEqual(result);
  expect(events.filter((event) => event.kind !== "latency").map((event) => event.kind)).toEqual(["game_started", "game_completed"]);

  accepted(host.send("rematch", { round: 1 }));
  const next = accepted(returned.send("rematch", { round: 1 })).room;
  expect(next.round).toBe(2);
  expect(next.players).toMatchObject([
    { name: "Duy", mark: "O" },
    { name: "Bạn", mark: "X" },
  ]);
  expect(next.game.moves).toEqual([]);
  expect(host.send("rematch", { round: 1 })).toMatchObject({
    code: "STALE_REVISION",
  });
});

it("moves a seat to a new connection and expires an idle waiting room", () => {
  const { connect, rooms, advance } = harness();
  const host = connect("host");
  const hostEntry = entry("Duy");
  accepted(host.send("enter", hostEntry));
  const replacement = connect("replacement");
  const next = accepted(
    replacement.send("resume", { resumeToken: hostEntry.resumeToken }),
  );
  expect(host.closed).toContain("kết nối khác");
  expect(
    host.send("move", { index: 0, revision: next.room.revision }),
  ).toMatchObject({ code: "NOT_AUTHORIZED" });
  host.disconnect();
  expect(replacement.view?.players[0]?.connected).toBe(true);
  advance(30 * 60_000);
  rooms.sweep();
  expect(replacement.closed).toContain("hết hạn");
  expect(
    host.send("resume", { resumeToken: hostEntry.resumeToken }),
  ).toMatchObject({ code: "INVALID_ROOM" });
});
