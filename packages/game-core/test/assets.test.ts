import { describe, expect, it } from "vitest";
import { applyAction } from "../src/index.js";
import type { GameState, GameAction } from "../src/index.js";
import { makeState } from "./fixtures/state-factory.js";
import { randomTape } from "./fixtures/random-tape.js";
function act(s: GameState, action: GameAction, actor = "p1") {
  const r = applyAction(s, actor, action, randomTape([]));
  expect(r.ok).toBe(true);
  if (!r.ok) throw new Error(r.code);
  return r.state;
}
function group() {
  const s = makeState();
  for (const id of [6, 8, 9]) s.board[id]!.owner = "p1";
  return s;
}
describe("asset management", () => {
  it("cannot_build_on_incomplete_or_mortgaged_group", () => {
    const s = makeState();
    s.board[6]!.owner = "p1";
    expect(
      applyAction(s, "p1", { type: "build", spaceId: 6 }, randomTape([])).ok,
    ).toBe(false);
    const full = group();
    full.board[9]!.mortgaged = true;
    expect(
      applyAction(full, "p1", { type: "build", spaceId: 6 }, randomTape([])).ok,
    ).toBe(false);
  });
  it("build_and_sell_evenly_without_skipping_roll", () => {
    let s = act(group(), { type: "build", spaceId: 6 });
    expect(s.players[0]!.cash).toBe(1450);
    expect(s.bank.houses).toBe(31);
    expect(s.phase).toBe("awaiting-roll");
    expect(
      applyAction(s, "p1", { type: "build", spaceId: 6 }, randomTape([])).ok,
    ).toBe(false);
    s = act(s, { type: "build", spaceId: 8 });
    s = act(s, { type: "build", spaceId: 9 });
    s = act(s, { type: "build", spaceId: 6 });
    expect(
      applyAction(
        s,
        "p1",
        { type: "sell-building", spaceId: 8 },
        randomTape([]),
      ).ok,
    ).toBe(false);
    s = act(s, { type: "sell-building", spaceId: 6 });
    expect(s.board[6]!.buildings).toBe(1);
    expect(s.players[0]!.cash).toBe(1325);
  });
  it("hotel_conversion_returns_four_houses_and_respects_inventory", () => {
    const s = group();
    for (const id of [6, 8, 9]) s.board[id]!.buildings = 4;
    s.bank.houses = 20;
    const next = act(s, { type: "build", spaceId: 6 });
    expect(next.board[6]!.buildings).toBe(5);
    expect(next.bank).toEqual({ houses: 24, hotels: 11 });
    const sold = act(next, { type: "sell-building", spaceId: 6 });
    expect(sold.bank).toEqual({ houses: 20, hotels: 12 });
    expect(sold.board[6]!.buildings).toBe(4);
    s.bank.hotels = 0;
    expect(
      applyAction(s, "p1", { type: "build", spaceId: 6 }, randomTape([])).ok,
    ).toBe(false);
  });
  it("house_pool_never_goes_negative", () => {
    const s = group();
    s.bank.houses = 0;
    expect(
      applyAction(s, "p1", { type: "build", spaceId: 6 }, randomTape([])).ok,
    ).toBe(false);
  });
  it("auctions_the_last_house_when_multiple_owners_can_build_and_resumes_roll", () => {
    const s = group();
    for (const i of [6, 8, 9]) s.board[i]!.owner = "p2";
    for (const i of [1, 3]) s.board[i]!.owner = "p1";
    s.bank.houses = 1;
    let next = act(s, { type: "build", spaceId: 1 });
    expect(next.phase).toBe("auction");
    expect(next.auction?.kind).toBe("house");
    next = act(next, { type: "bid", amount: 10 });
    next = act(next, { type: "bid", amount: 20 }, "p2");
    next = act(next, { type: "pass-auction" });
    expect(next.board[6]!.buildings).toBe(1);
    expect(next.bank.houses).toBe(0);
    expect(next.players[1]!.cash).toBe(1480);
    expect(next.phase).toBe("awaiting-roll");
  });
  it("mortgage_requires_group_buildings_sold_and_unmortgage_costs_110_percent", () => {
    let s = act(group(), { type: "mortgage", spaceId: 6 });
    expect(s.players[0]!.cash).toBe(1550);
    expect(s.board[6]!.mortgaged).toBe(true);
    s = act(s, { type: "unmortgage", spaceId: 6 });
    expect(s.players[0]!.cash).toBe(1495);
    expect(s.board[6]!.mortgaged).toBe(false);
    s.board[8]!.buildings = 1;
    expect(
      applyAction(s, "p1", { type: "mortgage", spaceId: 9 }, randomTape([])).ok,
    ).toBe(false);
  });
  it("rounds_utility_mortgage_interest_up_to_whole_units", () => {
    const s = makeState();
    s.board[12]!.owner = "p1";
    s.board[12]!.mortgaged = true;
    const next = act(s, { type: "unmortgage", spaceId: 12 });
    expect(next.players[0]!.cash).toBe(1417);
  });
  it("liquidation_settles_debt_then_resumes_interrupted_effects", () => {
    const s = group();
    s.players[0]!.cash = 0;
    s.phase = "debt";
    s.debt = { payer: "p1", payee: "p2", amount: 25 };
    s.pendingEffects = [
      { type: "payment", payer: "bank", payee: "p1", amount: 100 },
    ];
    const next = act(s, { type: "mortgage", spaceId: 6 });
    expect(next.players.map((p) => p.cash)).toEqual([125, 1525]);
    expect(next.debt).toBeNull();
    expect(next.phase).toBe("awaiting-end-turn");
  });
  it("cannot_declare_bankruptcy_while_liquidation_can_pay", () => {
    const s = group();
    s.players[0]!.cash = 0;
    s.phase = "debt";
    s.debt = { payer: "p1", payee: "p2", amount: 25 };
    expect(
      applyAction(s, "p1", { type: "declare-bankruptcy" }, randomTape([])).ok,
    ).toBe(false);
  });
  it("last_survivor_finishes_game_and_rejects_more_actions", () => {
    const s = makeState();
    s.players[0]!.cash = 10;
    s.phase = "debt";
    s.debt = { payer: "p1", payee: "p2", amount: 50 };
    const next = act(s, { type: "declare-bankruptcy" });
    expect(next.phase).toBe("finished");
    expect(next.winner).toBe("p2");
    expect(next.players[1]!.cash).toBe(1510);
    expect(applyAction(next, "p2", { type: "roll" }, randomTape([])).ok).toBe(
      false,
    );
  });
  it("bank_creditor_auctions_properties_and_advances_bankrupt_current_player", () => {
    const s = makeState();
    s.players.push({
      ...s.players[1]!,
      id: "p3",
      token: "hat",
      name: "Máy 2",
      jailCards: [],
    });
    s.players[0]!.cash = 0;
    s.board[6]!.owner = "p1";
    s.board[6]!.mortgaged = true;
    s.phase = "debt";
    s.debt = { payer: "p1", payee: "bank", amount: 100 };
    let next = act(s, { type: "declare-bankruptcy" });
    expect(next.phase).toBe("auction");
    expect(next.board[6]!.owner).toBeNull();
    expect(next.board[6]!.mortgaged).toBe(false);
    next = act(next, { type: "pass-auction" }, "p2");
    next = act(next, { type: "pass-auction" }, "p3");
    expect(next.turn.playerId).toBe("p2");
    expect(next.phase).toBe("awaiting-roll");
  });
});
it('scarce_building_bidder_can_select_any_eligible_street_and_rejects_foreign_targets',()=>{
 const state=makeState();for(const id of [1,3])state.board[id]!.owner='p1';for(const id of [6,8,9])state.board[id]!.owner='p2';state.bank.houses=1;
 const opened=act(state,{type:'build',spaceId:1});
 expect(applyAction(opened,'p2',{type:'bid',amount:1,spaceId:1},randomTape([]))).toMatchObject({ok:false});
 let next=act(opened,{type:'bid',amount:1,spaceId:9},'p2');next=act(next,{type:'pass-auction'});expect(next.board[9]!.buildings).toBe(1);expect(next.board[6]!.buildings).toBe(0);
});
