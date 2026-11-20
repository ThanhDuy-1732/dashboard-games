import { useState } from "react";
import { boardFor, classicSpaceId } from "@nha-choi/game-core";
import type { GameAction, PlayerView, Space, TradeBundle } from "@nha-choi/game-core";
import { Icon } from "./Icon.js";
import { TokenArt } from "./TokenArt.js";
import { LocationPhoto } from "./LocationDetails.js";
function describe(board: readonly Space[], bundle: TradeBundle) {
  return (
    [
      bundle.cash ? `${bundle.cash} tiền` : "",
      ...bundle.spaceIds.map((id) => board[id]!.name),
      ...bundle.jailCards.map(() => "thẻ ra tù"),
    ]
      .filter(Boolean)
      .join(", ") || "Không có"
  );
}
export function ActionPanel({
  view,
  pending,
  onAction,
  onAssets,
  onTrade,
}: {
  view: PlayerView;
  pending: boolean;
  onAction: (action: GameAction) => void;
  onAssets: () => void;
  onTrade: () => void;
}) {
  const board = boardFor(view.board.length);
  const [bidTarget, setBidTarget] = useState<number | null>(null);
  const [bid, setBid] = useState(0);
  const self = view.players.find((p) => p.id === view.viewerId)!;
  const can = (type: GameAction["type"]) =>
    view.allowedActions.find((a) => a.type === type);
  const bidSpaces = can("bid")?.spaceIds ?? [];
  const target =
    bidTarget !== null && bidSpaces.includes(bidTarget)
      ? bidTarget
      : (view.auction?.targets?.[self.id] ?? bidSpaces[0]);
  const current = view.players.find((p) => p.id === view.turn.playerId)!;
  const incoming = view.trades.filter(
    (t) => t.to === self.id && can("accept-trade")?.tradeIds?.includes(t.id),
  );
  const transfer = view.mortgageTransfers[0];
  const mortgageValue = transfer ? board[transfer.spaceId]!.mortgage! : 0;
  return (
    <section className="turn-panel">
      <div className="turn-label">
        <span className="status-dot" />
        {self.id === current.id ? "Lượt của bạn" : `Lượt của ${current.name}`}
      </div>
      <div className="turn-player">
        <span className="player-avatar mint">
          <TokenArt token={self.token} />
        </span>
        <div>
          <strong>{self.name}</strong>
          <span>
            {self.bankrupt
              ? "Đã phá sản"
              : self.jail
                ? "Đang trong tù"
                : "Đi một nước thật hay."}
          </span>
        </div>
        <div className="balance">
          <small>Số dư</small>
          <strong>{self.cash.toLocaleString("vi-VN")}</strong>
        </div>
      </div>
      {incoming.map((t) => (
        <div className="incoming-trade" key={t.id}>
          <strong>
            {view.players.find((p) => p.id === t.from)?.name} đề nghị
          </strong>
          <p>Bạn nhận: {describe(board, t.give)}</p>
          <p>Bạn đưa: {describe(board, t.receive)}</p>
          <div className="action-row">
            <button
              className="button primary"
              disabled={pending}
              onClick={() => onAction({ type: "accept-trade", tradeId: t.id })}
            >
              Đồng ý
            </button>
            <button
              className="button secondary"
              disabled={pending}
              onClick={() => onAction({ type: "reject-trade", tradeId: t.id })}
            >
              Từ chối
            </button>
          </div>
        </div>
      ))}
      {view.phase === "awaiting-purchase" && view.turn.playerId === self.id && (
        <div className="decision-box">
          <LocationPhoto
            spaceId={classicSpaceId(board.length, view.purchase!)}
          />
          <span className="tag green">Đất chưa có chủ</span>
          <h3>{board[view.purchase!]!.name}</h3>
          <p>Giá mua {board[view.purchase!]!.price}.</p>
          <button
            className="button primary full"
            disabled={pending || !can("buy-property")}
            onClick={() => onAction({ type: "buy-property" })}
          >
            Mua đất · {board[view.purchase!]!.price}
          </button>
          <button
            className="text-button full"
            disabled={pending}
            onClick={() => onAction({ type: "decline-property" })}
          >
            Đưa ra đấu giá
          </button>
        </div>
      )}
      {view.phase === "auction" && (
        <div className="decision-box">
          <LocationPhoto
            spaceId={classicSpaceId(board.length, target ?? view.auction!.spaceId)}
          />
          <h3>
            Đấu giá{" "}
            {view.auction!.kind === "property"
              ? board[view.auction!.spaceId]!.name
              : view.auction!.kind === "house"
                ? "nhà cuối cùng"
                : "khách sạn cuối cùng"}
          </h3>
          <p>
            Giá hiện tại: {view.auction!.bid}.{" "}
            {view.auction!.bidder
              ? `${view.players.find((p) => p.id === view.auction!.bidder)?.name} đang dẫn giá.`
              : "Chưa có người trả giá."}
          </p>
          {can("bid") && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onAction({
                  type: "bid",
                  amount: Math.max(bid, can("bid")!.minimum!),
                  ...(view.auction!.kind !== "property"
                    ? { spaceId: target }
                    : {}),
                });
              }}
            >
              {view.auction!.kind !== "property" && (
                <>
                  <label className="field-label" htmlFor="building-target">
                    Xây công trình tại đây nếu thắng
                  </label>
                  <select
                    id="building-target"
                    value={target}
                    onChange={(e) => setBidTarget(Number(e.target.value))}
                  >
                    {bidSpaces.map((id) => (
                      <option value={id} key={id}>
                        {board[id]!.name}
                      </option>
                    ))}
                  </select>
                </>
              )}
              <label className="field-label" htmlFor="bid">
                Giá bạn trả
              </label>
              <input
                className="action-input"
                id="bid"
                type="number"
                min={can("bid")!.minimum}
                max={can("bid")!.maximum}
                step={1}
                value={Math.max(bid, can("bid")!.minimum!)}
                onChange={(e) => setBid(Number(e.target.value))}
              />
              <button
                className="button primary full"
                disabled={pending}
                type="submit"
              >
                Trả giá
              </button>
            </form>
          )}
          {can("pass-auction") && (
            <button
              className="text-button full"
              disabled={pending}
              onClick={() => onAction({ type: "pass-auction" })}
            >
              Không tham gia tiếp
            </button>
          )}
        </div>
      )}
      {view.phase === "debt" && view.debt?.payer === self.id && (
        <div className="decision-box">
          <h3>Cần thanh toán {view.debt.amount}</h3>
          <p>
            Bán công trình, thế chấp hoặc giao dịch để trả nợ. Ván sẽ tiếp tục
            sau khi đủ tiền.
          </p>
          {can("declare-bankruptcy") && (
            <button
              className="button secondary full"
              disabled={pending}
              onClick={() => onAction({ type: "declare-bankruptcy" })}
            >
              Tuyên bố phá sản
            </button>
          )}
        </div>
      )}
      {can("resolve-mortgage-transfer") && transfer && (
        <div className="decision-box">
          <h3>Nhận {board[transfer.spaceId]!.name}</h3>
          <p>Tài sản đang thế chấp. Chọn cách thanh toán cho ngân hàng.</p>
          <button
            className="button primary full"
            disabled={pending}
            onClick={() =>
              onAction({
                type: "resolve-mortgage-transfer",
                spaceId: transfer.spaceId,
                choice: "keep",
              })
            }
          >
            Giữ thế chấp · {Math.ceil(mortgageValue / 10)}
          </button>
          <button
            className="text-button full"
            disabled={pending}
            onClick={() =>
              onAction({
                type: "resolve-mortgage-transfer",
                spaceId: transfer.spaceId,
                choice: "redeem",
              })
            }
          >
            Giải chấp · {mortgageValue + Math.ceil(mortgageValue / 10)}
          </button>
        </div>
      )}
      {view.phase === "jail-choice" && view.turn.playerId === self.id && (
        <p className="help-text">
          Trả 50, dùng thẻ hoặc thử gieo đôi. Lần thất bại thứ ba phải trả 50
          rồi di chuyển.
        </p>
      )}
      {can("use-jail-card") && (
        <button
          className="button secondary full"
          disabled={pending}
          onClick={() =>
            onAction({
              type: "use-jail-card",
              cardId: can("use-jail-card")!.cardIds![0]!,
            })
          }
        >
          Dùng thẻ ra tù
        </button>
      )}
      {can("pay-jail") && (
        <button
          className="text-button full"
          disabled={pending}
          onClick={() => onAction({ type: "pay-jail" })}
        >
          Trả 50 để ra tù
        </button>
      )}
      {can("roll") && (
        <button
          className="button primary full"
          disabled={pending}
          onClick={() => onAction({ type: "roll" })}
        >
          <Icon name="dice" />
          {self.jail
            ? "Gieo để ra tù"
            : view.turn.extraRoll
              ? "Gieo thêm lượt đôi"
              : "Gieo xúc xắc"}
        </button>
      )}
      {can("end-turn") && (
        <button
          className="button primary full"
          disabled={pending}
          onClick={() => onAction({ type: "end-turn" })}
        >
          Kết thúc lượt <Icon name="arrow" />
        </button>
      )}
      {self.bankrupt && (
        <p className="help-text">
          Bạn đã phá sản. Có thể theo dõi phần còn lại của ván.
        </p>
      )}
      <div className="action-row secondary-actions">
        <button className="button secondary" onClick={onAssets}>
          Tài sản
        </button>
        <button
          className="button secondary"
          disabled={!can("offer-trade") || pending}
          onClick={onTrade}
        >
          Giao dịch
        </button>
      </div>
    </section>
  );
}
