var CACHE = "sitelog-v6";
var PRECACHE = [
"./app.html",
"./admin.html",
"./scan.html",
"./Mostlane%20Icon.jpeg",
"./Mostlane%20Logo.jpg"
];

// Install: precache core files
self.addEventListener("install", function(e) {
self.skipWaiting();
e.waitUntil(
caches.open(CACHE).then(function(cache) {
return cache.addAll(PRECACHE);
})
);
});

// Activate: delete old caches (also purges any stale API responses
// cached by previous versions of this service worker)
self.addEventListener("activate", function(e) {
e.waitUntil(
caches.keys().then(function(keys) {
return Promise.all(
keys.filter(function(k) { return k !== CACHE; })
.map(function(k) { return caches.delete(k); })
);
}).then(function() { return self.clients.claim(); })
);
});

// Fetch strategy:
//   - Only handle same-origin GET requests for static assets.
//   - NEVER intercept API calls (cross-origin worker) or non-GET requests,
//     so live data (companies, sites, engineers, visits) is always fresh.
self.addEventListener("fetch", function(e) {
var req = e.request;

// Let non-GET requests (POST etc.) and cross-origin requests
// (the API on sitelog-api.*.workers.dev) go straight to the network.
if (req.method !== "GET") return;
if (new URL(req.url).origin !== self.location.origin) return;

var url = req.url;

// Network-first for HTML pages so updates come through immediately.
if (req.mode === "navigate" || url.endsWith(".html")) {
e.respondWith(
fetch(req).then(function(res) {
var clone = res.clone();
caches.open(CACHE).then(function(cache) { cache.put(req, clone); });
return res;
}).catch(function() {
return caches.match(req);
})
);
return;
}

// Cache-first for same-origin static assets (images, fonts, etc.).
e.respondWith(
caches.match(req).then(function(cached) {
if (cached) return cached;
return fetch(req).then(function(res) {
var clone = res.clone();
caches.open(CACHE).then(function(cache) { cache.put(req, clone); });
return res;
});
})
);
});
