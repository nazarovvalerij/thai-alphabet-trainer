// Service worker: network-first — при наличии сети всегда берём свежую версию и обновляем кеш,
// офлайн — отдаём из кеша. (Раньше был cache-first, из-за чего обновления не подхватывались.)
const CACHE = "thai-trainer-v8";
const ASSETS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/app.js",
  "./js/template.js",
  "./js/pointer.js",
  "./js/srs.js",
  "./js/audio.js",
  "./js/data/consonants.js",
  "./js/data/vowels.js",
  "./lib/opentype.min.js",
  "./fonts/NotoSansThaiLooped-Regular.ttf",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return resp;
      })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match("./index.html")))
  );
});
