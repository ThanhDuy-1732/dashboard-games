import { trackGame } from "../telemetry.js";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  CARO_DIFFICULTIES,
  chooseCaroMove,
  createCaro,
  isCaroDifficulty,
  playCaro,
} from "@nha-choi/game-core";
import type { CaroDifficulty, CaroMark } from "@nha-choi/game-core";
import { Dialog } from "../components/Dialog.js";
import { Icon } from "../components/Icon.js";
import { isNative } from "../platform.js";
import { CaroBoard, caroCoordinate } from "./Board.js";
import {
  CARO_SERVER,
  createCaroEntry,
  savedCaroEntry,
  useCaroOnline,
} from "./online.js";
import type { CaroEntry } from "./online.js";
import { readCaroSave, writeCaroSave } from "./save.js";
import type { CaroLocalMode, CaroSave } from "./save.js";
import "./caro.css";

const difficultyName: Record<CaroDifficulty, string> = {
  easy: "Dễ",
  normal: "Thường",
  hard: "Khó",
  expert: "Rất khó",
};

export function CaroRules() {
  return (
    <ol className="rules-list">
      <li>X đi trước. Hai bên lần lượt đánh vào ô trống.</li>
      <li>
        Tạo đúng 5 quân liên tiếp theo hàng ngang, dọc hoặc chéo để thắng, kể cả
        khi đối thủ chặn cả hai đầu. Chuỗi từ 6 quân trở lên không tính thắng.
      </li>
      <li>
        Bàn đầy mà chưa ai thắng thì hòa.
      </li>
      <li>Khi tái đấu, hai bên đổi X/O.</li>
    </ol>
  );
}

export function caroInviteCode() {
  const code = new URLSearchParams(window.location.search)
    .get("caro")
    ?.toUpperCase();
  return code && /^[A-Z0-9]{6}$/.test(code) ? code : "";
}

