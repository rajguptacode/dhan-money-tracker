/* Dhan service worker — offline app shell.
   Versioned cache; navigation is network-first with an offline shell fallback. */
const CACHE = "dhan-shell-v5";

const APP_SHELL = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "assets/css/styles.css",
  "assets/js/core.js",
  "assets/js/charts.js",
  "assets/js/ui.js",
  "assets/js/modals.js",
  "assets/js/views-dashboard.js",
  "assets/js/views-activity.js",
  "assets/js/views-accounts.js",
  "assets/js/views-plan.js",
  "assets/js/views-tax.js",
  "assets/js/views-reports.js",
  "assets/js/views-settings.js",
  "assets/js/app.js",
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
      fetch(request)
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
      const network = fetch(request)
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
