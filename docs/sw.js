const CACHE = “sitelog-v1”;
const SHELL = [
“/SiteLog/app.html”,
“/SiteLog/manifest.json”,
“/SiteLog/Mostlane Logo.jpg”
];

self.addEventListener(“install”, function(e) {
e.waitUntil(
caches.open(CACHE).then(function(cache) {
return cache.addAll(SHELL);
})
);
self.skipWaiting();
});

self.addEventListener(“activate”, function(e) {
e.waitUntil(
caches.keys().then(function(keys) {
return Promise.all(
keys.filter(function(k) { return k !== CACHE; })
.map(function(k)   { return caches.delete(k); })
);
})
);
self.clients.claim();
});

self.addEventListener(“fetch”, function(e) {
const url = new URL(e.request.url);

// Always go network-first for API calls
if (url.hostname.includes(“workers.dev”) ||
url.hostname.includes(“googleapis.com”) ||
url.hostname.includes(“google.com”)) {
e.respondWith(fetch(e.request).catch(function() {
return new Response(JSON.stringify({ ok: false, error: “offline” }), {
headers: { “Content-Type”: “application/json” }
});
}));
return;
}

// Cache-first for app shell assets
e.respondWith(
caches.match(e.request).then(function(cached) {
return cached || fetch(e.request).then(function(response) {
if (response && response.status === 200 && response.type === “basic”) {
var clone = response.clone();
caches.open(CACHE).then(function(cache) {
cache.put(e.request, clone);
});
}
return response;
});
}).catch(function() {
return caches.match(”/SiteLog/app.html”);
})
);
});
