// sw.js - 智能动态缓存版 (Network First)
const CACHE_NAME = 'calc-dynamic-cache';

// 安装阶段：立即跳过等待，接管网页
self.addEventListener('install', (e) => {
    self.skipWaiting();
});

// 激活阶段：立即控制所有终端，并清理可能的旧静态缓存
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    e.waitUntil(clients.claim());
});

// 拦截请求核心逻辑：网络优先，缓存兜底
self.addEventListener('fetch', (e) => {
    e.respondWith(
        fetch(e.request)
            .then((networkResponse) => {
                // 如果有网且拉取成功，把最新拉取到的文件悄悄存入缓存
                // 这样下次断网时，用的就是最新的这个版本
                const responseClone = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(e.request, responseClone);
                });
                return networkResponse;
            })
            .catch(() => {
                // 如果断网了（fetch 报错），就去缓存里找上一次存下来的文件
                return caches.match(e.request);
            })
    );
});
