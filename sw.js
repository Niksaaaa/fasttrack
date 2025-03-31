const CACHE_NAME = 'fasting-tracker-plus-cache-v1.3'; // Increment version
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/manifest.json', // <<< Make sure this is here
    'https://cdn.jsdelivr.net/npm/chart.js',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png'
];

// Install event: Open cache and add assets
self.addEventListener('install', event => {
    console.log('Service Worker: Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Service Worker: Caching app shell');
                // Use { cache: 'reload' } for essential files if needed during updates
                // but be mindful of offline-first goals
                const cachePromises = urlsToCache.map(urlToCache => {
                    return cache.add(urlToCache).catch(err => {
                        console.warn(`Failed to cache ${urlToCache}: ${err}`);
                    });
                });
                return Promise.all(cachePromises);
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
    const cacheWhitelist = [CACHE_NAME];
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
             return self.clients.claim(); // Take control immediately
        })
    );
});

// Fetch event: Cache-first strategy
self.addEventListener('fetch', event => {
    // Non-GET requests or specific paths shouldn't be cached typically
    if (event.request.method !== 'GET' /*|| event.request.url.includes('/api/')*/) {
        // console.log('Service Worker: Bypassing cache for non-GET request', event.request.url);
        event.respondWith(fetch(event.request));
        return;
    }

    // Cache-first for GET requests
    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                // Cache hit - return response
                if (cachedResponse) {
                    // console.log('Service Worker: Serving from cache', event.request.url);
                    return cachedResponse;
                }

                // Not in cache - fetch from network
                // console.log('Service Worker: Fetching from network', event.request.url);
                return fetch(event.request).then(
                    networkResponse => {
                        // Check if we received a valid response
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            return networkResponse;
                        }

                        // IMPORTANT: Clone the response. A response is a stream
                        // and because we want the browser to consume the response
                        // as well as the cache consuming the response, we need
                        // to clone it so we have two streams.
                        let responseToCache = networkResponse.clone();

                        caches.open(CACHE_NAME)
                            .then(cache => {
                                // console.log('Service Worker: Caching new resource', event.request.url);
                                cache.put(event.request, responseToCache);
                            });

                        return networkResponse;
                    }
                ).catch(error => {
                    console.error('Service Worker: Fetch error:', error);
                    // Optional: Provide a fallback page/resource if network fails
                    // Example: return caches.match('/offline.html');
                    // For an API call, you might return a default JSON structure or just let the error propagate
                    // For this app, letting it fail might be okay, the UI should handle lack of data.
                });
            })
    );
});