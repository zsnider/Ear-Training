const CACHE_NAME = 'freq-hunter-v1';
const CORE_ASSETS = ['./', './index.html', './manifest.json',
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap'];
const SAMPLE_ASSETS = [
  './samples/CLAP_DEEP_001.wav','./samples/CLAP_DEEP_002.wav','./samples/CLAP_DEEP_003.wav',
  './samples/CLAP_DEEP_004.wav','./samples/CLAP_DEEP_005.wav',
  './samples/CLAP_LAYER_001.wav','./samples/CLAP_LAYER_002.wav','./samples/CLAP_LAYER_003.wav','./samples/CLAP_LAYER_004.wav',
  './samples/SNARE_DEEP_001.wav','./samples/SNARE_DEEP_002.wav','./samples/SNARE_DEEP_003.wav',
  './samples/SNARE_DEEP_004.wav','./samples/SNARE_DEEP_005.wav','./samples/SNARE_DEEP_006.wav',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c =>
    c.addAll(CORE_ASSETS).then(() =>
      Promise.allSettled(SAMPLE_ASSETS.map(u => c.add(u).catch(()=>{})))
    )
  ));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if (e.request.method!=='GET') return;
  e.respondWith(caches.match(e.request).then(cached => {
    if (cached) return cached;
    return fetch(e.request).then(r => {
      if (!r||r.status!==200||(r.type!=='basic'&&r.type!=='cors')) return r;
      caches.open(CACHE_NAME).then(c=>c.put(e.request,r.clone()));
      return r;
    }).catch(()=>{ if(e.request.mode==='navigate') return caches.match('./index.html'); });
  }));
});
