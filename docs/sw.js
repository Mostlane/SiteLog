// SiteLog service worker — NETWORK-FIRST with offline fallback.
// Online, every page/asset is fetched fresh from the network (so the app is
// always up to date). The successful response is also tucked into a cache, so
// when the device has NO signal the last-known app shell can still load — which
// is what lets sign-in/out be captured offline and synced later.
//
// POST and other non-GET requests (e.g. /scan, /sync-event, /confirm-checkin)
// always go straight to the network and are never cached.
// The permanent device ID lives in IndexedDB/localStorage/cookie, untouched here.

var CACHE = "sitelog-v10";
var SHELL = ["./app.html", "./index.html", "./scan.html"];

self.addEventListener("install", function(e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function(c) {
      // Cache each individually so one missing file can't abort the whole install.
      return Promise.all(SHELL.map(function(u) { return c.add(u).catch(function() {}); }));
    })
  );
});

// Activate: drop every cache except the current version, then take control.
self.addEventListener("activate", function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(k) { if (k !== CACHE) return caches.delete(k); }));
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(e) {
  var req = e.request;
  if (req.method !== "GET") return; // POST etc. → network, never cached

  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return; // cross-origin (fonts/maps) → default

  // Network-first: try the network, refresh the cache, fall back to cache offline.
  e.respondWith(
    fetch(req).then(function(resp) {
      if (resp && resp.ok) {
        var copy = resp.clone();
        caches.open(CACHE).then(function(c) { c.put(req, copy); });
      }
      return resp;
    }).catch(function() {
      return caches.match(req).then(function(cached) {
        return cached || caches.match("./app.html") || caches.match("./index.html");
      });
    })
  );
});
