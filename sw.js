self.addEventListener('install', (e) => {
    console.log('[Service Worker] 安装成功');
    self.skipWaiting(); 
});

self.addEventListener('activate', (e) => {
    console.log('[Service Worker] 激活成功');
    e.waitUntil(clients.claim()); 
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        fetch(e.request).catch(() => {
            console.log('[Service Worker] 离线请求失败');
        })
    );
});
