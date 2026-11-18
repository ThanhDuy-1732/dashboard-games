import { Capacitor } from "@capacitor/core";
export function getPlatform(): "web" | "android" | "ios" {
  const platform = Capacitor.getPlatform();
  return platform === "android" || platform === "ios" ? platform : "web";
}
export const isNative = () => getPlatform() !== "web";
export function onlineServerUrl(
  value = import.meta.env?.VITE_SERVER_URL ?? "",
): string | null {
  if (isNative()) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password
        ? value
        : null;
    } catch {
      return null;
    }
  }
  return (
    value ||
    (typeof location === "undefined"
      ? "http://127.0.0.1:3001"
      : location.origin)
  );
}
