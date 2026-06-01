// LIDO 航班擷取代理 — Cloudflare Worker
// 取代原本的 Google Apps Script 端點。功能與原 GAS doPost() 等價。
//
// 安全模型
// ─────────────────────────────────────────────────────────────
// 1. 使用者 LIDO 帳密由前端隨請求送來,Worker 用一次就丟,不寫日誌、不存
// 2. 所有 STARLUX 識別性字串(URL / customer ID / auth realm / DWR session)
//    走 Cloudflare secrets,不入 git
//    必設的 4 個 secret:
//      LIDO_BASE_URL        (e.g. https://sjx.lido.aero)
//      LIDO_CUSTOMER_ID     (e.g. LSY)
//      LIDO_AUTH_REALM      (e.g. LAS)
//      LIDO_DWR_SESSION_ID  (一串 hardcoded scriptSessionId)
// 3. CORS allowlist,只接受 GitHub Pages 來源
//
// 部署
// ─────────────────────────────────────────────────────────────
//   wrangler secret put LIDO_BASE_URL
//   wrangler secret put LIDO_CUSTOMER_ID
//   wrangler secret put LIDO_AUTH_REALM
//   wrangler secret put LIDO_DWR_SESSION_ID
//   wrangler deploy

const ALLOWED_ORIGINS = new Set([
  'https://zihchi.github.io',
  // 本地開發用,部署時可保留也可移除
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://localhost:3000',
]);

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : 'https://zihchi.github.io';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function jsonResponse(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== 'POST') {
      return jsonResponse({ status: 'error', message: 'Method not allowed' }, 405, origin);
    }

    try {
      const body = await request.json().catch(() => null);
      if (!body) throw new Error('請求格式錯誤 (非 JSON)');

      const { username, password, targetFlight } = body;
      if (!username || !password || !targetFlight) {
        throw new Error('未提供完整的帳號、密碼或目標航班號。');
      }

      const target = String(targetFlight).replace(/\s+/g, '').toUpperCase();
      const data = await fetchLidoBriefing(env, username, password, target, targetFlight);
      return jsonResponse({ status: 'success', data }, 200, origin);
    } catch (e) {
      // 保持 200 + status:error,跟原 GAS 行為一致,前端用 body.status 判斷
      return jsonResponse({ status: 'error', message: String(e?.message || e) }, 200, origin);
    }
  },
};

