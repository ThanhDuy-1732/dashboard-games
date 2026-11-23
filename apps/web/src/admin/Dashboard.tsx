import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { AdminApiError, adminApi } from "./api.js";
import type { MetricRow, Summary } from "./api.js";
import { Deployments } from "./Deployments.js";

const tabs = [
  ["", "Tổng quan"], ["traffic", "Truy cập"], ["games", "Ván chơi"], ["system", "Hệ thống"], ["cleanup", "Dọn dữ liệu"],
] as const;
const number = new Intl.NumberFormat("vi-VN");
const dateTime = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" });
const formatDate = (value: string) => dateTime.format(new Date(value));
function formatBytes(bytes: number) {
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  const unit = Math.min(units.length - 1, Math.floor(Math.log(Math.max(1, bytes)) / Math.log(1024)));
  return `${number.format(Math.round(bytes / 1024 ** unit * 10) / 10)} ${units[unit]}`;
}
const sum = (rows: MetricRow[], kind: string) => rows.reduce((total, row) => total + (row.kind === kind ? row.count : 0), 0);
const gameNames: Record<string, string> = {
  caro: "Caro", "ty-phu": "Cờ tỷ phú", kiln: "Lò Gốm", dino: "Thằn Lằn Núi Lửa",
};
const modeNames: Record<string, string> = {
  online: "Online", bot: "Đấu máy", "same-device": "Hai người cùng thiết bị",
  solo: "Chơi một mình", offline: "Offline (chưa rõ chế độ)",
};
const systems: Record<string, string> = { backend: "Backend", database: "PostgreSQL", device: "Thiết bị" };

