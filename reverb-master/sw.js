// ── Reverb Master Service Worker ─────────────────────────────────────────────
// Bump CACHE_NAME when you deploy updates or add new samples.
const CACHE_NAME = 'reverb-master-v1';

const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap'
];

// Audio samples — add filenames here when you add new ones to samples/
const SAMPLE_ASSETS = [
  './samples/CLAP_DEEP_001.wav',
  './samples/CLAP_DEEP_002.wav',
  './samples/CLAP_DEEP_003.wav',
  './samples/CLAP_DEEP_004.wav',
  './samples/CLAP_DEEP_005.wav',
  './samples/CLAP_LAYER_001.wav',
  './samples/CLAP_LAYER_002.wav',
  './samples/CLAP_LAYER_003.wav',
  './samples/CLAP_LAYER_004.wav',
  './samples/SNARE_DEEP_001.wav',
  './samples/SNARE_DEEP_002.wav',
  './samples/SNARE_DEEP_003.wav',
  './samples/SNARE_DEEP_004.wav',
  './samples/SNARE_DEEP_005.wav',
  './samples/SNARE_DEEP_006.wav',
];

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache core assets first (required), then samples (best-effort)
      return cache.addAll(CORE_ASSETS).then(() => {
        return Promise.allSettled(
          SAMPLE_ASSETS.map(url => cache.add(url).catch(e => console.warn('Cache miss:', url, e)))
        );
      });
    })
  );
  self.skipWaiting();
});

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        if (
          !response ||
          response.status !== 200 ||
          (response.type !== 'basic' && response.type !== 'cors')
        ) {
          return response;
        }
        const toCache = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
        return response;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
