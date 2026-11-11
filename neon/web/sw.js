// Offline cache: serve app files from cache, refresh them in the background when online.
const C = 'neon-v1', FILES = ['./', 'index.html', 'engine.js', 'games1.js', 'games2.js', 'games3.js', 'shell.js', 'manifest.webmanifest', 'icon.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(C).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  if (e.request.method != 'GET') return;
  e.respondWith(caches.open(C).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(r => { if (r.ok && (r.type == 'basic' || e.request.url.includes('peerjs'))) c.put(e.request, r.clone()); return r }).catch(() => hit);
    return hit || net;
  }));
});
