import { useEffect, useRef, useState } from "react";
import type { PlayerView } from "@nha-choi/game-core";

export function Wallet({ view, cash }: { view: PlayerView; cash: number }) {
  const lastId = view.recentEvents[view.recentEvents.length - 1]?.id ?? 0;
  const previous = useRef({ gameId: view.gameId, cash, lastId });
  const [change, setChange] = useState<{
    delta: number;
    salary: number;
    revision: number;
  } | null>(null);

  useEffect(() => {
    const before = previous.current;
    previous.current = { gameId: view.gameId, cash, lastId };
    if (before.gameId !== view.gameId) {
      setChange(null);
      return;
    }
    const delta = cash - before.cash;
    const salary = view.recentEvents
      .filter(
        (event) =>
          event.id > before.lastId &&
          event.type === "go-salary" &&
          event.playerId === view.viewerId,
      )
      .reduce((sum, event) => sum + (event.amount ?? 0), 0);
    if (delta || salary) setChange({ delta, salary, revision: view.revision });
  }, [cash, lastId, view]);

  return (
    <div className="board-wallet">
      <span className="wallet-art" aria-hidden="true">
        ₫
      </span>
      <span>
        Ví của bạn <strong>{cash.toLocaleString("vi-VN")}</strong>
      </span>
      <span className="wallet-effects" aria-live="polite">
        {change && (
          <span key={change.revision} className="wallet-change">
            {change.delta !== 0 && (
              <b className={change.delta > 0 ? "income" : "expense"}>
                {change.delta > 0 ? "+" : "−"}
                {Math.abs(change.delta).toLocaleString("vi-VN")}
              </b>
            )}
            {change.salary > 0 && (
              <small>
                Xuất phát
                {change.salary === change.delta ? "" : ` +${change.salary}`}
              </small>
            )}
          </span>
        )}
      </span>
    </div>
  );
}
