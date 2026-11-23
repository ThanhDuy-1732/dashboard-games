import type { GameState, PlayerId } from "./types.js";
import { playerById, recordEvent, requireRule } from "./rules.js";
import { buildableSpaces } from "./assets.js";
import { boardFor } from "./board.js";
export function getRent(
  state: GameState,
  spaceId: number,
  total: number,
  override: { stationMultiplier?: number; utilityMultiplier?: number } = {},
): number {
  const board = boardFor(state.board.length);
  const space = board[spaceId];
  const property = state.board[spaceId];
  requireRule(space && property, "INVALID_GAME");
  if (property.owner === null || property.mortgaged) return 0;
  if (space.kind === "street") {
    const monopoly = board.filter(
      (s) => s.kind === "street" && s.group === space.group,
    ).every((s) => state.board[s.id]!.owner === property.owner);
    return (
      space.rent![property.buildings]! *
      (property.buildings === 0 && monopoly ? 2 : 1)
    );
  }
  const owned = board.filter(
    (s) => s.kind === space.kind && state.board[s.id]!.owner === property.owner,
  ).length;
  if (space.kind === "station")
    return 25 * 2 ** (owned - 1) * (override.stationMultiplier ?? 1);
  if (space.kind === "utility")
    return total * (override.utilityMultiplier ?? (owned === 2 ? 10 : 4));
  return 0;
}
export function buyProperty(state: GameState, actor: PlayerId) {
  requireRule(state.turn.playerId === actor, "NOT_AUTHORIZED");
  requireRule(state.phase === "awaiting-purchase" && state.purchase !== null);
  const space = boardFor(state.board.length)[state.purchase]!;
  const property = state.board[space.id]!;
  const player = playerById(state, actor);
  requireRule(property.owner === null && space.price !== undefined);
  requireRule(player.cash >= space.price, "INSUFFICIENT_FUNDS");
  settlePayment(state, actor, "bank", space.price);
  property.owner = actor;
  state.purchase = null;
  state.phase = "awaiting-end-turn";
  recordEvent(state, "purchase", `${player.name} mua ${space.name}.`, {
    playerId: actor,
    spaceId: space.id,
    amount: space.price,
  });
}
export function startAuction(state: GameState, spaceId: number) {
  state.auction = {
    spaceId,
    bid: 0,
    bidder: null,
    participants: state.players.filter((p) => !p.bankrupt).map((p) => p.id),
    kind: "property",
  };
  state.purchase = null;
  state.phase = "auction";
}
export function auctionAction(
  state: GameState,
  actor: PlayerId,
  amount?: number,
  spaceId?: number,
): boolean {
  const auction = state.auction;
  requireRule(state.phase === "auction" && auction);
  requireRule(auction.participants.includes(actor), "NOT_AUTHORIZED");
  if (amount === undefined) {
    requireRule(auction.bidder !== actor);
    auction.participants = auction.participants.filter((id) => id !== actor);
  } else {
    requireRule(Number.isSafeInteger(amount) && amount > auction.bid);
    requireRule(playerById(state, actor).cash >= amount, "INSUFFICIENT_FUNDS");
    if (auction.kind !== "property") {
      const target = spaceId ?? auction.targets?.[actor];
      requireRule(
        target !== undefined &&
          buildableSpaces(state, actor, auction.kind).includes(target),
      );
      auction.targets![actor] = target;
    } else requireRule(spaceId === undefined);
    auction.bid = amount;
    auction.bidder = actor;
  }
  if (
    auction.participants.length === 0 ||
    (auction.participants.length === 1 && auction.bidder !== null)
  ) {
    if (auction.bidder !== null) {
      settlePayment(state, auction.bidder, "bank", auction.bid);
      if (auction.kind === "property")
        state.board[auction.spaceId]!.owner = auction.bidder;
      else placeBuilding(state, auction.targets![auction.bidder]!);
      recordEvent(
        state,
        "auction",
        `${playerById(state, auction.bidder).name} thắng đấu giá ${auction.kind === "property" ? boardFor(state.board.length)[auction.spaceId]!.name : "công trình"} với giá ${auction.bid}.`,
        {
          spaceId: auction.targets?.[auction.bidder] ?? auction.spaceId,
          amount: auction.bid,
        },
      );
    } else
      recordEvent(state, "auction", "Phiên đấu giá kết thúc vì không có người trả giá.", {
        spaceId: auction.spaceId,
      });
    state.auction = null;
    state.phase = "awaiting-end-turn";
    return true;
  }
  return false;
}
export function placeBuilding(state: GameState, spaceId: number) {
  const property = state.board[spaceId]!;
  if (property.buildings === 4) {
    requireRule(state.bank.hotels > 0);
    state.bank.hotels--;
    state.bank.houses += 4;
  } else {
    requireRule(state.bank.houses > 0);
    state.bank.houses--;
  }
  property.buildings++;
}
export function trySettleDebt(state: GameState): boolean {
  const debt = state.debt;
  if (!debt) return false;
  if (playerById(state, debt.payer).cash < debt.amount) return false;
  state.debt = null;
  state.phase = "awaiting-end-turn";
  return settlePayment(state, debt.payer, debt.payee, debt.amount);
}
export function settlePayment(
  state: GameState,
  payer: PlayerId | "bank",
  payee: PlayerId | "bank",
  amount: number,
  reason?: "go-salary",
): boolean {
  requireRule(Number.isSafeInteger(amount) && amount >= 0, "INVALID_GAME");
  if (amount === 0 || payer === payee) return true;
  if (payer !== "bank") {
    const from = playerById(state, payer);
    if (from.bankrupt) return true;
    if (from.cash < amount) {
      state.debt = { payer, payee, amount };
      state.phase = "debt";
      recordEvent(state, "debt", `${from.name} cần thanh toán ${amount}.`, {
        playerId: payer,
        amount,
      });
      return false;
    }
    from.cash -= amount;
  }
  if (payee !== "bank") {
    const recipient = playerById(state, payee);
    requireRule(Number.isSafeInteger(recipient.cash + amount), "INVALID_GAME");
    recipient.cash += amount;
  }
  recordEvent(
    state,
    reason ?? "payment",
    reason === "go-salary"
      ? `${playerById(state, payee).name} nhận ${amount} tại Xuất phát.`
      : `${payer === "bank" ? "Ngân hàng" : playerById(state, payer).name} trả ${amount} cho ${payee === "bank" ? "ngân hàng" : playerById(state, payee).name}.`,
    reason === "go-salary"
      ? { playerId: payee, spaceId: 0, amount }
      : { amount },
  );
  return true;
}
