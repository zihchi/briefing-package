// ==========================================
// 📦 簡報箱 Service Worker - 離線強化版
// ==========================================
const CACHE_NAME = 'briefing-v152';

// ⬛ 本機靜態檔案：安裝時強制全部寫入快取
const LOCAL_FILES = [
  './',
  './index.html',
  './app.js',
  './aviation-calculator.html',
  './ATIS.html',
  './Captain_Logbook_Cloud.html',
  './Captain_Logbook_Cloud.webmanifest',
  './logbook.tailwind.css',
  './logbook-ofp-ocr.js',
  './FDP.html',
  './FIDS.html',
  './wx-decode.html',
  './rab-610.html',
  './LIDOPRO4.html',
  './PCR.html',
  './TR.html',
  './Turbli_Widget.html',
  './altimetry.html',
  './calendar.html',
  './curfew.html',
  './fpl_decoder.html',
  './fuel.html',
  './pa.html',
  './notam.html',
  './data/waypoints.json',
  './notices.html',
  './swap.html',
  './pilot-rest.html',
  './time.html',
  './ELB_Fleet.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './SwapDutyForm.pdf',
  // HOT 26/27（原 zihchi.github.io/Holdovertime，已併入；表格圖片另存在 HOT_CACHE）
  './hot/index.html',
  './hot/data/hot-2026-27.js',
  './hot/js/metar.js',
  './LIDOPRO.png',
  './TR.jpg',
];

// 🧊 HOT 26/27 的 FAA 原始表格圖片（約 11 MB）：存在獨立、跨版本保留的快取，
//    不在每次版本更新時重抓；首頁開啟時由 PRECACHE_CHECK 補齊缺的檔案。換季（新年度表）時改 HOT_CACHE 名稱。
const HOT_CACHE = 'briefing-hot-2026-27';
// 外部 CDN 程式庫（版本固定、內容不變）：存在跨版本保留的快取，只下載一次，不拖慢每次更新
const CDN_CACHE = 'briefing-cdn-v1';
const KEEP_CACHES = [HOT_CACHE, CDN_CACHE];
// 一律向伺服器確認最新檔案（避開 GitHub Pages／瀏覽器約 10 分鐘的 HTTP 暫存，剛部署後才不會存到舊檔）
const fresh = (u) => new Request(new URL(u, self.registration.scope).href, { cache: 'reload' });
const HOT_IMAGES = [
  './hot/images/2026-27/table_01.jpg',
  './hot/images/2026-27/table_02.jpg',
  './hot/images/2026-27/table_03.jpg',
  './hot/images/2026-27/table_20.jpg',
  './hot/images/2026-27/table_21.jpg',
  './hot/images/2026-27/table_22.jpg',
  './hot/images/2026-27/table_23.jpg',
  './hot/images/2026-27/table_24.jpg',
  './hot/images/2026-27/table_25.jpg',
  './hot/images/2026-27/table_26.jpg',
  './hot/images/2026-27/table_27.jpg',
  './hot/images/2026-27/table_28.jpg',
  './hot/images/2026-27/table_29.jpg',
  './hot/images/2026-27/table_30.jpg',
  './hot/images/2026-27/table_31.jpg',
  './hot/images/2026-27/table_32.jpg',
  './hot/images/2026-27/table_33.jpg',
  './hot/images/2026-27/table_34.jpg',
  './hot/images/2026-27/table_35.jpg',
  './hot/images/2026-27/table_36.jpg',
  './hot/images/2026-27/table_37.jpg',
  './hot/images/2026-27/table_38.jpg',
  './hot/images/2026-27/table_39.jpg',
  './hot/images/2026-27/table_40.jpg',
  './hot/images/2026-27/table_41.jpg',
  './hot/images/2026-27/table_42.jpg',
  './hot/images/2026-27/table_43.jpg',
  './hot/images/2026-27/table_44.jpg',
  './hot/images/2026-27/table_45.jpg',
  './hot/images/2026-27/table_46.jpg',
  './hot/images/2026-27/table_47.jpg',
  './hot/images/2026-27/table_48.jpg',
  './hot/images/2026-27/table_49.jpg',
  './hot/images/2026-27/table_50.jpg',
  './hot/images/2026-27/table_51.jpg',
  './hot/images/2026-27/table_52.jpg',
  './hot/images/2026-27/table_53.jpg',
  './hot/images/2026-27/table_55.jpg',
  './hot/images/2026-27/table_56.jpg',
  './hot/images/2026-27/table_57.jpg',
];

// 🌐 外部 CDN：盡力快取，單一失敗不影響 SW 安裝
const CDN_FILES = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  // 註：Captain_Logbook_Cloud.html 已改用本地預編譯 CSS（見 LOCAL_FILES logbook.tailwind.css）；
  // 其餘頁面（index/LIDOPRO4/FDP…）仍使用下列 Play CDN，故保留預快取。
  'https://cdn.tailwindcss.com',
  // Captain Logbook 圖表/天文計算相依，預先快取讓離線也能畫圖
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2',
  'https://cdnjs.cloudflare.com/ajax/libs/suncalc/1.9.0/suncalc.min.js',
  // OFP 截圖 OCR：Tesseract.js 主程式（worker/core/語言檔於首次使用時由 track-2 快取，之後離線可用）
  'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
  // 外部開啟工具的相依程式庫：沒先開過也能離線使用
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',          // FDP 圖示
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2', // FDP 圖示字型（fas）
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',   // 換班單 PDF
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js',                 // 換班單讀 PDF
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js',
  'https://unpkg.com/lucide@latest',                                                     // 換班單／FPN／PCR 圖示
  'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js',                          // PCR 公式
];

