import { useState } from "react";
import type { GameAction, PlayerView } from "@nha-choi/game-core";
import { Board } from "../components/Board.js";
import { LocationDetails } from "../components/LocationDetails.js";
import { Players } from "../components/Players.js";
import { ActionPanel } from "../components/ActionPanel.js";
import { AssetsDialog } from "../components/AssetsDialog.js";
import { TradeDialog } from "../components/TradeDialog.js";
import { Icon } from "../components/Icon.js";
export function Game({
  view,
  onAction,
  onLeave,
  pending,
}: {
  view: PlayerView;
  onAction: (action: GameAction) => void;
  onLeave: () => void;
  pending: boolean;
}) {
  const [location, setLocation] = useState<number | null>(null);
  const [assets, setAssets] = useState(false);
  const [trade, setTrade] = useState(false);
  return (
    <section
      className="screen"
      data-revision={view.revision}
      data-viewer-id={view.viewerId}
    >
      <div className="game-topline">
        <button className="back-link" onClick={onLeave}>
          <Icon name="back" />
          Rời bàn chơi
        </button>
        <div className="game-top-tags">
          <span className="tag green">
            {view.players.some((p) => p.kind === "bot") ? "Đấu máy" : "Online"}
          </span>
          <span className="tag">Luật truyền thống</span>
        </div>
      </div>
      <div className="play-layout">
        <Board view={view} onSelect={setLocation} />
        <aside className="game-side">
          <ActionPanel
            view={view}
            pending={pending}
            onAction={onAction}
            onAssets={() => setAssets(true)}
            onTrade={() => setTrade(true)}
          />
          <Players view={view} />
          <section className="activity-panel">
            <div className="subsection-heading">
              <h2>Chuyện trên bàn</h2>
              <span>Lượt {view.turn.number}</span>
            </div>
            <ol
              tabIndex={0}
              aria-label="Nhật ký ván chơi"
              aria-live="polite"
              aria-relevant="additions"
            >
              {view.recentEvents
                .slice(-15)
                .toReversed()
                .map((event) => (
                  <li key={event.id}>
                    <span className="activity-dot" />
                    <p>{event.text}</p>
                  </li>
                ))}
            </ol>
          </section>
        </aside>
      </div>
      {location !== null && (
        <LocationDetails
          view={view}
          spaceId={location}
          onClose={() => setLocation(null)}
        />
      )}
      {assets && (
        <AssetsDialog
          view={view}
          onAction={onAction}
          pending={pending}
          onClose={() => setAssets(false)}
        />
      )}
      {trade && (
        <TradeDialog
          view={view}
          onAction={onAction}
          pending={pending}
          onClose={() => setTrade(false)}
        />
      )}
    </section>
  );
}
