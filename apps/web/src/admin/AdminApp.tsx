import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Dashboard } from "./Dashboard.js";
import "./admin.css";

export function AdminApp() {
  const [session, setSession] = useState<"loading" | "out" | "in" | "unavailable">("loading");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const expire = useCallback(() => setSession("out"), []);
  useEffect(() => {
    void fetch("/api/admin/session", { cache: "no-store" }).then((res) => {
      setSession(!res.headers.get("Content-Type")?.includes("application/json")
        ? "unavailable" : res.ok ? "in" : res.status === 401 ? "out" : "unavailable");
    }).catch(() => setSession("unavailable"));
  }, []);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = new FormData(event.currentTarget).get("password");
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok && res.headers.get("Content-Type")?.includes("application/json")) setSession("in");
      else setError(res.status === 429 ? "Thử lại sau một phút." : res.status === 401 ? "Mật khẩu không đúng." : "Không kết nối được trang quản trị.");
    } catch {
      setError("Không kết nối được trang quản trị.");
    } finally {
      setBusy(false);
    }
  }
  return <main className="admin-app">
    <h1>Quản trị Nhà Chơi</h1>
    {session === "loading" && <p role="status">Đang kiểm tra phiên đăng nhập…</p>}
    {session === "unavailable" && <p role="alert">Trang quản trị chưa sẵn sàng.</p>}
    {session === "out" && <form onSubmit={(event) => void login(event)}>
      <label>Mật khẩu quản trị <input name="password" type="password" autoComplete="current-password" required maxLength={256} /></label>
      <button disabled={busy}>Đăng nhập</button>
      {error && <p role="alert">{error}</p>}
    </form>}
    {session === "in" && <div className="admin-session"><button onClick={() => {
      void fetch("/api/admin/logout", { method: "POST" })
        .then((res) => { if (res.ok || res.status === 401) setSession("out"); else setError("Chưa thể đăng xuất."); })
        .catch(() => setError("Chưa thể đăng xuất."));
    }}>Đăng xuất</button></div>}
    {session === "in" && <Dashboard onExpired={expire} />}
    {session === "in" && error && <p role="alert">{error}</p>}
  </main>;
}
