import type { GameState, GameEvent, PlayerId, RuleErrorCode } from "./types.js";
export class RuleViolation extends Error {
  constructor(public code: RuleErrorCode) {
    super(code);
  }
}
export function requireRule(
  condition: unknown,
  code: RuleErrorCode = "INVALID_ACTION",
): asserts condition {
  if (!condition) throw new RuleViolation(code);
}
export function playerById(state: GameState, id: PlayerId) {
  const player = state.players.find((p) => p.id === id);
  requireRule(player, "NOT_AUTHORIZED");
  return player;
}
export function recordEvent(
  state: GameState,
  type: string,
  text: string,
  details: Omit<Partial<GameEvent>, "id" | "type" | "text"> = {},
) {
  state.recentEvents.push({
    id: (state.recentEvents.at(-1)?.id ?? 0) + 1,
    type,
    text,
    ...details,
  });
  state.recentEvents = state.recentEvents.slice(-100);
}
export function advanceTurn(state: GameState) {
  const current = state.players.findIndex((p) => p.id === state.turn.playerId);
  let next = current;
  do {
    next = (next + 1) % state.players.length;
  } while (state.players[next]!.bankrupt);
  const target = state.players[next]!;
  state.turn = {
    playerId: target.id,
    doubles: 0,
    dice: null,
    extraRoll: false,
    number: state.turn.number + 1,
  };
  state.phase = target.jail ? "jail-choice" : "awaiting-roll";
}
