// ==========================================
// ✈️  ELB Proxy — Cloudflare Worker (v2)
// ==========================================
// 從 https://zihchi.github.io 呼叫 → 這支 Worker → ELB
// 部署：push to GitHub → Cloudflare 自動部署
// ==========================================

const ELB_BASE = 'https://elb.starlux-airlines.com';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const ALLOWED_ORIGINS = [
  'https://zihchi.github.io',
  'http://localhost:3001',
  'http://localhost:5050',
  'http://localhost:8080',
];

function cors(origin) {
  const ok = ALLOWED_ORIGINS.includes(origin) || (origin && origin.startsWith('http://192.168.'));
  return {
    'Access-Control-Allow-Origin': ok ? origin : 'https://zihchi.github.io',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-Token',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function jsonResp(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors(origin), 'Content-Type': 'application/json; charset=utf-8' },
  });
}

// ──────────────────────────────────────────
// Cookie 工具
// ──────────────────────────────────────────
function collectCookies(res) {
  const result = {};
  // CF Workers 支援 getSetCookie() 標準方法
  let list = [];
  if (typeof res.headers.getSetCookie === 'function') {
    list = res.headers.getSetCookie();
  } else {
    const sc = res.headers.get('set-cookie');
    if (sc) list = [sc];
  }
  for (const sc of list) {
    if (!sc) continue;
    const m = sc.match(/^([^=]+)=([^;]*)/);
    if (m) {
      const name = m[1].trim();
      const value = m[2].trim();
      if (name && value && value !== '""' && value !== 'deleteMe') {
        result[name] = value;
      }
    }
  }
  return result;
}

function cookieStr(obj) {
  return Object.entries(obj).map(([k, v]) => `${k}=${v}`).join('; ');
}

