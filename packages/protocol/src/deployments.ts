export type ProviderDeployments =
  | { status: "unconfigured" | "unavailable" }
  | {
      status: "ok";
      latest: { state: string; sha?: string; branch?: string; createdAt?: string } | null;
    };

export interface DeploymentOverview {
  render: ProviderDeployments;
  vercel: ProviderDeployments;
  backend: { sha?: string; branch?: string; nodeVersion: string; cpu: number; uptimeSeconds: number };
}
