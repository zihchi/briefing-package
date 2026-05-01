// 每次發布新版本或新增檔案時，請務必推進此版號 (v5 -> v6)
const CACHE_NAME = 'briefing-v6'; 
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
  './time.html',
  './manifest.json',    // 新增：確保 PWA 核心設定能離線讀取
  './icon-192.png',     // 新增：確保離線時圖示正常顯示
  './icon-512.png'
];

// 1. 安裝階段：快取檔案 + 強制插隊跳過等待
self.addEventListener('install', event => {
  console.log('⚙️ 新版 Service Worker (v6) 安裝中...');
  
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

// 3. 攔截請求：【Network First 網路優先策略 + 強化離線配對】
self.addEventListener('fetch', event => {
  event.respondWith(
    // 步驟 A: 優先嘗試從伺服器抓取最新的檔案
    fetch(event.request)
      .then(response => {
        // 動態快取：連線成功時，順手將最新檔案寫入快取，確保臨時新增的檔案也能離線存取
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return response; 
      })
      .catch(() => {
        // 步驟 B: 如果飛機上沒網路 (fetch 失敗)，退而求其次從快取拿資料
        console.log('📡 處於離線狀態，載入快取檔案:', event.request.url);
        
        // 關鍵修正：加入 { ignoreSearch: true } 
        // 確保帶有參數的請求 (如 app.js?v=2.0) 依然能精準配對到快取中的原始檔案
        return caches.match(event.request, { ignoreSearch: true });
      })
  );
});
