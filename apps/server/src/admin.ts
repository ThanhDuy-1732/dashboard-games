import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { promisify } from "node:util";
import { json, readJson } from "./http.js";

const derive = promisify(scrypt);
const sessionAge = 8 * 60 * 60;
export interface AdminOptions {
  origin: string;
  passwordHash: string;
  secure: boolean;
}
export type AdminRoute = (req: IncomingMessage, res: ServerResponse, url: URL, session: string) => Promise<void>;

export function createAdminHandler(options: AdminOptions, route?: AdminRoute) {
  const [salt, hash] = options.passwordHash.split(":");
  if (!salt || !/^[a-f0-9]{32}$/.test(salt) || !hash || !/^[a-f0-9]{128}$/.test(hash)
      || options.passwordHash !== salt + ":" + hash || new URL(options.origin).origin !== options.origin)
    throw new Error("Invalid admin configuration");
  const expected = Buffer.from(hash, "hex");
  const sessions = new Map<string, number>();
  const cookie = options.secure ? "__Host-nha_admin" : "nha_admin_dev";
  const cookieFlags = `; Path=/; HttpOnly; SameSite=Strict${options.secure ? "; Secure" : ""}`;
  let attempts = 0, nextWindow = 0;
  return async (req: IncomingMessage, res: ServerResponse, url: URL) => {
    const post = req.method === "POST";
    if (post && req.headers.origin !== options.origin)
      return json(res, 403, { error: "ORIGIN" });
    const time = Date.now();
    const token = (req.headers.cookie ?? "").split(/;\s*/).find((item) => item.startsWith(cookie + "="))?.slice(cookie.length + 1) ?? "";
    if (post && url.pathname === "/api/admin/login") {
      if (time >= nextWindow) {
        attempts = 0;
        nextWindow = time + 60_000;
      }
      if (++attempts > 10) return json(res, 429, { error: "RATE_LIMITED" });
      const body = await readJson(req, 2048) as { password?: unknown } | null;
      if (typeof body?.password !== "string" || body.password.length > 256)
        return json(res, 400, { error: "LOGIN" });
      const supplied = await derive(body.password, salt, 64) as Buffer;
      if (!timingSafeEqual(supplied, expected)) return json(res, 401, { error: "LOGIN" });
      for (const [id, expires] of sessions) if (expires <= time) sessions.delete(id);
      sessions.delete(token);
      const current = randomBytes(32).toString("base64url");
      sessions.set(current, time + sessionAge * 1000);
      res.setHeader("Set-Cookie", `${cookie}=${current}; Max-Age=${sessionAge}${cookieFlags}`);
      return json(res, 200, { ok: true });
    }
    if ((sessions.get(token) ?? 0) <= time) {
      sessions.delete(token);
      return json(res, 401, { error: "SESSION" });
    }
    if (post && url.pathname === "/api/admin/logout") {
      sessions.delete(token);
      res.setHeader("Set-Cookie", `${cookie}=; Max-Age=0${cookieFlags}`);
      return json(res, 200, { ok: true });
    }
    if (req.method === "GET" && url.pathname === "/api/admin/session")
      return json(res, 200, { ok: true });
    if (route) return route(req, res, url, token);
    json(res, 404, { error: "NOT_FOUND" });
  };
}
