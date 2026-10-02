const CACHE_NAME = 'calc-dynamic-cache-v9';

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
    // 注意：站内字体已迁到 registry.npmmirror.com（跨域）。跨域资源由浏览器自身的 HTTP 缓存
    // 负责（那边已经给了 1 年 immutable），SW 不再插手，所以这里没有字体条目。
];

// 说明（v9 的改动）：
// 1) 原先每个响应都做一次 cache.put，并且紧接着 cache.keys() 全量遍历做「大扫除」——
//    这个清扫是 O(缓存条目数) 的，却发生在每一次网络响应上，弱浏览器（套壳 WebView）里
//    白白吃掉主线程。现在大扫除只在 activate 时做一次，之后不再重复。
// 2) 跨域请求一律放行：字体在 npmmirror、车图在 B站图床，那些不该由我们接管
//    （而且旧逻辑的清扫会把跨域条目误删，导致每次都重新下载）。

self.addEventListener('install', (e) => {
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        console.log('[SW] 清理过时的旧缓存桶:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => caches.open(CACHE_NAME)).then((cache) => {
            // 一次性大扫除：删掉桶里已不在白名单的残留
            return cache.keys().then((requests) => {
                return Promise.all(requests.map((storedRequest) => {
                    const url = new URL(storedRequest.url);
                    if (url.origin !== self.location.origin) {
                        return cache.delete(storedRequest);
                    }
                    const relativePath = url.pathname + url.search;
                    const cleanPath = relativePath.replace(/^\/[^\/]+\//, '');
                    if (
                        CURRENT_VALID_ASSETS.indexOf(relativePath) === -1 &&
                        CURRENT_VALID_ASSETS.indexOf(cleanPath) === -1 &&
                        relativePath !== '/'
                    ) {
                        console.log('[SW 大扫除] 清理过时缓存残渣:', relativePath);
                        return cache.delete(storedRequest);
                    }
                }));
            });
        }).then(() => clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    if (e.request.method !== 'GET') {
        return;
    }

    // 只管同源请求；跨域（字体 / 图床 / 统计上报）原样放行给浏览器
    let url;
    try {
        url = new URL(e.request.url);
    } catch (err) {
        return;
    }
    if (url.origin !== self.location.origin) {
        return;
    }

    e.respondWith(
        fetch(e.request)
            .then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(e.request, responseClone);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                return caches.match(e.request);
            })
    );
});
