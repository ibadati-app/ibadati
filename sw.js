// زاد المسلم اليومي — offline app shell
var CACHE = 'ibadati-v14';
var ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-192.png',
  'icon-maskable-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    // Delete every old cache FIRST: requests below are intercepted by the previous
    // active worker, whose cache-first handler would otherwise fill this cache with
    // the OLD index.html and trap users on a stale version forever.
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { return caches.delete(k); }));
    }).then(function () {
      return caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); });
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { if (k !== CACHE) return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  // HTML: network-first so updates reach users immediately; cache is the offline fallback.
  if (e.request.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html')) {
    e.respondWith(
      fetch(e.request).then(function (resp) {
        if (resp && resp.ok) {
          var copy = resp.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return resp;
      }).catch(function () {
        return caches.match(e.request, { ignoreSearch: true });
      })
    );
    return;
  }

  // Static assets (icons, manifest): cache-first, network fills misses.
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      return hit || fetch(e.request).then(function (resp) {
        if (resp && resp.ok) {
          var copy = resp.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return resp;
      });
    })
  );
});

// v5: closed-app adhkar reminders via Web Push
self.addEventListener('push', function (e) {
  var data = {};
  try { data = e.data ? e.data.json() : {}; } catch (err) {}
  var title = data.title || 'زاد المسلم اليومي';
  var body = data.body || 'حان وقت الذكر';
  e.waitUntil(self.registration.showNotification(title, {
    body: body,
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    dir: 'rtl',
    lang: 'ar',
    data: { url: './' }
  }));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) { if ('focus' in list[i]) return list[i].focus(); }
      return clients.openWindow('./');
    })
  );
});
