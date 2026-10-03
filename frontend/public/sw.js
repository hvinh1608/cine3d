const CACHE_NAME = 'cine3d-shell-v4';
const APP_SHELL = ['/manifest.webmanifest', '/cine3d-favicon.png'];

const OFFLINE_HTML = `<!doctype html><html lang="vi"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>CINE3D</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#191a22;color:#e2e8f0;font-family:system-ui,sans-serif}main{max-width:22rem;padding:1.5rem;text-align:center}button{margin-top:1rem;padding:.65rem 1.1rem;border:0;border-radius:999px;background:#eab308;color:#111;font-weight:700}</style></head><body><main><h1>CINE3D</h1><p>Không có kết nối. Kiểm tra mạng rồi thử lại.</p><button onclick="location.reload()">Tải lại</button></main></body></html>`;

function offlineResponse() {
  return new Response(OFFLINE_HTML, {
    status: 503,
    statusText: 'Offline',
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || /\.(m3u8|ts|mp4)(\?|$)/i.test(url.pathname)) return;

  // Navigations: network-only with a real Response fallback (never undefined).
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(async () => {
          const cached = await caches.match('/');
          return cached || offlineResponse();
        }),
    );
    return;
  }

  if (!/\.(js|css|woff2?|png|jpg|jpeg|webp|svg|ico)(\?|$)/i.test(url.pathname)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => undefined);
          }
          return response;
        })
        .catch(() => offlineResponse());
    }),
  );
});

self.addEventListener('push', (event) => {
  let data = { title: 'CINE3D', body: 'Bạn có thông báo mới.', url: '/' };
  try {
    data = { ...data, ...event.data.json() };
  } catch {
    /* defaults */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/cine3d-favicon.png',
      badge: '/cine3d-favicon.png',
      data: { url: data.url || '/' },
      tag: data.url || 'cine3d-notification',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url === target);
      if (existing) return existing.focus();
      return self.clients.openWindow(target);
    }),
  );
});
