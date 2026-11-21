/// <reference lib="webworker" />
import { setCacheNameDetails } from "workbox-core";
import { addRoute, createHandlerBoundToURL, precache } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: { url: string; revision: string | null }[];
};
declare const __BUILD_ID__: string;
// shortcut: retain previous caches for tabs on older builds; add client-aware pruning if storage use grows.
setCacheNameDetails({ prefix: "nha-choi", suffix: __BUILD_ID__ });
precache(self.__WB_MANIFEST);
const offlineNavigation = createHandlerBoundToURL("/index.html");
registerRoute(
  new NavigationRoute(async (options) => {
    const latest = await fetch(new URL("/index.html", self.location.origin), {
      cache: "no-cache",
    }).catch(() => undefined);
    return latest?.ok ? latest : offlineNavigation(options);
  }, {
    denylist: [/^\/(?:admin|api)(?:\/|$)/, /^\/socket\.io(?:\/|$)/],
  }),
);
addRoute();
registerRoute(
  ({ url, request }) =>
    url.origin === self.location.origin &&
    ["script", "style"].includes(request.destination),
  async ({ request }) => (await caches.match(request)) ?? fetch(request),
);
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") event.waitUntil(self.skipWaiting());
});
