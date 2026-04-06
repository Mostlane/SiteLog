var CACHE = “sitelog-v2”;
var PRECACHE = [
“./app.html”,
“./admin.html”,
“./scan.html”,
“./Mostlane%20Icon.jpeg”,
“./Mostlane%20Logo.jpg”
];

// Install: precache core files
self.addEventListener(“install”, function(e) {
self.skipWaiting();
e.waitUntil(
caches.open(CACHE).then(function(cache) {
return cache.addAll(PRECACHE);
})
);
});

// Activate: delete old caches
self.addEventListener(“activate”, function(e) {
e.waitUntil(
caches.keys().then(function(keys) {
return Promise.all(
keys.filter(function(k) { return k !== CACHE; })
.map(function(k) { return caches.delete(k); })
);
}).then(function() { return self.clients.claim(); })
);
});

// Fetch: network-first for HTML, cache-first for everything else
self.addEventListener(“fetch”, function(e) {
var url = e.request.url;

// Always go network-first for HTML pages so updates come through immediately
if (e.request.mode === “navigate” || url.endsWith(”.html”)) {
e.respondWith(
fetch(e.request).then(function(res) {
var clone = res.clone();
caches.open(CACHE).then(function(cache) { cache.put(e.request, clone); });
return res;
}).catch(function() {
return caches.match(e.request);
})
);
return;
}

// Cache-first for images and other static assets
e.respondWith(
caches.match(e.request).then(function(cached) {
if (cached) return cached;
return fetch(e.request).then(function(res) {
var clone = res.clone();
caches.open(CACHE).then(function(cache) { cache.put(e.request, clone); });
return res;
});
})
);
});
