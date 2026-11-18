// 王牌竞速芯片计算器 · Service Worker (calc-shell-v78)
//
// 核心策略：
// 1) install 时预缓存首页核心骨架、图标与静态数据脚本，确保 PWA 离线首屏可用；
// 2) 运行时采用「网络优先 + 成功回写 + 离线缓存回退」策略，并忽略静态资源查询串（如 manifest.json?v=5）；
// 3) 社区动态 /api/* 与统计 /_vercel/* 绝不落入 SW 缓存桶；升级 CACHE_NAME 时在 activate 整体淘汰旧桶。

const CACHE_NAME = 'calc-shell-v78';

// 离线真正要用到的核心骨架与静态资源。html2canvas 只在导出长图时用，走运行时缓存即可。
const PRECACHE = [
    '/',
    '/index.html',
    '/csp-scripts/index-bindings.js',
    '/csp-scripts/index-01.js',
    '/csp-scripts/index-02.js',
    '/csp-scripts/index-03.js',
    '/csp-scripts/index-04.js',
    '/csp-scripts/index-05.js',
    '/csp-scripts/index-06.js',
    '/csp-scripts/index-07.js',
    '/csp-scripts/index-08.js',
    '/csp-scripts/index-09.js',
    '/csp-scripts/index-10.js',
    '/csp-scripts/index-11.js',
    '/csp-scripts/index-12.js',
    '/csp-scripts/index-13.js',
    '/csp-scripts/index-14.js',
    '/style.css',
    '/cdn-icons.js',
    '/v4.js',
    '/view.js',
    '/liquid-theme.js',
    '/desk.js',
    '/community-plans.css',
    '/community-plans.js',
    '/profile.js',
    '/car-database.js',
    '/data/talents-data.js',
    '/data/icon/pro_helmet_m.png',
    '/data/icon/chip_hunter.png',
    '/data/icon/chip_wphx.png',
    '/data/icon/chip_catnap.png',
    '/data/icon/chip_hardman.png',
    '/data/icon/chip_triple.png',
    '/data/icon/chip_qinglong.png',
    '/data/icon/chip_aomei.png',
    '/data/icon/chip_xiuzhu.png',
    '/data/icon/chip_yiju.png',
    '/data/icon/chip_xiuhua.png',
    '/data/icon/racer_icon_buff_2.png',
    '/data/icon/racer_icon_buff_4.png',
    '/data/icon/racer_icon_buff_7.png',
    '/data/icon/racer_icon_buff_9.png',
    '/data/icon/icon_mhyck_m.png',
    '/data/icon/talents/skill_green_02.png',
    '/data/icon/talents/skill_green_03.png',
    '/data/icon/talents/skill_green_04.png',
    '/data/icon/talents/skill_green_05.png',
    '/data/icon/talents/skill_green_06.png',
    '/data/icon/talents/skill_green_07.png',
    '/data/icon/talents/skill_purple_02.png',
    '/data/icon/talents/skill_purple_03.png',
    '/data/icon/talents/skill_purple_04.png',
    '/data/icon/talents/skill_purple_05.png',
    '/data/icon/talents/skill_purple_06.png',
    '/data/icon/talents/skill_purple_07.png',
    '/data/icon/talents/skill_red_02.png',
    '/data/icon/talents/skill_red_04.png',
    '/data/icon/talents/skill_red_06.png',
    '/data/icon/talents/skill_red_07.png',
    '/data/icon/talents/skill_red_08.png',
    '/data/icon/talents/skill_red_09.png',
    '/data/icon/talents/skill_yellow_02.png',
    '/data/icon/talents/skill_yellow_04.png',
    '/data/icon/talents/skill_yellow_05.png',
    '/data/icon/talents/skill_yellow_06.png',
    '/data/icon/talents/skill_yellow_08.png',
    '/data/icon/talents/skill_yellow_09.png',
    '/icon.png',
    '/icon.svg',
    '/icon-192.png',
    '/favicon.ico',
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

    // Vercel 的统计上报与后端动态 API 接口绝不进 Service Worker 缓存桶
    if (url.pathname.indexOf('/_vercel/') === 0 || url.pathname.indexOf('/api/') === 0) {
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
            return caches.match(request, { ignoreSearch: true }).then((cached) => {
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
