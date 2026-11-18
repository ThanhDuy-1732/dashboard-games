import { describe, expect, it } from "vitest";
import { applyAction, createGame } from "../src/index.js";
import type { GameState, GameAction } from "../src/index.js";
import { makeState, players } from "./fixtures/state-factory.js";
import { randomTape, seededRandom } from "./fixtures/random-tape.js";
function act(
  state: GameState,
  action: GameAction,
  dice: number[] = [],
  actor = "p1",
) {
  const result = applyAction(state, actor, action, randomTape(dice));
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.code);
  return result.state;
}
describe("turns, cards and jail", () => {
  it("starts_with_1500_and_2_to_6_players", () => {
    const state = createGame({ gameId: "new-game", players }, seededRandom(42));
    expect(state.players.map((p) => p.cash)).toEqual([1500, 1500]);
    expect(state.players.every((p) => p.position === 0)).toBe(true);
    expect(state.bank).toEqual({ houses: 32, hotels: 12 });
    expect(new Set(state.decks.chance).size).toBe(16);
    expect(() =>
      createGame(
        { gameId: "bad", players: players.slice(0, 1) },
        seededRandom(42),
      ),
    ).toThrow();
    expect(() =>
      createGame(
        { gameId: "bad", players: [players[0]!, players[0]!] },
        seededRandom(42),
      ),
    ).toThrow();
  });
  it("passes_go_once_per_crossing_without_mutating_input", () => {
    const state = makeState();
    state.players[0]!.position = 39;
    const next = act(state, { type: "roll" }, [1, 1]);
    expect(next.players[0]!.cash).toBe(1700);
    expect(next.players[0]!.position).toBe(1);
    expect(state.players[0]!.position).toBe(39);
    expect(state.revision).toBe(0);
    expect(next.revision).toBe(1);
  });
  it("third_double_goes_to_jail_without_moving", () => {
    let state = act(makeState(), { type: "roll" }, [2, 2]);
    state = act(state, { type: "roll" }, [3, 3]);
    state = act(state, { type: "roll" }, [1, 1]);
    expect(state.players[0]!.position).toBe(10);
    expect(state.players[0]!.jail).toEqual({ turns: 0 });
    expect(state.turn.extraRoll).toBe(false);
    expect(state.phase).toBe("awaiting-end-turn");
  });
  it("jail_double_does_not_grant_extra_roll", () => {
    const state = makeState();
    state.players[0]!.position = 10;
    state.players[0]!.jail = { turns: 0 };
    state.phase = "jail-choice";
    const next = act(state, { type: "roll" }, [5, 5]);
    expect(next.players[0]!.position).toBe(20);
    expect(next.players[0]!.jail).toBeNull();
    expect(next.turn.extraRoll).toBe(false);
    expect(next.phase).toBe("awaiting-end-turn");
  });
  it("third_failed_jail_roll_requires_50_then_moves", () => {
    const state = makeState();
    state.players[0]!.position = 10;
    state.players[0]!.jail = { turns: 2 };
    state.phase = "jail-choice";
    const next = act(state, { type: "roll" }, [1, 2]);
    expect(next.players[0]!.position).toBe(13);
    expect(next.players[0]!.cash).toBe(1450);
    expect(next.phase).toBe("awaiting-purchase");
    state.players[0]!.cash = 10;
    const debt = act(state, { type: "roll" }, [1, 2]);
    expect(debt.players[0]!.position).toBe(10);
    expect(debt.debt).toMatchObject({ payer: "p1", payee: "bank", amount: 50 });
    expect(debt.phase).toBe("debt");
    expect(debt.pendingEffects[0]).toMatchObject({ type: "move", spaceId: 13 });
  });
  it("card_moves_back_without_salary_and_resolves_following_tax", () => {
    const state = makeState();
    state.players[0]!.position = 4;
    state.decks.chance = [
      "chance-9",
      ...state.decks.chance.filter((c) => c !== "chance-9"),
    ];
    const next = act(state, { type: "roll" }, [1, 2]);
    expect(next.players[0]!.position).toBe(4);
    expect(next.players[0]!.cash).toBe(1300);
    expect(next.decks.chance.at(-1)).toBe("chance-9");
  });
  it("held_jail_card_leaves_deck_until_used", () => {
    const state = makeState();
    state.players[0]!.position = 4;
    state.decks.chance = [
      "chance-16",
      ...state.decks.chance.filter((c) => c !== "chance-16"),
    ];
    const next = act(state, { type: "roll" }, [1, 2]);
    expect(next.players[0]!.jailCards).toEqual(["chance-16"]);
    expect(next.decks.chance).not.toContain("chance-16");
    next.phase = "jail-choice";
    next.players[0]!.jail = { turns: 0 };
    next.players[0]!.position = 10;
    const released = act(next, { type: "use-jail-card", cardId: "chance-16" });
    expect(released.players[0]!.jail).toBeNull();
    expect(released.decks.chance.at(-1)).toBe("chance-16");
    expect(released.phase).toBe("awaiting-roll");
  });
  it("rejects_actions_out_of_turn_without_state_changes", () => {
    const state = makeState();
    expect(applyAction(state, "p2", { type: "roll" }, randomTape([]))).toEqual({
      ok: false,
      code: "NOT_AUTHORIZED",
    });
    expect(
      applyAction(state, "stranger", { type: "roll" }, randomTape([])),
    ).toEqual({ ok: false, code: "NOT_AUTHORIZED" });
    expect(state).toEqual(makeState());
  });
  it("does_not_skip_another_player_after_jail_failure", () => {
    const state = makeState();
    state.phase = "jail-choice";
    state.players[0]!.jail = { turns: 0 };
    state.players[0]!.position = 10;
    const failed = act(state, { type: "roll" }, [1, 2]);
    expect(failed.players[0]!.jail?.turns).toBe(1);
    const next = act(failed, { type: "end-turn" });
    expect(next.turn.playerId).toBe("p2");
    expect(next.phase).toBe("awaiting-roll");
  });
});
