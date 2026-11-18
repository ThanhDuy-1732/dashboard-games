import type { CapacitorConfig } from "@capacitor/cli";
const config: CapacitorConfig = {
  appId: "dev.nhachoi.app",
  appName: "Nhà Chơi",
  webDir: "../web/dist-native",
  ios: { contentInset: "automatic" },
  android: { allowMixedContent: false },
};
export default config;
