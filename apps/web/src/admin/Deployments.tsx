import { useEffect, useState } from "react";
import type { DeploymentOverview, ProviderDeployments } from "@nha-choi/protocol";
import { AdminApiError, adminApi } from "./api.js";

declare const __FRONTEND_DEPLOY__: { sha?: string; branch?: string; environment?: string; builtAt: string };
const build = __FRONTEND_DEPLOY__;
const states: Record<string, string> = {
  created: "Đã tạo", queued: "Đang chờ", INITIALIZING: "Đang chuẩn bị", QUEUED: "Đang chờ",
  BUILDING: "Đang build", build_in_progress: "Đang build", update_in_progress: "Đang triển khai",
  pre_deploy_in_progress: "Đang chuẩn bị triển khai", live: "Đang phục vụ", READY: "Build thành công",
  ERROR: "Triển khai thất bại", build_failed: "Build thất bại", update_failed: "Triển khai thất bại",
  pre_deploy_failed: "Chuẩn bị triển khai thất bại", canceled: "Đã hủy", CANCELED: "Đã hủy",
  BLOCKED: "Bị chặn", deactivated: "Đã ngừng phục vụ",
};
const dateTime = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short",
});
const formatDate = (value: string) => dateTime.format(new Date(value));
type Health = "checking" | "up" | "down";
function healthLabel(state: Health) {
  return state === "up" ? "Đang phản hồi" : state === "down" ? "Không phản hồi hoặc chưa sẵn sàng" : "Đang kiểm tra…";
}
async function probe(url: string, backend = false): Promise<Health> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    return response.ok && (!backend || (await response.json()).ok === true) ? "up" : "down";
  } catch {
    return "down";
  } finally {
    clearTimeout(timer);
  }
}
function Commit({ sha }: { sha?: string }) {
  return sha ? <code title={sha}>{sha.slice(0, 12)}</code> : <>Chưa có thông tin</>;
}
function Latest({ value, variable }: { value?: ProviderDeployments; variable: string }) {
  if (!value) return <>Chưa đọc được trạng thái triển khai</>;
  if (value.status === "unconfigured") return <>Chưa cấu hình API {variable}</>;
  if (value.status !== "ok") return <>Không đọc được dữ liệu từ nhà cung cấp</>;
  if (!value.latest) return <>Chưa có bản triển khai</>;
  const { state, sha, branch, createdAt } = value.latest;
  return <>
    <strong>{(Object.hasOwn(states, state) && states[state]) || "Trạng thái chưa xác định"}</strong>
    {" · "}<Commit sha={sha} />{branch && <> · {branch}</>}
    {createdAt && <> · {formatDate(createdAt)}</>}
  </>;
}

export function Deployments({ onExpired }: { onExpired: () => void }) {
  const [details, setDetails] = useState<DeploymentOverview>();
  const [render, setRender] = useState<Health>("checking");
  const [vercel, setVercel] = useState<Health>("checking");
  useEffect(() => {
    let active = true;
    void probe("/api/health", true).then((health) => { if (active) setRender(health); });
    void probe("/admin").then((health) => { if (active) setVercel(health); });
    void adminApi<DeploymentOverview>("deployments").then((data) => {
      if (active) setDetails(data);
    }).catch((error: unknown) => {
      if (!active) return;
      if (error instanceof AdminApiError && error.status === 401) onExpired();
      else setDetails(undefined);
    });
    return () => { active = false; };
  }, [onExpired]);

  const backend = details?.backend;
  return <div className="admin-table"><table>
    <caption>Triển khai và trạng thái máy chủ</caption>
    <thead><tr><th scope="col">Dịch vụ</th><th scope="col">Kết nối</th><th scope="col">Bản đang chạy</th><th scope="col">Triển khai gần nhất</th></tr></thead>
    <tbody>
      <tr>
        <th scope="row">Render</th>
        <td>{healthLabel(render)}</td>
        <td>
          <Commit sha={backend?.sha} />{backend?.branch && <> · {backend.branch}</>}
          {backend && <div>Node {backend.nodeVersion} · CPU khả dụng {backend.cpu} · Uptime {Math.floor(backend.uptimeSeconds / 60)} phút</div>}
        </td>
        <td><Latest value={details?.render} variable="Render" /></td>
      </tr>
      <tr>
        <th scope="row">Vercel</th>
        <td>{healthLabel(vercel)}</td>
        <td>
          <Commit sha={build.sha} />{build.branch && <> · {build.branch}</>}
          <div>{build.environment ? build.environment + " · " : ""}Bản web đang mở · Build {formatDate(build.builtAt)}</div>
        </td>
        <td><Latest value={details?.vercel} variable="Vercel" /></td>
      </tr>
    </tbody>
  </table></div>;
}
