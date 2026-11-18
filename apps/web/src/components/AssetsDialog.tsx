import { useState } from "react";
import { BOARD } from "@nha-choi/game-core";
import type { GameAction, PlayerView } from "@nha-choi/game-core";
import { Dialog } from "./Dialog.js";
export function AssetsDialog({
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
  const [confirm, setConfirm] = useState<number | null>(null);
  const group =
    confirm === null
      ? []
      : BOARD.filter(
          (s) => s.group === BOARD[confirm]!.group && s.kind === "street",
        );
  const proceeds = group.reduce(
    (sum, s) => sum + (view.board[s.id]!.buildings * s.buildCost!) / 2,
    0,
  );
  const owned = BOARD.filter(
    (space) => view.board[space.id]!.owner === view.viewerId,
  );
  const names = {
    build: "Xây công trình",
    "sell-building": "Bán công trình",
    mortgage: "Thế chấp",
    unmortgage: "Giải chấp",
  } as const;
  return (
    <Dialog title="Tài sản của bạn" onClose={onClose}>
      <h2>Tài sản của bạn</h2>
      <p className="dialog-lead">
        Ngân hàng còn {view.bank.houses} nhà và {view.bank.hotels} khách sạn.
      </p>
      {!owned.length && (
        <p className="empty-message">
          Bạn chưa sở hữu tài sản nào. Hãy mua đất khi dừng ở một địa điểm chưa
          có chủ.
        </p>
      )}
      {confirm !== null ? (
        <section>
          <h3>Thanh lý toàn bộ nhóm màu?</h3>
          <p>
            Ngân hàng không đủ 4 nhà để đổi khách sạn. Toàn bộ công trình trên
            các ô sau sẽ được bán:
          </p>
          <ul>
            {group.map((s) => (
              <li key={s.id}>
                {s.name}:{" "}
                {view.board[s.id]!.buildings === 5
                  ? "1 khách sạn"
                  : `${view.board[s.id]!.buildings} nhà`}
              </li>
            ))}
          </ul>
          <p>
            Tổng tiền nhận: <strong>{proceeds}</strong>.
          </p>
          <button
            className="button primary full"
            disabled={
              pending ||
              view.bank.houses >= 4 ||
              view.board[confirm]!.buildings !== 5 ||
              !view.allowedActions
                .find((a) => a.type === "sell-building")
                ?.spaceIds?.includes(confirm)
            }
            onClick={() => {
              onAction({ type: "sell-building", spaceId: confirm });
              setConfirm(null);
            }}
          >
            Xác nhận thanh lý
          </button>
          <button className="text-button full" onClick={() => setConfirm(null)}>
            Hủy thanh lý
          </button>
        </section>
      ) : (
        <div className="assets-list">
          {owned.map((space) => {
            const property = view.board[space.id]!;
            return (
              <article className="asset-item" key={space.id}>
                <strong>{space.name}</strong>
                <span>
                  {property.mortgaged
                    ? "Đang thế chấp"
                    : property.buildings === 5
                      ? "1 khách sạn"
                      : `${property.buildings} nhà`}
                </span>
                <div>
                  {(Object.keys(names) as (keyof typeof names)[])
                    .filter((type) =>
                      view.allowedActions
                        .find((a) => a.type === type)
                        ?.spaceIds?.includes(space.id),
                    )
                    .map((type) => (
                      <button
                        className="button secondary"
                        key={type}
                        disabled={pending}
                        onClick={() => {
                          if (
                            type === "sell-building" &&
                            property.buildings === 5 &&
                            view.bank.houses < 4
                          )
                            setConfirm(space.id);
                          else onAction({ type, spaceId: space.id });
                        }}
                      >
                        {names[type]}
                        {type === "build"
                          ? ` · ${space.buildCost}`
                          : type === "mortgage"
                            ? ` · +${space.mortgage}`
                            : type === "unmortgage"
                              ? ` · ${space.mortgage! + Math.ceil(space.mortgage! / 10)}`
                              : ""}
                      </button>
                    ))}
                </div>
              </article>
            );
          })}
        </div>
      )}
      <p className="help-text">
        Nhà được xây và bán đều trong nhóm màu. Nếu không đủ nhà để đổi khách
        sạn, bán khách sạn sẽ thanh lý toàn bộ công trình của nhóm.
      </p>
    </Dialog>
  );
}
