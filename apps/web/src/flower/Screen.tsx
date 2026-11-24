import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Ref } from "react";
import {
  FLOWER_LEVELS, FLOWER_NAMES, createFlowerGame, flowerAdjacent, flowerGoals, flowerHint,
  flowerLevel, flowerStars, swapFlower, useFlowerTool,
} from "@nha-choi/game-core";
import type { FlowerColor, FlowerFrame, FlowerGame, FlowerMode, FlowerTool, FlowerTurn } from "@nha-choi/game-core";
import { Dialog } from "../components/Dialog.js";
import { Icon } from "../components/Icon.js";
import { cryptoRandom } from "../random.js";
import { Flower } from "./Flower.js";
import { FlowerBoard } from "./Board.js";
import type { FlowerExchange } from "./Board.js";
import { FLOWER_SAVE_KEY, FlowerSaveConflict, flowerUnlocked, readFlowerSave, recordFlowerGame, writeFlowerSave } from "./save.js";
import type { FlowerSave } from "./save.js";
import "./flower.css";
const MODE_NAMES: Record<FlowerMode, string> = { quick: "Chơi nhanh", journey: "Hành trình", mystery: "Vườn khóa bí ẩn" };
const random = () => cryptoRandom.int(0, 2 ** 24 - 1) / 2 ** 24;
const delay = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : ms));
const initialFrame = (game: FlowerGame): FlowerFrame => ({ kind: "swap", board: game.board, grass: game.grass, score: game.score, combo: 0, indices: [], drops: {} });
function goalLabel(kind: string, color?: FlowerColor) {
  return kind === "score" ? "Điểm" : kind === "flower" ? FLOWER_NAMES[color!] : kind === "grass" ? "Đám cỏ" : kind === "rock" ? "Viên đá" : "Nụ lớn";
}
export function FlowerRules() {
  return <ol className="rules-list">
    <li>Kéo hoa đổi chỗ với ô ngay bên trái, phải, trên hoặc dưới. Bạn cũng có thể chọn lần lượt hai ô, hoặc giữ Shift và bấm phím mũi tên.</li>
    <li>Ghép ít nhất 3 hoa cùng loại theo hàng ngang hoặc dọc. Đổi chỗ không tạo hàng ghép được hoàn lại và không mất lượt.</li>
    <li>Hoa nổ, hoa phía trên rơi xuống và tạo combo. Một nước hợp lệ chỉ mất một lượt, dù có nhiều combo.</li>
    <li>Ghép hoa trên cỏ để dọn cỏ. Hoa ghép cạnh đá hoặc nụ lớn làm giảm sức bền của chúng. Hoàn thành mọi mục tiêu trước khi hết lượt.</li>
    <li>Hành trình có một Xẻng và một Bình tưới mỗi lần thử màn. Xẻng phá một hoa hoặc giảm một sức bền; Bình tưới làm nở một hoa và các hoa cùng loại sát cạnh. Vật phẩm không mất lượt.</li>
    <li>Vườn khóa bí ẩn có 4–6 ô khóa ngẫu nhiên. Khóa lượt mở sau 2–4 nước đi hợp lệ; khóa nổ mở sau 2–4 đợt ghép sát cạnh theo bốn hướng. Mỗi đợt chỉ tính một lần cho mỗi khóa, dù nhiều hoa cùng nổ. Khóa cố định và chặn hoa rơi.</li>
    <li>Tiến độ lưu trên thiết bị. Mở lần lượt 12 màn và chơi lại để nâng sao; Escape hủy chọn hoa hoặc vật phẩm.</li>
  </ol>;
}
export interface FlowerScreenHandle { openCurrentGame: () => boolean }
export function FlowerScreen({ onHome, onRules, onInGame, active = true, ref }: {
  onHome: () => void; onRules: () => void; onInGame: (active: boolean) => void; active?: boolean; ref?: Ref<FlowerScreenHandle>;
}) {
  const [initial] = useState(readFlowerSave);
  const [save, setSave] = useState(initial.save);
  const saveRef = useRef(save), raw = useRef(initial.raw);
  const [problem, setProblem] = useState(initial.problem);
  const [corrupt, setCorrupt] = useState(initial.corrupt);
  const writeQueue = useRef(Promise.resolve());
  const [saving, setSaving] = useState(false);
  const saveGeneration = useRef(0);
  const [conflict, setConflict] = useState(false), conflictRef = useRef(false);
  const [view, setView] = useState<"home" | "map" | "play">("home");
  const [game, setGame] = useState<FlowerGame | null>(null), gameRef = useRef<FlowerGame | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [hint, setHint] = useState<number[]>([]);
  const [tool, setTool] = useState<FlowerTool | null>(null);
  const [pending, setPending] = useState<{ mode: FlowerMode; level: number } | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const [frame, setFrame] = useState<FlowerFrame | null>(null);
  const [exchange, setExchange] = useState<FlowerExchange | null>(null);
  const [animating, setAnimating] = useState(false), locked = useRef(false), animation = useRef(0);
  const [notice, setNotice] = useState("Kéo đổi chỗ hai hoa cạnh nhau để ghép 3.");
  const [mapLevel, setMapLevel] = useState(() => flowerUnlocked(initial.save));
  const cancelSelection = useCallback(() => { setSelected(null); setHint([]); setTool(null); }, []);
  const stopAnimation = useCallback(() => { animation.current++; locked.current = false; setAnimating(false); setFrame(null); setExchange(null); cancelSelection(); }, [cancelSelection]);
  useImperativeHandle(ref, () => ({ openCurrentGame() {
    if (!gameRef.current) return false;
    stopAnimation(); setView("play"); return true;
  } }), [stopAnimation]);
  useEffect(() => () => { animation.current++; }, []);
  useEffect(() => {
    if (!active) { stopAnimation(); setPending(null); setOverwrite(false); }
  }, [active, stopAnimation]);
  useEffect(() => {
    onInGame(active && view === "play" && Boolean(game));
    return () => onInGame(false);
  }, [active, view, game, onInGame]);
  useEffect(() => {
    const storage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== FLOWER_SAVE_KEY) return;
      if (event.storageArea && event.storageArea !== localStorage) return;
      if (event.newValue === raw.current && event.key !== null) return;
      saveGeneration.current++; conflictRef.current = true; setConflict(true); stopAnimation();
    };
    window.addEventListener("storage", storage);
    return () => window.removeEventListener("storage", storage);
  }, [stopAnimation]);
  function persist(next: FlowerSave) {
    saveRef.current = next; setSave(next); setSaving(true);
    const generation = saveGeneration.current;
    writeQueue.current = writeQueue.current.then(async () => {
      if (conflictRef.current || generation !== saveGeneration.current) return;
      try {
        const written = await writeFlowerSave(next, raw.current);
        if (generation !== saveGeneration.current) return;
        raw.current = written; setProblem(null); setCorrupt(false);
        if (saveRef.current === next) setSaving(false);
      }
      catch (reason) {
        if (generation !== saveGeneration.current) return;
        if (saveRef.current === next) setSaving(false);
        if (reason instanceof FlowerSaveConflict) { conflictRef.current = true; setConflict(true); }
        else setProblem("Thiết bị chưa lưu được Vườn Hoa. Bạn vẫn chơi được trên trang này; hãy thử lưu lại trước khi rời.");
      }
    });
    return writeQueue.current;
  }
  function commit(next: FlowerGame) { gameRef.current = next; setGame(next); return persist(recordFlowerGame(saveRef.current, next)); }
  function show(next: "home" | "map") { stopAnimation(); setView(next); if (next === "map") setMapLevel(flowerUnlocked(saveRef.current)); }
  function start(mode: FlowerMode, level: number) {
    if (conflictRef.current) return;
    try {
      const next = createFlowerGame(mode, level, random);
      stopAnimation(); commit(next); setView("play"); setPending(null);
      setNotice("Kéo hoa hồng hàng 3, cột 3 xuống một ô để ghép ba hoa."); setHint([16, 23]);
    } catch { setProblem("Chưa tạo được bàn hoa. Hãy thử bắt đầu lại."); }
  }
  function requestStart(mode: FlowerMode, level = mode === "journey" ? mapLevel : 0) {
    if (conflictRef.current || (mode === "journey" && level > flowerUnlocked(saveRef.current))) return;
    if (saveRef.current[mode]?.status === "playing" || problem) setPending({ mode, level });
    else start(mode, level);
  }
  function resume(mode: FlowerMode) {
    const next = saveRef.current[mode]; if (!next || conflictRef.current) return;
    stopAnimation(); gameRef.current = next; setGame(next); setView("play"); setNotice("Đã mở lại ván trên thiết bị.");
  }
  function reload() {
    saveGeneration.current++; setSaving(false); stopAnimation(); const loaded = readFlowerSave(); raw.current = loaded.raw; saveRef.current = loaded.save;
    setSave(loaded.save); setProblem(loaded.problem); setCorrupt(loaded.corrupt); conflictRef.current = false; setConflict(false);
    gameRef.current = null; setGame(null); setView("home");
  }
  async function play(result: FlowerTurn | null, previous: FlowerGame, pair?: [number, number]) {
    const id = ++animation.current; locked.current = true; setAnimating(true); cancelSelection();
    setFrame(initialFrame(previous));
    // Save the completed turn before effects; leaving or backgrounding cannot lose an accepted swap.
    if (result) await commit(result.game);
    if (id !== animation.current) return;
    if (pair) {
      setExchange({ a: pair[0], b: pair[1], back: false });
      await delay(220); if (id !== animation.current) return;
      if (!result) {
        setExchange({ a: pair[0], b: pair[1], back: true });
        await delay(220); if (id !== animation.current) return;
        setNotice("Chưa tạo hàng 3 hoa. Hoa đã quay về, không mất lượt.");
      }
      setExchange(null);
    }
    if (result) {
      for (const next of result.frames) {
        if (next.kind === "swap") continue;
        setFrame(next);
        if (next.kind === "burst") setNotice(`${next.combo > 1 ? `Combo ×${next.combo}! ` : "Hoa cùng nở! "}${next.indices.length} ô được dọn.`);
        if (next.kind === "unlock") setNotice(`Đã mở ${next.indices.length} ô khóa! Hoa có thể rơi và ghép qua ô vừa mở.`);
        if (next.kind === "shuffle") setNotice("Đã xáo hoa để có nước đi mới, không mất thêm lượt.");
        await delay(next.kind === "burst" ? 300 : 440); if (id !== animation.current) return;
      }
    }
    locked.current = false; setAnimating(false); setFrame(null);
  }
  function swap(a: number, b: number) {
    const current = gameRef.current;
    if (!current || locked.current || conflictRef.current || current.status !== "playing" || !flowerAdjacent(a, b) || current.board[a]!.obstacle || current.board[b]!.obstacle) return;
    try { void play(swapFlower(current, a, b, random), current, [a, b]); }
    catch { setProblem("Chưa thực hiện được nước đi. Bàn hoa được giữ nguyên; hãy thử lại."); }
  }
  function pick(index: number) {
    const current = gameRef.current;
    if (!current || locked.current || conflictRef.current || current.status !== "playing") return;
    if (tool) {
      try {
        const result = useFlowerTool(current, tool, index, random);
        if (result) void play(result, current);
        else setNotice("Chọn một ô hợp lệ để dùng vật phẩm. Bình tưới chỉ dùng trên hoa.");
      } catch { setProblem("Chưa dùng được vật phẩm. Hãy thử lại."); }
      return;
    }
    if (current.board[index]!.obstacle) return;
    if (selected === index) setSelected(null);
    else if (selected !== null && flowerAdjacent(selected, index)) swap(selected, index);
    else { setSelected(index); setHint([]); setNotice("Chọn ô cạnh bên, hoặc kéo hoa để đổi chỗ."); }
  }
  const config = game ? flowerLevel(game) : null;
  const goals = game ? flowerGoals(game) : [];
  const final = game && game.status !== "playing" && !animating;
  const unlocked = flowerUnlocked(save), mapConfig = FLOWER_LEVELS[mapLevel - 1]!;
  return <section className="screen flower-screen">
    <nav className="flower-nav" aria-label="Điều hướng Vườn Hoa">
      <button className="text-button" onClick={onHome}><Icon name="back" />Nhà Chơi</button>
      <div><button className={view === "home" ? "active" : ""} onClick={() => show("home")}>Chọn chế độ</button><button className={view === "map" ? "active" : ""} onClick={() => show("map")}>Hành trình</button>{game && <button className={view === "play" ? "active" : ""} onClick={() => { stopAnimation(); setView("play"); }}>Bàn chơi</button>}</div>
    </nav>
    {conflict && <div className="flower-notice" role="alert"><p>Bản lưu đã thay đổi ở trang khác. Hãy chọn bản muốn tiếp tục.</p><button className="button secondary" onClick={reload}>Tải bản lưu mới</button><button className="text-button" onClick={() => setOverwrite(true)}>Dùng ván trên trang này</button></div>}
    {problem && <div className="flower-notice" role="alert"><p>{problem}</p>{game && !conflict && <button className="text-button" onClick={() => persist(saveRef.current)}>Thử lưu lại</button>}</div>}
    {view === "home" && <>
      <div className="flower-welcome"><div><p className="flower-kicker"><Icon name="spark" />Một khu vườn chờ bạn</p><h1>Đổi chỗ hoa.<br />Nở niềm vui.</h1><p className="flower-copy">Kéo đổi chỗ, ghép ba hoa cùng màu.<br />Để cả khu vườn cùng bừng nở.</p></div>
        <div className="flower-art" aria-hidden="true"><div className="flower-arch" />{([0, 1, 3, 2, 1] as FlowerColor[]).map((color, i) => <div key={i} className={`flower-stem s${i}`}><Flower color={color} /></div>)}<span>Chậm một chút, vui một chút.</span></div></div>
      <div className="flower-modes"><article><Icon name="spark" /><h2>Chơi nhanh</h2><p>Một ván nhỏ, thư giãn ngay.<br />20 lượt để vườn hoa khoe sắc.</p><button className="button secondary full" disabled={conflict} onClick={() => requestStart("quick")}>Chơi một ván<Icon name="arrow" /></button>{save.quick && <button className="text-button full" disabled={conflict} onClick={() => resume("quick")}>Tiếp tục Chơi nhanh</button>}</article>
        <article className="featured"><Icon name="grid" /><h2>Hành trình</h2><p>Qua 12 khu vườn, mở từng thử thách.<br />Mỗi màn là một điều mới.</p><button className="button primary full" onClick={() => show("map")}>Khám phá khu vườn<Icon name="arrow" /></button>{save.journey && <button className="text-button full" disabled={conflict} onClick={() => resume("journey")}>Tiếp tục Hành trình</button>}</article><article className="flower-mystery-card"><span className="flower-mode-lock" aria-hidden="true" /><h2>Vườn khóa bí ẩn</h2><p>Chờ đúng lượt, nổ đúng chỗ.<br />Mỗi ổ khóa là một bất ngờ.</p><button className="button primary full" disabled={conflict} onClick={() => requestStart("mystery")}>Chơi Vườn khóa bí ẩn<Icon name="arrow" /></button>{save.mystery && <button className="text-button full" disabled={conflict} onClick={() => resume("mystery")}>Tiếp tục Vườn khóa bí ẩn</button>}</article></div>
      <div className="flower-home-foot"><span>Tiến độ lưu trên thiết bị</span><button className="text-button" onClick={onRules}>Lần đầu chơi? Xem hướng dẫn</button></div>
    </>}
    {view === "map" && <>
      <div className="flower-map-heading"><div><h1>Hành trình nở hoa</h1><p>Từng bông hoa nhỏ, một khu vườn lớn.</p></div><span aria-label={`${save.levels.reduce((n, l) => n + l.stars, 0)} trên 36 sao`}>★ {save.levels.reduce((n, l) => n + l.stars, 0)} / 36</span></div>
      {save.levels.every(l => l.stars > 0) && <p className="flower-notice" role="status">Cả khu vườn đã nở rộ! Bạn đã hoàn thành 12 màn; hãy chơi lại để nâng sao.</p>}
      <div className="flower-map-layout"><div className="flower-map" role="group" aria-label="Bản đồ 12 màn Vườn Hoa">
        <svg className="flower-map-path" viewBox="0 0 300 450" preserveAspectRatio="none" aria-hidden="true"><path d="M65 400 C25 360 230 385 229 335 S35 310 65 260 S270 250 230 190 S25 180 65 110 S220 100 225 40" /></svg>
        {FLOWER_LEVELS.map((level, i) => { const [x, y] = [[22, 89], [49, 83], [77, 76], [49, 68], [22, 59], [49, 51], [77, 43], [49, 35], [22, 26], [48, 19], [76, 15], [75, 7]][i]!; return <button key={level.id} className={`flower-level${save.levels[i]!.stars ? " complete" : ""}${mapLevel === level.id ? " current" : ""}`} style={{ left: `${x}%`, top: `${y}%` }} disabled={level.id > unlocked} aria-pressed={mapLevel === level.id} aria-label={`Màn ${level.id}, ${level.name}${level.id > unlocked ? ", chưa mở" : ""}`} onClick={() => setMapLevel(level.id)}>{level.id}<span aria-hidden="true">{save.levels[i]!.stars ? "★".repeat(save.levels[i]!.stars) : ""}</span></button>; })}
      </div><div className="flower-map-detail"><p>Khu vườn {mapLevel <= 4 ? "ban mai" : mapLevel <= 8 ? "sau mưa" : "rực rỡ"}</p><div className="flower-map-number">{String(mapLevel).padStart(2, "0")}</div><h2>{mapConfig.name}</h2><ul>{mapConfig.goals.map((g, i) => <li key={i}>{goalLabel(g.kind, g.color)}<strong>{g.target.toLocaleString("vi-VN")}</strong></li>)}<li>Số lượt<strong>{mapConfig.moves}</strong></li><li>Điểm cao nhất<strong>{save.levels[mapLevel - 1]!.score.toLocaleString("vi-VN")}</strong></li></ul><button className="button primary full" disabled={conflict} onClick={() => requestStart("journey", mapLevel)}>Chơi màn {mapLevel}<Icon name="arrow" /></button></div></div>
    </>}
    {view === "play" && game && config && <>
      <div className="flower-play-heading"><div><h1>{game.mode === "quick" ? "Đổi chỗ hoa, nở niềm vui" : config.name}</h1><p>{game.mode === "journey" ? `Màn ${game.level} · Hành trình` : MODE_NAMES[game.mode]} · {config.moves} lượt</p></div><button className="button secondary" onClick={onRules} aria-label="Hướng dẫn Vườn Hoa"><Icon name="book" /></button></div>
      {final && <div className="flower-result" role="status"><div><p className="flower-result-stars" aria-label={`${flowerStars(game)} sao`}>{game.status === "won" ? "★".repeat(flowerStars(game)) : "✿"}</p><h2>{game.status === "won" ? game.mode === "journey" && game.level === 12 ? "Cả khu vườn nở rộ!" : "Khu vườn bừng nở!" : "Hẹn khu vườn lần nữa"}</h2><p>{game.score.toLocaleString("vi-VN")} điểm · {game.movesLeft} lượt còn lại</p></div><div>{game.status === "won" && game.mode === "journey" && game.level < 12 && <button className="button primary" disabled={conflict} onClick={() => requestStart("journey", game.level + 1)}>Chơi màn tiếp</button>}<button className="button secondary" disabled={conflict} onClick={() => requestStart(game.mode, game.level)}>Chơi lại</button><button className="text-button" onClick={() => show(game.mode === "journey" ? "map" : "home")}>{game.mode === "journey" ? "Về bản đồ" : "Chọn chế độ"}</button></div></div>}
      <div className="flower-play-layout"><div className="flower-board-wrap"><div className="flower-board-top"><span>Kéo hoa sang ô bên cạnh.</span><strong>{animating ? "Hoa đang nở…" : "Ghép 3 hoa thành hàng"}</strong></div>
        <FlowerBoard board={frame?.board ?? game.board} grass={frame?.grass ?? game.grass} frame={frame} exchange={exchange} selected={selected} hint={hint} disabled={animating || conflict || game.status !== "playing"} tool={Boolean(tool)} onSelect={pick} onSwap={swap} onCancel={cancelSelection} />
        {frame?.kind === "burst" && <span className="flower-combo" key={`${frame.score}-${frame.combo}`} aria-hidden="true">{frame.combo > 1 ? `Combo ×${frame.combo}!` : "Hoa cùng nở!"}</span>}
        <p className="flower-hint" role="status" aria-live="polite">{notice}</p>{game.mode === "mystery" && <div className="flower-lock-legend"><span><i className="legend-turn" aria-hidden="true">◷</i>Số lượt chờ</span><span><i className="legend-blast" aria-hidden="true">✦</i>Số đợt nổ sát cạnh</span><small>Chỉ nước hợp lệ mới giảm lượt chờ.</small></div>}</div>
        <aside className="flower-play-sidebar"><div className="flower-goal-panel"><div><p>Lượt còn lại</p><div className="flower-moves">{game.movesLeft}</div></div><div><p>Mục tiêu</p>{goals.map((g, i) => <div className="flower-goal" key={i}>{g.kind === "flower" && <Flower color={g.color!} />}<div><strong>{Math.min(g.current, g.target).toLocaleString("vi-VN")} / {g.target.toLocaleString("vi-VN")}</strong><span>{goalLabel(g.kind, g.color)}</span></div></div>)}</div><div><p>Điểm của bạn</p><strong>{(frame?.score ?? game.score).toLocaleString("vi-VN")}</strong><div className="flower-score-track"><span style={{ width: `${Math.min(100, goals.reduce((n, g) => n + Math.min(1, g.current / g.target), 0) / goals.length * 100)}%` }} /></div><span className="flower-star-guide">3 sao: còn ít nhất {Math.ceil(config.moves * .4)} lượt khi thắng</span></div></div>
          {game.mode === "journey" && <div className="flower-tools">{(["shovel", "water"] as const).map(id => <button key={id} className="button secondary" disabled={!game.tools[id] || animating || conflict || game.status !== "playing"} aria-pressed={tool === id} onClick={() => { setTool(tool === id ? null : id); setSelected(null); setNotice(`Chọn ô để dùng ${id === "shovel" ? "Xẻng" : "Bình tưới"}. Escape để hủy.`); }}>{id === "shovel" ? "Xẻng" : "Bình tưới"}<small>{game.tools[id]}</small></button>)}</div>}
          <button className="button secondary flower-hint-button" disabled={animating || conflict || game.status !== "playing"} onClick={() => { const next = flowerHint(game.board); cancelSelection(); if (next) { setHint(next); setNotice(`Đổi hoa hàng ${Math.floor(next[0] / 7) + 1}, cột ${next[0] % 7 + 1} với hàng ${Math.floor(next[1] / 7) + 1}, cột ${next[1] % 7 + 1}.`); } }}>Gợi ý nước đi</button>
          <p className="flower-game-note">Đổi chỗ hai ô cạnh nhau. Ghép 3 hoa theo hàng ngang hoặc dọc.</p><span className="flower-save-label">{problem || conflict ? "Chưa lưu được" : saving ? "Đang lưu…" : "Đã lưu trên thiết bị"}</span></aside></div>
    </>}
    {pending && <Dialog title="Thay thế ván Vườn Hoa?" onClose={() => setPending(null)}><h2>Thay thế ván Vườn Hoa?</h2><p className="dialog-lead">{corrupt ? "Bản lưu không đọc được. Xác nhận sẽ đặt lại toàn bộ tiến độ 12 màn và mọi ván Vườn Hoa trên thiết bị." : `Bắt đầu mới sẽ thay thế ván ${MODE_NAMES[pending.mode]} đã lưu. Tiến độ màn đã hoàn thành được giữ lại.`}</p><button className="button primary full" onClick={() => start(pending.mode, pending.level)}>Bắt đầu ván mới</button><button className="text-button full" onClick={() => setPending(null)}>Giữ ván đã lưu</button></Dialog>}
    {overwrite && <Dialog title="Thay bản lưu từ trang khác?" onClose={() => setOverwrite(false)}><h2>Thay bản lưu từ trang khác?</h2><p className="dialog-lead">Bản lưu hiện tại trên thiết bị sẽ được thay bằng tiến độ đang có ở trang này.</p><button className="button primary full" onClick={() => { try { saveGeneration.current++; raw.current = localStorage.getItem(FLOWER_SAVE_KEY); conflictRef.current = false; setConflict(false); persist(saveRef.current); } catch { setProblem("Không đọc được bản lưu. Hãy thử lại."); } setOverwrite(false); }}>Xác nhận dùng ván này</button><button className="text-button full" onClick={() => setOverwrite(false)}>Hủy</button></Dialog>}
  </section>;
}
