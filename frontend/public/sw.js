const CACHE_NAME = 'cine3d-shell-v1';
const APP_SHELL = ['/', '/manifest.webmanifest', '/cine3d-favicon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || request.url.includes('/api/') || /\.(m3u8|ts|mp4)(\?|$)/i.test(request.url)) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/')));
    return;
  }
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !/\.(js|css|woff2?|png|jpg|jpeg|webp|svg|ico)(\?|$)/i.test(url.pathname)) return;
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
    return response;
  })));
});

self.addEventListener('push', (event) => {
  let data = { title: 'CINE3D', body: 'Bạn có thông báo mới.', url: '/' };
  try { data = { ...data, ...event.data.json() }; } catch { /* use defaults */ }
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: data.icon || '/cine3d-favicon.png',
    badge: '/cine3d-favicon.png',
    data: { url: data.url || '/' },
    tag: data.url || 'cine3d-notification',
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => client.url === target);
    if (existing) return existing.focus();
    return self.clients.openWindow(target);
  }));
});
