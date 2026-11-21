import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { promisify } from "node:util";
import { z } from "zod";
import { cleanupFilter } from "./metrics-cleanup.js";
import type { MetricWriter } from "./metrics.js";
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

export function createCleanupHandler(metrics?: MetricWriter) {
  const previews = new Map<string, { filter: z.infer<typeof cleanupFilter>; session: string; expires: number }>();
  return async (req: IncomingMessage, res: ServerResponse, url: URL, session: string): Promise<boolean> => {
    if (!["/api/admin/cleanup", "/api/admin/cleanup/preview"].includes(url.pathname)) return false;
    const respond = (status: number, data: unknown) => {
      json(res, status, data);
      return true;
    };
    if (!metrics?.preview || !metrics.cleanup || !metrics.cleanupHistory)
      return respond(503, { error: "METRICS_UNAVAILABLE" });
    const time = Date.now();
    for (const [key, preview] of previews) if (preview.expires <= time) previews.delete(key);
    if (req.method === "POST" && url.pathname.endsWith("/preview")) {
      if (previews.size >= 100) return respond(429, { error: "RATE_LIMITED" });
      const filter = cleanupFilter.safeParse(await readJson(req, 2048));
      if (!filter.success) return respond(400, { error: "FILTER" });
      const preview = await metrics.preview(filter.data);
      if (!preview) return respond(400, { error: "RETENTION" });
      const previewToken = randomBytes(32).toString("base64url");
      previews.set(previewToken, { filter: filter.data, session, expires: time + 600_000 });
      return respond(200, { ...preview, previewToken, before: filter.data.before });
    }
    if (url.pathname.endsWith("/preview")) return respond(405, { error: "METHOD" });
    if (req.method === "GET") return respond(200, await metrics.cleanupHistory());
    if (req.method !== "POST") return respond(405, { error: "METHOD" });
    const request = z.strictObject({ previewToken: z.string().length(43) }).safeParse(await readJson(req, 2048));
    if (!request.success) return respond(400, { error: "TOKEN" });
    const { previewToken } = request.data;
    const preview = previews.get(previewToken);
    if (!preview || preview.session !== session) return respond(409, { error: "PREVIEW_EXPIRED" });
    const result = await metrics.cleanup(preview.filter);
    if (!result.remaining) previews.delete(previewToken);
    return respond(200, result);
  };
}