function encodeSession(cookies) {
  // base64-url 編碼整包 cookie
  const json = JSON.stringify(cookies);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeSession(token) {
  if (!token) return null;
  try {
    let b64 = token.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const json = decodeURIComponent(escape(atob(b64)));
    const obj = JSON.parse(json);
    if (obj && typeof obj === 'object') return obj;
  } catch {}
  // 向後相容：純 JSESSIONID
  return { JSESSIONID: token };
}

// ──────────────────────────────────────────
// ELB fetch — 帶上整包 cookie
// ──────────────────────────────────────────
async function elbFetch(path, token, opts = {}) {
  const cookies = decodeSession(token) || {};
  const headers = new Headers(opts.headers || {});
  headers.set('Cookie', cookieStr(cookies));
  headers.set('User-Agent', UA);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json, text/plain, */*');
  headers.set('Accept-Language', 'zh-TW,zh;q=0.9,en;q=0.8');
  headers.set('Referer', `${ELB_BASE}/elb/`);
  headers.set('Origin', ELB_BASE);
  // ★ 關鍵：標示為 AJAX，繞過 SPA HTML fallback
  headers.set('X-Requested-With', 'XMLHttpRequest');
  headers.set('Sec-Fetch-Dest', 'empty');
  headers.set('Sec-Fetch-Mode', 'cors');
  headers.set('Sec-Fetch-Site', 'same-origin');
  return fetch(`${ELB_BASE}${path}`, {
    ...opts,
    headers,
    redirect: 'manual',
  });
}

// ──────────────────────────────────────────
// /api/login  POST {user, pass}
// ──────────────────────────────────────────
async function handleLogin(request, origin) {
  let body;
  try { body = await request.json(); } catch {
    return jsonResp({ ok: false, error: '請求格式錯誤' }, 400, origin);
  }
  const { user, pass } = body;
  if (!user || !pass) {
    return jsonResp({ ok: false, error: '缺少帳號或密碼' }, 400, origin);
  }

  // Step 1: GET /elb/ 取得初始 cookies（像真實瀏覽器）
  let cookies = {};
  try {
    const initRes = await fetch(`${ELB_BASE}/elb/`, {
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml' },
      redirect: 'manual',
    });
    Object.assign(cookies, collectCookies(initRes));
  } catch (e) {
    return jsonResp({ ok: false, error: 'ELB 連線失敗: ' + String(e) }, 502, origin);
  }

  // Step 2: POST 帳密
  const form = new URLSearchParams();
  form.set('j_username', user);
  form.set('j_password', pass);

  const loginRes = await fetch(`${ELB_BASE}/elb/auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookieStr(cookies),
      'User-Agent': UA,
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
      'Origin': ELB_BASE,
      'Referer': `${ELB_BASE}/elb/`,
      'X-Requested-With': 'XMLHttpRequest',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
    },
    body: form,
    redirect: 'manual',
  });

  Object.assign(cookies, collectCookies(loginRes));

  // Step 3: 若 302，跟著 redirect 走最多 3 跳（拿後續 cookies）
  let cur = loginRes;
  for (let i = 0; i < 3; i++) {
    if (cur.status !== 301 && cur.status !== 302 && cur.status !== 303) break;
    const loc = cur.headers.get('location');
    if (!loc) break;
    const followUrl = new URL(loc, ELB_BASE).toString();
    cur = await fetch(followUrl, {
      headers: {
        'Cookie': cookieStr(cookies),
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml',
        'Referer': `${ELB_BASE}/elb/`,
      },
      redirect: 'manual',
    });
    Object.assign(cookies, collectCookies(cur));
  }

  // 不需要 REST 驗證 — ELB 不管帳密對錯都會給 JSESSIONID
  // 真正可不可以用，要靠 WebSocket 才能知道
  if (!cookies.JSESSIONID) {
    return jsonResp({
      ok: false,
      error: '登入失敗（ELB 沒回 JSESSIONID）',
      debug: { loginStatus: loginRes.status, cookieNames: Object.keys(cookies) },
    }, 401, origin);
  }

  return jsonResp({
    ok: true,
    session: encodeSession(cookies),
    cookieNames: Object.keys(cookies),
  }, 200, origin);
}

// ──────────────────────────────────────────
// /api/cookie-login  POST { cookieString }
// 接收瀏覽器整包 Cookie 字串（從 DevTools 複製來的），打包成 session token
// 這是繞過 Imperva 的方式：用使用者真實瀏覽器的 cookies
// ──────────────────────────────────────────
async function handleCookieLogin(request, origin) {
  let body;
  try { body = await request.json(); } catch {
    return jsonResp({ ok: false, error: '請求格式錯誤' }, 400, origin);
  }
  const { cookieString } = body;
  if (!cookieString) return jsonResp({ ok: false, error: '缺少 cookieString' }, 400, origin);

  // 解析 "key=val; key=val; ..." 字串
  const cookies = {};
  for (const part of cookieString.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k && v) cookies[k] = v;
  }

  if (!cookies.JSESSIONID) {
    return jsonResp({ ok: false, error: '貼上的 cookie 找不到 JSESSIONID' }, 400, origin);
  }

  // 即時驗證：開個 WS 試試
  let validation = { tested: false };
  try {
    const ws = await openELBWebSocket(cookies);
    validation = { tested: true, wsConnected: true };
    try { ws.close(); } catch {}
  } catch (e) {
    validation = { tested: true, wsConnected: false, error: e.message };
  }

  return jsonResp({
    ok: true,
    session: encodeSession(cookies),
    cookieNames: Object.keys(cookies),
    validation,
  }, 200, origin);
}

// ──────────────────────────────────────────
// /api/status  GET (X-Session-Token)
// ──────────────────────────────────────────
async function handleStatus(request, origin) {
  const url = new URL(request.url);
  const token = url.searchParams.get('session') || request.headers.get('X-Session-Token');
  if (!token) return jsonResp({ ok: true, loggedIn: false }, 200, origin);

  const res = await elbFetch('/elb/services/landingPage/getLandingPageImmediate?dataKeys=DASHBOARD_AIRCRAFT_LIST', token);
  const ct = res.headers.get('content-type') || '';
  return jsonResp({
    ok: true,
    loggedIn: res.status === 200 && ct.includes('json'),
    status: res.status,
    contentType: ct,
  }, 200, origin);
}

// ──────────────────────────────────────────
// WebSocket 客戶端：連到 ELB 的 /logbook-api/session
// ──────────────────────────────────────────
async function openELBWebSocket(cookies) {
  const wsUrl = `${ELB_BASE}/logbook-api/session`;

  const resp = await fetch(wsUrl, {
    headers: {
      'Upgrade': 'websocket',
      'Connection': 'Upgrade',
      'Cookie': cookieStr(cookies),
      'User-Agent': UA,
      'Origin': ELB_BASE,
      'Sec-WebSocket-Version': '13',
      'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8',
    },
  });

  if (resp.status !== 101) {
    const body = await resp.text().catch(() => '');
    throw new Error(`WS upgrade failed: HTTP ${resp.status} — ${body.slice(0, 200)}`);
  }

  const ws = resp.webSocket;
  if (!ws) throw new Error('No webSocket in response');
  ws.accept();
  return ws;
}

// 共用 WS pipeline：可在同一連線上送多個 req，依 id 收回應
function makeWSPipeline(ws) {
  const pending = new Map();   // id → resolve
  let nextId = 0;

  ws.addEventListener('message', (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }
    if (msg.type === 'res' && msg.id != null && pending.has(msg.id)) {
      const fn = pending.get(msg.id);
      pending.delete(msg.id);
      fn(msg.content);
    }
  });

  return {
    req(func, content, perReqTimeoutMs = 8000) {
      return new Promise((resolve, reject) => {
        const id = nextId++;
        const t = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`req ${func} timeout`));
        }, perReqTimeoutMs);
        pending.set(id, (data) => { clearTimeout(t); resolve(data); });
        ws.send(JSON.stringify({ id, type: 'req', func, content }));
      });
    },
    nextId() { return nextId; },
  };
}

// 等到第一筆 init 訊息（含 operatorCode）才能開始送 req
function waitForInit(ws, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('init timeout')), timeoutMs);
    const handler = (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }
      if (msg.content && msg.content.operatorCode) {
        clearTimeout(t);
        ws.removeEventListener('message', handler);
        resolve(msg.content.operatorCode);
      }
    };
    ws.addEventListener('message', handler);
  });
}

// 開啟 WS，撈機隊清單，再並行 enrich 每台飛機的 state
async function fetchFleetViaWS(cookies, timeoutMs = 25000) {
  const ws = await openELBWebSocket(cookies);
  let closed = false;
  const closeWS = () => { if (!closed) { closed = true; try { ws.close(1000, 'done'); } catch {} } };

  try {
    const operatorCode = await waitForInit(ws);
    const pipe = makeWSPipeline(ws);

    // Step 1: 拿機隊清單
    const fleetData = await pipe.req('getAircraftList', {
      id: operatorCode,
      extensions: ['FleetDashboard:RecentDefects', 'FleetDashboard:ColumnConfiguration'],
    }, 10000);

    const aircraft = Array.isArray(fleetData?.aircraft) ? fleetData.aircraft : [];

    // Step 2: 並行抓每台 state（合併到原本清單）
    const enriched = await Promise.all(
      aircraft.map(a =>
        pipe.req('getAircraftState', { id: a.aircraftIdentifier }, 8000)
          .then(state => ({ ...a, ...state }))
          .catch(() => a) // 個別失敗就用 bare info
      )
    );

    closeWS();
    return { ok: true, data: { ...fleetData, aircraft: enriched }, operatorCode, count: enriched.length };
  } catch (e) {
    closeWS();
    return { ok: false, error: e.message || String(e) };
  }
}

// ──────────────────────────────────────────
// /api/fleet  GET  X-Session-Token
// 走 WebSocket 路線
// ──────────────────────────────────────────
async function handleFleet(request, origin) {
  const token = request.headers.get('X-Session-Token') || new URL(request.url).searchParams.get('session');
  if (!token) return jsonResp({ ok: false, error: '未登入' }, 401, origin);

  const cookies = decodeSession(token) || {};
  if (!cookies.JSESSIONID) return jsonResp({ ok: false, error: '缺少 JSESSIONID cookie' }, 401, origin);

  try {
    const result = await fetchFleetViaWS(cookies);
    if (!result.ok) {
      return jsonResp({ ok: false, error: result.error, trace: result.trace }, 502, origin);
    }
    return jsonResp({ ok: true, data: result.data, operatorCode: result.operatorCode }, 200, origin);
  } catch (e) {
    return jsonResp({ ok: false, error: 'WS 連線失敗: ' + e.message }, 502, origin);
  }
}

// 開啟 WS，撈單機完整詳情：state + NTCs + MELs + 近 5 航班
async function fetchAircraftDetailViaWS(cookies, tail, timeoutMs = 30000) {
  const ws = await openELBWebSocket(cookies);
  let closed = false;
  const closeWS = () => { if (!closed) { closed = true; try { ws.close(1000, 'done'); } catch {} } };

  // 整體超時保護
  const overallTimer = setTimeout(() => closeWS(), timeoutMs);

  try {
    await waitForInit(ws);
    const pipe = makeWSPipeline(ws);

    // Step 1: 單機狀態（拿到 IDs）
    const state = await pipe.req('getAircraftState', { id: tail }, 10000);

    const ntcIds   = Array.isArray(state.notesToCrew)     ? state.notesToCrew     : [];
    const melIds   = Array.isArray(state.deferredDefects) ? state.deferredDefects : [];
    const openIds  = Array.isArray(state.openDefects)     ? state.openDefects     : [];
    const closedFs = Array.isArray(state.closedFlights)   ? state.closedFlights.slice(0, 5) : [];
    const activeFs = Array.isArray(state.activeFlights)   ? state.activeFlights   : [];

    // Step 2: 並行抓所有東西
    const [ntcs, mels, openDefs, recentFlights, currentFlights] = await Promise.all([
      // NTC 全文
      Promise.all(ntcIds.map(id =>
        pipe.req('getNoteToCrew', { id }, 7000)
          .then(d => ({ _id: id, ...d }))
          .catch(e => ({ _id: id, _error: e.message }))
      )),

      // MEL 條目 + 維修動作（兩段查詢）
      Promise.all(melIds.map(async id => {
        try {
          const ml = await pipe.req('getMaintLog', { id }, 7000);
          const maId = ml?.latestDeferringMaintActionId;
          if (maId) {
            ml._action = await pipe.req('getMaintAction', { id: maId }, 7000).catch(() => null);
          }
          return { _id: id, ...ml };
        } catch (e) {
          return { _id: id, _error: e.message };
        }
      })),

      // Open Defects（state.openDefects 是 maintLog id 清單）— 抓全文 + 維修動作
      Promise.all(openIds.map(async raw => {
        const id = (raw && typeof raw === 'object') ? (raw._id || raw.id || raw.recordId) : raw;
        try {
          const ml = await pipe.req('getMaintLog', { id }, 7000);
          const actId = ml?.latestMaintActionId;
          if (actId) {
            ml._action = await pipe.req('getMaintAction', { id: actId }, 6000).catch(() => null);
          }
          return { _id: id, ...ml };
        } catch (e) {
          return { _id: id, _error: e.message };
        }
      })),

      // 近 5 航班 + 每個航班的 log entries + fuel
      Promise.all(closedFs.map(async id => {
        try {
          const flt = await pipe.req('getFlightLog', { id }, 7000);
          const mlIds   = Array.isArray(flt?.maintLogIds)    ? flt.maintLogIds    : [];
          const svIds   = Array.isArray(flt?.serviceLogIds)  ? flt.serviceLogIds  : [];
          const fuelIds = Array.isArray(flt?.fuelRecordIds)  ? flt.fuelRecordIds  : [];

          const [mlLogs, svLogs, fuels] = await Promise.all([
            // ML：抓 maintLog + 它的 latestMaintActionId（"Action to Close" 內容）
            Promise.all(mlIds.map(async lid => {
              try {
                const ml = await pipe.req('getMaintLog', { id: lid }, 6000);
                const actId = ml?.latestMaintActionId;
                if (actId) {
                  ml._action = await pipe.req('getMaintAction', { id: actId }, 6000).catch(() => null);
                }
                return { _id: lid, _type: 'ML', ...ml };
              } catch (e) {
                return { _id: lid, _type: 'ML', _error: e.message };
              }
            })),
            Promise.all(svIds.map(lid =>
              pipe.req('getServiceLog', { id: lid }, 6000)
                .then(d => ({ _id: lid, _type: 'SV', ...d }))
                .catch(e => ({ _id: lid, _type: 'SV', _error: e.message }))
            )),
            Promise.all(fuelIds.map(fid =>
              pipe.req('getFuelRecord', { id: fid }, 6000)
                .then(d => ({ _id: fid, ...d }))
                .catch(e => ({ _id: fid, _error: e.message }))
            )),
          ]);

          flt._logs = [...mlLogs, ...svLogs];
          flt._fuels = fuels;
          return { _id: id, ...flt };
        } catch (e) {
          return { _id: id, _error: e.message };
        }
      })),

      // 目前在飛的航班（基本資訊）
      Promise.all(activeFs.map(id =>
        pipe.req('getFlightLog', { id }, 7000)
          .then(d => ({ _id: id, ...d }))
          .catch(e => ({ _id: id, _error: e.message }))
      )),
    ]);

    clearTimeout(overallTimer);
    closeWS();
    return {
      ok: true,
      data: {
        state,
        notesToCrew: ntcs,
        deferredDefects: mels,
        openDefects: openDefs,
        recentFlights,
        currentFlights,
      },
    };
  } catch (e) {
    clearTimeout(overallTimer);
    closeWS();
    return { ok: false, error: e.message || String(e) };
  }
}

// ──────────────────────────────────────────
// /api/aircraft/:tail  GET  X-Session-Token
// WS 路線：訂閱單機 events
// ──────────────────────────────────────────
async function handleAircraft(request, tail, origin) {
  const token = request.headers.get('X-Session-Token') || new URL(request.url).searchParams.get('session');
  if (!token) return jsonResp({ ok: false, error: '未登入' }, 401, origin);

  const cookies = decodeSession(token) || {};
  if (!cookies.JSESSIONID) return jsonResp({ ok: false, error: '缺少 JSESSIONID cookie' }, 401, origin);

  try {
    const result = await fetchAircraftDetailViaWS(cookies, tail);
    if (!result.ok) return jsonResp({ ok: false, error: result.error }, 502, origin);
    return jsonResp({ ok: true, tail, ...result.data }, 200, origin);
  } catch (e) {
    return jsonResp({ ok: false, error: 'WS 連線失敗: ' + e.message }, 502, origin);
  }
}

// ──────────────────────────────────────────
// /api/ws-probe?id=xxx&funcs=getFlight,getFlt,...
// 給定一個 ID，試多個函式名稱，回報哪個有回應
// ──────────────────────────────────────────
async function handleWsProbe(request, origin) {
  const url = new URL(request.url);
  const token = request.headers.get('X-Session-Token') || url.searchParams.get('session');
  const id = url.searchParams.get('id');
  const funcsParam = url.searchParams.get('funcs') || 'getFlight,getFlt,getFlightLog,getFltLog,getFlightLogPage,getMaintLogPage,getFlightRecord,getEntity';
  if (!token) return jsonResp({ ok: false, error: '未登入' }, 401, origin);
  if (!id) return jsonResp({ ok: false, error: '需要 id 參數' }, 400, origin);

  const cookies = decodeSession(token) || {};
  const ws = await openELBWebSocket(cookies);
  let closed = false;
  const closeWS = () => { if (!closed) { closed = true; try { ws.close(); } catch {} } };

  try {
    await waitForInit(ws);
    const pipe = makeWSPipeline(ws);
    const funcs = funcsParam.split(',').map(s => s.trim()).filter(Boolean);

    const results = await Promise.all(funcs.map(async func => {
      try {
        const data = await pipe.req(func, { id }, 5000);
        return { func, ok: true, keys: data && typeof data === 'object' ? Object.keys(data).slice(0, 20) : null, preview: JSON.stringify(data).slice(0, 300) };
      } catch (e) {
        return { func, ok: false, error: e.message };
      }
    }));

    closeWS();
    return jsonResp({ ok: true, id, results }, 200, origin);
  } catch (e) {
    closeWS();
    return jsonResp({ ok: false, error: e.message }, 502, origin);
  }
}

// ──────────────────────────────────────────
// /api/proxy?path=/elb/...  GET  X-Session-Token
// ──────────────────────────────────────────
async function handleProxy(request, origin) {
  const url = new URL(request.url);
  const path = url.searchParams.get('path');
  const token = request.headers.get('X-Session-Token') || url.searchParams.get('session');
  if (!path || !path.startsWith('/elb/')) {
    return jsonResp({ ok: false, error: 'path 必須以 /elb/ 開頭' }, 400, origin);
  }
  if (!token) return jsonResp({ ok: false, error: '未登入' }, 401, origin);

  const res = await elbFetch(path, token);
  const ct = res.headers.get('content-type') || '';
  const text = await res.text();
  if (ct.includes('application/json')) {
    try {
      return jsonResp({ ok: true, status: res.status, data: JSON.parse(text) }, 200, origin);
    } catch {}
  }
  return jsonResp({ ok: true, status: res.status, contentType: ct, raw: text.slice(0, 5000) }, 200, origin);
}

// ──────────────────────────────────────────
// /api/aerodatabox?flight=JX123&date=2026-06-08  GET
// 用 AeroDataBox (RapidAPI 免費額度) 查航班起訖時間（表定/預計/實際）
//   · index.html 頂部航班面板用；gate/terminal/行李轉盤已不再回傳
//   · API key 走 secret env.AERODATABOX_KEY,不入前端、不入 git
//   · 伺服器端 Cloudflare Cache 快取 1 小時,跨裝置共用、省免費額度
//   · 回傳精簡欄位,單次查詢同時涵蓋 dep + arr 兩側時間
// ──────────────────────────────────────────
async function handleAeroDataBox(request, origin, env, ctx) {
  // 只服務 allowlist 來源(瀏覽器會帶 Origin),擋掉非預期的額度消耗
  const okOrigin = ALLOWED_ORIGINS.includes(origin) || (origin && origin.startsWith('http://192.168.'));
  if (!okOrigin) return jsonResp({ ok: false, error: '來源不被允許' }, 403, origin);

  const key = env && env.AERODATABOX_KEY;
  if (!key) return jsonResp({ ok: false, error: 'AERODATABOX_KEY 未設定 (請 wrangler secret put AERODATABOX_KEY)' }, 500, origin);

  const url = new URL(request.url);
  const flight = (url.searchParams.get('flight') || '').replace(/\s+/g, '').toUpperCase();
  const date = url.searchParams.get('date') || '';
  if (!/^[A-Z0-9]{3,8}$/.test(flight)) return jsonResp({ ok: false, error: 'flight 參數無效' }, 400, origin);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return jsonResp({ ok: false, error: 'date 需為 YYYY-MM-DD' }, 400, origin);

  // 伺服器端快取(與來源無關的 key,跨裝置共用)
  const cache = caches.default;
  const cacheKey = new Request(`https://adb-cache.internal/flights/${flight}/${date}`);
  const cachedResp = await cache.match(cacheKey);
  if (cachedResp) {
    const slim = await cachedResp.json();
    return jsonResp({ ok: true, cached: true, flights: slim }, 200, origin);
  }

  const api = `https://aerodatabox.p.rapidapi.com/flights/number/${encodeURIComponent(flight)}/${date}?withAircraftImage=false&withLocation=false`;
  let res;
  try {
    res = await fetch(api, {
      headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': 'aerodatabox.p.rapidapi.com' },
    });
  } catch (e) {
    return jsonResp({ ok: false, error: 'AeroDataBox 連線失敗: ' + String(e) }, 502, origin);
  }

  // 該日無此班 → 正常空結果(也快取空結果,避免同班重複打 API)
  if (res.status === 204 || res.status === 404) {
    putAdbCache(ctx, cache, cacheKey, []);
    return jsonResp({ ok: true, flights: [] }, 200, origin);
  }
  if (res.status === 429) {
    return jsonResp({ ok: false, rateLimited: true, error: 'AeroDataBox 額度用罄或被限流 (HTTP 429)' }, 429, origin);
  }
  if (res.status !== 200) {
    const t = await res.text().catch(() => '');
    return jsonResp({ ok: false, error: `AeroDataBox HTTP ${res.status}`, detail: t.slice(0, 200) }, 502, origin);
  }

  let data;
  try { data = await res.json(); } catch { data = null; }
  const list = Array.isArray(data) ? data : (data ? [data] : []);
  // AeroDataBox 的時間欄位皆為 { utc, local } 物件（local 自帶時區位移）：
  //   scheduledTime = 表定、revisedTime = 預計（即時變動）、runwayTime = 實際起降
  const slimTime = t => (t && (t.utc || t.local)) ? { utc: t.utc || '', local: t.local || '' } : null;
  const slim = list.map(f => ({
    number: f.number || '',
    status: f.status || '',
    departure: f.departure ? {
      icao: f.departure.airport?.icao || '',
      iata: f.departure.airport?.iata || '',
      scheduledTime: slimTime(f.departure.scheduledTime),
      revisedTime: slimTime(f.departure.revisedTime),
      runwayTime: slimTime(f.departure.runwayTime),
    } : null,
    arrival: f.arrival ? {
      icao: f.arrival.airport?.icao || '',
      iata: f.arrival.airport?.iata || '',
      scheduledTime: slimTime(f.arrival.scheduledTime),
      revisedTime: slimTime(f.arrival.revisedTime),
      runwayTime: slimTime(f.arrival.runwayTime),
    } : null,
  }));

  putAdbCache(ctx, cache, cacheKey, slim);
  return jsonResp({ ok: true, flights: slim }, 200, origin);
}

function putAdbCache(ctx, cache, cacheKey, slim) {
  const toCache = new Response(JSON.stringify(slim), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=3600' },
  });
  if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(cache.put(cacheKey, toCache));
  else cache.put(cacheKey, toCache);
}

// ──────────────────────────────────────────
// 🌦️ METAR / TAF 代理 → aviationweather.gov (NOAA 官方)
// 取代免費公用代理（corsproxy/codetabs/allorigins，慢/不穩/自帶舊快取）；
// 直打 NOAA + 邊緣短快取 45s → 又快又新鮮。
// ──────────────────────────────────────────
async function handleWx(url, origin) {
  const type = (url.searchParams.get('type') || 'metar').toLowerCase();
  const ids = (url.searchParams.get('ids') || '').trim();
  const hours = url.searchParams.get('hours') || '';
  const format = url.searchParams.get('format') || 'json';
  if (type !== 'metar' && type !== 'taf') return jsonResp({ error: 'type 必須是 metar 或 taf' }, 400, origin);
  if (!ids) return jsonResp({ error: '缺少 ids（機場 ICAO，可逗號分隔）' }, 400, origin);
  let target = `https://aviationweather.gov/api/data/${type}?ids=${encodeURIComponent(ids)}&format=${encodeURIComponent(format)}`;
  if (hours) target += `&hours=${encodeURIComponent(hours)}`;
  try {
    const up = await fetch(target, {
      cf: { cacheTtl: 45, cacheEverything: true },
      headers: { 'Accept': 'application/json', 'User-Agent': UA },
    });
    const body = await up.text();
    return new Response(body, {
      status: up.status,
      headers: {
        ...cors(origin),
        'Content-Type': up.headers.get('Content-Type') || 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=45',
        'X-Proxy-By': 'elb-worker-wx',
      },
    });
  } catch (e) {
    return jsonResp({ error: 'aviationweather.gov 取得失敗: ' + String(e) }, 502, origin);
  }
}

// ══════════════════════════════════════════
// ✈️  LIDO 航班擷取 — /api/lido POST
// ──────────────────────────────────────────
// 取代舊的 Google Apps Script 端點（GAS 冷啟動 + UrlFetchApp 慢，
// 一次擷取要 10~20s；Worker 跑在邊緣、文件平行下載，通常 2~4s）。
//
// body: { username, password, targetFlight, legId?, date? }
//   date  — 選填 'YYYY-MM-DD'（UTC 日），有給就把航班總表窗口移到那天，
//           並只保留該日的候選；沒給則沿用「現在 ±24h」。
//   legId — 選填，picker 選定後帶回來直接抓那一班。
//
// 回傳（與前端相容）：
//   { status:'success',  data: <chosen 含 ofpDetails / rawTexts> }
//   { status:'multiple', candidates: [...] }   ← 同日多班同號時交給 picker
//
// 所需 secret（設在 briefing-package 這支 worker 上）：
//   LIDO_BASE_URL / LIDO_CUSTOMER_ID / LIDO_AUTH_REALM / LIDO_DWR_SESSION_ID
// ══════════════════════════════════════════
const LIDO_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// 帶逾時的 fetch：LIDO 若被防火牆擋而 hang，會快速中止，讓前端能及時退回 GAS
function lfetch(url, opts = {}, ms = 9000) {
  return fetch(url, { ...opts, signal: AbortSignal.timeout(ms) });
}

// /api/lido-probe GET — 只戳公開的 login.jsp，判斷「Cloudflare 出口能不能到 LIDO」。
// 只需要 LIDO_BASE_URL 這一個 secret；不碰帳密，login.jsp 是公開頁。
async function handleLidoProbe(origin, env) {
  const BASE = env.LIDO_BASE_URL;
  if (!BASE) return jsonResp({ ok: false, reachable: false, error: 'LIDO_BASE_URL 未設定，先 wrangler secret put LIDO_BASE_URL' }, 200, origin);
  const t0 = Date.now();
  try {
    const r = await lfetch(`${BASE}/lido/las/login.jsp`, { method: 'GET', redirect: 'manual', headers: { 'User-Agent': LIDO_UA } }, 10000);
    return jsonResp({
      ok: true,
      reachable: r.status > 0,
      httpStatus: r.status,
      ms: Date.now() - t0,
      verdict: (r.status >= 200 && r.status < 500) ? 'Cloudflare 可到達 LIDO（防火牆未擋）' : `回應狀態 ${r.status}，需再看細節`,
    }, 200, origin);
  } catch (e) {
    return jsonResp({
      ok: false,
      reachable: false,
      ms: Date.now() - t0,
      error: String(e?.message || e),
      verdict: 'Cloudflare 連不到 LIDO（可能真的被防火牆擋，維持 GAS）',
    }, 200, origin);
  }
}

async function handleLido(request, origin, env) {
  let body;
  try { body = await request.json(); } catch {
    return jsonResp({ status: 'error', message: '請求格式錯誤 (非 JSON)' }, 200, origin);
  }
  const { username, password, targetFlight, legId, date } = body || {};
  if (!username || !password || !targetFlight) {
    return jsonResp({ status: 'error', message: '未提供完整的帳號、密碼或目標航班號。' }, 200, origin);
  }
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return jsonResp({ status: 'error', message: '日期格式錯誤，需為 YYYY-MM-DD。' }, 200, origin);
  }
  try {
    const target = String(targetFlight).replace(/\s+/g, '').toUpperCase();
    const result = await fetchLidoBriefing(env, username, password, target, targetFlight, legId, date);
    return jsonResp(result, 200, origin);
  } catch (e) {
    return jsonResp({ status: 'error', message: String(e?.message || e) }, 200, origin);
  }
}

async function fetchLidoBriefing(env, username, password, target, targetRawForMsg, legId, date) {
  const BASE     = env.LIDO_BASE_URL;
  const CUSTOMER = env.LIDO_CUSTOMER_ID;
  const REALM    = env.LIDO_AUTH_REALM;
  const DWR_SS   = env.LIDO_DWR_SESSION_ID;
  if (!BASE || !CUSTOMER || !REALM || !DWR_SS) {
    throw new Error('Worker LIDO secrets 未完整設定，請執行 wrangler secret put（LIDO_BASE_URL / LIDO_CUSTOMER_ID / LIDO_AUTH_REALM / LIDO_DWR_SESSION_ID）。');
  }

  // 1. 初始 GET → 拿 initial cookies
  const initialUrl = `${BASE}/lido/las/login.jsp?DESMON_RESULT_PAGE=${BASE}/briefing/`;
  const r1 = await lfetch(initialUrl, { method: 'GET', redirect: 'manual' });
  let cookies = lidoExtractCookies(r1.headers);

  // 2. DWR login POST
  const dwrUrl = `${BASE}/lido/las/dwr/call/plaincall/LoginBean.login.dwr`;
  const dwrPayload =
    'callCount=1\nnextReverseAjaxIndex=0\nc0-scriptName=LoginBean\nc0-methodName=login\nc0-id=0\n' +
    'c0-param0=string:' + username + '\n' +
    'c0-param1=string:' + password + '\n' +
    'c0-param2=string:\nc0-param3=string:LIDO\nc0-param4=string:en\n' +
    'batchId=0\ninstanceId=0\n' +
    'page=%2Flido%2Flas%2Flogin.jsp%3FDESMON_RESULT_PAGE%3D' + encodeURIComponent(BASE) +
    '%2Fbriefing%26DESMON_CODE%3DLAS_001%26DESMON_LANG%3Dnull\n' +
    'scriptSessionId=' + DWR_SS + '\n';

  const r2 = await lfetch(dwrUrl, {
    method: 'POST',
    body: dwrPayload,
    redirect: 'manual',
    headers: { 'Cookie': cookies, 'Content-Type': 'text/plain', 'User-Agent': LIDO_UA },
  });
  cookies = lidoCombineCookies(cookies, lidoExtractCookies(r2.headers));

  // 3. 取航班總表。有指定日期 → 以該 UTC 日為中心（前一天 00:00Z 到後一天 24:00Z，
  //    涵蓋跨日紅眼班）；否則沿用現在 ±24h。
  let startTime, endTime;
  if (date) {
    const dayMs = new Date(date + 'T00:00:00.000Z').getTime();
    startTime = new Date(dayMs - 24 * 3600 * 1000).toISOString();
    endTime   = new Date(dayMs + 48 * 3600 * 1000).toISOString();
  } else {
    const now = Date.now();
    startTime = new Date(now - 24 * 3600 * 1000).toISOString();
    endTime   = new Date(now + 24 * 3600 * 1000).toISOString();
  }
  const listUrl = `${BASE}/lido/lcb/ui/flightlist?startDateTime=${startTime}&endDateTime=${endTime}`;
  const lidoCsrf = lidoGetCookieValue(cookies, 'lido_csrf') || '';

  const makeHeaders = (businessId) => ({
    'Cookie': cookies,
    'Accept': 'application/vnd.lsy.lido.lcb.v1.hal+json, application/json, text/plain, */*',
    'User-Agent': LIDO_UA,
    'Referer': `${BASE}/briefing/`,
    'X-Requested-With': 'XMLHttpRequest',
    'x-lido-applicationid': 'lido-lcb',
    'x-lido-auth': REALM,
    'x-lido-businessid': businessId,
    'x-lido-clientid': 'lido-lcb-ui',
    'x-lido-customerid': CUSTOMER,
    'x-lido-csrf': lidoCsrf,
    'x-lido-timestamp': new Date().toISOString(),
    'x-lido-traceid': lidoUuid(),
  });

  const listResp = await lfetch(listUrl, { method: 'GET', headers: makeHeaders('SearchFlights'), redirect: 'manual' });
  if (listResp.status !== 200) {
    throw new Error(`總表取得失敗，HTTP 狀態碼：${listResp.status}（可能 LIDO session 失效或 secret 有誤）。`);
  }
  let flights = JSON.parse(await listResp.text());
  if (!Array.isArray(flights)) flights = [flights];

  // 4. 比對目標班號
  const digits = target.replace(/[^0-9]/g, '');
  let matched = flights.filter(f => {
    const code = `${f.aircraftOperator || ''}${f.flightNumber || ''}`.replace(/\s+/g, '').toUpperCase();
    return code === target || String(f.flightNumber || '') === digits;
  });
  if (matched.length === 0) {
    throw new Error(`找不到代號為 ${targetRawForMsg} 的航班${date ? `（${date}）` : ''}。`);
  }

  const originDay = (f) => (f.flightOriginDate || f.scheduledDepartureTime || '').slice(0, 10);

  let chosen;
  if (legId) {
    // picker 已選定：直接鎖這一班（總表窗口可能沒涵蓋時退回最小物件）
    chosen = matched.find(f => f.legId === legId) || flights.find(f => f.legId === legId) || { legId };
  } else {
    // 有指定日期 → 只留該日；同日仍多班同號才交給 picker
    if (date) {
      const sameDay = matched.filter(f => originDay(f) === date);
      if (sameDay.length > 0) matched = sameDay;
    }
    if (matched.length > 1) {
      return { status: 'multiple', candidates: matched };
    }
    chosen = matched[0];
  }

  // 5. 取該航班 briefing 詳細
  const encodedLegId = encodeURIComponent(chosen.legId);
  const detailUrl = `${BASE}/lido/lcb/ui/${encodedLegId}/briefing`;
  const detailResp = await lfetch(detailUrl, { method: 'GET', headers: makeHeaders('GetFlightBriefing'), redirect: 'manual' });
  if (detailResp.status !== 200) {
    chosen.ofpDetails = { error: 'OFP 詳細資料取得失敗' };
    return { status: 'success', data: chosen };
  }
  const briefingData = JSON.parse(await detailResp.text());
  chosen.ofpDetails = briefingData;
  chosen.rawTexts = {};

  // 6. 平行下載各類文件 / 圖檔
  try {
    const cats = briefingData.categories
              || (briefingData.briefingPackages && briefingData.briefingPackages[0] && briefingData.briefingPackages[0].categories)
              || [];
    const requiredTypes = ['OFP', 'ATS', 'NOTAM', 'CREWINFO', 'RAIM', 'VERTPROF', 'SIGWXROUTE', 'IWFR'];
    const multiImageTypes = new Set(['SIGWXROUTE']);
    const multiTextTypes = new Set(['IWFR']);

    const docTasks = [];
    for (const cat of cats) {
      if (!requiredTypes.includes(cat.type) || !cat.documents) continue;
      const isMulti = multiImageTypes.has(cat.type);
      const isMultiText = multiTextTypes.has(cat.type);
      for (let d = 0; d < cat.documents.length; d++) {
        const doc = cat.documents[d];
        const mt = doc.mediaType || '';
        if (mt === 'text/plain' || mt.includes('image') || isMulti) {
          docTasks.push({
            url: `${BASE}/lido/lcb/ui/${encodedLegId}/briefing/${doc.fileId}/docs`,
            key: isMulti ? `${cat.type}_${d}` : cat.type,
            append: isMultiText,
          });
          if (!isMulti && !isMultiText) break;
        }
      }
    }

    if (docTasks.length > 0) {
      const responses = await Promise.all(docTasks.map(t => {
        const hdrs = makeHeaders('GetDocument');
        hdrs['Accept'] = 'text/plain, image/*, */*';
        return lfetch(t.url, { method: 'GET', headers: hdrs, redirect: 'manual' }, 12000);
      }));
      for (let i = 0; i < responses.length; i++) {
        const r = responses[i];
        const k = docTasks[i].key;
        if (r.status !== 200) { if (!(docTasks[i].append && chosen.rawTexts[k])) chosen.rawTexts[k] = '下載失敗'; continue; }
        const cType = r.headers.get('Content-Type') || '';
        const isImg = cType.includes('image') || k.indexOf('VERTPROF') !== -1 || k.indexOf('SIGWXROUTE') !== -1;
        if (isImg) {
          const buf = await r.arrayBuffer();
          const mime = (cType.split(';')[0] || '').trim() || 'image/png';
          chosen.rawTexts[k] = `data:${mime};base64,${lidoAb2b64(buf)}`;
        } else {
          const txt = await r.text();
          chosen.rawTexts[k] = (docTasks[i].append && chosen.rawTexts[k])
            ? chosen.rawTexts[k] + '\n' + txt
            : txt;
        }
      }
    }
  } catch (e) {
    chosen.rawTextsError = String(e?.message || e);
  }

  return { status: 'success', data: chosen };
}

