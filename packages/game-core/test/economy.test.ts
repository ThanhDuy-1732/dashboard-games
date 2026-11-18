import { describe, expect, it } from "vitest";
import { applyAction } from "../src/index.js";
import { getRent, trySettleDebt } from "../src/economy.js";
import { runEffects } from "../src/movement.js";
import type { GameState, GameAction } from "../src/index.js";
import { makeState } from "./fixtures/state-factory.js";
import { randomTape } from "./fixtures/random-tape.js";
function act(
  state: GameState,
  actor: string,
  action: GameAction,
  values: number[] = [],
) {
  const r = applyAction(state, actor, action, randomTape(values));
  expect(r.ok).toBe(true);
  if (!r.ok) throw new Error(r.code);
  return r.state;
}
function purchase() {
  const s = makeState();
  s.purchase = 6;
  s.phase = "awaiting-purchase";
  return s;
}
describe("purchases rent auctions and debt", () => {
  it("buys_at_printed_price_and_rejects_a_second_purchase", () => {
    const next = act(purchase(), "p1", { type: "buy-property" });
    expect(next.players[0]!.cash).toBe(1400);
    expect(next.board[6]!.owner).toBe("p1");
    expect(
      applyAction(next, "p1", { type: "buy-property" }, randomTape([])).ok,
    ).toBe(false);
  });
  it("decline_starts_auction_for_all_active_players", () => {
    const next = act(purchase(), "p1", { type: "decline-property" });
    expect(next.phase).toBe("auction");
    expect(next.auction?.participants).toEqual(["p1", "p2"]);
  });
  it("last_bidder_pays_exactly_once", () => {
    let s = act(purchase(), "p1", { type: "decline-property" });
    s = act(s, "p2", { type: "bid", amount: 55 });
    s = act(s, "p1", { type: "pass-auction" });
    expect(s.players[1]!.cash).toBe(1445);
    expect(s.board[6]!.owner).toBe("p2");
    expect(s.phase).toBe("awaiting-end-turn");
    expect(
      applyAction(s, "p2", { type: "bid", amount: 60 }, randomTape([])).ok,
    ).toBe(false);
  });
  it("all_pass_returns_property_to_bank", () => {
    let s = act(purchase(), "p1", { type: "decline-property" });
    s = act(s, "p1", { type: "pass-auction" });
    s = act(s, "p2", { type: "pass-auction" });
    expect(s.board[6]!.owner).toBeNull();
    expect(s.auction).toBeNull();
    expect(s.phase).toBe("awaiting-end-turn");
  });
  it("equal_bid_is_rejected_without_changing_owner_or_cash", () => {
    let s = act(purchase(), "p1", { type: "decline-property" });
    s = act(s, "p1", { type: "bid", amount: 100 });
    expect(
      applyAction(s, "p2", { type: "bid", amount: 100 }, randomTape([])).ok,
    ).toBe(false);
    expect(s.auction?.bidder).toBe("p1");
    expect(s.board[6]!.owner).toBeNull();
    expect(s.players[0]!.cash).toBe(1500);
  });
  it("monopoly_doubles_base_rent_and_mortgaged_property_collects_zero", () => {
    const s = makeState();
    for (const i of [6, 8, 9]) s.board[i]!.owner = "p2";
    expect(getRent(s, 6, 7)).toBe(12);
    s.board[8]!.mortgaged = true;
    expect(getRent(s, 6, 7)).toBe(12);
    s.board[6]!.buildings = 3;
    expect(getRent(s, 6, 7)).toBe(270);
    s.board[6]!.mortgaged = true;
    expect(getRent(s, 6, 7)).toBe(0);
  });
  it("stations_and_utilities_use_correct_counts", () => {
    const s = makeState();
    for (const [index, id] of [5, 15, 25, 35].entries()) {
      s.board[id]!.owner = "p2";
      expect(getRent(s, 5, 7)).toBe([25, 50, 100, 200][index]);
    }
    s.board[12]!.owner = "p2";
    expect(getRent(s, 12, 7)).toBe(28);
    s.board[28]!.owner = "p2";
    expect(getRent(s, 12, 7)).toBe(70);
  });
  it("landing_pays_owner_and_nearest_station_card_doubles_rent", () => {
    const s = makeState();
    s.board[5]!.owner = "p2";
    s.players[0]!.position = 2;
    const next = act(s, "p1", { type: "roll" }, [1, 2]);
    expect(next.players.map((p) => p.cash)).toEqual([1475, 1525]);
    s.players[0]!.position = 4;
    s.decks.chance = [
      "chance-6",
      ...s.decks.chance.filter((c) => c !== "chance-6"),
    ];
    s.board[15]!.owner = "p2";
    const nearest = act(s, "p1", { type: "roll" }, [1, 2]);
    expect(nearest.players[0]!.position).toBe(15);
    expect(nearest.players[0]!.cash).toBe(1400);
  });
  it("nearest_utility_uses_a_new_roll_only_when_rent_is_due", () => {
    const s = makeState();
    s.players[0]!.position = 4;
    s.board[12]!.owner = "p2";
    s.decks.chance = [
      "chance-8",
      ...s.decks.chance.filter((c) => c !== "chance-8"),
    ];
    const next = act(s, "p1", { type: "roll" }, [1, 2, 3, 4]);
    expect(next.players[0]!.cash).toBe(1430);
    expect(next.turn.dice).toEqual([1, 2]);
    s.board[12]!.mortgaged = true;
    expect(act(s, "p1", { type: "roll" }, [1, 2]).players[0]!.cash).toBe(1500);
  });
  it("insufficient_cash_enters_debt_and_blocks_roll", () => {
    const s = makeState();
    s.players[0]!.position = 2;
    s.players[0]!.cash = 10;
    s.board[5]!.owner = "p2";
    const next = act(s, "p1", { type: "roll" }, [1, 2]);
    expect(next.phase).toBe("debt");
    expect(next.players[0]!.cash).toBe(10);
    expect(next.debt?.amount).toBe(25);
    expect(applyAction(next, "p1", { type: "roll" }, randomTape([])).ok).toBe(
      false,
    );
  });
  it("payment_queue_resumes_at_exactly_the_interrupted_effect", () => {
    const s = makeState();
    s.players[0]!.cash = 10;
    s.pendingEffects = [
      { type: "payment", payer: "p1", payee: "p2", amount: 50 },
      { type: "payment", payer: "bank", payee: "p1", amount: 100 },
    ];
    runEffects(s, randomTape([]));
    expect(s.phase).toBe("debt");
    expect(s.pendingEffects).toHaveLength(1);
    s.players[0]!.cash = 60;
    expect(trySettleDebt(s)).toBe(true);
    runEffects(s, randomTape([]));
    expect(s.players[0]!.cash).toBe(110);
    expect(s.players[1]!.cash).toBe(1550);
    expect(s.debt).toBeNull();
  });
});
