// ==========================================
// 📦 簡報箱 Service Worker - 離線強化版
// ==========================================
const CACHE_NAME = 'briefing-v39';

// ⬛ 本機靜態檔案：安裝時強制全部寫入快取
const LOCAL_FILES = [
  './',
  './index.html',
  './app.js',
  './ATIS.html',
  './Captain_Logbook_Cloud.html',
  './FDP.html',
  './FIDS.html',
  './LIDOPRO4.html',
  './PCR.html',
  './TR.html',
  './Turbli_Widget.html',
  './altimetry.html',
  './calendar.html',
  './curfew.html',
  './fpl_decoder.html',
  './fuel.html',
  './notam.html',
  './swap.html',
  './time.html',
  './ELB_Fleet.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './SwapDutyForm.pdf',
  './LIDOPRO.png',
  './TR.jpg',
];

// 🌐 外部 CDN：盡力快取，單一失敗不影響 SW 安裝
const CDN_FILES = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.tailwindcss.com',
];

// 🚫 即時動態資料：永遠直接走網路，不快取
const BYPASS_HOSTNAMES = [
  'aviationweather.gov',
  'api.codetabs.com',
  'api.allorigins.win',
  'open-meteo.com',
  'script.google.com',
  'basemaps.cartocdn.com',
  'embed.windy.com',
  'windy.com',
  'turbli.com',
  'tenki.lbw.jp',
  'data.jma.go.jp',
  'app.cwa.gov.tw',
  'docs.google.com',
  'pilotstarspace.starlux-airlines.com',
  'elb.starlux-airlines.com',
  'sjx.lido.aero',
  'flight-plan-editor.weathernews.com',
  'skyinfo.jp',
  'tono2.net',
];

// ⏳ 2 秒超時（舊版 5 秒，斷網/弱網體感快很多）
const NETWORK_TIMEOUT = 2000;

const fetchWithTimeout = (request, timeout) => {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('Timeout')), timeout);
    fetch(request)
      .then(res => { clearTimeout(id); resolve(res); })
      .catch(err => { clearTimeout(id); reject(err); });
  });
};

// ============================
// 1. 安裝：預寫快取
// ============================
self.addEventListener('install', event => {
  console.log(`⚙️ Service Worker (${CACHE_NAME}) 安裝中...`);
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      // 本機檔案全部寫入，任一失敗會讓安裝重試
      await cache.addAll(LOCAL_FILES);
      console.log('✅ 本機檔案快取完成');

      // CDN 逐一寫入，失敗只印警告，不中斷安裝
      await Promise.allSettled(
        CDN_FILES.map(url =>
          cache.add(url).catch(err =>
            console.warn(`⚠️ CDN 快取失敗 (可忽略): ${url}`, err)
          )
        )
      );
      console.log('📦 快取安裝完畢');
    })
  );
});

// ============================
// 2. 啟動：清除舊快取，接管頁面
// ============================
self.addEventListener('activate', event => {
  console.log(`🚀 Service Worker (${CACHE_NAME}) 接管中`);
  event.waitUntil(
    Promise.all([
      clients.claim(),
      caches.keys().then(keys =>
        Promise.all(
          keys.filter(k => k !== CACHE_NAME).map(k => {
            console.log('🗑️ 刪除舊快取:', k);
            return caches.delete(k);
          })
        )
      ),
    ])
  );
});

// ============================
// 3. 攔截請求：三軌策略
// ============================
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 軌道 0：即時動態資料 → 直接放行，不快取
  if (BYPASS_HOSTNAMES.some(h => url.hostname.includes(h))) return;

  // 只處理 GET
  if (event.request.method !== 'GET') return;

  const isNavigate = event.request.mode === 'navigate';
  const acceptHeader = event.request.headers.get('accept') || '';
  const isHtmlNav = isNavigate || acceptHeader.includes('text/html');

  // 軌道 1：頁面導覽 → 網路優先，2 秒超時退回快取
  if (isHtmlNav) {
    event.respondWith(
      fetchWithTimeout(event.request, NETWORK_TIMEOUT)
        .then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return res;
        })
        .catch(() => {
          console.log('📵 網路超時，讀取離線快取:', url.pathname);
          return caches.match(event.request, { ignoreSearch: true });
        })
    );
    return;
  }

  // 軌道 2：靜態資源（JS、CSS、圖片、工具 HTML）→ 快取優先，背景更新
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(cached => {
      if (cached) {
        // 有快取 → 立即回應，背景偷偷拿新版
        fetchWithTimeout(event.request, NETWORK_TIMEOUT)
          .then(res => {
            if (res && res.status === 200) {
              caches.open(CACHE_NAME).then(c => c.put(event.request, res.clone()));
            }
          })
          .catch(() => {});
        return cached;
      }

      // 無快取 → 向網路取得並存入
      return fetchWithTimeout(event.request, NETWORK_TIMEOUT)
        .then(res => {
          if (res && res.status === 200) {
            caches.open(CACHE_NAME).then(c => c.put(event.request, res.clone()));
          }
          return res;
        })
        .catch(() =>
          new Response('', { status: 408, statusText: 'Offline - No Cache' })
        );
    })
  );
});

// ============================
// 4. 跨執行緒通訊
// ============================
self.addEventListener('message', event => {
  if (event.data === 'GET_VERSION') {
    event.source.postMessage({ type: 'VERSION_REPORT', version: CACHE_NAME });
  }
  if (event.data && event.data.action === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
