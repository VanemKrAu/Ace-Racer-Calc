const CACHE_NAME = 'calc-cache-v1';
const urlsToCache = [
    './',
    'index.html',
    'icon.png',
    'icon-192.png'
];

// 安装时缓存核心文件
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(urlsToCache);
        })
    );
    self.skipWaiting();
});

// 激活并清理旧缓存
self.addEventListener('activate', (e) => {
    e.waitUntil(clients.claim());
});

// 拦截请求：断网时直接从缓存读取，实现纯离线运行
self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((response) => {
            return response || fetch(e.request);
        })
    );
});
