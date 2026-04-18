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

// 1. 安裝階段：強制跳過等待時間
self.addEventListener('install', (event) => {
  console.log('⚙️ 新版 Service Worker 安裝中...');
  self.skipWaiting(); // 核心指令：不要等了，直接插隊！
});

// 2. 啟動階段：接管畫面並清除舊版快取
self.addEventListener('activate', (event) => {
  console.log('🚀 新版 Service Worker 準備接管');
  event.waitUntil(clients.claim()); // 核心指令：立刻奪取所有開啟中網頁的控制權

  // 清除名字不是最新版號的舊快取
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ 刪除舊快取:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
