const CACHE_NAME = 'bandhuram-v1';
const PRECACHE_URLS = [
  '/index.html',
  '/css/style.css',
  '/js/config.js',
  '/js/api.js',
  '/js/menu.js',
  '/js/cart.js',
  '/js/feedback.js',
  '/js/contact.js',
  '/js/gallery.js',
  '/js/chatbot.js',
  '/js/main.js',
  '/assets/logo.png'
];

// Runs once when the service worker is first installed — caches the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// Cleans up old cache versions when a new service worker takes over
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// Network-first for API calls (always want fresh menu/order data),
// cache-first for the static app shell (instant load, works offline)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache API calls — menu prices, order status etc. must always be fresh
  if (url.pathname.startsWith('/api/')) {
    return; // let it go straight to the network, untouched
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        // cache successful same-origin responses for next time
        if (response.ok && url.origin === self.location.origin) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return response;
      });
    })
  );
});