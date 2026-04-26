// 每次發布新版本，請務必修改這裡的版號 (例如 v1 -> v2)
const CACHE_NAME = 'briefing-v5'; 
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
  './LIDOPRO.html',
  './notam.html',
  './time.html'
];

// 1. 安裝階段：快取檔案 + 強制插隊跳過等待 (合併為一個 install 事件)
self.addEventListener('install', event => {
  console.log('⚙️ 新版 Service Worker 安裝中...');
  
  // 核心指令 1：不要等了，直接插隊！
  self.skipWaiting(); 

  // 把清單裡的檔案寫入快取
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 正在寫入離線快取檔案...');
        return cache.addAll(urlsToCache);
      })
  );
});

// 2. 啟動階段：接管畫面並清除舊版快取
self.addEventListener('activate', event => {
  console.log('🚀 新版 Service Worker 準備接管');
  
  // 核心指令 2：立刻奪取所有開啟中網頁的控制權
  event.waitUntil(clients.claim()); 

  // 清除名字不是最新版號的舊快取垃圾
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ 刪除舊版快取:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// 3. 攔截請求：【改為 Network First 網路優先策略】
self.addEventListener('fetch', event => {
  event.respondWith(
    // 步驟 A: 優先嘗試從伺服器抓取最新的檔案
    fetch(event.request)
      .then(response => {
        // (可選進階處理) 如果抓到了新檔案，可以順便更新快取，但目前保持簡單即可
        return response; 
      })
      .catch(() => {
        // 步驟 B: 如果飛機上沒網路 (fetch 失敗)，才退而求其次從快取拿資料
        console.log('📡 處於離線狀態，載入快取檔案:', event.request.url);
        return caches.match(event.request);
      })
  );
});
