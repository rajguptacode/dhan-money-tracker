/* Dhan service worker — offline app shell.
   Versioned cache; navigation is network-first with an offline shell fallback.
   Bump CACHE when the shell/fetch logic changes; bump the ?v= query in
   index.html when the CSS or JS changes. */
const CACHE = "dhan-shell-v9";

const APP_SHELL = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "assets/css/styles.css?v=8",
  "assets/js/core.js?v=7",
  "assets/js/charts.js?v=7",
  "assets/js/ui.js?v=7",
  "assets/js/modals.js?v=7",
  "assets/js/views-dashboard.js?v=7",
  "assets/js/views-activity.js?v=7",
  "assets/js/views-accounts.js?v=7",
  "assets/js/views-plan.js?v=7",
  "assets/js/views-tax.js?v=7",
  "assets/js/views-reports.js?v=7",
  "assets/js/views-settings.js?v=7",
  "assets/js/app.js?v=7",
  "assets/fonts/fraunces-latin.woff2",
  "assets/fonts/hanken-grotesk-latin.woff2",
  "assets/fonts/ibm-plex-mono-400.woff2",
  "assets/fonts/ibm-plex-mono-500.woff2",
  "assets/fonts/ibm-plex-mono-600.woff2",
  "assets/icons/icon.svg",
  "assets/icons/favicon-32.png",
  "assets/icons/apple-touch-icon.png",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // App pages: try the network first so published updates appear, fall back
  // to the cached shell when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-store" })
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put("index.html", copy));
          return response;
        })
        .catch(() =>
          caches.match("index.html").then((cached) => cached || caches.match("./"))
        )
    );
    return;
  }

  // Static assets: serve from cache immediately, refresh in the background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request, { cache: "reload" })
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
