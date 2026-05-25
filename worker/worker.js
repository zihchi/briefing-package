// ==========================================
// ✈️  ELB Proxy — Cloudflare Worker
// ==========================================
// 從 https://zihchi.github.io 呼叫 → 這支 Worker → ELB
// 部署：cd worker && wrangler deploy
// ==========================================

const ELB_BASE = 'https://elb.starlux-airlines.com';

// 允許的前端來源
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
// ELB 共用：用 session 帶 cookie 打 ELB API
// ──────────────────────────────────────────
async function elbFetch(path, session, opts = {}) {
  const headers = new Headers(opts.headers || {});
  headers.set('Cookie', `JSESSIONID=${session}`);
  headers.set('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  headers.set('Accept', 'application/json, text/plain, */*');
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
  try {
    body = await request.json();
  } catch {
    return jsonResp({ ok: false, error: '請求格式錯誤' }, 400, origin);
  }
  const { user, pass } = body;
  if (!user || !pass) {
    return jsonResp({ ok: false, error: '缺少帳號或密碼' }, 400, origin);
  }

  const form = new URLSearchParams();
  form.set('j_username', user);
  form.set('j_password', pass);

  const res = await fetch(`${ELB_BASE}/elb/auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Origin': ELB_BASE,
      'Referer': `${ELB_BASE}/elb/`,
    },
    body: form,
    redirect: 'manual',
  });

  // ELB 登入成功會在 Set-Cookie 回 JSESSIONID
  const setCookie = res.headers.get('set-cookie') || '';
  const m = setCookie.match(/JSESSIONID=([^;]+)/);

  if (!m) {
    // 也試試 multiple set-cookie 寫法
    const all = res.headers.getAll ? res.headers.getAll('set-cookie') : [setCookie];
    for (const c of all) {
      const mm = c && c.match(/JSESSIONID=([^;]+)/);
      if (mm) {
        return jsonResp({ ok: true, session: mm[1] }, 200, origin);
      }
    }
    return jsonResp({
      ok: false,
      error: '登入失敗（沒拿到 session）',
      status: res.status,
    }, 401, origin);
  }

  return jsonResp({ ok: true, session: m[1] }, 200, origin);
}

// ──────────────────────────────────────────
// /api/status  GET (?session=)
// 檢查 session 還有效嗎
// ──────────────────────────────────────────
async function handleStatus(request, origin) {
  const url = new URL(request.url);
  const session = url.searchParams.get('session') || request.headers.get('X-Session-Token');
  if (!session) return jsonResp({ ok: true, loggedIn: false }, 200, origin);

  // 戳個輕量 endpoint 看會不會被踢
  const res = await elbFetch('/elb/services/landingPage/getLandingPageImmediate?dataKeys=DASHBOARD_AIRCRAFT_LIST', session);
  if (res.status === 200) {
    return jsonResp({ ok: true, loggedIn: true }, 200, origin);
  }
  return jsonResp({ ok: true, loggedIn: false, status: res.status }, 200, origin);
}

// ──────────────────────────────────────────
// /api/fleet  GET  X-Session-Token
// 機隊總覽（REST 可達）
// ──────────────────────────────────────────
async function handleFleet(request, origin) {
  const session = request.headers.get('X-Session-Token') || new URL(request.url).searchParams.get('session');
  if (!session) return jsonResp({ ok: false, error: '未登入' }, 401, origin);

  const res = await elbFetch('/elb/services/landingPage/getLandingPageImmediate?dataKeys=DASHBOARD_AIRCRAFT_LIST', session);
  if (res.status !== 200) {
    return jsonResp({ ok: false, error: 'fleet fetch 失敗', status: res.status }, res.status, origin);
  }
  const data = await res.json();
  return jsonResp({ ok: true, data }, 200, origin);
}

// ──────────────────────────────────────────
// /api/aircraft/:tail  GET  X-Session-Token
// 單機詳細（REST，包含 Combined Fleet 資料）
// ──────────────────────────────────────────
async function handleAircraft(request, tail, origin) {
  const session = request.headers.get('X-Session-Token') || new URL(request.url).searchParams.get('session');
  if (!session) return jsonResp({ ok: false, error: '未登入' }, 401, origin);

  const safe = encodeURIComponent(tail);

  // 並行戳多個可能的 endpoint，回報哪個成功
  const probes = [
    `/elb/services/landingPage/getFleetDataForAircraft/Combined%20Fleet/${safe}`,
    `/elb/services/aircraft/getAircraftState/${safe}`,
    `/elb/services/aircraft/getAircraftDefects/${safe}`,
    `/elb/services/aircraft/getFlightLog/${safe}?extensions=Recent`,
    `/elb/services/landingPage/getLandingPageImmediate?dataKeys=AIRCRAFT_DETAIL&aircraftId=${safe}`,
  ];

  const results = await Promise.all(probes.map(async (p) => {
    try {
      const r = await elbFetch(p, session);
      const text = await r.text();
      let parsed = null;
      try { parsed = JSON.parse(text); } catch {}
      return { path: p, status: r.status, body: parsed ?? text.slice(0, 500) };
    } catch (e) {
      return { path: p, status: 0, error: String(e) };
    }
  }));

  return jsonResp({ ok: true, probes: results }, 200, origin);
}

// ──────────────────────────────────────────
// /api/proxy?path=/elb/...  GET  X-Session-Token
// 萬用轉發器：給前端探索 endpoint 用
// ──────────────────────────────────────────
async function handleProxy(request, origin) {
  const url = new URL(request.url);
  const path = url.searchParams.get('path');
  const session = request.headers.get('X-Session-Token') || url.searchParams.get('session');
  if (!path || !path.startsWith('/elb/')) {
    return jsonResp({ ok: false, error: 'path 必須以 /elb/ 開頭' }, 400, origin);
  }
  if (!session) return jsonResp({ ok: false, error: '未登入' }, 401, origin);

  const res = await elbFetch(path, session);
  const ct = res.headers.get('content-type') || '';
  const text = await res.text();
  if (ct.includes('application/json')) {
    try {
      return jsonResp({ ok: true, status: res.status, data: JSON.parse(text) }, 200, origin);
    } catch {}
  }
  return jsonResp({ ok: true, status: res.status, contentType: ct, raw: text }, 200, origin);
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

    // 健康檢查
    if (url.pathname === '/' || url.pathname === '/api/ping') {
      return jsonResp({ ok: true, name: 'ELB Proxy Worker', version: '1.0' }, 200, origin);
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
      return jsonResp({ ok: false, error: String(e), stack: e.stack }, 500, origin);
    }

    return jsonResp({ ok: false, error: 'Not found', path: url.pathname }, 404, origin);
  },
};
