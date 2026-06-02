// sw.js - 仅用于满足 PWA 安装条件的最小化 Service Worker
self.addEventListener('install', (e) => {
    console.log('[Service Worker] 已安装');
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    console.log('[Service Worker] 已激活');
});

self.addEventListener('fetch', (e) => {
    // 必须保留 fetch 监听器，这是浏览器判定 PWA 可安装的核心条件！
    // 这里我们直接放行所有网络请求，不做复杂的离线缓存
});
