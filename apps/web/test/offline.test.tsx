import { expect, it, vi } from "vitest";
import { createOfflineSession } from "../src/session/offline.js";
import type { SessionUpdate } from "@nha-choi/protocol";
import { makeState } from "../../../packages/game-core/test/fixtures/state-factory.js";
import { makeSavedGame } from "../src/storage/save-schema.js";
it("creates_1_to_5_bots_and_stops_scheduling_when_closed", async () => {
  vi.useFakeTimers();
  try {
    const session = createOfflineSession({
      human: { id: "human", name: "Bạn", token: "car", kind: "human" },
      botCount: 5,
    });
    let update: SessionUpdate | null = null;
    session.subscribe((next) => {
      update = next;
    });
    expect((update as SessionUpdate | null)?.view?.players).toHaveLength(6);
    expect(
      new Set(
        (update as SessionUpdate | null)?.view?.players.map((p) => p.token),
      ).size,
    ).toBe(6);
    await session.close();
    await vi.runAllTimersAsync();
    expect((update as SessionUpdate | null)?.connection).toBe("closed");
    expect(() =>
      createOfflineSession({
        human: { id: "human", name: "Bạn", token: "car", kind: "human" },
        botCount: 6,
      }),
    ).toThrow();
  } finally {
    vi.useRealTimers();
  }
});
it("resume_restores_debt_auction_jail_and_bot_turn_without_replaying_actions", async () => {
  vi.useFakeTimers();
  try {
    for (const phase of [
      "debt",
      "auction",
      "jail-choice",
      "awaiting-roll",
    ] as const) {
      const state = makeState();
      state.phase = phase;
      if (phase === "debt") {
        state.players[0]!.cash = 0;
        state.debt = { payer: "p1", payee: "bank", amount: 50 };
      }
      if (phase === "auction")
        state.auction = {
          kind: "property",
          spaceId: 6,
          bid: 0,
          bidder: null,
          participants: ["p1", "p2"],
        };
      if (phase === "jail-choice") {
        state.players[0]!.position = 10;
        state.players[0]!.jail = { turns: 1 };
      }
      if (phase === "awaiting-roll") state.turn.playerId = "p2";
      const session = createOfflineSession(
        { human: state.players[0]!, botCount: 1 },
        makeSavedGame(state, "p1"),
      );
      expect(session.snapshot()).toEqual(state);
      session.pause("Saving");
      const before = session.snapshot();
      await vi.advanceTimersByTimeAsync(500);
      expect(session.snapshot()).toEqual(before);
      await session.close();
    }
  } finally {
    vi.useRealTimers();
  }
});
it("bots_answer_a_human_debtors_offer_before_waiting_for_the_debtor", async () => {
  vi.useFakeTimers();
  try {
    const state = makeState();
    state.phase = "debt";
    state.debt = { payer: "p1", payee: "bank", amount: 40 };
    state.players[0]!.cash = 0;
    state.board[1]!.owner = "p1";
    const session = createOfflineSession(
      { human: state.players[0]!, botCount: 1 },
      makeSavedGame(state, "p1"),
    );
    expect(
      (
        await session.send({
          protocolVersion: 1,
          gameId: state.gameId,
          commandId: crypto.randomUUID(),
          expectedRevision: 0,
          action: {
            type: "offer-trade",
            to: "p2",
            give: { cash: 0, spaceIds: [1], jailCards: [] },
            receive: { cash: 40, spaceIds: [], jailCards: [] },
          },
        })
      ).ok,
    ).toBe(true);
    await vi.advanceTimersByTimeAsync(120);
    expect(session.snapshot().board[1]!.owner).toBe("p2");
    expect(session.snapshot().debt).toBeNull();
    await session.close();
  } finally {
    vi.useRealTimers();
  }
});

it.each([
  { give: 0, receive: 10, outcome: "từ chối" },
  { give: 10, receive: 0, outcome: "chấp nhận" },
])("logs when Máy 1 answers a trade ($outcome)", async ({ give, receive, outcome }) => {
  vi.useFakeTimers();
  const state = makeState();
  state.phase = "awaiting-end-turn";
  const session = createOfflineSession(
    { human: state.players[0]!, botCount: 1 },
    makeSavedGame(state, "p1"),
  );
  try {
    const reply = await session.send({
      protocolVersion: 1,
      gameId: state.gameId,
      commandId: crypto.randomUUID(),
      expectedRevision: state.revision,
      action: {
        type: "offer-trade",
        to: "p2",
        give: { cash: give, spaceIds: [], jailCards: [] },
        receive: { cash: receive, spaceIds: [], jailCards: [] },
      },
    });
    expect(reply.ok).toBe(true);
    await vi.advanceTimersByTimeAsync(120);
    const next = session.snapshot();
    expect(next.trades).toHaveLength(0);
    expect(next.phase).toBe("awaiting-end-turn");
    expect(next.recentEvents.at(-1)?.text).toContain(`Máy 1 ${outcome}`);
  } finally {
    await session.close();
    vi.useRealTimers();
  }
});
