import type { ActionHint, GameState, PlayerId, PlayerView } from "./types.js";
import { boardFor } from "./board.js";
import {
  buildableSpaces,
  liquidationValue,
  mortgageableSpaces,
  sellableSpaces,
} from "./assets.js";
export function allowedActions(
  state: GameState,
  viewer: PlayerId,
): ActionHint[] {
  const board = boardFor(state.board.length);
  const player = state.players.find((p) => p.id === viewer);
  if (!player || player.bankrupt || state.phase === "finished") return [];
  const actions: ActionHint[] = [];
  if (state.phase === "auction") {
    const auction = state.auction!;
    if (!auction.participants.includes(viewer) || auction.bidder === viewer)
      return [];
    if (player.cash > auction.bid)
      actions.push({
        type: "bid",
        minimum: auction.bid + 1,
        maximum: player.cash,
        ...(auction.kind !== "property"
          ? { spaceIds: buildableSpaces(state, viewer, auction.kind) }
          : {}),
      });
    actions.push({ type: "pass-auction" });
    return actions;
  }
  const raising = state.phase === "debt" || state.phase === "mortgage-transfer";
  if (state.phase === "debt" && state.debt?.payer !== viewer) {
    const offers = state.trades
      .filter((t) => t.to === viewer && t.from === state.debt?.payer)
      .map((t) => t.id);
    return offers.length
      ? [
          { type: "accept-trade", tradeIds: offers },
          { type: "reject-trade", tradeIds: offers },
        ]
      : [];
  }
  if (state.phase === "mortgage-transfer") {
    const transfer = state.mortgageTransfers[0];
    if (transfer?.playerId !== viewer) return [];
    actions.push({
      type: "resolve-mortgage-transfer",
      spaceIds: [transfer.spaceId],
    });
  }
  if (viewer === state.turn.playerId) {
    if (state.phase === "awaiting-roll" || state.phase === "jail-choice")
      actions.push({ type: "roll" });
    if (state.phase === "jail-choice") {
      if (player.cash >= 50) actions.push({ type: "pay-jail" });
      if (player.jailCards.length)
        actions.push({ type: "use-jail-card", cardIds: player.jailCards });
    }
    if (state.phase === "awaiting-end-turn") actions.push({ type: "end-turn" });
    if (state.phase === "awaiting-purchase") {
      if (player.cash >= board[state.purchase!]!.price!)
        actions.push({ type: "buy-property" });
      actions.push({ type: "decline-property" });
    }
  }
  const sell = sellableSpaces(state, viewer);
  if (sell.length) actions.push({ type: "sell-building", spaceIds: sell });
  const mortgage = mortgageableSpaces(state, viewer);
  if (mortgage.length) actions.push({ type: "mortgage", spaceIds: mortgage });
  if (
    state.phase === "debt" &&
    liquidationValue(state, viewer) < state.debt!.amount
  )
    actions.push({ type: "declare-bankruptcy" });
  if (!raising) {
    const build = buildableSpaces(state, viewer).filter(
      (id) =>
        player.cash >= board[id]!.buildCost! &&
        (state.board[id]!.buildings === 4
          ? state.bank.hotels
          : state.bank.houses) > 0,
    );
    if (build.length) actions.push({ type: "build", spaceIds: build });
    const redeem = board.filter((space) => {
      const p = state.board[space.id]!;
      return (
        p.owner === viewer &&
        p.mortgaged &&
        player.cash >= space.mortgage! + Math.ceil(space.mortgage! / 10)
      );
    }).map((s) => s.id);
    if (redeem.length) actions.push({ type: "unmortgage", spaceIds: redeem });
  }
  if (state.phase !== "mortgage-transfer") {
    actions.push({
      type: "offer-trade",
      playerIds: state.players
        .filter((p) => !p.bankrupt && p.id !== viewer)
        .map((p) => p.id),
    });
    const incoming = state.trades
      .filter((t) => t.to === viewer)
      .map((t) => t.id);
    const all = state.trades
      .filter((t) => t.to === viewer || t.from === viewer)
      .map((t) => t.id);
    if (incoming.length)
      actions.push({ type: "accept-trade", tradeIds: incoming });
    if (all.length) actions.push({ type: "reject-trade", tradeIds: all });
  }
  return actions;
}
export function projectGame(state: GameState, viewer: PlayerId): PlayerView {
  return structuredClone({
    gameId: state.gameId,
    rulesVersion: state.rulesVersion,
    viewerId: viewer,
    revision: state.revision,
    phase: state.phase,
    players: state.players,
    board: state.board,
    turn: state.turn,
    bank: state.bank,
    purchase: state.purchase,
    auction: state.auction,
    debt: state.debt,
    mortgageTransfers: state.mortgageTransfers,
    trades: state.trades,
    recentEvents: state.recentEvents,
    winner: state.winner,
    allowedActions: allowedActions(state, viewer),
  });
}
