const CACHE_NAME = 'jx-logbook-v2.7';
const urlsToCache = [
    './',
    './index.html',
    'https://cdn.tailwindcss.com',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2',
    'https://cdnjs.cloudflare.com/ajax/libs/suncalc/1.9.0/suncalc.min.js'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return Promise.allSettled(urlsToCache.map(url => cache.add(url)));
        })
    );
});

self.addEventListener('activate', event => {
    self.clients.claim();
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', event => {
    // 【關鍵修正】完全放行 Google API 與轉址，不讓 Service Worker 介入
    if (event.request.url.includes('script.google.com') || 
        event.request.url.includes('script.googleusercontent.com')) {
        return; // 直接 return，讓瀏覽器原生發送請求
    }

    // 處理 HTML 導航 (離線時回傳 index.html)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => caches.match('./index.html'))
        );
        return;
    }

    // 其他靜態資源請求 (CSS, 腳本)
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            return cachedResponse || fetch(event.request).then(response => {
                // 確保只快取連線成功的檔案
                if (response && response.status === 200) {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
                }
                return response;
            }).catch(() => {}); // 離線且無快取時默默失敗，不引發 Uncaught Error
        })
    );
});
