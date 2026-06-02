const CACHE_NAME = 'calc-dynamic-cache-v6';

const CURRENT_VALID_ASSETS = [
    '/',
    'index.html',
    'manifest.json',
    'manifest.json?v=5', 
    'sw.js',
    'icon.png',
    'icon-192.png',
    'icon.svg',
    'screenshot-mobile-1.png',
    'screenshot-mobile-2.png',
    'screenshot-mobile-3.png',
    'screenshot-desktop-1.png',
    'screenshot-desktop-2.png',
    'screenshot-desktop-3.png'
];

self.addEventListener('install', (e) => {
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log('[SW] 清理过时的旧缓存桶:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    e.waitUntil(clients.claim());
});

self.addEventListener('fetch', (e) => {
    if (e.request.method !== 'GET') {
        return;
    }

    e.respondWith(
        fetch(e.request)
            .then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(e.request, responseClone);

                        cache.keys().then((requests) => {
                            requests.forEach((storedRequest) => {
                                const url = new URL(storedRequest.url);
                                const relativePath = url.pathname + url.search;
                                const cleanPath = relativePath.replace(/^\/[^\/]+\//, ''); 

                                if (
                                    CURRENT_VALID_ASSETS.indexOf(relativePath) === -1 && 
                                    CURRENT_VALID_ASSETS.indexOf(cleanPath) === -1 &&
                                    relativePath !== '/'
                                ) {
                                    console.log('[SW 自动大扫除] 发现并销毁过时缓存残渣:', relativePath);
                                    cache.delete(storedRequest); 
                                }
                            });
                        });
                    });
                }
                return networkResponse; 
            })
            .catch(() => {
                return caches.match(e.request);
            })
    );
});
