const CACHE_NAME = 'fasting-tracker-plus-cache-v1.2'; // Increment version to force update
const urlsToCache = [
    '/', // Cache the root URL
    '/index.html',
    '/style.css',
    '/script.js',
    'https://cdn.jsdelivr.net/npm/chart.js', // Cache Chart.js CDN
    // Add '/manifest.json' if you want to cache it
    // Add '/icons/icon-192x192.png', '/icons/icon-512x512.png' etc.
    '/icons/icon-192x192.png', // Make sure paths are correct
    '/icons/icon-512x512.png'
];

// Install event: Open cache and add assets
self.addEventListener('install', event => {
    console.log('Service Worker: Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Service Worker: Caching app shell');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('Service Worker: Installation complete');
                return self.skipWaiting(); // Activate worker immediately
            })
             .catch(error => {
                console.error('Service Worker: Installation failed', error);
            })
    );
});

// Activate event: Clean up old caches
self.addEventListener('activate', event => {
     console.log('Service Worker: Activating...');
    const cacheWhitelist = [CACHE_NAME]; // Only keep the current cache
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log('Service Worker: Deleting old cache', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Service Worker: Activation complete');
             return self.clients.claim(); // Take control of existing clients immediately
        })
    );
});

// Fetch event: Serve cached assets or fetch from network
self.addEventListener('fetch', event => {
    // console.log('Service Worker: Fetching ', event.request.url);
    // Use a cache-first strategy
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Cache hit - return response
                if (response) {
                    // console.log('Service Worker: Serving from cache', event.request.url);
                    return response;
                }

                // Not in cache - fetch from network
                 // console.log('Service Worker: Fetching from network', event.request.url);
                return fetch(event.request).then(
                    // Optional: Cache newly fetched resources if needed dynamically
                    // For this simple app, caching only the predefined shell is usually enough.
                     networkResponse => {
                         // If you want to cache everything that's fetched:
                         /*
                         if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            return networkResponse; // Don't cache errors or opaque responses
                         }
                         let responseToCache = networkResponse.clone();
                         caches.open(CACHE_NAME).then(cache => {
                             cache.put(event.request, responseToCache);
                         });
                         */
                         return networkResponse;
                     }
                );
            }).catch(error => {
                console.error('Service Worker: Fetch error:', error);
                 // Optional: Return a fallback offline page if fetch fails and not in cache
                 // return caches.match('/offline.html');
            })
    );
});