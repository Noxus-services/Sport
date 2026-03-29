const CACHE = 'apexcoach-v2';
const STATIC = [
  '/',
  '/dashboard/',
  '/workout/',
  '/coach/',
  '/programs/',
  '/history/',
  '/profile/',
  '/reminders/',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.hostname.includes('googleapis') || url.hostname.includes('generativelanguage') || url.hostname.includes('supabase')) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// Push notifications from server
self.addEventListener('push', (e) => {
  const data = e.data?.json() ?? { title: 'ApexCoach', body: 'Rappel !' };
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      tag: data.tag ?? 'apex-notif',
      data: { url: data.url ?? '/' },
    })
  );
});

// Triggered by main thread for local scheduled notifications
self.addEventListener('message', (e) => {
  if (e.data?.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag, url } = e.data;
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      tag: tag ?? 'apex-reminder',
      data: { url: url ?? '/reminders' },
    });
  }
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data?.url ?? '/'));
});
