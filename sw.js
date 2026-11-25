// Pocket Play service worker: cache-first, everything precached on install.
// Bump VERSION whenever any app file changes, so phones pick up the new files.

const VERSION = 'v6';
const CACHE = `pocket-play-${VERSION}`;

// Paths are relative to this file, so the app works from any subpath (e.g. /pocket-play/).
const PRECACHE = [
  './',
  'index.html',
  'manifest.json',
  'css/app.css',
  'js/app.js',
  'js/audio.js',
  'js/registry.js',
  'js/characters.js',
  'js/picker.js',
  'games/dots/dots.js',
  'games/dots/dots.css',
  'games/dots/themes.js',
  'games/kart/kart.js',
  'games/kart/kart.css',
  'games/kart/track.js',
  'games/diner/diner.js',
  'games/diner/diner.css',
  'games/diner/menu.js',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // cache: 'reload' skips the HTTP cache so a new version never precaches stale files.
      .then((cache) => cache.addAll(PRECACHE.map((p) => new Request(p, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('pocket-play-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // the app never makes cross-origin requests

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Page navigations (any URL inside the app) get the app shell.
    if (req.mode === 'navigate') {
      const shell = await cache.match('index.html') || await cache.match('./');
      if (shell) return shell;
    }
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      return await fetch(req);
    } catch (err) {
      return new Response('', { status: 504, statusText: 'Offline' });
    }
  })());
});
