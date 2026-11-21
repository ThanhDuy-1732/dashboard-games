import rulebook from "../../../docs/rules/classic-v1.md?raw";
import { useEffect, useRef, useState } from "react";
import type { LobbyView } from "@nha-choi/protocol";
import {
  connectOnlineRoom,
  resumeOnlineRoom,
  hasOnlineRoom,
  ONLINE_URL,
  roomError,
} from "./session/online.js";
import type { OnlineSession } from "./session/online.js";
import { Lobby } from "./screens/Lobby.js";
import type { BoardSize, GameAction, PlayerConfig, Token } from "@nha-choi/game-core";
import {
  attachPlatformLifecycle,
  attachAndroidBack,
} from "./platform-lifecycle.js";
import { getPlatform } from "./platform.js";
import { PwaStatus } from "./components/PwaStatus.js";
import { CaroRules, CaroScreen, caroInviteCode } from "./caro/Screen.js";
import { readCaroSave } from "./caro/save.js";
import { Home } from "./screens/Home.js";
import { Setup } from "./screens/Setup.js";
import { Game } from "./screens/Game.js";
import { Results } from "./screens/Results.js";
import { Icon } from "./components/Icon.js";
import { Dialog } from "./components/Dialog.js";
import { createOfflineSession } from "./session/offline.js";
import type { OfflineSession } from "./session/offline.js";
import { useGameSession } from "./session/useGameSession.js";
import { useOfflineSave, saveErrorMessage } from "./storage/useOfflineSave.js";
import { SaveError } from "./storage/save.js";
import type { SavedGame } from "./storage/save-schema.js";
import { startTelemetry, trackGame, trackScreen } from "./telemetry.js";
const ERROR_TEXT: Record<string, string> = {
  STORAGE_UNAVAILABLE:
    "Máy chủ chưa xác nhận lưu được hành động. Hãy đợi đồng bộ lại trước khi tiếp tục.",
  NOT_AUTHORIZED: "Hành động này không thuộc lượt hoặc quyền của bạn.",
  INSUFFICIENT_FUNDS: "Bạn chưa đủ tiền để thực hiện hành động này.",
  STALE_REVISION:
    "Bàn chơi vừa thay đổi. Hãy kiểm tra trạng thái mới rồi thử lại.",
  INVALID_ACTION:
    "Hành động không còn hợp lệ. Hãy kiểm tra tiền, tài sản và lượt hiện tại.",
  PAUSED: "Ván đang tạm dừng. Hãy đợi kết nối hoặc thử mở lại ván đã lưu.",
};
type Destination = "home" | "setup" | "caro";