// LIDO 專用小工具（與上方 ELB 的 cookie 物件版分開，避免混淆）
function lidoExtractCookies(headers) {
  let raw;
  if (typeof headers.getSetCookie === 'function') raw = headers.getSetCookie();
  else { raw = []; headers.forEach((v, k) => { if (k.toLowerCase() === 'set-cookie') raw.push(v); }); }
  return raw.map(c => c.split(';')[0]).join('; ');
}
function lidoCombineCookies(oldC, newC) {
  if (!newC) return oldC || '';
  if (!oldC) return newC;
  const map = new Map();
  for (const part of `${oldC}; ${newC}`.split('; ')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    map.set(part.slice(0, eq), part.slice(eq + 1));
  }
  return [...map].map(([k, v]) => `${k}=${v}`).join('; ');
}
function lidoGetCookieValue(cookieStr, name) {
  if (!cookieStr) return null;
  const m = cookieStr.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return m ? m[3] : null;
}
function lidoUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
function lidoAb2b64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  return btoa(bin);
}

// ──────────────────────────────────────────
// Router
// ──────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    if (url.pathname === '/' || url.pathname === '/api/ping') {
      return jsonResp({ ok: true, name: 'ELB Proxy Worker', version: '3.9-aerodatabox', features: ['websocket-client', 'direct-login', 'fleet-enrichment', 'aircraft-detail', 'fuel-records', 'log-actions', 'aerodatabox-gates', 'wx-metar-taf'] }, 200, origin);
    }

    // 🌦️ METAR/TAF（公開、免登入）
    if (url.pathname === '/api/wx' && request.method === 'GET') {
      return await handleWx(url, origin);
    }

    try {
      if (url.pathname === '/api/aerodatabox' && request.method === 'GET') {
        return await handleAeroDataBox(request, origin, env, ctx);
      }
      if (url.pathname === '/api/login' && request.method === 'POST') {
        return await handleLogin(request, origin);
      }
      if (url.pathname === '/api/lido' && request.method === 'POST') {
        return await handleLido(request, origin, env);
      }
      if (url.pathname === '/api/lido-probe' && request.method === 'GET') {
        return await handleLidoProbe(origin, env);
      }
      if (url.pathname === '/api/cookie-login' && request.method === 'POST') {
        return await handleCookieLogin(request, origin);
      }
      if (url.pathname === '/api/status' && request.method === 'GET') {
        return await handleStatus(request, origin);
      }
      if (url.pathname === '/api/fleet' && request.method === 'GET') {
        return await handleFleet(request, origin);
      }
      if (url.pathname.startsWith('/api/aircraft/') && request.method === 'GET') {
        const tail = decodeURIComponent(url.pathname.replace('/api/aircraft/', ''));
        return await handleAircraft(request, tail, origin);
      }
      if (url.pathname === '/api/proxy' && request.method === 'GET') {
        return await handleProxy(request, origin);
      }
      if (url.pathname === '/api/ws-probe' && request.method === 'GET') {
        return await handleWsProbe(request, origin);
      }
    } catch (e) {
      return jsonResp({ ok: false, error: String(e), stack: (e && e.stack) || '' }, 500, origin);
    }

    return jsonResp({ ok: false, error: 'Not found', path: url.pathname }, 404, origin);
  },
};
