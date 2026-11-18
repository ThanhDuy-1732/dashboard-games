import { BOARD } from "./board.js";
import type { PlayerView, GameAction, TradeBundle } from "./types.js";
export function chooseBotAction(view: PlayerView): GameAction {
  const self = view.players.find((p) => p.id === view.viewerId)!;
  const hint = (type: GameAction["type"]) =>
    view.allowedActions.find((a) => a.type === type);
  const incoming = view.trades.find(
    (t) => t.to === self.id && hint("accept-trade")?.tradeIds?.includes(t.id),
  );
  if (incoming) {
    const value = (bundle: TradeBundle) =>
      bundle.cash +
      bundle.spaceIds.reduce((n, id) => n + (BOARD[id]!.price ?? 0), 0) +
      bundle.jailCards.length * 50;
    const valid =
      incoming.give.spaceIds.every(
        (id) => view.board[id]!.owner === incoming.from,
      ) &&
      incoming.receive.spaceIds.every(
        (id) => view.board[id]!.owner === self.id,
      );
    const fee = incoming.give.spaceIds.reduce(
      (n, id) =>
        n +
        (view.board[id]!.mortgaged ? Math.ceil(BOARD[id]!.mortgage! / 10) : 0),
      0,
    );
    const accept =
      valid &&
      value(incoming.give) > value(incoming.receive) &&
      self.cash - incoming.receive.cash + incoming.give.cash - fee >= 150 &&
      self.cash >= incoming.receive.cash &&
      view.players.find((p) => p.id === incoming.from)!.cash >=
        incoming.give.cash;
    return {
      type: accept ? "accept-trade" : "reject-trade",
      tradeId: incoming.id,
    };
  }
  if (view.phase === "auction") {
    const bid = hint("bid");
    const ceiling = Math.min(
      self.cash - 150,
      view.auction!.kind === "property"
        ? BOARD[view.auction!.spaceId]!.price!
        : BOARD[view.auction!.targets![self.id]!]!.buildCost!,
    );
    return bid && bid.minimum! <= ceiling
      ? { type: "bid", amount: bid.minimum! }
      : { type: "pass-auction" };
  }
  if (view.phase === "debt") {
    const sell = hint("sell-building")?.spaceIds?.[0];
    if (sell !== undefined) return { type: "sell-building", spaceId: sell };
    const mortgage = hint("mortgage")?.spaceIds?.toSorted(
      (a, b) => BOARD[b]!.mortgage! - BOARD[a]!.mortgage!,
    )[0];
    if (mortgage !== undefined) return { type: "mortgage", spaceId: mortgage };
    if (hint("declare-bankruptcy")) return { type: "declare-bankruptcy" };
  }
  const transfer = hint("resolve-mortgage-transfer")?.spaceIds?.[0];
  if (transfer !== undefined) {
    const value = BOARD[transfer]!.mortgage!;
    return {
      type: "resolve-mortgage-transfer",
      spaceId: transfer,
      choice:
        self.cash >= value + Math.ceil(value / 10) + 150 ? "redeem" : "keep",
    };
  }
  if (hint("use-jail-card"))
    return {
      type: "use-jail-card",
      cardId: hint("use-jail-card")!.cardIds![0]!,
    };
  if (hint("pay-jail") && self.cash >= 200) return { type: "pay-jail" };
  if (hint("buy-property") && self.cash - BOARD[view.purchase!]!.price! >= 150)
    return { type: "buy-property" };
  if (hint("decline-property")) return { type: "decline-property" };
  const building = hint("build")?.spaceIds?.find(
    (id) => self.cash - BOARD[id]!.buildCost! >= 150,
  );
  if (building !== undefined) return { type: "build", spaceId: building };
  const redeem = hint("unmortgage")?.spaceIds?.find(
    (id) =>
      self.cash - BOARD[id]!.mortgage! - Math.ceil(BOARD[id]!.mortgage! / 10) >=
      150,
  );
  if (redeem !== undefined) return { type: "unmortgage", spaceId: redeem };
  if (hint("roll")) return { type: "roll" };
  if (hint("end-turn")) return { type: "end-turn" };
  throw new Error(`No bot action available: ${view.phase} / ${view.viewerId}`);
}
