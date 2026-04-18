const CACHE_NAME = 'briefing-v1';
const urlsToCache = [
  './',
  './index.html',
  './app.js',
  './ATIS.html',
  './FIDS.html',
  './Turbli_Widget.html',
  './altimetry.html',
  './curfew.html',
  './fuel.html',
  './notam.html',
  './time.html'
];

// 安裝階段：快取所有指定的檔案
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// 攔截請求：斷網時優先從快取讀取
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response; // 命中快取，直接返回離線檔案
        }
        return fetch(event.request); // 未命中，嘗試透過網路抓取
      })
  );
});
