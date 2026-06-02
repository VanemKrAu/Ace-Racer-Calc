// sw.js - 标准的 PWA Service Worker
self.addEventListener('install', (e) => {
    console.log('[Service Worker] 安装成功');
    self.skipWaiting(); // 强制立即接管控制权
});

self.addEventListener('activate', (e) => {
    console.log('[Service Worker] 激活成功');
    e.waitUntil(clients.claim()); // 立即控制所有打开的页面
});

self.addEventListener('fetch', (e) => {
    // 拦截网络请求并直接放行。加上这一句，浏览器才会真正认为你具备离线能力。
    e.respondWith(
        fetch(e.request).catch(() => {
            console.log('[Service Worker] 离线请求失败');
        })
    );
});
