import { trackGame } from "../telemetry.js";
import { useEffect, useRef, useState } from "react";
import { createKilnGame, inspectKilnMove, KILN_LEVELS, KILN_ORDERS, KILN_SIZES, placeKilnPiece } from "@nha-choi/game-core";
import type { KilnGame, KilnLevelId, KilnMode, KilnMove, KilnSize } from "@nha-choi/game-core";
import { Dialog } from "../components/Dialog.js";
import { KilnBoard } from "./Board.js";
import type { KilnBurst } from "./Board.js";
import { KilnSaveError, loadKilnSave, replaceCorruptKilnSave, restoreKilnGame, saveKilnEndless, writeKilnSave } from "./save.js";
import type { KilnSave } from "./save.js";
import "./kiln.css";

type Session = { game: KilnGame; save: KilnSave };
type StorageIssue = "corrupt" | "conflict" | "unavailable";
type Props = { active: boolean; onHome: () => void; onRules: () => void; onInGame: (inGame: boolean) => void };

function newSession(level: KilnLevelId = 1, unlocked: KilnLevelId = 1, size: KilnSize = KILN_SIZES[0]): Session {
  return { game: createKilnGame(level, size), save: { version: 1, unlocked, active: { level, size, moves: [] } } };
}

const levelHint = {
  1: "Bình ở hàng 2 sắp chín. Đặt mảnh hai ô vào cuối hàng để lấy bình.",
  2: "Bình còn hai nhịp mới chín. Hãy canh lượt lấp hàng của bình.",
  3: "Quan sát hai bình và ô giao nhau của hàng với cột.",
};

const storageMessage = {
  corrupt: "Bản lưu Lò Gốm bị hỏng hoặc thuộc phiên bản khác.",
  conflict: "Bản lưu đã thay đổi ở tab khác. Tiến độ ở tab này chưa được lưu.",
  unavailable: "Chưa lưu được Lò Gốm trên thiết bị này. Bạn vẫn có thể chơi trong tab này.",
};

export function KilnRules() {
  return (
    <ol className="rules-list">
      <li>Đặt một trong ba mảnh lên bàn. Dùng hết ba mảnh để nhận bộ mới. Hàng hoặc cột đầy sẽ tự xóa.</li>
      <li>Mỗi nước hợp lệ làm lò nóng thêm một nhịp. Gốm mới cần hai lần đặt tiếp theo để chín và giữ độ chín trong hai lượt, tính cả lượt vừa chín.</li>
      <li>Xóa đường qua bình đang chín để lấy gốm. Mỗi ô đặt được 1 điểm, mỗi đường xóa được 10 điểm và mỗi bình chín được 50 điểm. Lấy hai bình trở lên trong một nước được thêm 25 điểm.</li>
      <li>Kéo mảnh lên bàn, hoặc chọn mảnh rồi chạm ô ứng với góc trên trái của mảnh. Với bàn phím, dùng phím mũi tên để di chuyển và Enter hoặc Space để đặt.</li>
      <li>Ở chế độ Vô tận, bạn chơi đến khi hết chỗ đặt. Hoàn thành đơn nhận điểm thưởng. Hết hạn thì nhận đơn tiếp theo.</li>
    </ol>
  );
}