// 🚫 即時動態資料：永遠直接走網路，不快取
const BYPASS_HOSTNAMES = [
  'aviationweather.gov',
  'api.codetabs.com',
  'api.allorigins.win',
  'corsproxy.io',
  'zihchi.workers.dev',
  'open-meteo.com',
  'script.google.com',
  'basemaps.cartocdn.com',
  'embed.windy.com',
  'windy.com',
  'turbli.com',
  'tenki.lbw.jp',
  'data.jma.go.jp',
  'app.cwa.gov.tw',
  // 即時天氣圖（雷達／紅外線衛星由 unibrief 即時產生，常超過 2 秒；地面分析圖來自氣象署）。
  // 不可走下方 2 秒逾時：逾時會回 408 → 圖片顯示「沒抓到」。直接交給瀏覽器載入。
  'unibrief.de.r.appspot.com',
  'www.cwa.gov.tw',
  'docs.google.com',
  'pilotstarspace.starlux-airlines.com',
  'elb.starlux-airlines.com',
  'sjx.ultramain.systems',
  'sjx.lido.aero',
  'flight-plan-editor.weathernews.com',
  'skyinfo.jp',
  'tono2.net',
  'metar-taf.com',
  'metar.vatsim.net',
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
      // 本機檔案全部寫入（強制取最新），任一失敗會讓安裝重試
      await cache.addAll(LOCAL_FILES.map(fresh));
      console.log('✅ 本機檔案快取完成');

      // CDN：只補還沒存過的（跨版本保留），失敗只印警告，不中斷安裝
      const cdn = await caches.open(CDN_CACHE);
      await Promise.allSettled(CDN_FILES.map(async url => {
        if (await cdn.match(url)) return;
        try { await cdn.add(url); } catch (err) { console.warn(`⚠️ CDN 快取失敗 (可忽略): ${url}`, err); }
      }));
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
          keys.filter(k => k !== CACHE_NAME && !KEEP_CACHES.includes(k)).map(k => {
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
    // 同網站的頁面：要求伺服器確認是否有新版（no-cache 會帶 ETag，沒變只回 304，很快）
    const sameOrigin = url.origin === self.location.origin;
    const netReq = sameOrigin
      ? fetch(url.href, { cache: 'no-cache', credentials: 'same-origin' }).then(res =>
          // 導覽不能直接回傳「被轉址過」的回應（Safari 會報錯），重新包一份
          res.redirected ? res.blob().then(b => new Response(b, { status: res.status, statusText: res.statusText, headers: res.headers })) : res)
      : fetch(event.request);
    event.respondWith(
      Promise.race([netReq, new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout')), NETWORK_TIMEOUT))])
        .then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return res;
        })
        .catch(() => {
          console.log('📵 網路超時，讀取離線快取:', url.pathname);
          return matchOfflinePage(url);
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

// 離線開頁：網址可能不帶 .html（GitHub Pages 的 /FDP 等於 /FDP.html），依序嘗試對應的快取檔
async function matchOfflinePage(url) {
  const path = url.pathname;
  const tries = [url.href.split('#')[0]];
  if (path.endsWith('/')) tries.push(url.origin + path + 'index.html');
  else if (!/\.[a-z0-9]+$/i.test(path)) tries.push(url.origin + path + '.html', url.origin + path + '/index.html');
  for (const t of tries) {
    const hit = await caches.match(t, { ignoreSearch: true });
    if (hit) return hit;
  }
  return new Response(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>離線</title><body style="font-family:-apple-system,sans-serif;padding:40px 20px;text-align:center;color:#4a3627;background:#f4ece4">' +
    '<h2>📵 目前離線，這一頁尚未存到手機</h2><p>連上網路後打開簡報箱首頁一次，就會自動存好。</p></body>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

// 補存：首頁每次開啟／重新整理都會呼叫；缺哪個補哪個（iOS 可能清掉部分快取）
let precacheRunning = null;
async function ensurePrecache() {
  const cache = await caches.open(CACHE_NAME);
  let added = 0, failed = 0;
  for (const f of LOCAL_FILES) {
    const req = fresh(f);
    if (await cache.match(req.url, { ignoreSearch: true })) continue;
    try { await cache.add(req); added++; } catch (e) { failed++; }
  }
  const cdn = await caches.open(CDN_CACHE);
  for (const u of CDN_FILES) {
    if (await caches.match(u)) continue;
    try { await cdn.add(u); added++; } catch (e) { failed++; }
  }
  const hot = await caches.open(HOT_CACHE);
  for (const f of HOT_IMAGES) {
    const req = fresh(f);
    if (await hot.match(req.url)) continue;
    try { await hot.add(req); added++; } catch (e) { failed++; }
  }
  return { added, failed, total: LOCAL_FILES.length + CDN_FILES.length + HOT_IMAGES.length };
}

// ============================
// 4. 跨執行緒通訊
// ============================
self.addEventListener('message', event => {
  if (event.data === 'GET_VERSION') {
    event.source.postMessage({ type: 'VERSION_REPORT', version: CACHE_NAME });
  }
  if (event.data && event.data.action === 'PRECACHE_CHECK') {
    if (!precacheRunning) precacheRunning = ensurePrecache().finally(() => { precacheRunning = null; });
    event.waitUntil(precacheRunning.then(r => { if (event.source) event.source.postMessage({ type: 'PRECACHE_DONE', ...r }); }).catch(() => {}));
  }
  if (event.data && event.data.action === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
