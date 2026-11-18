import { describe, expect, it } from "vitest";
import {
  applyAction,
  createGame,
  projectGame,
  chooseBotAction,
} from "../src/index.js";
import type { GameState, Token } from "../src/index.js";
import { makeState, players } from "./fixtures/state-factory.js";
import { seededRandom } from "./fixtures/random-tape.js";
function decisionPlayer(s: GameState) {
  return s.phase === "auction"
    ? s.auction!.participants.find((id) => id !== s.auction!.bidder)!
    : s.phase === "debt"
      ? s.debt!.payer
      : s.phase === "mortgage-transfer"
        ? s.mortgageTransfers[0]!.playerId
        : s.turn.playerId;
}
function simulate(seed: number, limit: number, count = 2) {
  const random = seededRandom(seed);
  const tokens: Token[] = ["car", "cat", "hat", "ship", "dog", "plane"];
  const group = Array.from({ length: count }, (_, i) => ({
    ...players[0]!,
    id: `p${i + 1}`,
    name: `Máy ${i + 1}`,
    token: tokens[i]!,
    kind: "bot" as const,
  }));
  let state = createGame({ gameId: "simulation", players: group }, random);
  for (let i = 0; i < limit && state.phase !== "finished"; i++) {
    const actor = decisionPlayer(state);
    const action = chooseBotAction(projectGame(state, actor));
    const result = applyAction(state, actor, action, random);
    expect(
      result.ok,
      `seed=${seed} step=${i} phase=${state.phase} action=${JSON.stringify(action)}`,
    ).toBe(true);
    if (!result.ok) throw new Error(result.code);
    state = result.state;
    expect(
      state.players.every((p) => Number.isSafeInteger(p.cash) && p.cash >= 0),
    ).toBe(true);
    expect(
      state.bank.houses +
        state.board.reduce(
          (sum, p) => sum + (p.buildings < 5 ? p.buildings : 0),
          0,
        ),
    ).toBe(32);
    expect(
      state.bank.hotels + state.board.filter((p) => p.buildings === 5).length,
    ).toBe(12);
    expect(
      state.decks.chance.length +
        state.decks.community.length +
        state.players.reduce((n, p) => n + p.jailCards.length, 0),
    ).toBe(32);
  }
  return state;
}
describe("bots", () => {
  it("chooses_mortgage_or_sale_when_in_debt_and_can_handle_jail", () => {
    const state = makeState();
    state.phase = "debt";
    state.debt = { payer: "p1", payee: "bank", amount: 50 };
    state.players[0]!.cash = 0;
    state.board[6]!.owner = "p1";
    expect(chooseBotAction(projectGame(state, "p1"))).toEqual({
      type: "mortgage",
      spaceId: 6,
    });
    state.debt = null;
    state.phase = "jail-choice";
    state.players[0]!.jail = { turns: 0 };
    state.players[0]!.cash = 200;
    expect(chooseBotAction(projectGame(state, "p1"))).toEqual({
      type: "pay-jail",
    });
  });
  it("does_not_overbid_or_accept_an_unfavorable_trade", () => {
    const state = makeState();
    state.phase = "auction";
    state.auction = {
      kind: "property",
      spaceId: 6,
      bid: 100,
      bidder: "p2",
      participants: ["p1", "p2"],
    };
    expect(chooseBotAction(projectGame(state, "p1"))).toEqual({
      type: "pass-auction",
    });
    state.phase = "awaiting-roll";
    state.auction = null;
    state.trades = [
      {
        id: "trade-1",
        from: "p2",
        to: "p1",
        give: { cash: 0, spaceIds: [], jailCards: [] },
        receive: { cash: 100, spaceIds: [], jailCards: [] },
      },
    ];
    expect(chooseBotAction(projectGame(state, "p1"))).toEqual({
      type: "reject-trade",
      tradeId: "trade-1",
    });
  });
  it("finishes_a_game_started_from_the_normal_initial_state", () => {
    const state = simulate(42, 20000);
    expect(state.phase).toBe("finished");
    expect(state.winner).toBeTruthy();
  }, 30000);
  it("keeps_money_inventory_and_cards_valid_across_50_seeds", () => {
    for (let seed = 1; seed <= 50; seed++) simulate(seed, 2000, 2 + (seed % 5));
  }, 60000);
});