export function KilnScreen({ active, onHome, onRules, onInGame }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [issue, setIssue] = useState<StorageIssue | null>(null);
  const [notice, setNotice] = useState("");
  const [restart, setRestart] = useState<{ level: KilnMode; size: KilnSize } | null>(null);
  const [burst, setBurst] = useState<KilnBurst | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [working, setWorking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [boardKey, setBoardKey] = useState(0);
  const current = useRef<Session | null>(null);
  const checkpoint = useRef<Session | null>(null);
  const revision = useRef<number | null>(null);
  const blocked = useRef<"conflict" | "corrupt" | null>(null);
  const writes = useRef(Promise.resolve());
  const storageAction = useRef(false);

  function show(next: Session) {
    current.current = next;
    setSession(next);
  }

  function acceptRead(record: Awaited<ReturnType<typeof loadKilnSave>>) {
    revision.current = record?.revision ?? null;
    blocked.current = null;
    setIssue(null);
    setNotice("");
    setDirty(false);
    setBurst(null);
    setBoardKey(key => key + 1);
    checkpoint.current = record ? { save: record.save, game: restoreKilnGame(record.save)! } : newSession();
    show(checkpoint.current);
  }

  useEffect(() => {
    if (!active) {
      setBurst(null);
      return;
    }
    if (current.current) return;
    let cancelled = false;
    void loadKilnSave().then(record => {
      if (!cancelled) acceptRead(record);
    }).catch((error: unknown) => {
      if (cancelled) return;
      blocked.current = error instanceof KilnSaveError && error.kind === "corrupt" ? "corrupt" : null;
      setIssue(blocked.current ?? "unavailable");
      show(newSession());
    });
    return () => { cancelled = true; };
  }, [active]);

  const inGame = dirty || saving || working || (active && session?.game.status === "playing");
  useEffect(() => {
    onInGame(inGame);
    return () => onInGame(false);
  }, [inGame, onInGame]);

  function reportWriteError(error: unknown) {
    if (error instanceof KilnSaveError && error.kind === "conflict") blocked.current = "conflict";
    setIssue(blocked.current ?? "unavailable");
  }

  function store(next: Session) {
    setDirty(true);
    if (blocked.current) return;
    setSaving(true);
    const pending = writes.current.then(async () => {
      if (blocked.current) return;
      try {
        revision.current = await writeKilnSave(next.save, revision.current);
        checkpoint.current = next;
        if (writes.current === pending) setDirty(false);
        setIssue(null);
      } catch (error) {
        reportWriteError(error);
      }
    }).finally(() => {
      if (writes.current === pending) setSaving(false);
    });
    writes.current = pending;
  }

  function discardUnsaved() {
    if (saving) return;
    show(checkpoint.current ?? newSession());
    setBoardKey(key => key + 1);
    setNotice("");
    setDirty(false);
    setBurst(null);
    setConfirmDiscard(false);
  }

  async function recover(replace: boolean) {
    if (storageAction.current) return;
    storageAction.current = true;
    setWorking(true);
    try {
      await writes.current;
      if (replace) {
        const initial = newSession();
        const nextRevision = await replaceCorruptKilnSave(initial.save);
        acceptRead({ save: initial.save, revision: nextRevision });
      } else {
        acceptRead(await loadKilnSave());
      }
      setConfirmReset(false);
    } catch (error) {
      if (error instanceof KilnSaveError) {
        blocked.current = error.kind;
        setIssue(error.kind);
        if (error.kind === "conflict") setConfirmReset(false);
      } else {
        setIssue(blocked.current ?? "unavailable");
      }
    } finally {
      setWorking(false);
      storageAction.current = false;
    }
  }

  function tryMove(move: KilnMove) {
    const before = current.current;
    if (!before || storageAction.current || before.game.status !== "playing") return;
    const placement = inspectKilnMove(before.game, move);
    if (!placement) {
      setNotice("Mảnh chưa vừa. Chọn ô khác hoặc đổi mảnh.");
      return;
    }
    const game = placeKilnPiece(before.game, move)!;
    const completed = placement.order?.outcome === "completed";
    const collected = placement.collected.length;
    if (placement.cleared.length) {
      const glaze = before.game.tray[move.slot]!.glaze;
      const tiles: KilnBurst["tiles"] = new Map(placement.cleared.map(index => [
        index,
        placement.collected.includes(index) ? "gold" : before.game.board[index]?.glaze ?? glaze,
      ]));
      const label = completed ? "Hoàn thành đơn" : collected ? `Lấy ${collected} bình` : `Xóa ${placement.lines} đường`;
      setBurst({
        turn: game.turn, anchor: move.anchor, tiles, label, points: placement.points,
        highlight: completed || collected > 0 || placement.lines > 1,
      });
    }
    const starting = before.game.turn === 0;
    const run = game.level === "endless" ? before.save.endless : before.save.active;
    const id = run?.id ?? crypto.randomUUID();
    const startedAt = starting ? Date.now() : run?.startedAt;
    const timing = { id, ...(startedAt === undefined ? {} : { startedAt }) };
    let save: KilnSave;
    if (game.level === "endless") {
      save = saveKilnEndless(before.save, game, timing);
    } else {
      const unlocked = game.status === "won"
        ? Math.max(before.save.unlocked, Math.min(game.level + 1, 3)) as KilnLevelId
        : before.save.unlocked;
      save = {
        ...before.save, unlocked,
        active: { level: game.level, size: game.size, moves: [...before.save.active.moves, move], ...timing },
      };
    }
    if (starting) trackGame("kiln", id, "game_started", "solo");
    if (game.status !== "playing") trackGame("kiln", id, "game_completed", "solo", startedAt);
    if (completed) {
      setNotice(`Hoàn thành ${KILN_ORDERS[before.game.order!.kind].name}. Thưởng +${placement.order!.bonus} điểm.`);
    } else if (placement.order?.outcome === "expired") {
      setNotice("Đơn đã hết hạn. Bạn có thể tiếp tục với đơn mới.");
    } else if (collected) {
      setNotice(`Đã lấy ${collected} món gốm chín. +${placement.points} điểm.`);
    } else {
      setNotice(placement.lines ? `Đã xóa ${placement.lines} đường. +${placement.points} điểm.` : "Lò đã nóng thêm một nhịp.");
    }
    const next = { game, save };
    show(next);
    store(next);
    return placement;
  }

  function switchSession(next: Session) {
    setBoardKey(key => key + 1);
    setNotice("");
    setRestart(null);
    setBurst(null);
    show(next);
    store(next);
  }

  function start(level: KilnMode, size: KilnSize) {
    if (!current.current || storageAction.current) return;
    const previous = current.current.save;
    const game = createKilnGame(level, size);
    const save: KilnSave = level === "endless"
      ? saveKilnEndless(previous, game)
      : { ...previous, mode: "campaign", active: { level, size, moves: [] } };
    switchSession({ game, save });
  }

  if (!session) return active ? <p className="empty-message">Đang mở lò gốm…</p> : null;
  const { game, save } = session;
  const config = game.level === "endless" ? null : KILN_LEVELS[game.level];
  const order = game.order;
  const contract = order && KILN_ORDERS[order.kind];
  const playing = game.status === "playing";
  const nextLevel = game.level !== "endless" && game.status === "won" && game.level < 3 ? (game.level + 1) as KilnLevelId : null;
  const statusText = {
    playing: notice || (game.turn === 0 && game.level !== "endless" ? levelHint[game.level] : ""),
    won: "Mẻ gốm thành công!",
    "lost-turns": "Đã hết lượt đặt.",
    "lost-space": "Hết chỗ đặt các mảnh còn lại.",
  }[game.status];

  function chooseBoard(level: KilnMode, size = game.size) {
    if (playing && game.turn > 0) setRestart({ level, size });
    else start(level, size);
  }

  function openMode(level: KilnMode) {
    if (storageAction.current) return;
    if (level === "endless") {
      if (!save.endless) {
        start(level, game.size);
      } else {
        const nextSave: KilnSave = { ...save, mode: "endless" };
        switchSession({ save: nextSave, game: restoreKilnGame(nextSave)! });
      }
    } else if (game.level === "endless") {
      const nextSave: KilnSave = { ...save, mode: "campaign" };
      const campaign = restoreKilnGame(nextSave)!;
      if (level === campaign.level) switchSession({ save: nextSave, game: campaign });
      else if (campaign.status === "playing" && campaign.turn > 0) setRestart({ level, size: campaign.size });
      else start(level, campaign.size);
    } else {
      chooseBoard(level);
    }
  }

  return (
    <section className="kiln-screen" aria-labelledby="kiln-heading">
      <div className="kiln-header">
        <div className="kiln-brand">
          <span className="kiln-seal" aria-hidden="true"><span className="kiln-vase" /></span>
          <h1 id="kiln-heading">Lò Gốm</h1>
        </div>
        <div className="kiln-actions">
          <button type="button" onClick={onRules}>Cách chơi</button>
          <button type="button" disabled={working} onClick={() => chooseBoard(game.level)}>Chơi lại</button>
          <button type="button" onClick={onHome}>Về Nhà Chơi</button>
        </div>
      </div>
      <div className="kiln-options">
        <div className="kiln-levels" role="group" aria-label="Chọn màn">
          {Object.values(KILN_LEVELS).map(level => (
            <button
              type="button"
              key={level.id}
              aria-label={`Màn ${level.id}: ${level.name}`}
              aria-current={level.id === game.level ? "step" : undefined}
              disabled={working || level.id > save.unlocked || level.id === game.level}
              onClick={() => openMode(level.id)}
            >
              Màn {level.id}
            </button>
          ))}
          <button
            type="button"
            aria-current={game.level === "endless" ? "true" : undefined}
            disabled={working || game.level === "endless"}
            onClick={() => openMode("endless")}
          >
            Vô tận
          </button>
        </div>
        <div className="kiln-sizes" role="group" aria-label="Kích thước bàn">
          <span>Bàn</span>
          {KILN_SIZES.map(size => (
            <button
              type="button"
              key={size}
              aria-pressed={game.size === size}
              disabled={working}
              onClick={() => { if (size !== game.size) chooseBoard(game.level, size); }}
            >
              {size} × {size}
            </button>
          ))}
        </div>
        {saving && <span className="kiln-saving">Đang lưu…</span>}
      </div>
      {issue && (
        <div className="kiln-save-warning">
          <p role="alert">{storageMessage[issue]}</p>
          {issue === "corrupt" && <button type="button" disabled={working} onClick={() => setConfirmReset(true)}>Đặt lại bản lưu</button>}
          {issue === "conflict" && <button type="button" disabled={working} onClick={() => void recover(false)}>Tải bản lưu mới</button>}
          {issue === "unavailable" && (
            <>
              <button type="button" disabled={saving} onClick={() => store(session)}>Thử lưu lại</button>
              {dirty && <button type="button" disabled={saving} onClick={() => setConfirmDiscard(true)}>Bỏ tiến độ chưa lưu</button>}
            </>
          )}
        </div>
      )}
      {order && contract && (
        <section className="kiln-contract" aria-label="Đơn hàng hiện tại">
          <div>
            <h2>{contract.name}</h2>
            <p>{contract.description}</p>
          </div>
          <div className="kiln-contract-stats">
            {order.kind !== "cross" && <span>{order.progress}/2 {order.kind === "pots" ? "bình" : "nước liên tiếp"}</span>}
            {order.remaining !== null && <span>Còn {order.remaining} lượt</span>}
            <strong>+{contract.bonus} điểm</strong>
          </div>
        </section>
      )}
      <div className="kiln-layout">
        <KilnBoard
          key={boardKey}
          game={game}
          burst={burst}
          onMove={tryMove}
          onBurstEnd={turn => setBurst(visible => visible?.turn === turn ? null : visible)}
        />
        <aside className="kiln-sidebar">
          <div className="kiln-order">
            <h2>{config?.name ?? "Vô tận"}</h2>
            {config ? (
              <>
                <p>Lấy {config.target} món gốm chín trong {config.turnLimit} lượt.</p>
                <div className="kiln-shelf" role="img" aria-label={`Đã lấy ${game.collected} trên ${config.target} món`}>
                  {Array.from({ length: config.target }, (_, index) => (
                    <span key={index} className={`kiln-vase${index < game.collected ? " kiln-fired" : ""}`} />
                  ))}
                </div>
              </>
            ) : (
              <p className="kiln-endless-intro">Đặt khối và thu gốm đến khi hết chỗ.</p>
            )}
            <div className="kiln-stats">
              <div><span>Điểm</span><strong data-kiln-score>{game.score}</strong></div>
              {config ? (
                <div><span>Lượt còn</span><strong data-kiln-left>{config.turnLimit - game.turn}</strong></div>
              ) : (
                <div><span>Lượt đã chơi</span><strong>{game.turn}</strong></div>
              )}
            </div>
          </div>
          <div className="kiln-state">
            <p role="status">{statusText}</p>
            {nextLevel && <button type="button" disabled={working} onClick={() => start(nextLevel, game.size)}>Màn tiếp theo</button>}
          </div>
          <div className="kiln-legend" aria-label="Trạng thái gốm">
            <span><b className="kiln-chip kiln-raw">2</b> Nhịp đến khi chín</span>
            <span><b className="kiln-chip kiln-ready">✦</b> Chín, lấy trong 2 lượt</span>
            <span><b className="kiln-chip kiln-broken">ϟ</b> Nứt, mất điểm thưởng</span>
          </div>
        </aside>
      </div>
      {active && restart !== null && (
        <Dialog title={restart.size === game.size ? "Bắt đầu màn mới?" : "Đổi kích thước bàn?"} onClose={() => setRestart(null)}>
          <p>Ván đang chơi sẽ được thay bằng bàn {restart.size} × {restart.size} mới.</p>
          <button className="button primary" onClick={() => start(restart.level, restart.size)}>Bắt đầu lại</button>
        </Dialog>
      )}
      {active && confirmReset && (
        <Dialog title="Đặt lại bản lưu Lò Gốm?" onClose={() => setConfirmReset(false)}>
          <p>Tiến độ Lò Gốm trên thiết bị này sẽ được đặt về màn đầu.</p>
          <button className="button primary" disabled={working} onClick={() => void recover(true)}>Xác nhận đặt lại</button>
        </Dialog>
      )}
      {active && confirmDiscard && (
        <Dialog title="Bỏ tiến độ chưa lưu?" onClose={() => setConfirmDiscard(false)}>
          <p>{checkpoint.current ? "Bàn sẽ trở về trạng thái đã lưu gần nhất của tab này." : "Bàn sẽ trở về màn đầu."}</p>
          <button className="button primary" onClick={discardUnsaved}>Xác nhận bỏ tiến độ</button>
        </Dialog>
      )}
    </section>
  );
}
