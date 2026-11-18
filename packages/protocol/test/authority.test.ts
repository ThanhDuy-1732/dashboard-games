import { expect, it } from "vitest";
import { createAuthority } from "../src/index.js";
import { makeState } from "../../game-core/test/fixtures/state-factory.js";
import { randomTape } from "../../game-core/test/fixtures/random-tape.js";
const command = {
  protocolVersion: 1 as const,
  gameId: "game-1",
  commandId: "eecf32d7-ae16-4f5f-b55a-b7c75ae94a6e",
  expectedRevision: 0,
  action: { type: "buy-property" as const },
};
it("duplicates_return_original_ack_and_never_spend_twice", () => {
  const s = makeState();
  s.phase = "awaiting-purchase";
  s.purchase = 6;
  const authority = createAuthority(s, randomTape([]));
  const first = authority.dispatch("p1", command);
  expect(first).toMatchObject({ ok: true, revision: 1 });
  expect(authority.dispatch("p1", command)).toEqual(first);
  expect(authority.getView("p1").players[0]!.cash).toBe(1400);
  expect(
    authority.dispatch("p1", { ...command, action: { type: "end-turn" } }),
  ).toMatchObject({ ok: false, code: "COMMAND_ID_REUSED" });
  expect(
    authority.dispatch("p2", { ...command, commandId: crypto.randomUUID() }),
  ).toMatchObject({ ok: false, code: "STALE_REVISION" });
});
it("rejects_wrong_games_actors_and_payloads_without_leaking_state", () => {
  const authority = createAuthority(makeState(), randomTape([]));
  expect(authority.dispatch("unknown", command)).toMatchObject({
    ok: false,
    code: "NOT_AUTHORIZED",
  });
  expect(
    authority.dispatch("p1", { ...command, gameId: "other" }),
  ).toMatchObject({ ok: false, code: "INVALID_GAME" });
  const snapshot = authority.snapshot();
  snapshot.players[0]!.cash = 0;
  expect(authority.getView("p1").players[0]!.cash).toBe(1500);
  expect(authority.getView("p1")).not.toHaveProperty("decks");
});
it("bounds_reply_cache_and_rejects_an_evicted_stale_command", () => {
  const authority = createAuthority(makeState(), randomTape([1, 2]));
  const first = { ...command, action: { type: "end-turn" as const } };
  expect(authority.dispatch("p1", first)).toMatchObject({
    ok: false,
    code: "INVALID_ACTION",
  });
  for (let i = 0; i < 1025; i++)
    authority.dispatch("p1", { ...first, commandId: crypto.randomUUID() });
  expect(
    authority.dispatch("p1", {
      ...first,
      commandId: crypto.randomUUID(),
      action: { type: "roll" },
    }),
  ).toMatchObject({ ok: true, revision: 1 });
  expect(authority.dispatch("p1", first)).toMatchObject({
    ok: false,
    code: "STALE_REVISION",
  });
  expect(authority.snapshot().revision).toBe(1);
});
