import { useState } from "react";
import { boardFor } from "@nha-choi/game-core";
import type { GameAction, PlayerView } from "@nha-choi/game-core";
import { Dialog } from "./Dialog.js";
export function TradeDialog({
  view,
  onAction,
  onClose,
  pending,
}: {
  view: PlayerView;
  onAction: (action: GameAction) => void;
  onClose: () => void;
  pending: boolean;
}) {
  const board = boardFor(view.board.length);
  const others = view.players.filter(
    (p) => p.id !== view.viewerId && !p.bankrupt,
  );
  const [to, setTo] = useState(others[0]?.id ?? "");
  const [give, setGive] = useState(0);
  const [receive, setReceive] = useState(0);
  const [giveIds, setGiveIds] = useState<number[]>([]);
  const [receiveIds, setReceiveIds] = useState<number[]>([]);
  const [giveCards, setGiveCards] = useState<string[]>([]);
  const [receiveCards, setReceiveCards] = useState<string[]>([]);
  const self = view.players.find((p) => p.id === view.viewerId)!;
  const target = view.players.find((p) => p.id === to);
  const assets = (owner: string) =>
    board.filter(
      (space) =>
        view.board[space.id]!.owner === owner &&
        !view.mortgageTransfers.some((t) => t.spaceId === space.id) &&
        (space.kind !== "street" ||
          board.filter(
            (s) => s.group === space.group && s.kind === "street",
          ).every((s) => view.board[s.id]!.buildings === 0)),
    );
  return (
    <Dialog title="Đề nghị giao dịch" onClose={onClose}>
      <h2>Đề nghị giao dịch</h2>
      <p className="dialog-lead">
        Giao dịch chỉ hoàn tất khi bên còn lại đồng ý. Tài sản và tiền sẽ được
        kiểm tra lại khi chấp nhận.
      </p>
      <form
        className="trade-form"
        onSubmit={(event) => {
          event.preventDefault();
          onAction({
            type: "offer-trade",
            to,
            give: { cash: give, spaceIds: giveIds, jailCards: giveCards },
            receive: {
              cash: receive,
              spaceIds: receiveIds,
              jailCards: receiveCards,
            },
          });
          onClose();
        }}
      >
        <label>
          Người nhận
          <select
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setReceiveIds([]);
              setReceiveCards([]);
            }}
          >
            {others.map((p) => (
              <option value={p.id} key={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <div className="trade-columns">
          {[
            {
              owner: self.id,
              title: "Bạn đưa",
              cash: give,
              setCash: setGive,
              ids: giveIds,
              setIds: setGiveIds,
              cards: giveCards,
              setCards: setGiveCards,
            },
            {
              owner: to,
              title: "Bạn nhận",
              cash: receive,
              setCash: setReceive,
              ids: receiveIds,
              setIds: setReceiveIds,
              cards: receiveCards,
              setCards: setReceiveCards,
            },
          ].map((part) => (
            <fieldset key={part.title}>
              <legend>{part.title}</legend>
              <label>
                Tiền
                <input
                  type="number"
                  value={part.cash}
                  min={0}
                  max={view.players.find((p) => p.id === part.owner)?.cash ?? 0}
                  onChange={(e) => part.setCash(Number(e.target.value))}
                />
              </label>
              {assets(part.owner).map((space) => (
                <label className="trade-checkbox" key={space.id}>
                  <input
                    type="checkbox"
                    checked={part.ids.includes(space.id)}
                    onChange={(e) =>
                      part.setIds(
                        e.target.checked
                          ? [...part.ids, space.id]
                          : part.ids.filter((id) => id !== space.id),
                      )
                    }
                  />
                  {space.name}
                  {view.board[space.id]!.mortgaged ? " (thế chấp)" : ""}
                </label>
              ))}
              {view.players
                .find((p) => p.id === part.owner)
                ?.jailCards.map((card) => (
                  <label className="trade-checkbox" key={card}>
                    <input
                      type="checkbox"
                      checked={part.cards.includes(card)}
                      onChange={(e) =>
                        part.setCards(
                          e.target.checked
                            ? [...part.cards, card]
                            : part.cards.filter((id) => id !== card),
                        )
                      }
                    />
                    Thẻ ra tù
                  </label>
                ))}
            </fieldset>
          ))}
        </div>
        <button
          className="button primary full"
          disabled={pending || !target}
          type="submit"
        >
          Gửi đề nghị
        </button>
      </form>
    </Dialog>
  );
}
