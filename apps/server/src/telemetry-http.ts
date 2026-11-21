import type { IncomingMessage, ServerResponse } from "node:http";
import { telemetryEventSchema } from "@nha-choi/protocol";
import { z } from "zod";
import { json, readJson } from "./http.js";
import type { MetricWriter } from "./metrics.js";

const batch = z.strictObject({ events: z.array(telemetryEventSchema).min(1).max(50) });

export async function ingestTelemetry(req: IncomingMessage, res: ServerResponse, origins: string[], allowed: () => boolean, metrics?: MetricWriter) {
  const origin = req.headers.origin;
  if (!origin || !origins.includes(origin)) return json(res, 403, { error: "ORIGIN" });
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Methods": "POST",
      "Access-Control-Allow-Headers": "Content-Type",
    }).end();
    return;
  }
  if (req.method !== "POST") return json(res, 405, { error: "METHOD" });
  if (!metrics) return json(res, 503, { error: "METRICS_UNAVAILABLE" });
  if (!allowed()) return json(res, 429, { error: "RATE_LIMITED" });
  const parsed = batch.safeParse(await readJson(req, 32_768));
  if (!parsed.success || parsed.data.events.some((event) =>
    ("mode" in event && event.mode !== "offline") ||
    (event.kind === "latency" && event.metric !== "device")))
    return json(res, 400, { error: "EVENTS" });
  try {
    json(res, 200, await metrics.record("device", parsed.data.events));
  } catch {
    json(res, 503, { error: "METRICS_UNAVAILABLE" });
  }
}
