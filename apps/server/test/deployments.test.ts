import { expect, it, vi } from "vitest";
import { readDeployments } from "../src/deployments.js";

it("reports production builds independently and does not expose provider tokens or response bodies", async () => {
  const request = vi.fn<typeof fetch>();
  request.mockImplementation(async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "api.render.com") {
      return Response.json([{ deploy: { status: "build_in_progress", commit: { id: "b".repeat(40) } } }]);
    }
    expect(url.pathname).toBe("/v7/deployments");
    expect(url.searchParams.get("target")).toBe("production");
    expect(url.searchParams.get("teamId")).toBe("team_test");
    return Response.json({ deployments: [{ readyState: "ERROR", meta: { githubCommitSha: "c".repeat(40), githubCommitRef: "main" } }] });
  });
  const environment = { RENDER_API_KEY: "render-fixture", RENDER_SERVICE_ID: "srv-test",
    VERCEL_API_TOKEN: "vercel-fixture", VERCEL_PROJECT_ID: "prj_test", VERCEL_TEAM_ID: "team_test" };
  const result = await readDeployments(environment, request);
  expect(result.render).toMatchObject({ status: "ok", latest: { state: "build_in_progress", sha: "b".repeat(40) } });
  expect(result.vercel).toMatchObject({ status: "ok", latest: { state: "ERROR", sha: "c".repeat(40), branch: "main" } });
  expect(JSON.stringify(result)).not.toContain("-fixture");
  expect(request.mock.calls[0]?.[1]).toMatchObject({ redirect: "error", headers: { Authorization: "Bearer render-fixture" } });
  request.mockRejectedValue(new Error("private provider response"));
  const partial = await readDeployments({ RENDER_API_KEY: "render-fixture", RENDER_SERVICE_ID: "srv-test" }, request);
  expect(partial).toEqual({ render: { status: "unavailable" }, vercel: { status: "unconfigured" } });
});