// ─────────────────────────────────────────────────────────────
// LIDO 擷取主邏輯 (對應原 GAS doPost 流程)
// ─────────────────────────────────────────────────────────────
async function fetchLidoBriefing(env, username, password, target, targetRawForMsg) {
  const BASE     = env.LIDO_BASE_URL;
  const CUSTOMER = env.LIDO_CUSTOMER_ID;
  const REALM    = env.LIDO_AUTH_REALM;
  const DWR_SS   = env.LIDO_DWR_SESSION_ID;
  if (!BASE || !CUSTOMER || !REALM || !DWR_SS) {
    throw new Error('Worker secrets 未完整設定,請執行 wrangler secret put');
  }

  // 1. 初始 GET → 拿 initial cookies
  const initialUrl = `${BASE}/lido/las/login.jsp?DESMON_RESULT_PAGE=${BASE}/briefing/`;
  const r1 = await fetch(initialUrl, { method: 'GET', redirect: 'manual' });
  let cookies = extractCookies(r1.headers);
  const debug = { step1_status: r1.status, step1_cookies_len: cookies.length, step1_cookie_names: cookieNames(cookies) };

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

  const r2 = await fetch(dwrUrl, {
    method: 'POST',
    body: dwrPayload,
    redirect: 'manual',
    headers: {
      'Cookie': cookies,
      'Content-Type': 'text/plain',
      'User-Agent': UA,
    },
  });
  cookies = combineCookies(cookies, extractCookies(r2.headers));
  debug.step2_status = r2.status;
  debug.step2_cookie_names = cookieNames(cookies);
  debug.step2_body_head = (await r2.clone().text()).slice(0, 200);

  // 3. 取航班總表 (now-24h ~ now+24h)
  const now = new Date();
  const startTime = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
  const endTime   = new Date(now.getTime() + 24 * 3600 * 1000).toISOString();
  const listUrl = `${BASE}/lido/lcb/ui/flightlist?startDateTime=${startTime}&endDateTime=${endTime}`;
  const lidoCsrf = getCookieValue(cookies, 'lido_csrf') || '';

  const makeHeaders = (businessId) => ({
    'Cookie': cookies,
    'Accept': 'application/vnd.lsy.lido.lcb.v1.hal+json, application/json, text/plain, */*',
    'User-Agent': UA,
    'Referer': `${BASE}/briefing/`,
    'X-Requested-With': 'XMLHttpRequest',
    'x-lido-applicationid': 'lido-lcb',
    'x-lido-auth': REALM,
    'x-lido-businessid': businessId,
    'x-lido-clientid': 'lido-lcb-ui',
    'x-lido-customerid': CUSTOMER,
    'x-lido-csrf': lidoCsrf,
    'x-lido-timestamp': new Date().toISOString(),
    'x-lido-traceid': uuid(),
  });

  const listResp = await fetch(listUrl, { method: 'GET', headers: makeHeaders('SearchFlights'), redirect: 'manual' });
  if (listResp.status !== 200) {
    const respBody = (await listResp.text()).slice(0, 300);
    debug.step3_status = listResp.status;
    debug.step3_body = respBody;
    debug.step3_csrf_present = !!lidoCsrf;
    throw new Error(`總表取得失敗,HTTP 狀態碼:${listResp.status} | debug: ${JSON.stringify(debug)}`);
  }
  let flights = JSON.parse(await listResp.text());
  if (!Array.isArray(flights)) flights = [flights];

  // 4. 比對目標班號 → 重複時挑離 now 最近的
  const matched = flights.filter(f => {
    const code = `${f.aircraftOperator || ''}${f.flightNumber || ''}`.replace(/\s+/g, '').toUpperCase();
    const digits = target.replace(/[^0-9]/g, '');
    return code === target || String(f.flightNumber || '') === digits;
  });
  if (matched.length === 0) {
    throw new Error(`找不到代號為 ${targetRawForMsg} 的航班。`);
  }
  let chosen = matched[0];
  if (matched.length > 1) {
    const nowMs = now.getTime();
    chosen = matched.reduce((prev, curr) => {
      const pT = prev.scheduledDepartureTime ? new Date(prev.scheduledDepartureTime).getTime() : 0;
      const cT = curr.scheduledDepartureTime ? new Date(curr.scheduledDepartureTime).getTime() : 0;
      return Math.abs(cT - nowMs) < Math.abs(pT - nowMs) ? curr : prev;
    });
  }

  // 5. 取該航班 briefing 詳細
  const encodedLegId = encodeURIComponent(chosen.legId);
  const detailUrl = `${BASE}/lido/lcb/ui/${encodedLegId}/briefing`;
  const detailResp = await fetch(detailUrl, { method: 'GET', headers: makeHeaders('GetFlightBriefing'), redirect: 'manual' });

  if (detailResp.status !== 200) {
    chosen.ofpDetails = { error: 'OFP 詳細資料取得失敗' };
    return chosen;
  }
  const briefingData = JSON.parse(await detailResp.text());
  chosen.ofpDetails = briefingData;
  chosen.rawTexts = {};

  // 6. 平行下載各類文件 / 圖檔
  try {
    const cats = briefingData.categories
              || (briefingData.briefingPackages && briefingData.briefingPackages[0] && briefingData.briefingPackages[0].categories)
              || [];
    const requiredTypes = ['OFP', 'ATS', 'NOTAM', 'CREWINFO', 'RAIM', 'VERTPROF', 'SIGWXROUTE'];
    const multiImageTypes = new Set(['SIGWXROUTE']);

    const docTasks = [];
    for (const cat of cats) {
      if (!requiredTypes.includes(cat.type) || !cat.documents) continue;
      const isMulti = multiImageTypes.has(cat.type);
      for (let d = 0; d < cat.documents.length; d++) {
        const doc = cat.documents[d];
        const mt = doc.mediaType || '';
        if (mt === 'text/plain' || mt.includes('image') || isMulti) {
          docTasks.push({
            url: `${BASE}/lido/lcb/ui/${encodedLegId}/briefing/${doc.fileId}/docs`,
            key: isMulti ? `${cat.type}_${d}` : cat.type,
          });
          if (!isMulti) break;
        }
      }
    }

    if (docTasks.length > 0) {
      const responses = await Promise.all(docTasks.map(t => {
        const hdrs = makeHeaders('GetDocument');
        hdrs['Accept'] = 'text/plain, image/*, */*';
        return fetch(t.url, { method: 'GET', headers: hdrs, redirect: 'manual' });
      }));

      for (let i = 0; i < responses.length; i++) {
        const r = responses[i];
        const k = docTasks[i].key;
        if (r.status !== 200) { chosen.rawTexts[k] = '下載失敗'; continue; }
        const cType = r.headers.get('Content-Type') || '';
        const isImg = cType.includes('image') || k.indexOf('VERTPROF') !== -1 || k.indexOf('SIGWXROUTE') !== -1;
        if (isImg) {
          const buf = await r.arrayBuffer();
          const mime = (cType.split(';')[0] || '').trim() || 'image/png';
          chosen.rawTexts[k] = `data:${mime};base64,${arrayBufferToBase64(buf)}`;
        } else {
          chosen.rawTexts[k] = await r.text();
        }
      }
    }
  } catch (e) {
    chosen.rawTextsError = String(e?.message || e);
  }

  return chosen;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function cookieNames(cookieStr) {
  if (!cookieStr) return [];
  return cookieStr.split('; ').map(c => c.split('=')[0]).filter(Boolean);
}

function extractCookies(headers) {
  let raw;
  if (typeof headers.getSetCookie === 'function') {
    raw = headers.getSetCookie();
  } else {
    raw = [];
    headers.forEach((v, k) => { if (k.toLowerCase() === 'set-cookie') raw.push(v); });
  }
  return raw.map(c => c.split(';')[0]).join('; ');
}

function combineCookies(oldC, newC) {
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

function getCookieValue(cookieStr, name) {
  if (!cookieStr) return null;
  const m = cookieStr.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return m ? m[3] : null;
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}
