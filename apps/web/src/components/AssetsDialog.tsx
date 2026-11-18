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
                      onClick={() => onAction({ type, spaceId: space.id })}
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
      <p className="help-text">
        Nhà được xây và bán đều trong nhóm màu. Nếu không đủ nhà để đổi khách
        sạn, bán khách sạn sẽ thanh lý toàn bộ công trình của nhóm.
      </p>
    </Dialog>
  );
}
