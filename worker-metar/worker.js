// ==========================================
// 🌦️  METAR / TAF Proxy — Cloudflare Worker
// ==========================================
// 從 https://zihchi.github.io 呼叫 → 這支 Worker → aviationweather.gov (NOAA AWC 官方)
// 目的：取代免費公用代理（corsproxy.io / codetabs / allorigins，常慢、不穩、被快取成舊資料）
//      自有邊緣節點 + 短快取 → 又快又新鮮，資料源仍是 NOAA 官方。
// 部署：push to GitHub → Cloudflare 自動部署（或本機 `wrangler deploy`）
// ==========================================

const AWC_BASE = 'https://aviationweather.gov/api/data';
const EDGE_TTL = 60; // 邊緣快取秒數（METAR 約每小時更新，60 秒夠新鮮又快；要更即時可改 0）

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
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function jsonErr(msg, status, origin) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...cors(origin), 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    if (request.method !== 'GET') return jsonErr('只接受 GET', 405, origin);

    const u = new URL(request.url);
    const type = (u.searchParams.get('type') || 'metar').toLowerCase();
    const ids = (u.searchParams.get('ids') || '').trim();
    const hours = u.searchParams.get('hours') || '';
    const format = u.searchParams.get('format') || 'json';

    if (type !== 'metar' && type !== 'taf') return jsonErr('type 必須是 metar 或 taf', 400, origin);
    if (!ids) return jsonErr('缺少 ids（機場 ICAO，可逗號分隔）', 400, origin);

    let target = `${AWC_BASE}/${type}?ids=${encodeURIComponent(ids)}&format=${encodeURIComponent(format)}`;
    if (hours) target += `&hours=${encodeURIComponent(hours)}`;

    try {
      const upstream = await fetch(target, {
        cf: { cacheTtl: EDGE_TTL, cacheEverything: true },
        headers: { 'Accept': 'application/json', 'User-Agent': 'briefing-package-metar-proxy' },
      });
      const body = await upstream.text();
      return new Response(body, {
        status: upstream.status,
        headers: {
          ...cors(origin),
          'Content-Type': upstream.headers.get('Content-Type') || 'application/json; charset=utf-8',
          'Cache-Control': `public, max-age=${EDGE_TTL}`,
          'X-Proxy-By': 'cf-worker-metar',
        },
      });
    } catch (err) {
      return jsonErr('上游 aviationweather.gov 取得失敗：' + String(err), 502, origin);
    }
  },
};
