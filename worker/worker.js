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
  headers.set('Referer', `${ELB_BASE}/elb/`);
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
      'Origin': ELB_BASE,
      'Referer': `${ELB_BASE}/elb/`,
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

  // Step 4: 驗證 — 戳真正會用的 endpoint，看回 JSON 還是 HTML
  const testRes = await fetch(`${ELB_BASE}/elb/services/landingPage/getLandingPageImmediate?dataKeys=DASHBOARD_AIRCRAFT_LIST`, {
    headers: {
      'Cookie': cookieStr(cookies),
      'User-Agent': UA,
      'Accept': 'application/json',
      'Referer': `${ELB_BASE}/elb/`,
    },
    redirect: 'manual',
  });
  const ct = testRes.headers.get('content-type') || '';
  const testText = await testRes.text();

  if (testRes.status !== 200 || !ct.includes('json')) {
    // HTML 表示登入失敗 / session 沒生效
    return jsonResp({
      ok: false,
      error: '登入失敗（ELB 回了 HTML，帳密可能錯了或 session 沒帶上）',
      debug: {
        loginStatus: loginRes.status,
        testStatus: testRes.status,
        testContentType: ct,
        cookieNames: Object.keys(cookies),
        bodyPreview: testText.slice(0, 300),
      },
    }, 401, origin);
  }

  // 登入成功
  return jsonResp({
    ok: true,
    session: encodeSession(cookies),
    cookieNames: Object.keys(cookies),
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
// /api/fleet  GET  X-Session-Token
// ──────────────────────────────────────────
async function handleFleet(request, origin) {
  const token = request.headers.get('X-Session-Token') || new URL(request.url).searchParams.get('session');
  if (!token) return jsonResp({ ok: false, error: '未登入' }, 401, origin);

  const res = await elbFetch('/elb/services/landingPage/getLandingPageImmediate?dataKeys=DASHBOARD_AIRCRAFT_LIST', token);
  const ct = res.headers.get('content-type') || '';
  const text = await res.text();

  if (res.status !== 200) {
    return jsonResp({ ok: false, error: `fleet HTTP ${res.status}`, bodyPreview: text.slice(0, 200) }, res.status, origin);
  }
  if (!ct.includes('json')) {
    return jsonResp({
      ok: false,
      error: 'ELB 回了非 JSON（session 過期？）',
      contentType: ct,
      bodyPreview: text.slice(0, 200),
    }, 401, origin);
  }

  try {
    return jsonResp({ ok: true, data: JSON.parse(text) }, 200, origin);
  } catch (e) {
    return jsonResp({ ok: false, error: 'JSON 解析失敗', detail: String(e), bodyPreview: text.slice(0, 200) }, 500, origin);
  }
}

// ──────────────────────────────────────────
// /api/aircraft/:tail  GET  X-Session-Token
// 並行戳多個可能的 endpoint
// ──────────────────────────────────────────
async function handleAircraft(request, tail, origin) {
  const token = request.headers.get('X-Session-Token') || new URL(request.url).searchParams.get('session');
  if (!token) return jsonResp({ ok: false, error: '未登入' }, 401, origin);

  const safe = encodeURIComponent(tail);
  const probes = [
    `/elb/services/landingPage/getFleetDataForAircraft/Combined%20Fleet/${safe}`,
    `/elb/services/aircraft/getAircraftState/${safe}`,
    `/elb/services/aircraft/getAircraftDefects/${safe}`,
    `/elb/services/aircraft/getFlightLog/${safe}?extensions=Recent`,
    `/elb/services/landingPage/getLandingPageImmediate?dataKeys=AIRCRAFT_DETAIL&aircraftId=${safe}`,
  ];

  const results = await Promise.all(probes.map(async (p) => {
    try {
      const r = await elbFetch(p, token);
      const text = await r.text();
      const ct = r.headers.get('content-type') || '';
      let parsed = null;
      if (ct.includes('json')) {
        try { parsed = JSON.parse(text); } catch {}
      }
      return {
        path: p,
        status: r.status,
        contentType: ct,
        body: parsed ?? text.slice(0, 500),
      };
    } catch (e) {
      return { path: p, status: 0, error: String(e) };
    }
  }));

  return jsonResp({ ok: true, probes: results }, 200, origin);
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
      return jsonResp({ ok: true, name: 'ELB Proxy Worker', version: '2.0' }, 200, origin);
    }

    try {
      if (url.pathname === '/api/login' && request.method === 'POST') {
        return await handleLogin(request, origin);
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
    } catch (e) {
      return jsonResp({ ok: false, error: String(e), stack: (e && e.stack) || '' }, 500, origin);
    }

    return jsonResp({ ok: false, error: 'Not found', path: url.pathname }, 404, origin);
  },
};
