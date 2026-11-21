import "./compat.js";
import { createRoot } from "react-dom/client";
import { AdminApp } from "./admin/AdminApp.js";
import { App } from "./App.js";
import "./styles.css";
createRoot(document.getElementById("root")!).render(/^\/admin(?:\/|$)/.test(location.pathname) ? <AdminApp /> : <App />);
