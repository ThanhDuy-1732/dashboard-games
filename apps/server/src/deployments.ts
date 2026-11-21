import type { ProviderDeployments } from "@nha-choi/protocol";
import { z } from "zod";

const sha = z.string().regex(/^[a-f0-9]{40}$/i).optional().catch(undefined);
const timestamp = z.iso.datetime({ offset: true }).optional().catch(undefined);
const renderResult = z.array(z.object({ deploy: z.object({
  status: z.string(),
  commit: z.object({ id: sha }).nullish(),
  createdAt: timestamp,
}) }));
const vercelResult = z.object({ deployments: z.array(z.object({
  readyState: z.string().optional(),
  state: z.string().optional(),
  created: z.number().int().min(0).max(8.64e15).optional().catch(undefined),
  meta: z.object({
    githubCommitSha: sha,
    githubCommitRef: z.string().max(250).optional().catch(undefined),
  }).optional().catch(undefined),
})) });

export async function readDeployments(env: NodeJS.ProcessEnv, request = fetch) {
  const renderId = env.RENDER_SERVICE_ID;
  const projectId = env.VERCEL_PROJECT_ID;
  async function read<T>(
    url: URL | undefined, token: string | undefined, schema: z.ZodType<T>,
    latest: (value: T) => Extract<ProviderDeployments, { status: "ok" }>["latest"],
  ): Promise<ProviderDeployments> {
    if (!url || !token) return { status: "unconfigured" };
    try {
      const res = await request(url, {
        headers: { Authorization: `Bearer ${token}` },
        redirect: "error",
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) return { status: "ok", latest: latest(schema.parse(await res.json())) };
    } catch {
      // Keep provider failures separate from application health.
    }
    return { status: "unavailable" };
  }

  const renderUrl = renderId && /^srv-[a-z0-9-]+$/i.test(renderId)
    ? new URL(`https://api.render.com/v1/services/${renderId}/deploys?limit=1`) : undefined;
  const vercelUrl = projectId ? new URL("https://api.vercel.com/v7/deployments") : undefined;
  if (vercelUrl && projectId) {
    vercelUrl.searchParams.set("projectId", projectId);
    vercelUrl.searchParams.set("target", "production");
    vercelUrl.searchParams.set("limit", "1");
    if (env.VERCEL_TEAM_ID) vercelUrl.searchParams.set("teamId", env.VERCEL_TEAM_ID);
  }
  const [render, vercel] = await Promise.all([
    read(renderUrl, env.RENDER_API_KEY, renderResult, ([row]) => row ? {
      state: row.deploy.status, sha: row.deploy.commit?.id, createdAt: row.deploy.createdAt,
    } : null),
    read(vercelUrl, env.VERCEL_API_TOKEN, vercelResult, ({ deployments: [row] }) => row ? {
      state: row.readyState ?? row.state ?? "unknown",
      sha: row.meta?.githubCommitSha, branch: row.meta?.githubCommitRef,
      createdAt: row.created === undefined ? undefined : new Date(row.created).toISOString(),
    } : null),
  ]);
  return { render, vercel };
}
