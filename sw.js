// sw.js - 智能动态缓存过滤版 (Network First)
const CACHE_NAME = 'calc-dynamic-cache-v3';

// 安装阶段：立即跳过等待，接管网页
self.addEventListener('install', (e) => {
    self.skipWaiting();
});

// 激活阶段：立即控制所有终端，并清理旧缓存
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
    // 【核心修复】：如果不是 GET 请求（比如浏览器插件发送的 POST），直接放行不拦截，彻底解决报错！
    if (e.request.method !== 'GET') {
        return; 
    }

    e.respondWith(
        fetch(e.request)
            .then((networkResponse) => {
                // 只有成功的合法网络请求才存入缓存
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(e.request, responseClone);[span_3](start_span)[span_3](end_span)
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                // 断网时去缓存里捞
                return caches.match(e.request);
            })
    );
});