export function CaroScreen({
  startSaved,
  onHome,
  onRules,
  onInGame,
}: {
  startSaved: boolean;
  onHome: () => void;
  onRules: () => void;
  onInGame: (active: boolean) => void;
}) {
  const [saved, setSaved] = useState(readCaroSave);
  const [local, setLocal] = useState<CaroSave | null>(() => {
    const initial = startSaved ? readCaroSave() : null;
    return initial && !initial.id ? { ...initial, id: crypto.randomUUID() } : initial;
  });
  const [replace, setReplace] = useState<CaroLocalMode | null>(null);
  const [difficulty, setDifficulty] = useState<CaroDifficulty>("normal");
  const [name, setName] = useState("");
  const [code, setCode] = useState(caroInviteCode);
  const [onlineSetup, setOnlineSetup] = useState(() =>
    Boolean(caroInviteCode()),
  );
  const [entry, setEntry] = useState<CaroEntry | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [boardKey, setBoardKey] = useState(0);
  const [notice, setNotice] = useState("");
  const [inviteStatus, setInviteStatus] = useState("");
  const online = useCaroOnline(entry);
  const room = entry ? online.seat?.room : undefined;
  const inGame = Boolean(local || entry);

  useEffect(() => {
    onInGame(inGame);
    return () => onInGame(false);
  }, [inGame, onInGame]);

  function persist(save: CaroSave, moved = false) {
    if (moved && save.game.moves.length === 1) save.startedAt ??= Date.now();
    try {
      writeCaroSave(save);
      setSaved(save);
      setNotice("");
    } catch {
      setNotice(
        "Thiết bị chưa lưu được ván này. Bạn vẫn có thể tiếp tục chơi trên trang hiện tại.",
      );
    }
    if (moved && save.id) {
      const playMode = save.mode === "local" ? "same-device" : "bot";
      if (save.game.moves.length === 1) trackGame("caro", save.id, "game_started", playMode);
      if (save.game.result) trackGame("caro", save.id, "game_completed", playMode, save.startedAt);
    }
  }

  useEffect(() => {
    if (local?.id && saved && !saved.id && startSaved) {
      try {
        writeCaroSave(local);
        setSaved(local);
      } catch {
        setNotice("Thiết bị chưa lưu được ván này.");
      }
    }
  }, [local, saved, startSaved]);

  useEffect(() => {
    const mode = local?.mode;
    if (
      !local ||
      !mode ||
      mode === "local" ||
      local.game.result ||
      local.game.turn === local.firstMark
    )
      return;
    const timer = window.setTimeout(() => {
      const move = chooseCaroMove(local.game, mode);
      const game = move === null ? null : playCaro(local.game, move);
      if (game) {
        const next = { ...local, game };
        persist(next, true);
        setLocal(next);
      }
    }, 330);
    return () => window.clearTimeout(timer);
  }, [local]);

  useEffect(() => {
    if (!room) return;
    setSelected(null);
  }, [room?.revision]);

  function start(mode: CaroLocalMode, firstMark: CaroMark = "X") {
    const save = { id: crypto.randomUUID(), mode, firstMark, game: createCaro() };
    setLocal(save);
    setBoardKey((key) => key + 1);
    setSelected(null);
    setReplace(null);
    persist(save);
  }

  function newLocal(mode: CaroLocalMode) {
    const prior = readCaroSave();
    if (prior && !prior.game.result && prior.game.moves.length)
      setReplace(mode);
    else start(mode);
  }

  function enter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const joining =
      submitter instanceof HTMLButtonElement
        ? submitter.value === "join"
        : code.length === 6;
    if (!name.trim() || (joining && !/^[A-Z0-9]{6}$/.test(code))) {
      setNotice(
        "Nhập tên và mã phòng 6 ký tự để vào phòng. Để tạo phòng mới, chỉ cần nhập tên.",
      );
      return;
    }
    setNotice("");
    setInviteStatus("");
    setEntry(createCaroEntry(name.trim(), joining ? code : undefined));
  }

  function backToModes() {
    setEntry(null);
    setLocal(null);
    setSelected(null);
    setNotice("");
  }

  async function copyInvite(roomCode: string) {
    const url = new URL(location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("caro", roomCode);
    try {
      await navigator.clipboard.writeText(isNative() ? roomCode : url.href);
      setInviteStatus(
        isNative() ? "Đã sao chép mã phòng." : "Đã sao chép link mời.",
      );
    } catch {
      setInviteStatus("Hãy sao chép mã phòng hiển thị ở trên.");
    }
  }

  const game =
    local?.game ?? (room?.players.length === 2 ? room.game : undefined);
  const ownMark = online.seat?.mark;
  const allConnected = Boolean(
    online.connected &&
      room?.players.length === 2 &&
      room.players.every((player) => player.connected),
  );
  const canPlay = Boolean(
    game &&
      !game.result &&
      (local
        ? local.mode === "local" || game.turn === local.firstMark
        : allConnected && !online.pending && ownMark === game.turn),
  );
  const playerNames = local
    ? local.mode === "local"
      ? {
          X: local.firstMark === "X" ? "Người chơi 1" : "Người chơi 2",
          O: local.firstMark === "O" ? "Người chơi 1" : "Người chơi 2",
        }
      : {
          X: local.firstMark === "X" ? "Bạn" : "Máy",
          O: local.firstMark === "O" ? "Bạn" : "Máy",
        }
    : Object.fromEntries(
        room?.players.map((player) => [player.mark, player.name]) ?? [],
      );
  const resume = !local && !entry ? savedCaroEntry() : null;

  function confirm() {
    if (!canPlay || selected === null) return;
    if (local) {
      const nextGame = playCaro(local.game, selected);
      if (!nextGame) return;
      const next = { ...local, game: nextGame };
      persist(next, true);
      setLocal(next);
    } else online.send("caro:move", selected);
    setSelected(null);
  }

  return (
    <section className="screen caro-screen">
      <header className={`caro-heading${game ? " in-match" : ""}`}>
        <div>
          <button
            className="text-button"
            onClick={local || entry ? backToModes : onHome}
          >
            {local || entry ? "Chọn chế độ" : "Về trang chủ"}
          </button>
          <h1>Cờ Caro</h1>
        </div>
        <button className="button secondary" onClick={onRules}>
          <Icon name="book" /> Cách chơi
        </button>
      </header>
      {notice && (
        <p className="app-error" role="alert">
          {notice}
        </p>
      )}
      {!local && !entry && (
        <div className="caro-menu">
          <div className="caro-menu-play">
            {saved && (
              <button
                className="button primary"
                onClick={() => {
                  setSelected(null);
                  const resumed = saved.id ? saved : { ...saved, id: crypto.randomUUID() };
                  if (!saved.id) persist(resumed);
                  setLocal(resumed);
                }}
              >
                {saved.game.result ? "Xem kết quả Caro" : "Tiếp tục ván Caro"}{" "}
                <Icon name="arrow" />
              </button>
            )}
            <button className="caro-mode" onClick={() => newLocal("local")}>
              <Icon name="users" />
              <span>
                <strong>Hai người cùng máy</strong>
                <small>Luân phiên đánh trên một thiết bị.</small>
              </span>
              <Icon name="arrow" />
            </button>
            <div className="caro-mode caro-mode-form">
              <Icon name="bot" />
              <div>
                <h2>Đấu với máy</h2>
                <label className="caro-difficulty">
                  Độ khó
                  <select
                    value={difficulty}
                    onChange={(event) => {
                      const mode = event.target.value;
                      if (isCaroDifficulty(mode)) setDifficulty(mode);
                    }}
                  >
                    {CARO_DIFFICULTIES.map((mode) => (
                      <option key={mode} value={mode}>
                        {difficultyName[mode]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                className="button secondary"
                onClick={() => newLocal(difficulty)}
              >
                Bắt đầu
              </button>
            </div>
            {resume && (
              <button
                className="button secondary"
                onClick={() => setEntry(resume)}
              >
                Tiếp tục phòng Caro
              </button>
            )}
          </div>
          <div className="caro-online-panel">
            <h2>Chơi với bạn online</h2>
            <p>Tạo phòng riêng hoặc nhập mã bạn bè gửi.</p>
            {!CARO_SERVER ? (
              <p>Ứng dụng cần máy chủ HTTPS để chơi online.</p>
            ) : onlineSetup ? (
              <form onSubmit={enter}>
                <label>
                  Tên hiển thị
                  <input
                    value={name}
                    maxLength={24}
                    required
                    autoComplete="nickname"
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>
                <label>
                  Mã phòng
                  <input
                    value={code}
                    maxLength={6}
                    autoCapitalize="characters"
                    spellCheck={false}
                    onChange={(event) =>
                      setCode(event.target.value.toUpperCase())
                    }
                  />
                </label>
                <div className="caro-actions">
                  <button
                    className="button primary"
                    name="mode"
                    value="join"
                    type="submit"
                    disabled={code.length !== 6}
                  >
                    Vào phòng
                  </button>
                  <button
                    className="button secondary"
                    name="mode"
                    value="create"
                    type="submit"
                  >
                    Tạo phòng
                  </button>
                </div>
              </form>
            ) : (
              <button
                className="button primary"
                onClick={() => setOnlineSetup(true)}
              >
                Chọn phòng
              </button>
            )}
          </div>
        </div>
      )}
      {entry && online.message && (
        <p className="caro-online-status" role="status">
          {online.message}
        </p>
      )}
      {entry && online.canRetry && (
        <button className="button secondary" onClick={online.retry}>
          Thử kết nối lại
        </button>
      )}
      {room && (
        <div className="caro-room">
          <div>
            <span>Mã phòng</span>
            <strong>{room.code}</strong>
          </div>
          <button
            className="button secondary"
            onClick={() => void copyInvite(room.code)}
          >
            {isNative() ? "Sao chép mã phòng" : "Sao chép link mời"}
          </button>
          {inviteStatus && <small role="status">{inviteStatus}</small>}
        </div>
      )}
      {room?.players.length === 1 && (
        <p role="status" className="caro-online-status">
          Đang chờ người thứ hai vào phòng.
        </p>
      )}
      {game && (
        <div className="caro-match">
          <CaroBoard
            key={local ? boardKey : room?.round}
            game={game}
            canPlay={canPlay}
            selected={selected}
            onSelect={setSelected}
          />
          <div className="caro-match-panel">
            <p className="caro-match-mode">
              {local
                ? local.mode === "local"
                  ? "Hai người cùng máy"
                  : `Đấu máy · ${difficultyName[local.mode]}`
                : `Ván ${room?.round} · Online`}
            </p>
            <div className="caro-players">
              {(["X", "O"] as const).map((mark) => (
                <div
                  key={mark}
                  className={`caro-player${!game.result && game.turn === mark ? " current" : ""}`}
                >
                  <span data-mark={mark}>{mark}</span>
                  <div>
                    <strong>
                      {playerNames[mark]}
                      {mark === ownMark ? " (bạn)" : ""}
                    </strong>
                    {!local &&
                      !room?.players.find((player) => player.mark === mark)
                        ?.connected && <small>Mất kết nối</small>}
                  </div>
                </div>
              ))}
            </div>
            <h2 aria-live="polite" aria-atomic="true">
              {game.result
                ? game.result.winner
                  ? `${playerNames[game.result.winner]} thắng!`
                  : "Ván hòa"
                : !local && !allConnected
                  ? "Đang chờ kết nối"
                  : `Lượt ${game.turn} · ${playerNames[game.turn]}`}
            </h2>
            {game.moves.length > 0 && (
              <p>
                Nước vừa đánh ở ô{" "}
                {caroCoordinate(game.moves[game.moves.length - 1]!)}
              </p>
            )}
            {game.result && local && (
              <button
                className="button primary"
                onClick={() =>
                  start(local.mode, local.firstMark === "X" ? "O" : "X")
                }
              >
                Chơi lại
              </button>
            )}
            {game.result && !local && (
              <button
                className="button primary"
                disabled={
                  !allConnected ||
                  online.pending ||
                  room?.players.some(
                    (player) =>
                      player.mark === ownMark && player.readyForRematch,
                  )
                }
                onClick={() => online.send("caro:rematch")}
              >
                {room?.players.some(
                  (player) => player.mark === ownMark && player.readyForRematch,
                )
                  ? "Đang chờ bạn chơi"
                  : room?.players.some((player) => player.readyForRematch)
                    ? "Đồng ý tái đấu"
                    : "Tái đấu"}
              </button>
            )}
            {game.result && (
              <button className="button secondary" onClick={onHome}>
                Về trang chủ
              </button>
            )}
            {!game.result && (
              <div className="caro-confirm">
                <button
                  className="button primary"
                  disabled={!canPlay || selected === null}
                  onClick={confirm}
                >
                  {selected === null
                    ? "Đánh"
                    : `Đánh ô ${caroCoordinate(selected)}`}
                </button>
                {canPlay && selected === null && (
                  <small>Chọn một ô trống rồi bấm Đánh.</small>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {replace && (
        <Dialog
          title="Thay ván Caro đang lưu?"
          onClose={() => setReplace(null)}
        >
          <h2>Thay ván Caro đang lưu?</h2>
          <p className="dialog-lead">
            Bắt đầu ván mới sẽ thay ván Caro offline hiện có trên thiết bị này.
          </p>
          <div className="caro-actions">
            <button
              className="button secondary"
              onClick={() => setReplace(null)}
            >
              Quay lại
            </button>
            <button className="button primary" onClick={() => start(replace)}>
              Bắt đầu ván mới
            </button>
          </div>
        </Dialog>
      )}
    </section>
  );
}
