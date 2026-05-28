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
// Router
// ──────────────────────────────────────────
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    if (url.pathname === '/' || url.pathname === '/api/ping') {
      return jsonResp({ ok: true, name: 'ELB Proxy Worker', version: '3.8-title-action', features: ['websocket-client', 'direct-login', 'fleet-enrichment', 'aircraft-detail', 'fuel-records', 'log-actions'] }, 200, origin);
    }

    try {
      if (url.pathname === '/api/login' && request.method === 'POST') {
        return await handleLogin(request, origin);
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
