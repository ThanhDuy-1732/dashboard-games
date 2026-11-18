import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
const native = process.env.NATIVE_BUILD === "1";
const proxy = {
  "/socket.io": {
    target: process.env.BACKEND_PROXY_URL || "http://127.0.0.1:3001",
    ws: true,
  },
};
export default defineConfig({
  server: { proxy },
  preview: { proxy },
  define: { __BUILD_ID__: JSON.stringify(Date.now().toString()) },
  build: { outDir: native ? "dist-native" : "dist", target:["safari15","chrome100"] },
  plugins: [
    VitePWA({
      disable: native,
      strategies: "injectManifest",
      srcDir: "src/pwa",
      filename: "sw.ts",
      injectRegister: false,
      registerType: "prompt",
      injectManifest: {
        globPatterns: [
          "**/*.{html,js,css,jpg,jpeg,png,svg,json,webp,woff2,txt,webmanifest}",
        ],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      manifest: {
        name: "Nhà Chơi — Cờ tỷ phú",
        short_name: "Nhà Chơi",
        description:
          "Góc nhỏ, cuộc vui lớn. Chơi Cờ tỷ phú cùng bạn bè hoặc với máy.",
        lang: "vi",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#f7f8f2",
        theme_color: "#135b43",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
});
