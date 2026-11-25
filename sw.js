/* Service worker : l'appli fonctionne hors ligne (cache de l'interface). */
const CACHE = 'runwow-v2';
const ASSETS = [
  './', './index.html', './css/style.css', './manifest.webmanifest', './icon.svg',
  './js/engine/util.js', './js/engine/paces.js', './js/data/exercises.js', './js/engine/strength.js',
  './js/engine/plan.js', './js/engine/replan.js', './js/engine/rules.js', './js/app.js',
  './js/sync/fit.js', './js/sync/zip.js', './js/sync/strava.js', './js/sync/match.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Réseau d'abord (pour recevoir les mises à jour), cache si hors ligne.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
