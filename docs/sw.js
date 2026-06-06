// SiteLog service worker — NO CONTENT CACHING.
// Purpose: keep the app installable as a PWA while guaranteeing that every
// page, asset and API response is fetched fresh from the network on each load.
// Nothing is ever served from a cache, so the app is always up to date.
// (The permanent device ID lives in IndexedDB/localStorage/cookie, not here,
//  and is untouched by this worker.)

var CACHE = "sitelog-v7";

self.addEventListener("install", function(e) {
self.skipWaiting();
});

// Activate: delete EVERY cache left behind by older service worker versions,
// so no stale pages or API responses can survive.
self.addEventListener("activate", function(e) {
e.waitUntil(
caches.keys().then(function(keys) {
return Promise.all(keys.map(function(k) { return caches.delete(k); }));
}).then(function() { return self.clients.claim(); })
);
});

// Fetch: always go to the network. Never read from or write to a cache.
self.addEventListener("fetch", function(e) {
if (e.request.method !== "GET") return; // POST etc. → straight to network
e.respondWith(fetch(e.request));
});
