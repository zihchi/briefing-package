#!/usr/bin/env node
/**
 * update-flights.mjs — 依 TDX 國際線定期時刻表，自動產生 app.js 的 flightGroups。
 *
 * 用途：星宇(JX)航班表有變動時(通常一季一次)跑一次，自動更新網頁上方「選擇航班」的清單。
 *
 * 需要 TDX 免費 API 金鑰(到 https://tdx.transportdata.tw 註冊 → 會員中心取得 client_id / client_secret)。
 *
 * 用法：
 *   TDX_CLIENT_ID=xxx TDX_CLIENT_SECRET=yyy node scripts/update-flights.mjs
 *   # 只想預覽、先不改檔：加 --dry-run
 *   TDX_CLIENT_ID=xxx TDX_CLIENT_SECRET=yyy node scripts/update-flights.mjs --dry-run
 *
 * 產出：改寫 app.js 中兩個標記
 *   //  >>> FLIGHTGROUPS AUTO-GENERATED ... <<< FLIGHTGROUPS AUTO-GENERATED
 * 之間的 flightGroups 陣列。改完自行 git commit / push 即可。
 *
 * 需 Node 18+(內建 fetch)。
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_JS = join(__dirname, '..', 'app.js');
const AIRLINE = 'JX';                 // 星宇航空
const DRY_RUN = process.argv.includes('--dry-run');

const TOKEN_URL = 'https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token';
// 國際線定期時刻表(欄位：AirlineID/FlightNumber/DepartureAirportID/ArrivalAirportID/
//   ScheduleStartDate/ScheduleEndDate/Monday..Sunday/DepartureTime/ArrivalTime)
const SCHED_URL = 'https://tdx.transportdata.tw/api/basic/v2/Air/Schedule/International';

// ── 分區設定：以「非 TPE 那一端的機場(IATA)」歸類。────────────────────────────
//   想調整分組名稱或把某站改到別區，改這裡即可。未列到的站會落到「其他航線」以便你補分類。
const REGION_ORDER = ['東北亞航線 (日韓)', '港澳航線', '東南亞航線', '北美航線', '歐洲航線', '其他航線'];
const REGION_OF_AIRPORT = {
  // 東北亞(日本)
  NRT:'東北亞航線 (日韓)', HND:'東北亞航線 (日韓)', KIX:'東北亞航線 (日韓)', UKB:'東北亞航線 (日韓)',
  NGO:'東北亞航線 (日韓)', FUK:'東北亞航線 (日韓)', KMJ:'東北亞航線 (日韓)', CTS:'東北亞航線 (日韓)',
  HKD:'東北亞航線 (日韓)', SDJ:'東北亞航線 (日韓)', OKA:'東北亞航線 (日韓)', SHI:'東北亞航線 (日韓)',
  // 東北亞(韓國)
  ICN:'東北亞航線 (日韓)', PUS:'東北亞航線 (日韓)', GMP:'東北亞航線 (日韓)',
  // 港澳
  MFM:'港澳航線', HKG:'港澳航線',
  // 東南亞
  DAD:'東南亞航線', PQC:'東南亞航線', SGN:'東南亞航線', HAN:'東南亞航線', KUL:'東南亞航線',
  BKK:'東南亞航線', CNX:'東南亞航線', CGK:'東南亞航線', SIN:'東南亞航線', CEB:'東南亞航線',
  MNL:'東南亞航線', CRK:'東南亞航線', DPS:'東南亞航線', PNH:'東南亞航線', RGN:'東南亞航線',
  // 北美
  LAX:'北美航線', ONT:'北美航線', SFO:'北美航線', PHX:'北美航線', SEA:'北美航線', SJC:'北美航線',
  // 歐洲
  PRG:'歐洲航線', LHR:'歐洲航線', CDG:'歐洲航線', FRA:'歐洲航線', MXP:'歐洲航線',
};
const regionOf = (iata) => REGION_OF_AIRPORT[iata] || '其他航線';

function fail(msg) { console.error('✗ ' + msg); process.exit(1); }

async function getToken(id, secret) {
  const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret });
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!r.ok) fail(`取得 TDX token 失敗：HTTP ${r.status} ${await r.text().catch(() => '')}`);
  const j = await r.json();
  if (!j.access_token) fail('TDX token 回應缺少 access_token');
  return j.access_token;
}

async function getSchedule(token) {
  const url = `${SCHED_URL}?$filter=${encodeURIComponent(`AirlineID eq '${AIRLINE}'`)}&$format=JSON`;
  const r = await fetch(url, { headers: { authorization: `Bearer ${token}`, accept: 'application/json' } });
  if (!r.ok) fail(`取得 TDX 班表失敗：HTTP ${r.status} ${await r.text().catch(() => '')}`);
  const j = await r.json();
  if (!Array.isArray(j)) fail('TDX 班表回應不是陣列');
  return j;
}

// 只留今天仍在有效期內的班表
function isCurrent(s, today) {
  const a = (s.ScheduleStartDate || '').slice(0, 10);
  const b = (s.ScheduleEndDate || '').slice(0, 10);
  return (!a || a <= today) && (!b || b >= today);
}

// 班號正規化：純數字補到 3 位(對齊現有 "001"/"012" 風格)；4 位以上維持原樣
function normFlightNo(n) {
  const s = String(n == null ? '' : n).trim().replace(/\D/g, '');
  if (!s) return '';
  return s.length < 3 ? s.padStart(3, '0') : s;
}

function buildGroups(schedules) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
  const seen = new Map(); // flightNo → {flightNo, route, outstation}
  for (const s of schedules) {
    if (s.AirlineID !== AIRLINE) continue;
    if (!isCurrent(s, today)) continue;
    const dep = String(s.DepartureAirportID || '').trim().toUpperCase();
    const arr = String(s.ArrivalAirportID || '').trim().toUpperCase();
    const no = normFlightNo(s.FlightNumber);
    if (!dep || !arr || !no) continue;
    if (seen.has(no)) continue;                 // 一個班號一筆
    const outstation = dep === 'TPE' ? arr : dep; // 非 TPE 的那一端(供分區)
    seen.set(no, { flightNo: no, route: `${dep}/${arr}`, outstation });
  }

  // 分組
  const byRegion = new Map();
  for (const f of seen.values()) {
    const region = regionOf(f.outstation);
    if (!byRegion.has(region)) byRegion.set(region, []);
    byRegion.get(region).push(f);
  }
  // 依設定順序輸出；未在順序內的區塊(理論上只有「其他航線」)接在最後
  const orderedRegions = [
    ...REGION_ORDER.filter((r) => byRegion.has(r)),
    ...[...byRegion.keys()].filter((r) => !REGION_ORDER.includes(r)),
  ];
  const numCmp = (a, b) => a.flightNo.localeCompare(b.flightNo, 'en', { numeric: true });
  return orderedRegions.map((region) => ({
    region,
    flights: byRegion.get(region).sort(numCmp),
  }));
}

function renderBlock(groups) {
  const lines = [];
  lines.push('// >>> FLIGHTGROUPS AUTO-GENERATED — 由 scripts/update-flights.mjs 依 TDX 班表產生。');
  lines.push('//     可手動編輯，但重跑腳本會覆蓋此區塊(兩個標記之間)。');
  lines.push(`//     最後更新：${new Date().toISOString().slice(0, 10)}(TDX 國際線定期時刻表，AirlineID=${AIRLINE})`);
  lines.push('const flightGroups = [');
  groups.forEach((g, gi) => {
    lines.push(`  { region: ${JSON.stringify(g.region)}, flights: [`);
    // 每行放兩筆，貼近原本排版
    for (let i = 0; i < g.flights.length; i += 2) {
      const pair = g.flights.slice(i, i + 2)
        .map((f) => `{ flightNo: ${JSON.stringify(f.flightNo)}, route: ${JSON.stringify(f.route)} }`)
        .join(', ');
      const comma = i + 2 < g.flights.length ? ',' : '';
      lines.push(`      ${pair}${comma}`);
    }
    lines.push(`  ]}${gi + 1 < groups.length ? ',' : ''}`);
  });
  lines.push('];');
  lines.push('// <<< FLIGHTGROUPS AUTO-GENERATED');
  return lines.join('\n');
}

function writeBack(block) {
  const src = readFileSync(APP_JS, 'utf8');
  const startRe = /\/\/ >>> FLIGHTGROUPS AUTO-GENERATED[\s\S]*?\/\/ <<< FLIGHTGROUPS AUTO-GENERATED/;
  if (!startRe.test(src)) fail('在 app.js 找不到 FLIGHTGROUPS 標記，請確認標記存在。');
  const out = src.replace(startRe, block);
  if (DRY_RUN) {
    console.log('—— DRY RUN，不寫檔。以下為將寫入的區塊 ——\n');
    console.log(block);
    return;
  }
  writeFileSync(APP_JS, out, 'utf8');
}

(async () => {
  const id = process.env.TDX_CLIENT_ID, secret = process.env.TDX_CLIENT_SECRET;
  if (!id || !secret) fail('請設定環境變數 TDX_CLIENT_ID 與 TDX_CLIENT_SECRET(TDX 會員中心取得)。');

  console.log('→ 取得 TDX token…');
  const token = await getToken(id, secret);
  console.log('→ 抓取星宇國際線定期時刻表…');
  const schedules = await getSchedule(token);
  console.log(`  取得 ${schedules.length} 筆原始班表`);

  const groups = buildGroups(schedules);
  const total = groups.reduce((n, g) => n + g.flights.length, 0);
  console.log(`→ 整理後 ${groups.length} 區、共 ${total} 個班號：`);
  groups.forEach((g) => console.log(`   • ${g.region}：${g.flights.length} 班`));
  const other = groups.find((g) => g.region === '其他航線');
  if (other) console.log(`   ⚠ 有 ${other.flights.length} 班落在「其他航線」，可在腳本的 REGION_OF_AIRPORT 補上分類。`);

  writeBack(renderBlock(groups));
  console.log(DRY_RUN ? '✓ DRY RUN 完成(未寫檔)' : '✓ 已更新 app.js。請檢查後 git commit / push。');
})();
