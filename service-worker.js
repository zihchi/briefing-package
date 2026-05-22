// 每次發布新版本或新增檔案時，請務必推進此版號
const CACHE_NAME = 'briefing-v17'; 
const urlsToCache = [
  './',
  './index.html',
  './app.js',
  './FDP.html',
  './FIDS.html',
  './Turbli_Widget.html',
  './altimetry.html',
  './curfew.html',
  './fuel.html',
  './swap.html',
  './notam.html',
  './time.html',
  './fpl_decoder.html',     // 新增：ICAO FPL Decoder 檔案 (若您的檔名不同，請務必在此修改)
  './manifest.json',    // 確保 PWA 核心設定能離線讀取
  './icon-192.png',     // 確保離線時圖示正常顯示
  './icon-512.png',
  './SwapDutyForm.pdf',
  // 👇 必須強制登機的外部 CDN 資源
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// 1. 安裝階段：快取檔案 + 強制插隊跳過等待
self.addEventListener('install', event => {
  console.log('⚙️ 新版 Service Worker (v7) 安裝中...');
  
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

// 3. 攔截請求：【快取優先，背景更新 (Stale-While-Revalidate)】
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // ⚠️ 排除清單：外部氣象 API 與動態圖層，絕對不能拿舊快取來騙自己，一律放行讓瀏覽器原生處理
  if (url.hostname.includes('aviationweather.gov') ||
      url.hostname.includes('windy.com') ||
      url.hostname.includes('script.google.com') ||
      url.hostname.includes('basemaps.cartocdn.com')) {
      return; 
  }

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(cachedResponse => {
      // 策略：如果快取裡有，立刻顯示給使用者 (達成 100% 離線秒開，不受弱網干擾)
      if (cachedResponse) {
        // 背景默默去抓新版更新快取
        fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200 && (networkResponse.type === 'basic' || networkResponse.type === 'cors')) {
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, networkResponse.clone());
            });
          }
        }).catch(() => { /* 斷網時背景更新失敗，安靜忽略 */ });

        return cachedResponse;
      }

      // 如果快取真的沒有，才去網路抓 (通常是第一次載入，或是忘記加進清單的檔案)
      return fetch(event.request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200 && (networkResponse.type === 'basic' || networkResponse.type === 'cors')) {
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, networkResponse.clone());
          });
        }
        return networkResponse;
      }).catch(() => {
          console.log('📡 徹底斷網，且無快取可用:', event.request.url);
      });
    })
  );
});

// ==========================================
// 4. 跨執行緒通訊：回報目前版號給前端 UI
// ==========================================
self.addEventListener('message', (event) => {
  if (event.data === 'GET_VERSION') {
    event.source.postMessage({ 
      type: 'VERSION_REPORT', 
      version: CACHE_NAME 
    });
  }
});
