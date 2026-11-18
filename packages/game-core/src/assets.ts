import { BOARD } from "./board.js";
import type { GameState, PlayerId } from "./types.js";
import { playerById, recordEvent, requireRule } from "./rules.js";
import { placeBuilding, settlePayment } from "./economy.js";

export function groupSpaces(spaceId: number): number[] {
  const space = BOARD[spaceId];
  return space?.kind === "street"
    ? BOARD.filter((s) => s.kind === "street" && s.group === space.group).map(
        (s) => s.id,
      )
    : [spaceId];
}
export function requireManagement(
  state: GameState,
  actor: PlayerId,
  raising = false,
) {
  if (state.phase === "debt") {
    requireRule(raising && state.debt?.payer === actor, "NOT_AUTHORIZED");
    return;
  }
  if (state.phase === "mortgage-transfer") {
    requireRule(
      raising && state.mortgageTransfers[0]?.playerId === actor,
      "NOT_AUTHORIZED",
    );
    return;
  }
  requireRule(
    [
      "awaiting-roll",
      "awaiting-purchase",
      "jail-choice",
      "awaiting-end-turn",
    ].includes(state.phase),
  );
}
export function buildableSpaces(state: GameState, actor: PlayerId): number[] {
  return BOARD.filter((space) => {
    const property = state.board[space.id]!;
    if (
      space.kind !== "street" ||
      property.owner !== actor ||
      property.buildings >= 5
    )
      return false;
    const group = groupSpaces(space.id);
    return (
      group.every(
        (id) => state.board[id]!.owner === actor && !state.board[id]!.mortgaged,
      ) &&
      property.buildings ===
        Math.min(...group.map((id) => state.board[id]!.buildings))
    );
  }).map((s) => s.id);
}
export function mortgageableSpaces(
  state: GameState,
  actor: PlayerId,
): number[] {
  return BOARD.filter(
    (space) =>
      space.mortgage !== undefined &&
      state.board[space.id]!.owner === actor &&
      !state.board[space.id]!.mortgaged &&
      groupSpaces(space.id).every((id) => state.board[id]!.buildings === 0),
  ).map((s) => s.id);
}
export function sellableSpaces(state: GameState, actor: PlayerId): number[] {
  return BOARD.filter(
    (space) =>
      state.board[space.id]!.owner === actor &&
      state.board[space.id]!.buildings > 0 &&
      state.board[space.id]!.buildings ===
        Math.max(
          ...groupSpaces(space.id).map((id) => state.board[id]!.buildings),
        ),
  ).map((s) => s.id);
}
export function build(state: GameState, actor: PlayerId, spaceId: number) {
  requireManagement(state, actor);
  requireRule(buildableSpaces(state, actor).includes(spaceId));
  const property = state.board[spaceId]!;
  const space = BOARD[spaceId]!;
  const kind = property.buildings === 4 ? "hotel" : "house";
  const available = kind === "house" ? state.bank.houses : state.bank.hotels;
  requireRule(available > 0);
  requireRule(
    playerById(state, actor).cash >= space.buildCost!,
    "INSUFFICIENT_FUNDS",
  );
  if (available === 1) {
    const targets: Record<string, number> = {};
    for (const player of state.players.filter(
      (p) => !p.bankrupt && p.cash > 0,
    )) {
      const target = buildableSpaces(state, player.id).find(
        (id) => (state.board[id]!.buildings === 4 ? "hotel" : "house") === kind,
      );
      if (target !== undefined)
        targets[player.id] = player.id === actor ? spaceId : target;
    }
    if (Object.keys(targets).length > 1) {
      state.resumePhase = state.phase;
      state.auction = {
        spaceId,
        bid: 0,
        bidder: null,
        participants: Object.keys(targets),
        kind,
        targets,
      };
      state.phase = "auction";
      return;
    }
  }
  settlePayment(state, actor, "bank", space.buildCost!);
  placeBuilding(state, spaceId);
  recordEvent(
    state,
    "build",
    `${playerById(state, actor).name} xây tại ${space.name}.`,
    { playerId: actor, spaceId, amount: space.buildCost! },
  );
}
export function sellBuilding(
  state: GameState,
  actor: PlayerId,
  spaceId: number,
) {
  requireManagement(state, actor, true);
  requireRule(sellableSpaces(state, actor).includes(spaceId));
  const property = state.board[spaceId]!;
  const cost = BOARD[spaceId]!.buildCost!;
  if (property.buildings === 5 && state.bank.houses < 4) {
    // A hotel cannot turn into houses that the bank does not have: liquidate the whole color group.
    for (const id of groupSpaces(spaceId)) liquidateBuildings(state, actor, id);
  } else {
    if (property.buildings === 5) {
      state.bank.hotels++;
      state.bank.houses -= 4;
    } else state.bank.houses++;
    property.buildings--;
    settlePayment(state, "bank", actor, cost / 2);
  }
  recordEvent(
    state,
    "sell-building",
    `${playerById(state, actor).name} bán công trình tại ${BOARD[spaceId]!.name}.`,
    { playerId: actor, spaceId },
  );
}
function liquidateBuildings(
  state: GameState,
  actor: PlayerId,
  spaceId: number,
) {
  const property = state.board[spaceId]!;
  const count = property.buildings;
  if (!count) return;
  if (count === 5) state.bank.hotels++;
  else state.bank.houses += count;
  property.buildings = 0;
  settlePayment(state, "bank", actor, (count * BOARD[spaceId]!.buildCost!) / 2);
}
export function mortgage(state: GameState, actor: PlayerId, spaceId: number) {
  requireManagement(state, actor, true);
  requireRule(mortgageableSpaces(state, actor).includes(spaceId));
  state.board[spaceId]!.mortgaged = true;
  settlePayment(state, "bank", actor, BOARD[spaceId]!.mortgage!);
  recordEvent(
    state,
    "mortgage",
    `${playerById(state, actor).name} thế chấp ${BOARD[spaceId]!.name}.`,
    { playerId: actor, spaceId },
  );
}
export function unmortgage(state: GameState, actor: PlayerId, spaceId: number) {
  requireManagement(state, actor);
  const property = state.board[spaceId];
  const space = BOARD[spaceId];
  requireRule(
    property && space && property.owner === actor && property.mortgaged,
  );
  const cost = space.mortgage! + Math.ceil(space.mortgage! / 10);
  requireRule(playerById(state, actor).cash >= cost, "INSUFFICIENT_FUNDS");
  settlePayment(state, actor, "bank", cost);
  property.mortgaged = false;
  recordEvent(
    state,
    "unmortgage",
    `${playerById(state, actor).name} giải chấp ${space.name}.`,
    { playerId: actor, spaceId, amount: cost },
  );
}
export function liquidationValue(state: GameState, actor: PlayerId) {
  return (
    playerById(state, actor).cash +
    BOARD.reduce((sum, space) => {
      const property = state.board[space.id]!;
      return (
        sum +
        (property.owner === actor
          ? (property.buildings * (space.buildCost ?? 0)) / 2 +
            (property.mortgaged ? 0 : (space.mortgage ?? 0))
          : 0)
      );
    }, 0)
  );
}
export function declareBankruptcy(state: GameState, actor: PlayerId) {
  const debt = state.debt;
  requireRule(state.phase === "debt" && debt?.payer === actor);
  requireRule(liquidationValue(state, actor) < debt.amount);
  const player = playerById(state, actor);
  const creditor = debt.payee;
  for (const space of BOARD)
    if (state.board[space.id]!.owner === actor)
      liquidateBuildings(state, actor, space.id);
  settlePayment(state, actor, creditor, player.cash);
  const auctions: number[] = [];
  for (const space of BOARD) {
    const property = state.board[space.id]!;
    if (property.owner !== actor) continue;
    if (creditor === "bank") {
      property.owner = null;
      property.mortgaged = false;
      auctions.push(space.id);
    } else {
      property.owner = creditor;
      if (property.mortgaged)
        state.mortgageTransfers.push({ playerId: creditor, spaceId: space.id });
    }
  }
  if (creditor === "bank")
    for (const card of player.jailCards)
      (card.startsWith("chance-")
        ? state.decks.chance
        : state.decks.community
      ).push(card);
  else playerById(state, creditor).jailCards.push(...player.jailCards);
  player.jailCards = [];
  player.bankrupt = true;
  player.jail = null;
  state.debt = null;
  state.trades = state.trades.filter((t) => t.from !== actor && t.to !== actor);
  state.mortgageTransfers = state.mortgageTransfers.filter(
    (t) => t.playerId !== actor,
  );
  state.pendingEffects = state.pendingEffects.filter(
    (e) => !("playerId" in e && e.playerId === actor),
  );
  const survivors = state.players.filter((p) => !p.bankrupt);
  recordEvent(state, "bankruptcy", `${player.name} phá sản.`, {
    playerId: actor,
  });
  if (survivors.length === 1) {
    state.winner = survivors[0]!.id;
    state.phase = "finished";
    state.pendingEffects = [];
    state.mortgageTransfers = [];
    state.auction = null;
    state.resumePhase = null;
    return;
  }
  state.pendingEffects.unshift(
    ...auctions.map((spaceId) => ({ type: "auction" as const, spaceId })),
  );
  state.phase = "awaiting-end-turn";
}
