const CACHE_NAME = 'quick-compress-v2';
const CORE = ['./', './index.html', './manifest.json',
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap'];
const SAMPLES = [
  '../../samples/one-shots/CLAP_DEEP_001.wav',
  '../../samples/one-shots/CLAP_DEEP_002.wav',
  '../../samples/one-shots/CLAP_DEEP_003.wav',
  '../../samples/one-shots/CLAP_DEEP_004.wav',
  '../../samples/one-shots/CLAP_DEEP_005.wav',
  '../../samples/one-shots/CLAP_LAYER_001.wav',
  '../../samples/one-shots/CLAP_LAYER_002.wav',
  '../../samples/one-shots/CLAP_LAYER_003.wav',
  '../../samples/one-shots/CLAP_LAYER_004.wav',
  '../../samples/one-shots/SNARE_DEEP_001.wav',
  '../../samples/one-shots/SNARE_DEEP_002.wav',
  '../../samples/one-shots/SNARE_DEEP_003.wav',
  '../../samples/one-shots/SNARE_DEEP_004.wav',
  '../../samples/one-shots/SNARE_DEEP_005.wav',
  '../../samples/one-shots/SNARE_DEEP_006.wav',
  '../../samples/loops/tunetank-soft-house-music-348241.mp3',
  '../../samples/loops/cyberwave-orchestra-orchestral-music-loop-287416.mp3',
  '../../samples/loops/mkgomez-minimal-techno-background-loop-475852.mp3',
  '../../samples/loops/nastelbom-lounge-house-314576.mp3',
  '../../samples/loops/ohpalmusic-passive-hip-hop-beat-90bpm-d-minor-177334.mp3',
  '../../samples/loops/openmindaudio-deep-club-organic-house-music-ashen-palms-524258.mp3',
  '../../samples/loops/openmindaudio-epic-organic-house-music-driftwood-ritual-524274.mp3',
  '../../samples/loops/sonican-acoustic-senses-loop-313230.mp3',
  '../../samples/loops/sonican-feelgood-acoustic-loop-320856.mp3',
  '../../samples/loops/sonican-positive-corporate-music-optimistic-loop-464544.mp3',
  '../../samples/loops/sonofevan-gravel-in-my-lungs-470048.mp3',
  '../../samples/loops/the_mountain-deep-house-483808.mp3',
  '../../samples/loops/the_mountain-hi-tech-loop-151203.mp3',
  '../../samples/loops/the_mountain-loop-beat-130010.mp3',
  '../../samples/loops/the_mountain-soft-loop-130012.mp3',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(CORE).then(() => Promise.allSettled(SAMPLES.map(u => c.add(u).catch(() => {}))))));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(cached => {
    if (cached) return cached;
    return fetch(e.request).then(r => {
      if (!r || r.status !== 200 || (r.type !== 'basic' && r.type !== 'cors')) return r;
      caches.open(CACHE_NAME).then(c => c.put(e.request, r.clone()));
      return r;
    }).catch(() => { if (e.request.mode === 'navigate') return caches.match('./index.html'); });
  }));
});
