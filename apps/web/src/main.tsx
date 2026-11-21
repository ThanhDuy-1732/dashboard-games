import "./compat.js";
import { createRoot } from "react-dom/client";
import { lazy, Suspense } from "react";
import { isNative } from "./platform.js";
import { App } from "./App.js";
import "./styles.css";
const AdminApp = lazy(() => import("./admin/AdminApp.js").then(({ AdminApp }) => ({ default: AdminApp })));
createRoot(document.getElementById("root")!).render(
  !isNative() && /^\/admin(?:\/|$)/.test(location.pathname)
    ? <Suspense fallback={<p role="status">Đang tải trang quản trị…</p>}><AdminApp /></Suspense>
    : <App />,
);