export function Dashboard({ onExpired }: { onExpired: () => void }) {
  const segment = location.pathname.replace(/^\/admin\/?/, "").replace(/\/$/, "");
  const [range, setRange] = useState("7d");
  const [summary, setSummary] = useState<Summary>();
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const tab = tabs.find(([key]) => key === segment);
  useEffect(() => {
    if (segment === "cleanup") return;
    let active = true;
    void adminApi<Summary>("summary?range=" + range).then((data) => {
      if (active) setSummary(data);
    }).catch((failure: unknown) => {
      if (!active) return;
      if (failure instanceof AdminApiError && failure.status === 401) onExpired();
      else setError(true);
    });
    return () => { active = false; };
  }, [segment, range, reload, onExpired]);
  function refresh(value = range) {
    setSummary(undefined);
    setError(false);
    setRange(value);
    setReload((prev) => prev + 1);
  }
  return <>
    <nav aria-label="Các trang quản trị" className="admin-nav">
      {tabs.map(([key, name]) => <a key={key} href={key ? "/admin/" + key : "/admin"} aria-current={segment === key ? "page" : undefined}>{name}</a>)}
    </nav>
    <div className="admin-toolbar">
      <h2>{tab?.[1] ?? "Không tìm thấy trang"}</h2>
      {segment !== "cleanup" && tab && <div className="admin-actions">
        <label>Khoảng thời gian <select value={range} onChange={(event) => refresh(event.target.value)}>
          <option value="today">Hôm nay</option><option value="7d">7 ngày</option><option value="30d">30 ngày</option>
        </select></label>
        <button onClick={() => refresh()}>Làm mới</button>
      </div>}
    </div>
    {segment === "system" && <Deployments key={reload} onExpired={onExpired} />}
    {segment === "cleanup" ? <Cleanup onExpired={onExpired} /> : tab && <>
      {error ? <p role="alert">Chưa tải được số liệu. Hãy thử làm mới.</p>
        : !summary ? <p role="status">Đang tải số liệu…</p> : <>
          <p className="admin-muted">Cập nhật {formatDate(summary.updatedAt)} · Giờ Việt Nam</p>
          {!segment && <Overview summary={summary} />}
          {segment === "traffic" && <Traffic summary={summary} />}
          {segment === "games" && <Games summary={summary} />}
          {segment === "system" && <System summary={summary} />}
        </>}
    </>}
  </>;
}
function Stats({ values }: { values: [string, string | number][] }) {
  return <dl className="admin-stats">{values.map(([label, value]) => <div key={label}>
    <dt>{label}</dt><dd>{typeof value === "number" ? number.format(value) : value}</dd>
  </div>)}</dl>;
}
function Overview({ summary }: { summary: Summary }) {
  const deviceP95 = summary.system.latency.find(({ metric }) => metric === "device")?.p95;
  return <>
    <Stats values={[
      ["Lượt xem", sum(summary.traffic.rows, "view")],
      ["Phiên truy cập", sum(summary.traffic.rows, "session_started")],
      ["Ván bắt đầu", sum(summary.games, "game_started")],
      ["Ván hoàn thành", sum(summary.games, "game_completed")],
      ["Dung lượng PostgreSQL", formatBytes(summary.system.bytes)],
      ["Phản hồi thiết bị p95", deviceP95 == null ? "Chưa có mẫu" : `≈ ${number.format(deviceP95)} ms`],
    ]} />
    <PlayBreakdown rows={summary.games} />
    <DayTraffic summary={summary} />
  </>;
}
function DayTraffic({ summary }: { summary: Summary }) {
  const daily = summary.days.map((day) => {
    const rows = summary.traffic.rows.filter((row) => row.day === day);
    return { day, views: sum(rows, "view"), sessions: sum(rows, "session_started") };
  });
  const max = Math.max(1, ...daily.map(({ views }) => views));
  return <div className="admin-table">
    <table><caption>Truy cập theo ngày</caption>
      <thead><tr><th scope="col">Ngày</th><th scope="col">Lượt xem</th><th scope="col">Phiên mới</th></tr></thead>
      <tbody>{daily.map(({ day, views, sessions }) => <tr key={day}>
        <th scope="row">{day}</th><td><span className="admin-bar" aria-hidden="true" style={{ width: `${100 * views / max}%` }} />{number.format(views)}</td><td>{number.format(sessions)}</td>
      </tr>)}</tbody>
    </table>
  </div>;
}
function Traffic({ summary }: { summary: Summary }) {
  const { traffic } = summary;
  return <>
    <Stats values={[["Lượt xem", sum(traffic.rows, "view")], ["Phiên truy cập", sum(traffic.rows, "session_started")], ["Phiên hoạt động trong 5 phút", traffic.active]]} />
    <DayTraffic summary={summary} />
    <div className="admin-table"><table><caption>Truy cập theo nền tảng</caption>
      <thead><tr><th scope="col">Nền tảng</th><th scope="col">Lượt xem</th><th scope="col">Phiên mới</th></tr></thead>
      <tbody>{Object.entries({ web: "Web", pwa: "PWA", android: "Android", ios: "iOS" }).map(([key, label]) => {
        const rows = traffic.rows.filter(({ dimensions }) => dimensions.platform === key);
        return <tr key={key}><th scope="row">{label}</th><td>{number.format(sum(rows, "view"))}</td><td>{number.format(sum(rows, "session_started"))}</td></tr>;
      })}</tbody>
    </table></div>
  </>;
}
function formatDuration(ms: number) {
  const seconds = Math.round(ms / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const remainder = seconds % 60;
  return [hours ? hours + " giờ" : "", minutes ? minutes + " phút" : "", remainder || seconds === 0 ? remainder + " giây" : ""]
    .filter(Boolean).join(" ");
}

function PlayBreakdown({ rows, game = "", mode = "" }: { rows: MetricRow[]; game?: string; mode?: string }) {
  const groups = new Map<string, { game: string; mode: string; started: number; completed: number; ms: number; samples: number }>();
  for (const row of rows) {
    const gameId = String(row.dimensions.game);
    if (!Object.hasOwn(gameNames, gameId)) continue;
    const rawMode = String(row.dimensions.playMode ?? (gameId === "ty-phu" ? "bot" : "offline"));
    const playMode = row.dimensions.mode === "online" ? "online" : Object.hasOwn(modeNames, rawMode) ? rawMode : "offline";
    if ((game && game !== gameId) || (mode && mode !== playMode)) continue;
    const key = gameId + ":" + playMode;
    const group = groups.get(key) ?? { game: gameId, mode: playMode, started: 0, completed: 0, ms: 0, samples: 0 };
    if (row.kind === "game_started") group.started += row.count;
    if (row.kind === "game_completed") {
      group.completed += row.count;
      group.ms += row.durationMs ?? 0;
      group.samples += row.durationSamples ?? 0;
    }
    groups.set(key, group);
  }
  const ranked = [...groups.values()].sort((a, b) => b.started - a.started || b.completed - a.completed);
  return <>
    <div className="admin-table"><table><caption>Ván chơi theo trò và chế độ</caption>
      <thead><tr><th scope="col">Trò chơi</th><th scope="col">Chế độ</th><th scope="col">Bắt đầu</th><th scope="col">Kết thúc</th><th scope="col">Trung bình mỗi ván</th><th scope="col">Tổng thời lượng đo được</th></tr></thead>
      <tbody>{ranked.map((row) => <tr key={row.game + ":" + row.mode}>
        <td>{gameNames[row.game]}</td><td>{modeNames[row.mode]}</td>
        <td>{number.format(row.started)}</td><td>{number.format(row.completed)}</td>
        <td>{row.samples ? <>{formatDuration(row.ms / row.samples)} <span className="admin-muted">({number.format(row.samples)} ván đo được)</span></> : "Chưa có mẫu"}</td>
        <td>{row.samples ? formatDuration(row.ms) : "—"}</td>
      </tr>)}
      {!ranked.length && <tr><td colSpan={6}>Chưa có ván chơi trong khoảng đã chọn.</td></tr>}</tbody>
    </table></div>
    <p className="admin-muted">Thời lượng tính từ lúc bắt đầu đến khi ván kết thúc, kể cả lúc tạm dừng. Ván offline có thể đồng bộ muộn.</p>
  </>;
}

function Games({ summary }: { summary: Summary }) {
  const [game, setGame] = useState("");
  const [mode, setMode] = useState("");
  return <>
    <Stats values={[["Caro online đang diễn ra", summary.ongoing.caro], ["Cờ tỷ phú online đang diễn ra", summary.ongoing["ty-phu"]]]} />
    <div className="admin-actions">
      <label>Trò chơi <select value={game} onChange={(event) => setGame(event.target.value)}>
        <option value="">Tất cả</option>{Object.entries(gameNames).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select></label>
      <label>Chế độ <select value={mode} onChange={(event) => setMode(event.target.value)}>
        <option value="">Tất cả</option>{Object.entries(modeNames).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select></label>
    </div>
    <PlayBreakdown rows={summary.games} game={game} mode={mode} />
  </>;
}
function System({ summary }: { summary: Summary }) {
  const { system } = summary;
  const time = (ms: number | null) => ms === null ? "Chưa có mẫu" : `≈ ${number.format(ms)} ms`;
  return <>
    <Stats values={[["Dung lượng PostgreSQL", formatBytes(system.bytes)], ["RAM backend", formatBytes(system.ramBytes)], ["Mẫu bỏ từ lần khởi chạy backend", summary.droppedMetrics], ["Lô ghi lỗi từ lần khởi chạy backend", summary.metricWriteErrors]]} />
    <div className="admin-table"><table><caption>Độ trễ và lỗi kỹ thuật</caption>
      <thead><tr><th scope="col">Nguồn đo</th><th scope="col">Mẫu</th><th scope="col">p50</th><th scope="col">p95</th><th scope="col">Tỷ lệ lỗi</th></tr></thead>
      <tbody>{system.latency.map((row) => <tr key={row.metric}>
        <th scope="row">{systems[row.metric]}</th><td>{number.format(row.samples)}</td><td>{time(row.p50)}</td><td>{time(row.p95)}</td>
        <td>{row.samples ? number.format(100 * row.errors / row.samples) + "%" : "—"}</td>
      </tr>)}</tbody>
    </table></div>
    <div className="admin-table"><table><caption>Dung lượng theo bảng</caption>
      <thead><tr><th scope="col">Bảng</th><th scope="col">Dung lượng</th><th scope="col">Bản ghi ước tính</th></tr></thead>
      <tbody>{system.tables.map((row) => <tr key={row.name}><th scope="row">{row.name}</th><td>{formatBytes(row.bytes)}</td><td>{number.format(row.estimatedRows)}</td></tr>)}</tbody>
    </table></div>
    <div className="admin-table"><table><caption>Lịch sử dung lượng</caption>
      <thead><tr><th scope="col">Ngày</th><th scope="col">Dung lượng</th></tr></thead>
      <tbody>{summary.days.map((day) => {
        const found = system.storageHistory.find((row) => row.day === day);
        return <tr key={day}><th scope="row">{day}</th><td>{found ? formatBytes(found.bytes) : "Chưa có mẫu"}</td></tr>;
      })}</tbody>
    </table></div>
  </>;
}
const categories = [
  ["traffic", "Truy cập", ["view", "session_started", "activity"]],
  ["games", "Ván chơi", ["game_started", "game_completed"]],
  ["latency", "Hiệu năng", ["latency"]],
] as const;
type Preview = { previewToken: string; count: number; estimatedBytes: number; before: string };
type History = { deleted: number; removedAt: string; before: string; kinds: string[] };

function Cleanup({ onExpired }: { onExpired: () => void }) {
  const lastDay = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(Date.now() - 30 * 86_400_000));
  const [before, setBefore] = useState(lastDay);
  const [group, setGroup] = useState("traffic");
  const [preview, setPreview] = useState<Preview>();
  const [history, setHistory] = useState<History[]>();
  const [historyError, setHistoryError] = useState(false);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void adminApi<History[]>("cleanup").then((rows) => { if (active) { setHistory(rows); setHistoryError(false); } }).catch((failure: unknown) => {
      if (!active) return;
      if (failure instanceof AdminApiError && failure.status === 401) onExpired();
      else setHistoryError(true);
    });
    return () => { active = false; };
  }, [historyRevision, onExpired]);
  function handleError(failure: unknown) {
    if (failure instanceof AdminApiError) {
      if (failure.status === 401) return onExpired();
      if (failure.status === 409) {
        setPreview(undefined);
        return setError("Lượt xem trước đã hết hạn. Hãy xem trước lại.");
      }
      if (failure.status === 400) return setError("Hãy chọn mốc cách hiện tại ít nhất 30 ngày.");
    }
    setError("Yêu cầu chưa hoàn tất. Hãy kiểm tra lịch sử dọn và thử lại.");
  }
  async function showPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    setPreview(undefined);
    try {
      const cutoff = new Date(before + "T00:00:00+07:00").toISOString();
      setPreview(await adminApi<Preview>("cleanup/preview", { before: cutoff, kinds: categories.find(([key]) => key === group)?.[2] }));
    } catch (failure) {
      handleError(failure);
    } finally {
      setBusy(false);
    }
  }
  async function clean() {
    if (busy || !preview?.count) return;
    setBusy(true);
    setError("");
    try {
      const { deleted, remaining } = await adminApi<{ deleted: number; remaining: number }>("cleanup", { previewToken: preview.previewToken });
      setMessage(`Đã xóa ${number.format(deleted)} bản ghi.${remaining ? ` Còn ${number.format(remaining)} bản ghi đủ điều kiện.` : ""}`);
      setPreview(remaining ? { ...preview, count: remaining, estimatedBytes: 0 } : undefined);
    } catch (failure) {
      handleError(failure);
    } finally {
      setHistoryRevision((value) => value + 1);
      setBusy(false);
    }
  }
  return <>
    <p>Chỉ có thể dọn dữ liệu chi tiết quá 30 ngày. Thống kê theo ngày vẫn được giữ.</p>
    <form className="admin-actions" onSubmit={(event) => void showPreview(event)}>
      <label>Nhóm dữ liệu <select disabled={busy} value={group} onChange={(event) => { setGroup(event.target.value); setPreview(undefined); }}>
        {categories.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select></label>
      <label>Trước ngày <input required disabled={busy} type="date" max={lastDay} value={before} onChange={(event) => { setBefore(event.target.value); setPreview(undefined); }} /></label>
      <button disabled={busy}>Xem trước</button>
    </form>
    {preview && <div className="admin-preview">
      <strong>{number.format(preview.count)} bản ghi đủ điều kiện</strong>
      <p>Trước {formatDate(preview.before)}. {preview.estimatedBytes > 0 && `Ước tính ${formatBytes(preview.estimatedBytes)} dữ liệu.`}</p>
      <p className="admin-muted">Dung lượng PostgreSQL có thể chưa giảm ngay sau khi xóa.</p>
      <button type="button" disabled={busy || !preview.count} onClick={() => void clean()}>Xác nhận dọn</button>
    </div>}
    {message && <p role="status">{message}</p>}
    {error && <p role="alert">{error}</p>}
    <h3>Lịch sử dọn</h3>
    {historyError && <p role="alert">Chưa tải được lịch sử dọn.</p>}
    {history?.length === 0 && <p>Chưa có lần dọn nào.</p>}
    {Boolean(history?.length) && <div className="admin-table"><table>
      <thead><tr><th scope="col">Thời điểm dọn</th><th scope="col">Nhóm dữ liệu</th><th scope="col">Xóa dữ liệu trước</th><th scope="col">Bản ghi đã xóa</th></tr></thead>
      <tbody>{history?.map((row, index) => <tr key={row.removedAt + index}>
        <td>{formatDate(row.removedAt)}</td>
        <td>{categories.filter(([, , kinds]) => kinds.some((kind) => row.kinds.includes(kind))).map(([, label]) => label).join(", ")}</td>
        <td>{formatDate(row.before)}</td><td>{number.format(row.deleted)}</td>
      </tr>)}</tbody>
    </table></div>}
  </>;
}
