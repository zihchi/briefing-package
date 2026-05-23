// 每次發布新版本或新增檔案時，請務必推進此版號
const CACHE_NAME = 'briefing-v18'; 
const NETWORK_TIMEOUT = 5000; // 5秒超時判定 (5000毫秒)

const urlsToCache = [
  './',
  './index.html',
  './FDP.html',
  './FIDS.html',
  './Turbli_Widget.html',
  './altimetry.html',
  './curfew.html',
  './fuel.html',
  './swap.html',
  './notam.html',
  './time.html',
  './PCR.html',
  './fpl_decoder.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './SwapDutyForm.pdf',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// ⏳ 自訂帶有超時機制的 Fetch 函數
const fetchWithTimeout = (request, timeout) => {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('網路請求超時 (Timeout)'));
    }, timeout);

    fetch(request).then(response => {
      clearTimeout(timeoutId);
      resolve(response);
    }).catch(err => {
      clearTimeout(timeoutId);
      reject(err);
    });
  });
};

// 1. 安裝階段
self.addEventListener('install', event => {
  console.log(`⚙️ 新版 Service Worker (${CACHE_NAME}) 安裝中...`);
  // 取消 self.skipWaiting()，改由使用者點擊按鈕後再觸發更新，避免突發重整
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
  event.waitUntil(clients.claim()); 

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

// 3. 攔截請求：【智慧雙軌策略】
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // ⚠️ 排除清單：外部氣象 API 等純動態資料，直接放行 (這裡的超時由前端碼控制)
  if (url.hostname.includes('aviationweather.gov') ||
      url.hostname.includes('windy.com') ||
      url.hostname.includes('script.google.com') ||
      url.hostname.includes('basemaps.cartocdn.com')) {
      return; 
  }

  // 🌟 策略 A：針對網頁本身 (HTML)，採用【網路優先，5秒超時退回快取】
  // 這樣能保證只要有網路，永遠載入最新版；若斷網或弱網，5秒後秒切離線版
  if (event.request.mode === 'navigate' || event.request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetchWithTimeout(event.request, NETWORK_TIMEOUT)
        .then(networkResponse => {
          // 網路成功，更新快取
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          return networkResponse;
        })
        .catch(() => {
          // 網路失敗或超時 (5秒)，退回快取
          console.log('📡 網路超時或斷線，啟動離線網頁快取:', event.request.url);
          return caches.match(event.request);
        })
    );
    return;
  }

  // 🌟 策略 B：針對靜態資源 (CSS, JS, 圖片)，採用【快取優先，背景更新】
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(cachedResponse => {
      if (cachedResponse) {
        // 背景拿新版
        fetchWithTimeout(event.request, NETWORK_TIMEOUT).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse.clone()));
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetchWithTimeout(event.request, NETWORK_TIMEOUT).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse.clone()));
        }
        return networkResponse;
      });
    })
  );
});

// 4. 跨執行緒通訊：回報版號與接收強制更新指令
self.addEventListener('message', (event) => {
  if (event.data === 'GET_VERSION') {
    event.source.postMessage({ 
      type: 'VERSION_REPORT', 
      version: CACHE_NAME 
    });
  }
  // 接收前端發送的「立即接管」指令 (使用者點擊了更新按鈕)
  if (event.data && event.data.action === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
