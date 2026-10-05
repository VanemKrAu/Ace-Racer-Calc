// 王牌竞速芯片计算器 · Service Worker
//
// v10 相对 v9 改了三处，都是为了「离线真能用」这件事：
//
// 1) install 时预缓存首页骨架。
//    v9 把注册放在 window.load 里，等 load 触发时页面资源早就下载完了，SW 接管不到
//    任何请求 —— 第一次访问结束后缓存桶是空的。用户装完 PWA 第一次断网打开就是白屏，
//    看起来就像「PWA 根本没生效」。
// 2) 缓存写入放进 event.waitUntil。
//    v9 是 respondWith 的 then 里挂一个没人等的 caches.open().then(put)。响应一返回，
//    SW 就可能被浏览器回收，这次写入丢在半路。现在写入完成前 SW 不会被回收。
// 3) 删掉 activate 里那次「大扫除」。
//    它按一份很窄的白名单清理，而 car-database.js、html2canvas.min.js 不在名单里，
//    于是每次 SW 换版本，这两个文件连同缓存首页都会被整批删掉，离线直接断。
//    缓存桶换名（v9 → v10）时旧桶整个删掉就够干净了，不需要逐条扫。

const CACHE_NAME = 'calc-shell-v10';

// 离线真正要用到的骨架。html2canvas 只在导出长图时用，走运行时缓存即可。
const PRECACHE = [
    '/',
    '/index.html',
    '/car-database.js',
    '/manifest.json'
];

// 导航请求的兜底：连首页骨架都没缓存到的时候拿它顶上，总好过 net::ERR_FAILED
const OFFLINE_HTML = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>王牌竞速芯片计算器</title></head>'
    + '<body style="margin:0;background:#0f172a;color:#e2e8f0;font:16px/1.7 system-ui,sans-serif;'
    + 'display:flex;align-items:center;justify-content:center;height:100vh;text-align:center">'
    + '<div><p style="font-size:20px;margin:0 0 12px">当前处于离线状态</p>'
    + '<p style="opacity:.7;margin:0">连上网后重新打开即可</p></div></body></html>';

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // 逐条 add 而不是 addAll：任何一条 404 都不该让整个安装失败
            return Promise.all(PRECACHE.map((path) => {
                return cache.add(new Request(path, { cache: 'reload' }))
                    .catch(() => { /* 单条失败跳过，不影响其余 */ });
            }));
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((names) => {
            return Promise.all(names.map((name) => {
                if (name !== CACHE_NAME) {
                    console.log('[SW] 清理旧缓存桶:', name);
                    return caches.delete(name);
                }
                return undefined;
            }));
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') {
        return;
    }

    let url;
    try {
        url = new URL(request.url);
    } catch (err) {
        return;
    }

    // 跨域（字体在 npmmirror、车图在 B 站图床）交给浏览器自己的 HTTP 缓存，
    // 那些响应是 opaque 的，放进桶里只会占地方
    if (url.origin !== self.location.origin) {
        return;
    }

    // Vercel 的统计上报不是站点资产，没必要进缓存桶
    if (url.pathname.indexOf('/_vercel/') === 0) {
        return;
    }

    event.respondWith(
        fetch(request).then((response) => {
            if (response && response.status === 200 && response.type === 'basic') {
                const copy = response.clone();
                event.waitUntil(
                    caches.open(CACHE_NAME)
                        .then((cache) => cache.put(request, copy))
                        .catch(() => { /* 配额满或响应不可缓存，忽略 */ })
                );
            }
            return response;
        }).catch(() => {
            return caches.match(request).then((cached) => {
                if (cached) {
                    return cached;
                }
                // 导航请求回退到首页骨架。绝不能返回 undefined ——
                // respondWith(undefined) 会让浏览器直接报 net::ERR_FAILED，页面全白。
                if (request.mode === 'navigate') {
                    return caches.match('/index.html').then((shell) => {
                        return shell || new Response(OFFLINE_HTML, {
                            status: 200,
                            headers: { 'Content-Type': 'text/html; charset=utf-8' }
                        });
                    });
                }
                return undefined;
            });
        })
    );
});
