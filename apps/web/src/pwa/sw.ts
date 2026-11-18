/// <reference lib="webworker" />
import { setCacheNameDetails } from "workbox-core";
import { precacheAndRoute, createHandlerBoundToURL } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: { url: string; revision: string | null }[];
};
declare const __BUILD_ID__: string;
// shortcut: retain previous caches for tabs on older builds; add client-aware pruning if storage use grows.
setCacheNameDetails({ prefix: "nha-choi", suffix: __BUILD_ID__ });
precacheAndRoute(self.__WB_MANIFEST);
registerRoute(
  new NavigationRoute(createHandlerBoundToURL("/index.html"), {
    denylist: [/^\/socket\.io(?:\/|$)/],
  }),
);
registerRoute(
  ({ url, request }) =>
    url.origin === self.location.origin &&
    ["script", "style"].includes(request.destination),
  async ({ request }) => (await caches.match(request)) ?? fetch(request),
);
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") void self.skipWaiting();
});