export function App() {
  const [page, setPage] = useState<Destination | "game">(() =>
    caroInviteCode() ? "caro" : "home",
  );
  const [resumeCaro, setResumeCaro] = useState(false);
  const [caroInGame, setCaroInGame] = useState(false);
  const [session, setSession] = useState<OfflineSession | OnlineSession | null>(
    null,
  );
  const update = useGameSession(session);
  const online = session && "selfId" in session ? session : null;
  const offline = session && "snapshot" in session ? session : null;
  const persistence = useOfflineSave(offline);
  const [lobby, setLobby] = useState<LobbyView | null>(null);
  useEffect(() => {
    setLobby(null);
    if (online) return online.subscribeLobby(setLobby);
  }, [online]);
  async function joinOnline(input?: {
    name: string;
    token: Token;
    code?: string;
    boardSize?: BoardSize;
  }) {
    if (operation.current) return;
    operation.current = true;
    setPending(true);
    setError("");
    try {
      if (input && !ONLINE_URL)
        throw new Error(
          "Bản mobile này chưa cấu hình máy chủ HTTPS. Bạn vẫn có thể chơi với máy khi offline.",
        );
      const created = await (input
        ? connectOnlineRoom({ serverUrl: ONLINE_URL!, ...input })
        : resumeOnlineRoom());
      setSession(created);
      setPage("game");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không kết nối được phòng.",
      );
    } finally {
      operation.current = false;
      setPending(false);
    }
  }
  const operation = useRef(false);
  const [newGame, setNewGame] = useState<{
    human: PlayerConfig;
    botCount: number;
    boardSize: BoardSize;
  } | null>(null);
  const [rules, setRules] = useState(false);
  const [fullRules, setFullRules] = useState(false);
  const [leave, setLeave] = useState<Destination | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!session) return;
    return attachPlatformLifecycle(session, {
      onActive: offline
        ? async (active) => {
            if (!active) {
              await offline.setActive(false);
              await persistence.write(offline);
              await persistence.store.release();
            } else await persistence.retry();
          }
        : undefined,
      onError: (reason) =>
        setError(
          offline
            ? saveErrorMessage(reason)
            : "Phiên chơi đang tạm dừng. Hãy kết nối lại phòng.",
        ),
    });
  }, [session]);
  const backAction = useRef<() => boolean>(() => false);
  backAction.current = () => {
    if (page === "home" && !session) return false;
    navigate("home");
    return true;
  };
  useEffect(
    () =>
      attachAndroidBack(
        () => backAction.current(),
        () =>
          setError(
            "Chưa xử lý được nút quay lại. Hãy dùng điều hướng trong ứng dụng.",
          ),
      ),
    [],
  );

  useEffect(() => {
    document.getElementById("main")?.focus({ preventScroll: true });
    document.documentElement.scrollTop = 0;
  }, [page]);
  const navigate = (next: Destination) => {
    if (operation.current) return;
    if (session) {
      setLeave(next);
      return;
    }
    if (page === "caro" && next !== "caro") {
      const url = new URL(location.href);
      url.searchParams.delete("caro");
      history.replaceState(history.state, "", url);
    }
    setPage(next);
    setError("");
  };
  function openCurrentGame() {
    if (page === "caro") return;
    if (session) setPage("game");
    else navigate("setup");
  }
  function openCaro(resume = false) {
    setResumeCaro(resume);
    navigate("caro");
  }
  async function start(
    human: PlayerConfig,
    botCount: number,
    boardSize: BoardSize = 40,
    saved?: SavedGame,
    replace = false,
  ) {
    if (operation.current) return;
    operation.current = true;
    setPending(true);
    let created: OfflineSession | undefined;
    try {
      if (!saved && !replace) {
        try {
          const previous = await persistence.store.load();
          if (previous.save?.state.phase !== "finished" && previous.save) {
            setNewGame({ human, botCount, boardSize });
            return;
          }
          replace = Boolean(previous.save);
        } catch (reason) {
          if (
            reason instanceof SaveError &&
            ["INCOMPATIBLE", "CORRUPT"].includes(reason.code)
          ) {
            setNewGame({ human, botCount, boardSize });
            setError(saveErrorMessage(reason));
            return;
          }
          throw reason;
        }
      }
      if (!(await persistence.store.claim())) throw new SaveError("LEASE_LOST");
      created = createOfflineSession({ human, botCount, boardSize }, saved);
      created.pause("Đang chuẩn bị bản lưu.");
      await persistence.write(created, replace);
      if (!saved) trackGame("ty-phu", created.snapshot().gameId, "game_started");
      created.resume();
      setSession(created);
      setNewGame(null);
      setPage("game");
      setError("");
      persistence.dismissNotice();
    } catch (reason) {
      await created?.close();
      await persistence.store.release().catch(() => {});
      setError(saveErrorMessage(reason));
    } finally {
      operation.current = false;
      setPending(false);
    }
  }
  async function resume() {
    if (operation.current) return;
    try {
      if (!(await persistence.store.claim())) throw new SaveError("LEASE_LOST");
      const result = await persistence.store.load();
      if (!result.save) {
        setError("Không còn ván đã lưu trên thiết bị này.");
        await persistence.store.release();
        return;
      }
      const save = result.save;
      await start(
        save.state.players.find((p) => p.id === save.humanId)!,
        save.state.players.length - 1,
        undefined,
        save,
      );
    } catch (reason) {
      await persistence.store.release().catch(() => {});
      setError(saveErrorMessage(reason));
    }
  }
  async function exit(next: Destination, discard = false) {
    if (!session || operation.current) return;
    operation.current = true;
    setPending(true);
    setError("");
    try {
      if (offline) {
        offline.pause(
          discard ? "Đang xóa bản lưu." : "Đang lưu ván trước khi rời.",
        );
        if (discard) await persistence.discard(offline);
        else await persistence.write(offline);
      }
      if (online) await online.leaveRoom(discard);
      await session.close();
      setSession(null);
      setPage(next);
      setLeave(null);
      if (offline) await persistence.store.release();
    } catch (reason) {
      if (offline && discard) offline.resume();
      setError(
        online && reason instanceof Error
          ? reason.message
          : saveErrorMessage(reason),
      );
    } finally {
      operation.current = false;
      setPending(false);
    }
  }
  async function send(action: GameAction) {
    if (
      !session ||
      !update?.view ||
      pending ||
      update.connection !== "connected"
    )
      return;
    setPending(true);
    setError("");
    try {
      const reply = await session.send({
        protocolVersion: 1,
        gameId: update.view.gameId,
        commandId: crypto.randomUUID(),
        expectedRevision: update.view.revision,
        action,
      });
      if (!reply.ok)
        setError(
          ERROR_TEXT[reply.code] ??
            "Không thể thực hiện. Hãy kiểm tra trạng thái ván rồi thử lại.",
        );
    } catch {
      setError(
        "Chưa nhận được xác nhận. Hãy đợi đồng bộ lại và kiểm tra bàn chơi trước khi thử tiếp.",
      );
    } finally {
      setPending(false);
    }
  }
  const finished =
    update?.view?.phase === "finished" || Boolean(online && lobby?.closed);
  const telemetryScreen = page === "game" ? finished ? "results" : online && !lobby?.started ? "lobby" : "game" : page;
  useEffect(() => trackScreen(telemetryScreen), [telemetryScreen]);
  useEffect(startTelemetry, []);
  return (
    <>
      <div className="app-shell">
        <aside className="sidebar">
          <a
            className="brand"
            href="#home"
            onClick={(event) => {
              event.preventDefault();
              navigate("home");
            }}
          >
            <span className="brand-mark">
              <i />
              <i />
              <i />
              <i />
            </span>
            <span>
              nhà chơi<span className="brand-dot">.</span>
            </span>
          </a>
          <div className="sidebar-caption">Góc nhỏ, cuộc vui lớn</div>
          <nav className="main-nav" aria-label="Điều hướng chính">
            <button
              aria-label="Khám phá"
              className={`nav-item ${page === "home" ? "active" : ""}`}
              onClick={() => navigate("home")}
            >
              <Icon name="grid" />
              <span>Khám phá</span>
            </button>
            <button
              aria-label="Vào bàn chơi"
              className={`nav-item ${page !== "home" ? "active" : ""}`}
              onClick={openCurrentGame}
            >
              <Icon name="dice" />
              <span>Vào bàn chơi</span>
            </button>
            <button
              className="nav-item"
              aria-label="Luật chơi"
              onClick={() => setRules(true)}
            >
              <Icon name="book" />
              <span>Luật chơi</span>
            </button>
          </nav>
          <div className="sidebar-game">
            <span className="sidebar-label">Trò chơi của nhà</span>
            <button onClick={() => navigate("setup")}>
              <span className="mini-game">♜</span>
              <span>
                Cờ tỷ phú<small>Luật truyền thống</small>
              </span>
              <span className="tiny-arrow">↗</span>
            </button>
            <button
              onClick={() => openCaro()}
              aria-current={page === "caro" ? "page" : undefined}
            >
              <span className="mini-game caro-mini">×</span>
              <span>
                Cờ Caro<small>Hai người</small>
              </span>
              <span className="tiny-arrow">↗</span>
            </button>
          </div>
          <div className="sidebar-bottom">
            <div className="little-dice">⚄</div>
            <p>
              Chơi một ván.
              <br />
              Gần nhau thêm chút.
            </p>
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <div className="mobile-brand">
              nhà chơi<span>.</span>
            </div>
            <div className="breadcrumb">
              Nhà Chơi <span>/</span>
              <strong>
                {page === "home"
                  ? "Khám phá"
                  : page === "caro"
                    ? "Cờ Caro"
                    : page === "setup"
                      ? "Chọn chế độ"
                      : finished
                        ? "Kết quả"
                        : "Bàn chơi"}
              </strong>
            </div>
            <div className="header-tools">
              {offline && (
                <span className="save-indicator">
                  {persistence.error
                    ? "Chưa lưu"
                    : persistence.saved?.revision === update?.view?.revision
                      ? "Đã lưu"
                      : "Đang lưu…"}
                </span>
              )}
              <span className="platform-select">
                <Icon name="globe" />{" "}
                {getPlatform() === "web"
                  ? "Web"
                  : getPlatform() === "ios"
                    ? "iOS"
                    : "Android"}
              </span>
              <span className="guest-avatar">
                {update?.view?.players.find(
                  (p) => p.id === update.view!.viewerId,
                )?.name[0] ?? "K"}
              </span>
            </div>
          </header>
          <main id="main" tabIndex={-1}>
            <PwaStatus inGame={Boolean(session) || caroInGame} />
            {persistence.notice && (
              <div className="app-error">
                {persistence.notice}
                <button
                  aria-label="Đóng thông báo bản lưu"
                  onClick={persistence.dismissNotice}
                >
                  <Icon name="close" />
                </button>
              </div>
            )}
            {persistence.error && (
              <div className="app-error" role="alert">
                <span>{persistence.error}</span>
                <button
                  className="text-button"
                  onClick={() => void persistence.retry()}
                >
                  Thử lưu lại
                </button>
              </div>
            )}
            {error && (
              <div className="app-error" role="alert">
                {error}
                <button
                  aria-label="Đóng thông báo"
                  onClick={() => setError("")}
                >
                  <Icon name="close" />
                </button>
              </div>
            )}
            {update &&
              update.connection !== "connected" &&
              !persistence.error && (
                <p className="app-error" role="alert">
                  {update.reason ?? "Ván đang tạm dừng."}
                  {online && update.canEndInterrupted && (
                    <button
                      className="button secondary"
                      onClick={() => {
                        void online
                          .endInterrupted()
                          .then((reply) => {
                            if (!reply.ok) setError(roomError(reply.code));
                          })
                          .catch(() =>
                            setError("Chưa gửi được yêu cầu kết thúc."),
                          );
                      }}
                    >
                      Kết thúc ván không người thắng
                    </button>
                  )}
                </p>
              )}
            {page === "caro" && (
              <CaroScreen
                startSaved={resumeCaro}
                onHome={() => navigate("home")}
                onRules={() => setRules(true)}
                onInGame={setCaroInGame}
              />
            )}
            {page === "home" && (
              <Home
                onCaro={() => openCaro()}
                onResumeCaro={readCaroSave() ? () => openCaro(true) : undefined}
                onPlay={() => navigate("setup")}
                onRules={() => setRules(true)}
                saved={persistence.saved}
                onResume={() => void resume()}
                busy={pending}
              />
            )}
            {page === "setup" && (
              <Setup
                onOnline={(input) => void joinOnline(input)}
                onResumeOnline={
                  hasOnlineRoom() ? () => void joinOnline() : undefined
                }
                onStart={start}
                onBack={() => navigate("home")}
                busy={pending}
              />
            )}
            {page === "game" &&
              (online && lobby && !lobby.started && !lobby.closed ? (
                <Lobby
                  room={lobby}
                  session={online}
                  connected={update?.connection === "connected"}
                  onLeave={() => setLeave("home")}
                />
              ) : !update?.view ? (
                <p className="empty-message">Đang chuẩn bị bàn chơi…</p>
              ) : finished ? (
                <Results
                  view={update.view}
                  onHome={() => navigate("home")}
                  onAgain={() => navigate("setup")}
                />
              ) : (
                <Game
                  view={update.view}
                  pending={pending || update.connection !== "connected"}
                  onAction={send}
                  onLeave={() => setLeave("home")}
                />
              ))}
          </main>
          <footer className="workspace-footer">
            <span>Nhà Chơi — Cùng nhau, thêm vui.</span>
            {page !== "caro" && (
              <span>Tiền trong game, không có giá trị quy đổi</span>
            )}
          </footer>
        </div>
      </div>
      <nav className="mobile-nav" aria-label="Điều hướng điện thoại">
        <button onClick={() => navigate("home")}>
          <Icon name="grid" />
          Khám phá
        </button>
        <button onClick={openCurrentGame}>
          <Icon name="dice" />
          Vào bàn chơi
        </button>
        <button onClick={() => setRules(true)}>
          <Icon name="book" />
          Luật chơi
        </button>
      </nav>
      {rules && page === "caro" && (
        <Dialog title="Luật chơi Cờ Caro" onClose={() => setRules(false)}>
          <h2>Luật chơi Cờ Caro</h2>
          <CaroRules />
          <button
            className="button primary full"
            onClick={() => setRules(false)}
          >
            Mình hiểu rồi
          </button>
        </Dialog>
      )}
      {rules && page !== "caro" && (
        <Dialog title="Luật chơi Cờ tỷ phú" onClose={() => setRules(false)}>
          <h2>Một vòng luật chơi</h2>
          <p className="dialog-lead">
            Người cuối cùng chưa phá sản sẽ chiến thắng.
          </p>
          <ol className="rules-list">
            <li>
              Gieo hai xúc xắc và đi theo chiều tiến. Qua Xuất phát nhận 200.
            </li>
            <li>
              Mua đất chưa có chủ hoặc mở đấu giá nếu từ chối mua. Trả tiền thuê
              khi dừng ở tài sản người khác.
            </li>
            <li>
              Sở hữu đủ nhóm màu để xây đều. Ngân hàng có 32 nhà và 12 khách
              sạn.
            </li>
            <li>
              Có thể giao dịch, thế chấp và bán công trình để trả nợ. Đỗ xe miễn
              phí không có thưởng.
            </li>
            <li>
              Ba lần đôi liên tiếp vào tù. Có thể ra tù bằng 50, thẻ hoặc tung
              đôi.
            </li>
          </ol>
          <button
            className="button secondary full"
            aria-expanded={fullRules}
            onClick={() => setFullRules(!fullRules)}
          >
            {fullRules ? "Thu gọn bộ luật" : "Đọc bộ luật đầy đủ"}
          </button>
          {fullRules && (
            <pre
              className="full-rulebook"
              role="region"
              aria-label="Bộ luật đầy đủ"
              tabIndex={0}
            >
              {rulebook}
            </pre>
          )}
          <button
            className="button primary full"
            onClick={() => setRules(false)}
          >
            Mình hiểu rồi
          </button>
        </Dialog>
      )}
      {leave && (
        <Dialog title="Rời ván đang chơi?" onClose={() => setLeave(null)}>
          <h2>Rời ván đang chơi?</h2>
          <p className="dialog-lead">
            {online
              ? lobby?.started
                ? `${lobby.closed ? "" : "Rời phòng sẽ tạm dừng ván. "}Nếu chọn không lưu, bạn sẽ mất lối quay lại từ tab này. Ván chỉ bị xóa ngay khi tất cả người chơi chọn không lưu.`
                : "Bạn sẽ rời ghế trong phòng chờ."
              : "Bạn có thể lưu để chơi tiếp. Thoát không lưu sẽ xóa ván này khỏi thiết bị."}
          </p>
          <button
            className="button primary full"
            disabled={pending}
            onClick={() => void exit(leave)}
          >
            {online && !lobby?.started ? "Rời phòng" : "Lưu và rời ván"}
          </button>
          {error && (
            <p className="dialog-lead" role="alert">
              {error}
            </p>
          )}
          {(offline || lobby?.started) && (
            <button
              className="button secondary full"
              disabled={pending}
              onClick={() => void exit(leave, true)}
            >
              Thoát không lưu
            </button>
          )}
          <button
            className="text-button full"
            disabled={pending}
            onClick={() => setLeave(null)}
          >
            Tiếp tục chơi
          </button>
        </Dialog>
      )}
      {newGame && (
        <Dialog title="Thay thế ván đã lưu?" onClose={() => setNewGame(null)}>
          <h2>Thay thế ván đã lưu?</h2>
          <p className="dialog-lead">
            Bắt đầu ván mới sẽ thay thế ván đang được lưu trên thiết bị này. Bản
            lưu cũ được giữ cho tới khi ghi ván mới thành công.
          </p>
          <button
            className="button primary full"
            disabled={pending}
            onClick={() =>
              void start(newGame.human, newGame.botCount, newGame.boardSize, undefined, true)
            }
          >
            Bắt đầu ván mới
          </button>
          <button
            className="text-button full"
            disabled={pending}
            onClick={() => setNewGame(null)}
          >
            Giữ ván đã lưu
          </button>
        </Dialog>
      )}
    </>
  );
}
