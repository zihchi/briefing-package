// ==========================================
// 📦 簡報箱主核心引擎 (Core Engine) - 極速競速優化版 + 雙引擎解析架構 + 機隊升級
// ==========================================

// ------------------------------------------
// 🌐 全域變數與系統資料庫 (Global State)
// ------------------------------------------
const MONOSPACE_FONT = "font-family: ui-monospace, 'SF Mono', 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;";

let notamMapInstance = null;
let notamActiveLayers = [];
let notamFeatures = [];
let notamRoutes = [];
let curfewClockInterval = null;

// ✈️ Turbli 航班資料庫
const flightGroups = [
  { region: "東北亞航線 (日本)", flights: [
      { flightNo: "800", route: "TPE/NRT" }, { flightNo: "801", route: "NRT/TPE" },
      { flightNo: "802", route: "TPE/NRT" }, { flightNo: "803", route: "NRT/TPE" },
      { flightNo: "804", route: "TPE/NRT" }, { flightNo: "805", route: "NRT/TPE" },
      { flightNo: "820", route: "TPE/KIX" }, { flightNo: "821", route: "KIX/TPE" },
      { flightNo: "822", route: "TPE/KIX" }, { flightNo: "823", route: "KIX/TPE" },
      { flightNo: "834", route: "TPE/UKB" }, { flightNo: "835", route: "UKB/TPE" },
      { flightNo: "838", route: "TPE/NGO" }, { flightNo: "839", route: "NGO/TPE" },
      { flightNo: "840", route: "TPE/FUK" }, { flightNo: "841", route: "FUK/TPE" },
      { flightNo: "846", route: "TPE/KMJ" }, { flightNo: "847", route: "KMJ/TPE" },
      { flightNo: "850", route: "TPE/CTS" }, { flightNo: "851", route: "CTS/TPE" },
      { flightNo: "860", route: "TPE/HKD" }, { flightNo: "861", route: "HKD/TPE" },
      { flightNo: "862", route: "TPE/SDJ" }, { flightNo: "863", route: "SDJ/TPE" },
      { flightNo: "870", route: "TPE/OKA" }, { flightNo: "871", route: "OKA/TPE" },
      { flightNo: "886", route: "TPE/SHI" }, { flightNo: "887", route: "SHI/TPE" }
  ]},
  { region: "港澳航線", flights: [
      { flightNo: "201", route: "TPE/MFM" }, { flightNo: "202", route: "MFM/TPE" },
      { flightNo: "205", route: "TPE/MFM" }, { flightNo: "206", route: "MFM/TPE" },
      { flightNo: "233", route: "TPE/HKG" }, { flightNo: "234", route: "HKG/TPE" },
      { flightNo: "235", route: "TPE/HKG" }, { flightNo: "236", route: "HKG/TPE" }
  ]},
  { region: "東南亞航線", flights: [
      { flightNo: "703", route: "TPE/DAD" }, { flightNo: "704", route: "DAD/TPE" },
      { flightNo: "705", route: "TPE/PQC" }, { flightNo: "706", route: "PQC/TPE" },
      { flightNo: "711", route: "TPE/SGN" }, { flightNo: "712", route: "SGN/TPE" },
      { flightNo: "713", route: "TPE/SGN" }, { flightNo: "714", route: "SGN/TPE" },
      { flightNo: "715", route: "TPE/HAN" }, { flightNo: "716", route: "HAN/TPE" },
      { flightNo: "717", route: "TPE/HAN" }, { flightNo: "718", route: "HAN/TPE" },
      { flightNo: "725", route: "TPE/KUL" }, { flightNo: "726", route: "KUL/TPE" },
      { flightNo: "741", route: "TPE/BKK" }, { flightNo: "742", route: "BKK/TPE" },
      { flightNo: "745", route: "TPE/BKK" }, { flightNo: "746", route: "BKK/TPE" },
      { flightNo: "751", route: "TPE/CNX" }, { flightNo: "752", route: "CNX/TPE" },
      { flightNo: "761", route: "TPE/CGK" }, { flightNo: "762", route: "CGK/TPE" },
      { flightNo: "771", route: "TPE/SIN" }, { flightNo: "772", route: "SIN/TPE" },
      { flightNo: "781", route: "TPE/CEB" }, { flightNo: "782", route: "CEB/TPE" },
      { flightNo: "783", route: "TPE/CEB" }, { flightNo: "784", route: "CEB/TPE" },
      { flightNo: "785", route: "TPE/MNL" }, { flightNo: "786", route: "MNL/TPE" },
      { flightNo: "789", route: "TPE/CRK" }, { flightNo: "790", route: "CRK/TPE" },
      { flightNo: "791", route: "TPE/CRK" }, { flightNo: "792", route: "CRK/TPE" }
  ]},
  { region: "北美航線", flights: [
      { flightNo: "001", route: "LAX/TPE" }, { flightNo: "002", route: "TPE/LAX" },
      { flightNo: "009", route: "ONT/TPE" }, { flightNo: "010", route: "TPE/ONT" },
      { flightNo: "011", route: "SFO/TPE" }, { flightNo: "012", route: "TPE/SFO" },
      { flightNo: "025", route: "PHX/TPE" }, { flightNo: "026", route: "TPE/PHX" },
      { flightNo: "031", route: "SEA/TPE" }, { flightNo: "032", route: "TPE/SEA" }
  ]}
];
window.flights = flightGroups.flatMap(group => group.flights);

// ❄️ 高度修正基礎數據
let altimetryRows = [
  { id: 'msa', label: 'MSA', altitude: '', isCustom: false },
  { id: 'iaf', label: 'IAF', altitude: '', isCustom: false },
  { id: 'if', label: 'IF', altitude: '', isCustom: false },
  { id: 'faf', label: 'FAF/FAP', altitude: '', isCustom: false },
  { id: 'da', label: 'DA/MDA', altitude: '', isCustom: false },
  { id: 'maa', label: 'MAA', altitude: '', isCustom: false },
  { id: 'eo', label: 'EO ACC', altitude: '', isCustom: false }
];

// ==========================================
// 🌍 全域共用：氣象特徵與解析工具 (Global Weather Tools)
// ==========================================
function getWeatherEmojis(text) {
  if (!text) return '';
  let emojis = [];
  const tokens = text.split(/\s+/);
  
  let hasTSWS = false; let hasRA = false; let hasSN = false; let hasGust = false;
  const tsRegex = /^[+-]?(?:VC)?TS(?:RA|SN|GR|GS|DZ|PL)?$|^RETS$/;
  const raRegex = /^[+-]?(?:VC)?(?:SH|TS|FZ)?RA$|^RERA$/;
  const snRegex = /^[+-]?(?:VC)?(?:SH|TS|FZ|BL|DR|MI)?SN$|^RESN$/;

  for (let token of tokens) {
      if (token === 'WS' || /^WS\d{3}\//.test(token) || tsRegex.test(token)) hasTSWS = true;
      if (raRegex.test(token)) hasRA = true;
      if (snRegex.test(token)) hasSN = true;
      if (/G\d{2,}/.test(token) && (token.includes('KT') || token.includes('MPS') || token.includes('KMH'))) hasGust = true;
  }
  if (hasTSWS) emojis.push('🚨');
  if (hasRA) emojis.push('☔️');
  if (hasSN) emojis.push('☃️');
  if (hasGust) emojis.push('⚠️');

  return emojis.join(' ');
}

function parseWeatherElements(text, prevVis, prevCeil) {
  let vis = prevVis; let ceil = prevCeil;
  if (/\b(CAVOK|SKC|CLR|NSC)\b/.test(text)) {
      if (/\bCAVOK\b/.test(text)) vis = 10;
      ceil = 99999;
  }
  const metricMatch = text.match(/(?:\s|^)([0-9]{4})(?:NDV)?(?:\s|$)/);
  if (metricMatch) {
      const meters = parseInt(metricMatch[1], 10);
      vis = meters === 9999 ? 10 : meters / 1609.34;
  }
  const smMatch = text.match(/(?:\s|^)(P|M)?(\d+)?\s?(\d+\/\d+)?SM(?:\s|$)/);
  if (smMatch) {
      let val = 0;
      if (smMatch[2]) val += parseInt(smMatch[2], 10);
      if (smMatch[3]) {
          const [num, den] = smMatch[3].split('/');
          val += parseInt(num, 10) / parseInt(den, 10);
      }
      if (val === 0 && smMatch[1] === 'M') val = 0.25;
      if (val === 0 && smMatch[1] === 'P') val = 6.0;
      vis = val;
  }
  const cloudMatches = text.match(/(BKN|OVC|VV)(\d{3})/g);
  if (cloudMatches) {
      const bases = cloudMatches.map(c => parseInt(c.slice(3, 6), 10) * 100);
      ceil = Math.min(...bases);
  }
  return { vis, ceil };
}

function getFlightCategory(vis, ceil) {
  if (ceil < 500 || vis < 1) return "lifr";
  if (ceil < 1000 || vis < 3) return "ifr";
  if (ceil <= 3000 || vis <= 5) return "mvfr";
  return "vfr";
}

function calculateReportAge(rawText) {
  if (!rawText) return "";
  const match = rawText.match(/\b(\d{2})(\d{2})(\d{2})Z\b/);
  if (!match) return "";

  const repDay = parseInt(match[1], 10);
  const repHour = parseInt(match[2], 10);
  const repMin = parseInt(match[3], 10);

  const now = new Date();
  const currDay = now.getUTCDate();
  let targetMonth = now.getUTCMonth();
  let targetYear = now.getUTCFullYear();

  if (repDay > currDay + 5) {
      targetMonth -= 1;
      if (targetMonth < 0) {
          targetMonth = 11;
          targetYear -= 1;
      }
  }

  const reportDate = new Date(Date.UTC(targetYear, targetMonth, repDay, repHour, repMin));
  const diffMs = now.getTime() - reportDate.getTime();
  const diffMins = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMins < 60) return `(已發佈 ${diffMins} 分鐘)`;
  else {
      const h = Math.floor(diffMins / 60);
      const m = diffMins % 60;
      return `(已發佈 ${h} 小時 ${m} 分鐘)`;
  }
}

function formatColorTAF(rawTaf) {
  if (!rawTaf) return `<div style="background-color: #ebedef; padding: 12px; border-radius: 6px; text-align: left; ${MONOSPACE_FONT} font-size: 13.5px; color: #2c3e50;">目前無有效或無法載入 TAF 報文</div>`;
  
  const catColors = { vfr: '#2ecc71', mvfr: '#3498db', ifr: '#e74c3c', lifr: '#9b59b6', unk: '#95a5a6' };
  const flatTaf = rawTaf.replace(/\s+/g, ' ').trim();
  const markedTaf = flatTaf.replace(/\b(TEMPO|BECMG|FM[0-9]{6}|PROB[0-9]{2})\b/g, '|||$1');
  const lines = markedTaf.split('|||');

  let prevailingVis = 999; let prevailingCeil = 99999;
  let htmlOutput = `<div style="background-color: #ebedef; padding: 12px; border-radius: 6px; text-align: left;">`;

  lines.forEach((line, index) => {
      const cleanLine = line.trim();
      if (!cleanLine) return;

      let current = parseWeatherElements(cleanLine, prevailingVis, prevailingCeil);
      const cat = getFlightCategory(current.vis, current.ceil);
      const color = catColors[cat] || catColors['unk'];
      const catLabel = cat.toUpperCase();
      
      const emojis = getWeatherEmojis(cleanLine);
      const emojiHtml = emojis ? `<span style="font-size: 13px; margin-right: 6px; vertical-align: middle;">${emojis}</span>` : '';

      let isMainBody = false;
      if (index === 0 || cleanLine.startsWith('FM') || cleanLine.startsWith('BECMG')) {
          prevailingVis = current.vis; prevailingCeil = current.ceil;
          isMainBody = true;
      }

      const highlightStyle = isMainBody ? 'background-color: #cbd5e1; padding: 2px 6px; border-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);' : '';

      htmlOutput += `
          <div style="border-left: 4px solid ${color}; padding-left: 10px; margin-bottom: 8px; line-height: 1.6;">
              <span style="display: inline-block; background-color: ${color}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; margin-right: ${emojis ? '4px' : '8px'}; vertical-align: middle;">${catLabel}</span>
              ${emojiHtml}
              <span style="${MONOSPACE_FONT} font-size: 13.5px; color: #2c3e50; vertical-align: middle; word-break: break-word; ${highlightStyle}">${cleanLine}</span>
          </div>
      `;
  });
  htmlOutput += `</div>`;
  return htmlOutput;
}

// ------------------------------------------
// 🚀 面板切換與生命週期管理
// ------------------------------------------
function cleanUpPanel() {
    if (typeof notamMapInstance !== 'undefined' && notamMapInstance !== null) {
        notamMapInstance.remove();
        notamMapInstance = null;
    }
    if (typeof curfewClockInterval !== 'undefined' && curfewClockInterval !== null) {
        clearInterval(curfewClockInterval);
        curfewClockInterval = null;
    }
    const oldScripts = document.querySelectorAll('.dynamic-script');
    oldScripts.forEach(script => script.remove());
}

function loadPage(pageUrl) {
    const displayArea = document.getElementById('content-display');
    cleanUpPanel(); 

    displayArea.innerHTML = '<div style="text-align: center; padding: 2em; color: #3c79ff; font-weight: bold;">讀取模組中 (Loading)...</div>';

    fetch(pageUrl)
        .then(response => {
            if (!response.ok) throw new Error('網路回應異常');
            return response.text();
        })
        .then(html => {
            displayArea.innerHTML = html;

            const scripts = displayArea.querySelectorAll('script');
            scripts.forEach(oldScript => {
                const newScript = document.createElement('script');
                newScript.className = 'dynamic-script'; 
                Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                newScript.appendChild(document.createTextNode(oldScript.innerHTML));
                oldScript.parentNode.replaceChild(newScript, oldScript);
            });

            if (pageUrl.includes('curfew.html')) {
                initCurfewCalculator(); 
            } 
            else if (pageUrl.includes('altimetry.html')) {
                resetAltimetryCalculator(); 
                const resetAltBtn = document.getElementById("resetAltimetryBtn");
                if (resetAltBtn) resetAltBtn.onclick = resetAltimetryCalculator;
            }
            else if (pageUrl.includes('notam.html')) {
                initNotamRadar(); 
            }
            else if (pageUrl.includes('FIDS.html') || pageUrl.includes('TPE_Flight_Data_Link')) { 
                setTimeout(() => {
                    if (typeof initFIDS === 'function') initFIDS();
                }, 50);
            }
        })
        .catch(error => {
            console.error('Fetch 錯誤:', error);
            displayArea.innerHTML = '<div style="text-align: center; padding: 2em; color: #e74c3c; font-weight: bold;">載入失敗，請確認檔案路徑是否正確。</div>';
        });
}

function closePanel() {
    const displayArea = document.getElementById('content-display');
    cleanUpPanel(); 
    displayArea.innerHTML = `
        <div class="section" style="text-align: center; color: #666;">
            <h3>👈 請點擊上方按鈕載入計算工具</h3>
        </div>
    `;
}

// ------------------------------------------
// 📋 總指揮中心與首頁模組初始化 (AppInit)
// ------------------------------------------
function setupChecklist(listId) {
    const list = document.getElementById(listId);
    if (!list) return;
    list.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
}

document.addEventListener("DOMContentLoaded", function () {
    setupChecklist("briefingChecklist1");
    setupChecklist("personalChecklist");
    initFlightSelect();
    initAviationMap();

    console.log("✈️ 簡報箱主核心系統已全面整合上線 (Core Engine Online)");
});

function refreshIframe(id) {
    const iframe = document.getElementById(id);
    if (iframe) iframe.src = iframe.src;
}

function initFlightSelect() {
  const selectEl = document.getElementById("flightSelect");
  if (!selectEl) return;

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "-- 請選擇航班 --";
  selectEl.appendChild(defaultOption);

  flightGroups.forEach(group => {
    const optgroup = document.createElement("optgroup");
    optgroup.label = group.region;
    group.flights
      .sort((a, b) => a.flightNo.localeCompare(b.flightNo, 'en', { numeric: true }))
      .forEach(item => {
        const opt = document.createElement("option");
        opt.value = item.flightNo;
        opt.textContent = `${item.flightNo}  (${item.route})`;
        optgroup.appendChild(opt);
      });
    selectEl.appendChild(optgroup);
  });

  selectEl.addEventListener("change", function() {
    const flightNo = selectEl.value;
    if (!flightNo) {
      const area = document.getElementById("turbliChartArea");
      if (area) area.style.display = "none";
      return;
    }
    loadTurbliChartsForFlight(flightNo);
  });
}

// ==========================================
// 🌪️ Turbli 湍流圖 — 選航班直接顯示今天 + 明天兩張圖
// ==========================================

// 台北時間今天 / 明天 (YYYY-MM-DD)
function turbliDatesTaipei() {
  // 用 Asia/Taipei 取目前日期
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit"
  });
  const today = fmt.format(new Date()); // YYYY-MM-DD
  const t = new Date();
  t.setUTCDate(t.getUTCDate() + 1);
  const tomorrow = fmt.format(t);
  return { today, tomorrow };
}

function formatAge(lastModified) {
  if (!lastModified) return "";
  const ageMs = Date.now() - new Date(lastModified).getTime();
  if (ageMs < 0) return "剛抓的";
  const min = Math.floor(ageMs / 60000);
  if (min < 1) return "剛抓的";
  if (min < 60) return `${min} 分鐘前抓的`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小時前抓的`;
  return `${Math.floor(hr/24)} 天前抓的`;
}

async function loadOneTurbliCell(cellEl, flight, date, route) {
  const dateEl = cellEl.querySelector(".turbli-cell-date");
  const ageEl = cellEl.querySelector(".turbli-cell-age");
  const body = cellEl.querySelector(".turbli-cell-body");

  if (dateEl) dateEl.textContent = date;
  if (ageEl) ageEl.textContent = "";
  body.innerHTML = `<div class="turbli-cell-status loading">✈️ 載入中…</div>`;

  try {
    const res = await fetch(`chartcache/${flight}-${date}.png`, { cache: "default" });
    if (!res.ok) throw new Error("not-cached");
    const blob = await res.blob();
    const imgUrl = URL.createObjectURL(blob);

    body.innerHTML = "";
    const img = document.createElement("img");
    img.src = imgUrl;
    img.alt = `JX-${flight} ${route} ${date} 湍流圖`;
    body.appendChild(img);

    const ageStr = formatAge(res.headers.get("Last-Modified"));
    if (ageEl) ageEl.textContent = ageStr;
  } catch (_) {
    body.innerHTML = `<div class="turbli-cell-status empty">無資料</div>`;
    if (ageEl) ageEl.textContent = "";
  }
}

async function loadTurbliChartsForFlight(flightNo) {
  const area = document.getElementById("turbliChartArea");
  if (!area) return;
  const flight = window.flights.find(f => f.flightNo === flightNo);
  if (!flight) return;

  area.style.display = "grid";
  const { today, tomorrow } = turbliDatesTaipei();
  const todayCell = area.querySelector('[data-slot="today"]');
  const tomorrowCell = area.querySelector('[data-slot="tomorrow"]');

  // 兩張圖並行載入
  await Promise.all([
    loadOneTurbliCell(todayCell, flightNo, today, flight.route),
    loadOneTurbliCell(tomorrowCell, flightNo, tomorrow, flight.route),
  ]);
}

// ==========================================
// 🌍 首頁模組二：NOAA AWC 航空氣象儀表板 (機隊擴充版)
// ==========================================

function calculatePopupAtisAge(rawText) {
    if (!rawText || rawText.includes("無資料") || rawText.includes("失敗")) return "";
    const timeMatch = rawText.match(/\b(?:\d{2})?(\d{2})(\d{2})Z\b/);
    if (!timeMatch) return `<span style="font-size: 11px; background: #f1f5f9; color: #64748b; padding: 2px 8px; border-radius: 12px; font-weight: bold;">未知時間</span>`;

    const atisHr = parseInt(timeMatch[1], 10);
    const atisMin = parseInt(timeMatch[2], 10);
    
    const now = new Date();
    const currHr = now.getUTCHours();
    const currMin = now.getUTCMinutes();
    
    let atisTotalMins = atisHr * 60 + atisMin;
    let currTotalMins = currHr * 60 + currMin;
    
    if (currTotalMins < atisTotalMins && (atisHr >= 22 && currHr <= 2)) {
        currTotalMins += 24 * 60;
    }
    
    let diffMins = currTotalMins - atisTotalMins;
    if (diffMins < 0 && diffMins > -5) diffMins = 0; 
    
    if (diffMins < 0 || diffMins > 1440) return `<span style="font-size: 11px; background: #f1f5f9; color: #64748b; padding: 2px 8px; border-radius: 12px; font-weight: bold;">時效異常</span>`;
    
    if (diffMins > 30) {
        return `<span style="font-size: 11px; background: #fee2e2; color: #ef4444; border: 1px solid #fca5a5; padding: 2px 8px; border-radius: 12px; font-weight: bold;">⚠️ 已過期 (${diffMins}m)</span>`;
    } else {
        return `<span style="font-size: 11px; background: #dcfce7; color: #10b981; padding: 2px 8px; border-radius: 12px; font-weight: bold;">✅ 最新 (${diffMins}m)</span>`;
    }
}

window.fetchPopupAtis = function(icao) {
    const container = document.getElementById(`popup-atis-container-${icao}`);
    if (!container) return;
    const contentBox = document.getElementById(`popup-atis-content-${icao}`);
    const btn = container.querySelector('button');

    btn.innerText = "🔄 正在建立資料鏈路 (Datalink)...";
    btn.disabled = true;
    btn.style.opacity = "0.7";

    const gasUrl = "https://script.google.com/macros/s/AKfycbwgSjLlF8GvVbBAdjkBdIQVDBYhdz5WIzbm8K8f4NAY5_s5cH0xxTf9J4Kv1cMceCPzMQ/exec"; 
    
    fetch(`${gasUrl}?icao=${icao}`)
      .then(response => {
        if (!response.ok) throw new Error("網路狀態異常");
        return response.json();
      })
      .then(data => {
        btn.style.display = "none";
        contentBox.style.display = "block";

        if (data.error) {
            contentBox.innerHTML = `<div style="color: #ef4444; font-weight: bold; text-align: center;">❌ ${data.error}</div>`;
            return;
        }

        const arrAgeBadge = calculatePopupAtisAge(data.arrival);
        const depAgeBadge = calculatePopupAtisAge(data.departure);

        contentBox.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 10px;">
                <div style="background-color: #f8fafc; border-left: 4px solid #3c79ff; padding: 10px; border-radius: 6px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                        <span style="font-weight: bold; color: #3c79ff; font-size: 13px;">📥 ARRIVAL ATIS</span>
                        ${arrAgeBadge}
                    </div>
                    <div class="raw-text" style="${MONOSPACE_FONT} font-size: 12.5px; padding: 0; background: transparent; border: none; white-space: pre-wrap; word-break: break-word;">${data.arrival || "無 Arrival 資料"}</div>
                </div>
                <div style="background-color: #f8fafc; border-left: 4px solid #e67e22; padding: 10px; border-radius: 6px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                        <span style="font-weight: bold; color: #e67e22; font-size: 13px;">🛫 DEPARTURE ATIS</span>
                        ${depAgeBadge}
                    </div>
                    <div class="raw-text" style="${MONOSPACE_FONT} font-size: 12.5px; padding: 0; background: transparent; border: none; white-space: pre-wrap; word-break: break-word;">${data.departure || "無 Departure 資料"}</div>
                </div>
            </div>
        `;
      })
      .catch(error => {
        btn.innerText = "❌ 通訊失敗，點擊重試";
        btn.disabled = false;
        btn.style.opacity = "1";
      });
};

// ------------------------------------------
// ✈️ 智慧時間與分類標籤產生器
// ------------------------------------------
function getAirportTimeHTML(lng) {
    const now = new Date();
    const utcString = now.toISOString().substring(0, 16).replace('T', ' ') + 'Z';
    
    const offsetHours = Math.round(lng / 15);
    const local = new Date(now.getTime() + offsetHours * 3600 * 1000);
    
    const YYYY = local.getUTCFullYear();
    const MM = String(local.getUTCMonth() + 1).padStart(2, '0');
    const DD = String(local.getUTCDate()).padStart(2, '0');
    const HH = String(local.getUTCHours()).padStart(2, '0');
    const MIN = String(local.getUTCMinutes()).padStart(2, '0');
    const sign = offsetHours >= 0 ? '+' : '';
    const localString = `${YYYY}-${MM}-${DD} ${HH}:${MIN} (UTC${sign}${offsetHours})`;

    return `
        <div style="display:flex; flex-wrap: wrap; gap: 10px; margin-bottom: 10px; font-size: 12px; color: #64748b; background: #f8fafc; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0;">
            <div style="flex: 1; min-width: 140px;"><span style="font-weight:bold; color:#475569;">🕒 UTC:</span> ${utcString}</div>
            <div style="flex: 1; min-width: 140px;"><span style="font-weight:bold; color:#475569;">📍 Local:</span> ${localString}</div>
        </div>
    `;
}

function getCategoryBadge(typeStr) {
    if (!typeStr) return '';
    let bgColor = '#94a3b8'; // 預設灰色
    let displayCat = '';

    // 優先順序: S > R > A > P/RF
    if (typeStr.includes('S')) { bgColor = '#f97316'; displayCat = 'S (Special)'; } // 橘色
    else if (typeStr.includes('R')) { bgColor = '#22c55e'; displayCat = 'R (Regular)'; } // 綠色
    else if (typeStr.includes('A')) { bgColor = '#3b82f6'; displayCat = 'A (Alternate)'; } // 藍色
    else if (typeStr.includes('P') || typeStr.includes('RF')) { bgColor = '#64748b'; displayCat = typeStr.includes('P') ? 'P (Provisional)' : 'RF (Refueling)'; } // 灰色

    if(!displayCat) return '';

    return `<span style="background:${bgColor}; color:white; padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: bold; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">分類: ${displayCat} [${typeStr}]</span>`;
}

// ------------------------------------------
// 🌤️ 開源氣象整合 (Open-Meteo) 輔助函數
// ------------------------------------------
function getWmoEmoji(code, isNight) {
    // 根據 WMO 天氣代碼返回對應 Emoji
    if (code === 0) return isNight ? '🌙' : '☀️';
    if (code === 1) return isNight ? '🌤️' : '🌤️'; 
    if (code === 2) return '⛅';
    if (code === 3) return '☁️';
    if ([45, 48].includes(code)) return '🌫️';
    if ([51, 53, 55, 56, 57].includes(code)) return '🌧️';
    if ([61, 63, 65, 66, 67].includes(code)) return '🌧️';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return '🌨️';
    if ([80, 81, 82].includes(code)) return '🌦️';
    if ([95, 96, 99].includes(code)) return '⛈️';
    return '❓';
}

window.fetchOpenMeteoForecast = async function(icao, lat, lng) {
    const container = document.getElementById(`os-weather-${icao}`);
    if (!container) return;

    if (!lat || !lng) {
        container.innerHTML = '<div style="font-size:12px; color:#ef4444; padding:8px; text-align:center;">無座標資訊，無法載入天氣</div>';
        return;
    }

    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,weathercode&timezone=UTC&forecast_days=2`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('API Error');
        const data = await res.json();

        const now = new Date();
        const currentUtcHour = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), 0, 0));

        let startIndex = data.hourly.time.findIndex(t => new Date(t + "Z").getTime() >= currentUtcHour.getTime());
        if (startIndex === -1) startIndex = 0;

        let html = `<div style="display:flex; overflow-x:auto; gap:12px; padding:10px; background:#f8fafc; border-radius:6px; border:1px solid #e2e8f0; font-family: ui-monospace, 'SF Mono', Consolas, monospace; justify-content: space-between;">`;

        // 每 3 小時為間隔，總共 24 小時 (8 個節點)
        for (let i = 0; i <= 24; i += 3) {
            const idx = startIndex + i;
            if (idx >= data.hourly.time.length) break;

            const timeStr = data.hourly.time[idx]; 
            const dateObj = new Date(timeStr + "Z");
            const hh = String(dateObj.getUTCHours()).padStart(2, '0');
            const temp = Math.round(data.hourly.temperature_2m[idx]);
            const code = data.hourly.weathercode[idx];

            const isNight = (dateObj.getUTCHours() < 6 || dateObj.getUTCHours() >= 18);
            const emoji = getWmoEmoji(code, isNight);

            html += `
                <div style="display:flex; flex-direction:column; align-items:center; min-width:45px;">
                    <span style="font-size:11px; color:#64748b; font-weight:bold;">${hh}Z</span>
                    <span style="font-size:22px; margin:4px 0; text-shadow: 1px 1px 2px rgba(0,0,0,0.1);">${emoji}</span>
                    <span style="font-size:14px; font-weight:bold; color:#1e293b;">${temp}°C</span>
                </div>
            `;
        }
        html += `</div>`;
        container.innerHTML = html;

    } catch (e) {
        container.innerHTML = '<div style="font-size:12px; color:#ef4444; padding:8px; text-align:center;">開源天氣載入失敗</div>';
    }
};

// ------------------------------------------
// ✈️ 地圖彈出視窗(Popup) 組件產生器
// ------------------------------------------
function buildAirportPopupHtml(airport, rawMetarText, rawTafText) {
    const metarState = parseWeatherElements(rawMetarText, 999, 99999);
    const metarCat = getFlightCategory(metarState.vis, metarState.ceil);
    const displayCat = rawMetarText ? metarCat.toUpperCase() : "UNK";

    const metarAgeStr = calculateReportAge(rawMetarText);
    const tafAgeStr = calculateReportAge(rawTafText);
    const coloredTafHtml = formatColorTAF(rawTafText);

    const metarEmojis = getWeatherEmojis(rawMetarText);
    const metarEmojiHtml = metarEmojis ? `<span style="font-size: 15px; margin-left: 6px; vertical-align: middle;">${metarEmojis}</span>` : '';

    const catColors = { vfr: '#2ecc71', mvfr: '#3498db', ifr: '#e74c3c', lifr: '#9b59b6', unk: '#95a5a6' };
    const badgeColor = catColors[metarCat] || catColors['unk'];

    const timeHtml = airport.lng ? getAirportTimeHTML(airport.lng) : '';
    const fleetBadgeHtml = airport.type ? getCategoryBadge(airport.type) : '';

    return `
    <div class="weather-popup">
        <div class="airport-title" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <span>${airport.name} (${airport.icao})</span>
            ${fleetBadgeHtml}
        </div>
        
        ${timeHtml}

        <div id="os-weather-${airport.icao}" style="margin-bottom: 15px;">
            <div style="font-size:12px; color:#64748b; padding:8px; background:#f8fafc; border-radius:6px; border:1px solid #e2e8f0; text-align:center;">⏳ 正在擷取開源氣象資料...</div>
        </div>

        <div class="data-block">
            <div class="section-title">
                <span style="display:inline-flex; align-items:center;">
                    METAR (即時天氣)
                    ${rawMetarText ? `<span class="badge" style="background-color: ${badgeColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-left: 8px; font-weight: bold;">${displayCat}</span>${metarEmojiHtml}` : ''}
                </span>
                <span style="font-size:12.5px; color:#7f8c8d; font-weight:normal; margin-left:10px; margin-top:2px;">${metarAgeStr}</span>
            </div>
            <div class="raw-text" style="border-left: 4px solid ${badgeColor}; white-space: pre-wrap; word-break: break-word; background-color: #f8fafc; padding: 10px; border-radius: 4px; ${MONOSPACE_FONT} font-size: 13px;">${rawMetarText || "目前無有效 METAR 報文"}</div>
        </div>
        
        <div class="data-block" style="margin-top: 15px;">
            <div class="section-title">
                <span style="display:inline-flex; align-items:center;">TAF (機場預報)</span>
                <span style="font-size:12.5px; color:#7f8c8d; font-weight:normal; margin-left:10px; margin-top:2px;">${tafAgeStr}</span>
            </div>
            ${coloredTafHtml}
        </div>

        <div class="data-block" id="popup-atis-container-${airport.icao}" style="border-bottom: none; margin-top: 15px;">
            <button class="btn-outline" style="width: 100%; margin: 0; padding: 8px; border: 1px solid #3c79ff; color: #3c79ff; border-radius: 6px; background: #ebf5ff; cursor: pointer; font-weight: bold; transition: 0.2s;" onclick="fetchPopupAtis('${airport.icao}')">
                📻 獲取 ${airport.icao} 即時 D-ATIS
            </button>
            <div id="popup-atis-content-${airport.icao}" style="display: none; margin-top: 10px;"></div>
        </div>

        <div class="data-block" style="border-bottom: none; margin-top: 15px; border-top: 2px dashed #e2e8f0; padding-top: 15px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <span style="color: #8e44ad; font-size: 13.5px; font-weight: bold;">🕒 歷史氣象 (過去 24 小時)</span>
                <button class="btn-outline" style="border: none; background-color: #8e44ad; color: white; padding: 5px 12px; font-size: 12px; margin: 0; border-radius: 6px; cursor: pointer; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" onclick="fetchHistoryMetarPopup('${airport.icao}')">
                    載入紀錄
                </button>
            </div>
            <div id="history-metar-container-${airport.icao}" class="custom-scrollbar" style="max-height: 250px; overflow-y: auto; display: none; padding-right: 5px; margin-top: 10px;">
                <div style="text-align: center; color: #94a3b8; font-size: 0.9em; padding: 10px;">資料載入中...</div>
            </div>
        </div>
    </div>
    `;
}

// ------------------------------------------
// 🕒 獲取 24H 歷史氣象紀錄
// ------------------------------------------
window.fetchHistoryMetarPopup = async function(icao) {
    const container = document.getElementById(`history-metar-container-${icao}`);
    if (!container) return;

    container.style.display = 'block';
    container.innerHTML = `<div style="text-align: center; color: #8e44ad; font-size: 0.9em; padding: 20px;">🔄 正在獲取 ${icao} 過去 24 小時紀錄...</div>`;

    try {
        const cleanUrl = `https://aviationweather.gov/api/data/metar?ids=${icao}&format=json&hours=24`;

        const fetchWithTimeout = async (url, ms, label) => {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), ms);
            try {
                const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
                clearTimeout(id);
                if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
                const text = await res.text();
                if (!text || !text.trim()) throw new Error(`${label}: empty body`);
                const arr = JSON.parse(text);
                if (!Array.isArray(arr)) throw new Error(`${label}: not array`);
                return arr;
            } catch (err) {
                clearTimeout(id);
                throw err;
            }
        };

        // 4 條路並行 race,第一個成功就用
        let data;
        try {
            data = await Promise.any([
                fetchWithTimeout(cleanUrl, 8000, 'direct'),
                fetchWithTimeout(`https://corsproxy.io/?${encodeURIComponent(cleanUrl)}`, 9000, 'corsproxy'),
                fetchWithTimeout(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(cleanUrl)}`, 9000, 'codetabs'),
                fetchWithTimeout(`https://api.allorigins.win/raw?url=${encodeURIComponent(cleanUrl)}`, 9000, 'allorigins'),
            ]);
        } catch (e) {
            const reasons = (e && e.errors) ? e.errors.map(x => (x && x.message) || String(x)).join(' | ') : String(e);
            console.error(`[history METAR ${icao}] all racers failed: ${reasons}`);
            throw new Error('無法連接至氣象資料庫');
        }

        if (!data || data.length === 0) {
            container.innerHTML = `<div style="text-align: center; color: #ef4444; font-size: 0.9em; padding: 20px;">❌ 找不到 ${icao} 的歷史紀錄</div>`;
            return;
        }

        let html = `<div style="display: flex; flex-direction: column; gap: 8px;">`;
        data.forEach(item => {
            const rawText = item.rawOb || item.raw;
            const current = parseWeatherElements(rawText, 999, 99999);
            const cat = getFlightCategory(current.vis, current.ceil);
            const catLabel = cat.toUpperCase();
            
            const catColors = { vfr: '#2ecc71', mvfr: '#3498db', ifr: '#e74c3c', lifr: '#9b59b6', unk: '#95a5a6' };
            const color = catColors[cat] || catColors['unk'];
            
            const emojis = getWeatherEmojis(rawText);
            const emojiHtml = emojis ? `<span style="font-size: 13px; margin-right: 6px; vertical-align: middle;">${emojis}</span>` : '';
            
            // 處理時間格式 (支援 UNIX Timestamp 與 ISO String)
            let dateObj;
            if (typeof item.obsTime === 'number') {
                dateObj = new Date(item.obsTime * 1000);
            } else {
                dateObj = new Date(item.obsTime);
            }
            const timeStr = item.obsTime ? dateObj.toISOString().replace('T', ' ').substring(0, 16) + 'Z' : '';

            html += `
                <div style="background-color: #f8fafc; border-left: 4px solid ${color}; padding: 10px; border-radius: 6px;">
                    <div style="margin-bottom: 4px; font-size: 11px; color: #64748b; font-weight: bold;">
                        <span style="display: inline-block; background-color: ${color}; color: white; padding: 2px 6px; border-radius: 4px; margin-right: 6px;">${catLabel}</span>
                        ${emojiHtml}
                        <span style="${MONOSPACE_FONT}">${timeStr}</span>
                    </div>
                    <div style="${MONOSPACE_FONT} font-size: 13px; color: #2c3e50; word-break: break-word;">
                        ${rawText}
                    </div>
                </div>
            `;
        });
        html += `</div>`;
        container.innerHTML = html;
    } catch (err) {
        console.warn("歷史氣象讀取失敗:", err);
        container.innerHTML = `<div style="text-align: center; color: #ef4444; font-size: 0.9em; padding: 20px;">❌ 歷史資料讀取失敗<br><span style="font-size: 0.8em; color: #94a3b8;">請檢查網路狀態</span></div>`;
    }
};

// ==========================================
// 🗺️ 核心機場座標與機隊資料庫
// ==========================================
const coordsDB = {
    "RCTP": [25.0777, 121.2328], "RCSS": [25.0697, 121.5525], "RCKH": [22.5771, 120.3500], "RCMQ": [24.2646, 120.6200], "RCNN": [22.9503, 120.2061], "RCFN": [22.7564, 121.1033],
    "RCBS": [24.4283, 118.3592], "RCQC": [23.5681, 119.6300], "RCYU": [24.0276, 121.6174], "RCFG": [26.1580, 119.9576], "RCMT": [26.2238, 120.0022], "RCKU": [23.4619, 120.3956], "RCLM": [20.7042, 116.7183],
    "RJAA": [35.7647, 140.3863], "RJBB": [34.4273, 135.2440], "RJCC": [42.7752, 141.6923], "RJCH": [41.7700, 140.8220], "RJFF": [33.5859, 130.4507], "RJFK": [31.8034, 130.7194],
    "RJFT": [32.8372, 130.8553], "RJGG": [34.8583, 136.8053], "RJSS": [38.1397, 140.9169], "RJTT": [35.5523, 139.7797], "RJOT": [34.2144, 134.0156], "RJBE": [34.6328, 135.2239],
    "ROAH": [26.1958, 127.6458], "VHHH": [22.3089, 113.9146], "VMMC": [22.1496, 113.5915], "WMKK": [2.7456, 101.7099], "WMKP": [5.2971, 100.2769],
    "RPLC": [15.1858, 120.5599], "RPLL": [14.5090, 121.0194], "RPVM": [10.3075, 123.9794], "WSSS": [1.3592, 103.9893], "VTBD": [13.9126, 100.6068],
    "VTBS": [13.6811, 100.7473], "VTBU": [12.6797, 101.0051], "VTCC": [18.7668, 98.9626], "VTSP": [8.1132, 98.3169], "VVCR": [11.9981, 109.2193],
    "VVDN": [16.0439, 108.1994], "VVNB": [21.2212, 105.8072], "VVPQ": [10.1656, 103.9944], "VVTS": [10.8188, 106.6520], "WADD": [-8.7482, 115.1675],
    "WARR": [-7.3798, 112.7836], "WIII": [-6.1256, 106.6558], "WBGG": [1.4847, 110.3468], "WICA": [-6.6264, 108.1763], "PGSN": [15.1188, 145.2428],
    "PGUM": [13.4834, 144.7960], "PTRO": [7.3672, 134.5441], "RJFU": [32.9169, 129.9136], "RJNK": [36.3934, 136.4070], "RJOS": [34.1328, 134.6066],
    "RJSN": [37.9558, 139.1133], "RKPC": [33.5113, 126.4930], "RKPK": [35.1795, 128.9382], "RKSI": [37.4602, 126.4407], "RKSS": [37.5583, 126.7906],
    "RKTN": [35.8941, 128.6587], "ROIG": [24.3964, 124.1864], "RORS": [24.8267, 125.1447], "RPMD": [7.1253, 125.6456], "CYVR": [49.1967, -123.1815],
    "EDDB": [52.3667, 13.5033], "EDDM": [48.3538, 11.7861], "EPWA": [52.1657, 20.9671], "KLAS": [36.0801, -115.1523], "KLAX": [33.9416, -118.4085],
    "KOAK": [37.7213, -122.2207], "KONT": [34.0560, -117.6012], "KPDX": [45.5898, -122.5951], "KPHX": [33.4342, -112.0080], "KSEA": [47.4489, -122.3094],
    "KSFO": [37.6189, -122.3750], "KSMF": [38.6954, -121.5908], "KTUS": [32.1161, -110.9410], "LKPR": [50.1008, 14.2600], "LOWL": [48.2332, 14.1875],
    "LOWW": [48.1103, 16.5697], "PACD": [55.2045, -162.7246], "PAFA": [64.8151, -147.8563], "PAKN": [58.6768, -156.6492], "PANC": [61.1743, -149.9962],
    "PASY": [52.7123, 174.1136], "PHNL": [21.3187, -157.9225], "PMDY": [28.2015, -177.3800], "PWAK": [19.2815, 166.6358]
};

const rawA321 = `
PGSN / Saipan Intl. / Saipan, Northern Mariana / A
PGUM / Guam Intl. / Agana, Guam, USA / R
PTRO / Roman Tmetuchl Intl. / Koror, Palau / A
RCFN / Taitung Airport / Taitung, Taiwan / P, S
RCKH / Kaohsiung Intl. / Kaohsiung, Taiwan / P, S
RCMQ / Taichung Intl. / Taichung, Taiwan / R
RCNN / Tainan Airport / Tainan, Taiwan / P
RCSS / Songshan Intl. / Taipei, Taiwan / A, S
RCTP / Taiwan Taoyuan Intl. / Taoyuan, Taiwan / R
RJAA / New Tokyo (Narita) Intl. / Tokyo, Japan / R
RJBB / Kansai Intl. / Osaka, Japan / R
RJBE / Kobe Airport / Kobe, Japan / R
RJCC / New Chitose Airport / Sapporo, Japan / R
RJCH / Hakodate Airport / Hakodate, Japan / R
RJFF / Fukuoka Intl. / Fukuoka, Japan / R, S
RJFK / Kagoshima Airport / Kagoshima, Japan / A
RJFT / Kumamoto Airport / Kumamoto, Japan / R
RJFU / Nagasaki Airport / Nagasaki, Japan / A
RJGG / Chubu Centrair Intl. / Nagoya, Japan / R
RJNK / Komatsu Intl. / Komatsu, Japan / A
RJOS / Tokushima Awaodori Airport / Tokushima, Japan / P
RJOT / Takamatsu Airport / Takamatsu, Japan / R
RJSN / Niigata Intl. / Niigata, Japan / A
RJSS / Sendai Intl. / Sendai, Japan / R
RJTT / Tokyo (Haneda) Intl. / Tokyo, Japan / A
RKPC / Jeju Intl. / Jeju, South Korea / A
RKPK / Gimhae Intl. / Busan, South Korea / R, S
RKSI / Incheon Intl. / Seoul, South Korea / A
RKSS / Gimpo Intl. / Seoul, South Korea / A
RKTN / Daegu Intl. / Daegu, South Korea / A
ROAH / Naha Airport / Naha, Japan / R
ROIG / Ishigaki Airport / Ishigaki, Japan / P
RORS / Shimojishima Airport / Miyakojima, Japan / R
RPLC / Clark Intl. / Angel City, Philippines / R
RPLL / Ninoy Aquino Intl / Manila, Philippines / R
RPMD / Francisco Bangoy Intl. / Davao, Philippines / A
RPVM / Mactan Cebu Intl. / Lapu Lapu, Philippines / R
VHHH / Hong Kong Intl. / Hong Kong, China / R, S
VMMC / Macao Intl. / Macao, China / R
VTBD / Don Mueang Intl. / Bangkok, Thailand / A
VTBS / Suvarnabhumi Intl. / Bangkok, Thailand / R
VTBU / U-Tapao Rayong Pattaya Intl. / Rayong, Thailand / A
VTCC / Chiang Mai Intl. / Chiang Mai, Thailand / R
VTSP / Phuket Intl. / Phuket, Thailand / A
VVCR / Cam Ranh Intl. / Khanh Hoa, Vietnam / A
VVDN / Danang Intl. / Danang, Vietnam / R
VVNB / Noi bai Intl. / Hanoi, Vietnam / R
VVPQ / Phu Quoc Intl. / Kiên Giang, Vietnam / R
VVTS / Tan Son Nhat Intl. / Ho Chi Minh, Vietnam / R
WADD / Bali Intl. / Denpasar, Indonesia / A
WARR / Juanda Intl. / Surabaya, Indonesia / A
WBGG / Kuching Intl. / Kuching, Malaysia / A
WIII / Soekarno Hatta Intl. / Jakarta, Indonesia / R
WICA / Kertajati Intl. / Majalengka, Indonesia / A
WMKP / Penang Intl. / Penang, Malaysia / R
WMKK / Kuala Lumpur Intl. / Kuala Lumpur, Malaysia / R
WSSS / Singapore Changi. / Singapore / R`;

const rawA330 = `
RCKH / Kaohsiung Intl. / Kaohsiung, Taiwan / A, S
RCSS / Songshan Intl. / Taipei, Taiwan / A, S
RCTP / Taiwan Taoyuan Intl. / Taoyuan, Taiwan / R
RJAA / New Tokyo (Narita) Intl. / Tokyo, Japan / R
RJBB / Kansai Intl. / Osaka, Japan / R
RJCC / New Chitose Airport / Sapporo, Japan / R
RJCH / Hakodate Airport / Hakodate, Japan / A
RJFF / Fukuoka Intl. / Fukuoka, Japan / R, S
RJFK / Kagoshima Airport / Kagoshima, Japan / A
RJFT / Kumamoto Airport / Kumamoto, Japan / R
RJGG / Chubu Centrair Intl. / Nagoya, Japan / R
RJOT / Takamatsu Airport / Takamatsu, Japan / A
RJSS / Sendai Intl. / Sendai, Japan / R
RJTT / Tokyo (Haneda) Intl. / Tokyo, Japan / A
ROAH / Naha Airport / Naha, Japan / R
RPLC / Clark Intl. / Angel City, Philippines / R
RPLL / Ninoy Aquino Intl / Manila, Philippines / R
RPVM / Mactan Cebu Intl. / Lapu Lapu, Philippines / A
VHHH / Hong Kong Intl. / Hong Kong, China / R, S
VMMC / Macao Intl. / Macao, China / R
VTBD / Don Mueang Intl. / Bangkok, Thailand / A
VTBS / Suvarnabhumi Intl. / Bangkok, Thailand / R
VTBU / U-Tapao Rayong Pattaya Intl. / Rayong, Thailand / A
VTCC / Chiang Mai Intl. / Chiang Mai, Thailand / R
VVCR / Cam Ranh Intl. / Khanh Hoa, Vietnam / A
VVDN / Danang Intl. / Danang, Vietnam / R
VVNB / Noi bai Intl. / Hanoi, Vietnam / R
VVPQ / Phu Quoc Intl. / Kiên Giang, Vietnam / R
VVTS / Tan Son Nhat Intl. / Ho Chi Minh, Vietnam / R
WARR / Juanda Intl. / Surabaya, Indonesia / A
WBGG / Kuching Intl. / Kuching, Malaysia / A
WIII / Soekarno Hatta Intl. / Jakarta, Indonesia / A
WMKP / Penang Intl. / Penang, Malaysia / R
WMKK / Kuala Lumpur Intl. / Kuala Lumpur, Malaysia / R
WSSS / Singapore Changi. / Singapore / R`;

const rawA350 = `
CYVR / Vancouver Intl. / Vancouver, Canada / A
EDDB / Berlin Brandenburg Airport / Brandenburg, Germany / A
EDDM / Munich Airport / Bavaria, Germany / A
EPWA / Warsaw Chopin Airport / Warsaw, Poland / A
KLAS / Harry Reid Intl. / Las Vegas, NV, USA / A
KLAX / Los Angeles Intl. / Los Angeles, CA, USA / R
KOAK / Oakland Intl. / Oakland, CA, USA / A
KONT / Ontario Intl. / Ontario, CA, USA / R, S
KPDX / Portland Intl. / Portland, OR, USA / A, RF
KPHX / Phoenix Sky Harbor Intl. / Phoenix, AZ, USA / R
KSEA / Seattle Intl. / SeaTac, WA, USA / R
KSFO / San Francisco Intl. / San Francisco, CA, USA / R, S
KSMF / Sacramento Intl. / Sacramento, CA, USA / A
KTUS / Tucson Intl. / Tucson, AZ, USA / A
LKPR / Prague Intl. / Prague, Czech / R
LOWL / Linz Airport / Hörsching, Austria / A
LOWW / Vienna Intl. / Schwechat, Austria / A
PACD / Cold Bay Airport / Cold Bay, AK, USA / A
PAFA / Fairbanks Intl. / Fairbanks, AK, USA / A
PAKN / King Salmon Airport / King Salmon, AK, USA / A
PANC / Ted Stevens Anchorage Intl. / Anchorage, AK, USA / A
PASY / Eareckson Air Station / Shemya, AK, USA / A
PGSN / Saipan Intl. / Saipan, Northern Mariana / A
PGUM / Guam Intl. / Agana, Guam, USA / A
PHNL / Inouye Intl. / Honolulu, HI, USA / A
PMDY / Henderson Field / Midway Island / A
PWAK / Wake Island Airfield / Wake Island / A
RCKH / Kaohsiung Intl. / Kaohsiung, Taiwan / A, S
RCSS / Songshan Intl. / Taipei, Taiwan / A, S
RCTP / Taiwan Taoyuan Intl. / Taoyuan, Taiwan / R
RJAA / New Tokyo (Narita) Intl. / Tokyo, Japan / R
RJBB / Kansai Intl. / Osaka, Japan / R
RJCC / New Chitose Airport / Sapporo, Japan / R
RJCH / Hakodate Airport / Hakodate, Japan / A
RJFF / Fukuoka Intl. / Fukuoka, Japan / R, S
RJGG / Chubu Centrair Intl. / Nagoya, Japan / R
RJSS / Sendai Intl. / Sendai, Japan / A
RJTT / Tokyo (Haneda) Intl. / Tokyo, Japan / A
RKPC / Jeju Intl. / Jeju, South Korea / A
RKPK / Gimhae Intl. / Busan, South Korea / A, S
RKSI / Incheon Intl. / Seoul, South Korea / A
ROAH / Naha Airport / Naha, Japan / R
RPLC / Clark Intl. / Angel City, Philippines / A
RPLL / Ninoy Aquino Intl / Manila, Philippines / R
RPVM / Mactan Cebu Intl. / Lapu Lapu, Philippines / A
VHHH / Hong Kong Intl. / Hong Kong, China / R, S
VMMC / Macao Intl. / Macao, China / R
VTBD / Don Mueang Intl. / Bangkok, Thailand / A
VTBS / Suvarnabhumi Intl. / Bangkok, Thailand / R
VTBU / U-Tapao Rayong Pattaya Intl. / Rayong, Thailand / A
VTCC / Chiang Mai Intl. / Chiang Mai, Thailand / A
VVCR / Cam Ranh Intl. / Khanh Hoa, Vietnam / A
VVDN / Danang Intl. / Danang, Vietnam / A
VVNB / Noi bai Intl. / Hanoi, Vietnam / R
VVPQ / Phu Quoc Intl. / Kiên Giang, Vietnam / A
VVTS / Tan Son Nhat Intl. / Ho Chi Minh, Vietnam / R
WARR / Juanda Intl. / Surabaya, Indonesia / A
WIII / Soekarno Hatta Intl. / Jakarta, Indonesia / A
WMKP / Penang Intl. / Penang, Malaysia / A
WMKK / Kuala Lumpur Intl. / Kuala Lumpur, Malaysia / A
WSSS / Singapore Changi. / Singapore / R
RCKH / Kaohsiung Intl. / Kaohsiung, Taiwan / A, S
RCTP / Taiwan Taoyuan Intl. / Taoyuan, Taiwan / R
RJAA / New Tokyo (Narita) Intl. / Tokyo, Japan / R
RJBB / Kansai Intl. / Osaka, Japan / R
RJCC / New Chitose Airport / Sapporo, Japan / A
RJFF / Fukuoka Intl. / Fukuoka, Japan / A, S
RJGG / Chubu Centrair Intl. / Nagoya, Japan / A
RJSS / Sendai Intl. / Sendai, Japan / A
RJTT / Tokyo (Haneda) Intl. / Tokyo, Japan / A
ROAH / Naha Airport / Naha, Japan / A
RPLC / Clark Intl. / Angel City, Philippines / A
RPLL / Ninoy Aquino Intl / Manila, Philippines / A
VHHH / Hong Kong Intl. / Hong Kong, China / A, S
VMMC / Macao Intl. / Macao, China / A
VTBD / Don Mueang Intl. / Bangkok, Thailand / A
VTBS / Suvarnabhumi Intl. / Bangkok, Thailand / R
VTBU / U-Tapao Rayong Pattaya Intl. / Rayong, Thailand / A
VTCC / Chiang Mai Intl. / Chiang Mai, Thailand / A`;

const rawDomestic = `
RCTP / 桃園國際機場 / Taoyuan, Taiwan / D
RCSS / 台北松山機場 / Taipei, Taiwan / D
RCMQ / 台中國際機場 / Taichung, Taiwan / D
RCKH / 高雄國際機場 / Kaohsiung, Taiwan / D
RCBS / 金門機場 / Kinmen, Taiwan / D
RCFN / 台東機場 / Taitung, Taiwan / D
RCFG / 馬祖南竿機場 / Matsu, Taiwan / D
RCKU / 嘉義機場 / Chiayi, Taiwan / D
RCMT / 馬祖北竿機場 / Matsu, Taiwan / D
RCNN / 台南機場 / Tainan, Taiwan / D
RCQC / 澎湖機場 / Penghu, Taiwan / D
RCYU / 花蓮機場 / Hualien, Taiwan / D
RCLM / 東沙機場 / Dongsha Island, Taiwan / D`;

function parseFleetData(rawString) {
    const lines = rawString.trim().split('\n');
    const map = new Map();
    lines.forEach(line => {
        const parts = line.split('/').map(p => p.trim());
        if(parts.length >= 4) {
            const icao = parts[0];
            const name = parts[1];
            const type = parts[3];
            const coords = coordsDB[icao] || [0, 0];
            if (map.has(icao)) {
                // 如果已經存在 (例如 A350 兩機型都有)，則累加屬性字串，後續徽章函數會自動抓取最高優先級
                map.get(icao).type += ', ' + type;
            } else {
                map.set(icao, { icao, name, type, lat: coords[0], lng: coords[1] });
            }
        }
    });
    return Array.from(map.values());
}

const fleets = {
    "A321": parseFleetData(rawA321),
    "A330": parseFleetData(rawA330),
    "A350": parseFleetData(rawA350),
    "Domestic": parseFleetData(rawDomestic)
};

const weatherCache = {};
let currentFleet = "A330"; 
let fleetMarkersLayer;

// 🌍 全域共用：並行 race 多條 proxy 鏈路,第一個拿到資料就回傳 — 比序列備援快 + 不會被單條卡住
const fetchBulkWeatherFast = async (icaoList, type) => {
    if(!icaoList) return [];
    const cleanUrl = `https://aviationweather.gov/api/data/${type}?ids=${icaoList}&format=json`;

    const fetchWithTimeout = async (url, timeoutMs, label) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
            clearTimeout(id);
            if (!res.ok) throw new Error(`${label}: HTTP ${res.status}`);
            const text = await res.text();
            if (!text || !text.trim()) throw new Error(`${label}: empty body`);
            const data = JSON.parse(text);
            if (!Array.isArray(data)) throw new Error(`${label}: not array`);
            return data;
        } catch (err) {
            clearTimeout(id);
            throw err;
        }
    };

    const racers = [
        fetchWithTimeout(cleanUrl, 8000, 'direct'),
        fetchWithTimeout(`https://corsproxy.io/?${encodeURIComponent(cleanUrl)}`, 9000, 'corsproxy'),
        fetchWithTimeout(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(cleanUrl)}`, 9000, 'codetabs'),
        fetchWithTimeout(`https://api.allorigins.win/raw?url=${encodeURIComponent(cleanUrl)}`, 9000, 'allorigins'),
    ];

    try {
        return await Promise.any(racers);
    } catch (e) {
        // Promise.any 失敗會帶 AggregateError,把每條的錯誤訊息列出來給 console 看
        const reasons = (e && e.errors) ? e.errors.map(x => (x && x.message) || String(x)).join(' | ') : String(e);
        console.error(`[fetchBulkWeatherFast ${type}] all racers failed: ${reasons}`);
        throw new Error(`無法連接至氣象資料庫`);
    }
};

// 更新右上角狀態膠囊 (現在它本身就是「重新整理」按鈕)
const setSyncStatus = (state, fleetName) => {
    const el = document.getElementById('sync-status');
    if (!el) return;
    el.classList.remove('status-loaded', 'status-error');
    el.style.opacity = '1';
    el.style.cursor = 'pointer';
    el.disabled = false;
    el.style.backgroundColor = '';
    if (state === 'syncing') {
        el.innerText = `🚀 同步 ${fleetName} 機隊中...`;
        el.style.backgroundColor = '#f39c12';
        el.style.cursor = 'progress';
        el.style.opacity = '0.85';
        el.disabled = true;
        el.title = '同步中,請稍候';
    } else if (state === 'loaded') {
        el.innerText = `✅ ${fleetName} 氣象就緒 · ⟳`;
        el.classList.add('status-loaded');
        el.title = '點一下重新整理目前機隊氣象';
    } else if (state === 'error') {
        el.innerText = '❌ 氣象同步失敗 · 點此重試';
        el.classList.add('status-error');
        el.title = '點一下重試';
    } else if (state === 'idle') {
        el.innerText = '⏸️ 系統初始化中...';
        el.title = '';
    }
};

const syncFleetWeather = async (fleetName, forceRefresh = false, _retried = false) => {
    setSyncStatus('syncing', fleetName);

    const airports = fleets[fleetName];

    if (forceRefresh) {
        airports.forEach(a => { delete weatherCache[a.icao]; });
    }

    // 過濾出尚未快取的 ICAO 列表 (大幅減少切換時的 API 負擔)
    const missingIcaos = airports
        .map(a => a.icao)
        .filter(icao => !weatherCache[icao] || (!weatherCache[icao].metar && !weatherCache[icao].taf));

    try {
        if (missingIcaos.length > 0) {
            const chunkSize = 50; // 分批請求防 URL 過長
            for (let i = 0; i < missingIcaos.length; i += chunkSize) {
                const chunk = missingIcaos.slice(i, i + chunkSize).join(',');
                const [metars, tafs] = await Promise.all([
                    fetchBulkWeatherFast(chunk, 'metar'),
                    fetchBulkWeatherFast(chunk, 'taf')
                ]);

                // 初始化快取物件
                missingIcaos.slice(i, i + chunkSize).forEach(icao => {
                    if(!weatherCache[icao]) weatherCache[icao] = { metar: "", taf: "" };
                });

                metars.forEach(m => {
                    if(m.icaoId && weatherCache[m.icaoId]) weatherCache[m.icaoId].metar = m.rawOb || m.raw;
                });
                tafs.forEach(t => {
                    if(t.icaoId && weatherCache[t.icaoId]) weatherCache[t.icaoId].taf = t.rawTAF || t.raw;
                });
            }
        }

        setSyncStatus('loaded', fleetName);
        renderFleetMarkers(fleetName);

    } catch (error) {
        console.error('同步程序中斷:', error.message);
        // 第一次失敗自動重試一次 (forceRefresh),解決機隊切換冷啟動 race
        if (!_retried) {
            console.warn('[syncFleetWeather] auto-retry with forceRefresh');
            return syncFleetWeather(fleetName, true, true);
        }
        setSyncStatus('error', fleetName);
    }
};

function renderFleetMarkers(fleetName) {
    if (fleetMarkersLayer) {
        fleetMarkersLayer.clearLayers();
    }

    const airports = fleets[fleetName];
    let validBounds = [];

    airports.forEach(airport => {
        if (airport.lat === 0 && airport.lng === 0) return; // 略過無座標的機場
        
        validBounds.push([airport.lat, airport.lng]);
        const marker = L.marker([airport.lat, airport.lng]).addTo(fleetMarkersLayer);

        marker.on('click', function() {
            const mapElement = document.getElementById('map');
            const mapWidth = mapElement ? mapElement.clientWidth : window.innerWidth;
            const isMobile = window.innerWidth < 768;
            
            const dynamicMaxWidth = isMobile ? Math.max(mapWidth - 50, 200) : Math.max(500, mapWidth * 0.70);
            const dynamicMinWidth = isMobile ? Math.min(mapWidth - 60, 260) : 300;
            
            const popupOpts = { 
                maxWidth: dynamicMaxWidth, 
                minWidth: dynamicMinWidth,
                maxHeight: 450,
                autoPanPadding: [20, 20], 
                keepInView: true 
            };

            const cache = weatherCache[airport.icao] || { metar: "", taf: "" };
            const popupHtml = buildAirportPopupHtml(airport, cache.metar, cache.taf);

            L.popup(popupOpts)
                .setLatLng(marker.getLatLng())
                .setContent(popupHtml)
                .openOn(window.aviationMapInstance);
                
            // 觸發開源氣象讀取
            setTimeout(() => window.fetchOpenMeteoForecast(airport.icao, airport.lat, airport.lng), 50);
        });
    });

    if (validBounds.length > 0 && window.aviationMapInstance) {
        const bounds = L.latLngBounds(validBounds);
        if(bounds.isValid()) {
            window.aviationMapInstance.fitBounds(bounds, { padding: [30, 30], maxZoom: 6 });
        }
    }
}

function initAviationMap() {
    const mapContainer = document.getElementById('map');
    if (!mapContainer) return;

    if (window.aviationMapInstance) {
        window.aviationMapInstance.remove();
    }

    window.aviationMapInstance = L.map('map').setView([23.5, 121.0], 4);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap & CARTO',
        maxZoom: 20
    }).addTo(window.aviationMapInstance);

    fleetMarkersLayer = L.layerGroup().addTo(window.aviationMapInstance);

    // iOS Safari 的 touch 不會自動 fire dblclick,Leaflet 內建 doubleClickZoom 因此失效;
    // 連 Leaflet 的 'click' 在連續快 tap 下也常被 tap recognizer 重置,沒辦法穩定偵測。
    // 改成直接綁原生 touchend 事件,自己算連續兩次 tap (400ms / 50px 內 + 同一點落地)。
    // - 多指 / pinch 不算
    // - tap 在 marker 上不算 (讓 marker 單擊照常開 popup)
    // - 桌面瀏覽器有 dblclick 事件,Leaflet 內建 doubleClickZoom 仍會運作 — 兩條路不衝突
    const mapEl = document.getElementById('map');
    if (mapEl && ('ontouchstart' in window || navigator.maxTouchPoints > 0)) {
        let _lastTapTs = 0;
        let _lastTapXY = null;
        mapEl.addEventListener('touchend', function(e) {
            if (e.touches.length > 0 || e.changedTouches.length !== 1) {
                _lastTapTs = 0; _lastTapXY = null; return;
            }
            if (e.target && e.target.closest && e.target.closest('.leaflet-marker-pane')) {
                _lastTapTs = 0; _lastTapXY = null; return;
            }
            const t = e.changedTouches[0];
            const now = Date.now();
            if (_lastTapXY && (now - _lastTapTs) < 400) {
                const dx = t.clientX - _lastTapXY.x;
                const dy = t.clientY - _lastTapXY.y;
                if (dx*dx + dy*dy < 50*50) {
                    const map = window.aviationMapInstance;
                    const rect = mapEl.getBoundingClientRect();
                    const x = t.clientX - rect.left;
                    const y = t.clientY - rect.top;
                    const latlng = map.containerPointToLatLng([x, y]);
                    map.setView(latlng, Math.min(map.getZoom() + 1, map.getMaxZoom()), { animate: true });
                    _lastTapTs = 0; _lastTapXY = null;
                    e.preventDefault();
                    return;
                }
            }
            _lastTapTs = now;
            _lastTapXY = { x: t.clientX, y: t.clientY };
        }, { passive: false });
    }

    // 綁定機隊切換按鈕
    document.querySelectorAll('.fleet-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.fleet-btn').forEach(b => {
                b.classList.remove('active'); b.classList.add('inactive');
            });
            this.classList.remove('inactive'); this.classList.add('active');

            currentFleet = this.getAttribute('data-fleet');
            syncFleetWeather(currentFleet, false);
        });
    });

    // 右上角狀態膠囊現在也是「重新整理」按鈕
    const statusBtn = document.getElementById('sync-status');
    if (statusBtn) {
        statusBtn.addEventListener('click', () => {
            if (statusBtn.disabled) return; // 同步中時 setSyncStatus 已 disable
            syncFleetWeather(currentFleet, true);
        });
    }

    // 自訂 ICAO 搜尋功能
    const btnSearchIcao = document.getElementById('btn-search-icao');
    if (btnSearchIcao) {
        btnSearchIcao.addEventListener('click', async function() {
            const inputEl = document.getElementById('custom-icao-input');
            let icao = inputEl.value.trim().toUpperCase();
            const btn = this;

            if(icao.length !== 4) {
                const origText = btn.innerText;
                btn.innerText = "⚠️ 四碼";
                btn.style.background = "#e74c3c";
                setTimeout(() => { btn.innerText = origText; btn.style.background = "#8e44ad"; }, 2000);
                return;
            }

            btn.disabled = true;
            btn.innerText = "⏳ 尋找...";
            btn.style.opacity = "0.7";

            try {
                const [airportData, metarData, tafData] = await Promise.all([
                    fetchBulkWeatherFast(icao, 'airport'),
                    fetchBulkWeatherFast(icao, 'metar'),
                    fetchBulkWeatherFast(icao, 'taf')
                ]);

                let lat, lon, siteName;

                if (airportData.length > 0) {
                    lat = airportData[0].lat;
                    lon = airportData[0].lon;
                    siteName = airportData[0].id || icao; 
                } else if (metarData.length > 0 && metarData[0].lat !== undefined) {
                    lat = metarData[0].lat;
                    lon = metarData[0].lon;
                    siteName = metarData[0].name || icao;
                } else if (tafData.length > 0 && tafData[0].lat !== undefined) {
                    lat = tafData[0].lat;
                    lon = tafData[0].lon;
                    siteName = tafData[0].name || icao;
                }

                if (lat === undefined || lon === undefined) {
                    throw new Error("查無此機場或氣象座標資訊");
                }

                let rawMetarText = "";
                let rawTafText = "";
                if (metarData.length > 0) rawMetarText = metarData[0].rawOb || metarData[0].raw;
                if (tafData.length > 0) rawTafText = tafData[0].rawTAF || tafData[0].raw;

                const customIcon = L.divIcon({
                    html: '<div style="font-size:26px; text-shadow: 2px 2px 4px rgba(0,0,0,0.5); line-height: 1; transform: translate(-5px, -15px);">🌟</div>',
                    className: 'custom-icao-icon',
                    iconSize: [30, 30],
                    iconAnchor: [15, 30]
                });

                const customMarker = L.marker([lat, lon], {icon: customIcon, zIndexOffset: 1000}).addTo(window.aviationMapInstance);

                const mapElement = document.getElementById('map');
                const mapWidth = mapElement ? mapElement.clientWidth : window.innerWidth;
                const isMobile = window.innerWidth < 768;
                const dynamicMaxWidth = isMobile ? Math.max(mapWidth - 50, 200) : Math.max(500, mapWidth * 0.70);
                const dynamicMinWidth = isMobile ? Math.min(mapWidth - 60, 260) : 300;

                const popupHtml = buildAirportPopupHtml({ icao: icao, name: siteName, lat: lat, lng: lon }, rawMetarText, rawTafText);

                customMarker.bindPopup(popupHtml, {
                    maxWidth: dynamicMaxWidth,
                    minWidth: dynamicMinWidth,
                    maxHeight: 450,
                    autoPanPadding: [20, 20],
                    keepInView: true
                }).openPopup();
                
                // 觸發開源氣象讀取
                setTimeout(() => window.fetchOpenMeteoForecast(icao, lat, lon), 50);

                window.aviationMapInstance.flyTo([lat, lon], 6, { duration: 1.5 });

                btn.disabled = false;
                btn.innerText = "🔍 搜尋";
                btn.style.opacity = "1";
                inputEl.value = ""; 

            } catch (err) {
                console.error("自訂機場搜尋失敗:", err);
                btn.innerText = "❌ 失敗";
                btn.style.background = "#e74c3c";
                setTimeout(() => {
                    btn.disabled = false;
                    btn.innerText = "🔍 搜尋";
                    btn.style.background = "#8e44ad";
                    btn.style.opacity = "1";
                }, 2500);
            }
        });
    }

    // 啟動預設機隊同步 (預設為 A330)
    syncFleetWeather(currentFleet, false);
}

// ==========================================
// ⏳ Curfew Calculator 核心邏輯
// ==========================================
function initCurfewCalculator() {
    let state = {
        curfewType: 'parking', 
        curfewCondition: 'before' 
    };

    const els = {
        offBlockLabel: document.getElementById('offBlockLabel'),
        takeoffLabel: document.getElementById('takeoffLabel'),
        resultEOBT: document.getElementById('resultEOBT'),
        resultETOT: document.getElementById('resultETOT'),
        resetBtn: document.getElementById('resetCurfewBtn'),
        typeBgPill: document.getElementById('typeBgPill'),
        condBgPill: document.getElementById('condBgPill'),
        typeBtns: document.querySelectorAll('.curfew-type-btn'),
        condBtns: document.querySelectorAll('.curfew-cond-btn'),
        liveClock: document.getElementById('liveUTCClock')
    };

    const dropdownIds = ['curfewHr', 'curfewMin', 'txoHr', 'txoMin', 'ftHr', 'ftMin', 'txiHr', 'txiMin'];

    function updateClock() {
        const now = new Date();
        const h = String(now.getUTCHours()).padStart(2, '0');
        const m = String(now.getUTCMinutes()).padStart(2, '0');
        const s = String(now.getUTCSeconds()).padStart(2, '0');
        if(els.liveClock) els.liveClock.textContent = `${h}:${m}:${s}`;
    }
    
    if(curfewClockInterval) clearInterval(curfewClockInterval);
    curfewClockInterval = setInterval(updateClock, 1000);
    updateClock();

    function populateDropdowns() {
        const generateOptions = (max, defaultVal) => {
            let html = '<option value="">--</option>';
            for (let i = 0; i <= max; i++) {
                const val = String(i).padStart(2, '0');
                const selected = val === defaultVal ? 'selected' : '';
                html += `<option value="${val}" ${selected}>${val}</option>`;
            }
            return html;
        };

        const setOptions = (id, max, def) => {
            const el = document.getElementById(id);
            if(el) el.innerHTML = generateOptions(max, def);
        };

        setOptions('curfewHr', 23, '');
        setOptions('curfewMin', 59, '');
        setOptions('txoHr', 23, '00');
        setOptions('txoMin', 59, '15');
        setOptions('ftHr', 23, '');
        setOptions('ftMin', 59, '');
        setOptions('txiHr', 23, '00');
        setOptions('txiMin', 59, '15');
    }

    function getTimeStr(hrId, minId) {
        const hEl = document.getElementById(hrId);
        const mEl = document.getElementById(minId);
        if (!hEl || !mEl || hEl.value === '' || mEl.value === '') return null;
        return `${hEl.value}:${mEl.value}`;
    }

    function timeToMins(timeStr) {
        if (!timeStr) return NaN;
        const parts = timeStr.split(':');
        return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    }

    function minsToTime(mins) {
        mins = ((mins % 1440) + 1440) % 1440;
        const h = String(Math.floor(mins / 60)).padStart(2, '0');
        const m = String(mins % 60).padStart(2, '0');
        return `${h}:${m}`;
    }

    function calculateTimes() {
        const isBefore = state.curfewCondition === 'before';
        if(els.offBlockLabel) els.offBlockLabel.textContent = isBefore ? 'Latest Off Block Time' : 'Earliest Off Block Time';
        if(els.takeoffLabel) els.takeoffLabel.textContent = isBefore ? 'Latest Takeoff Time' : 'Earliest Takeoff Time';

        const curfewTime = getTimeStr('curfewHr', 'curfewMin');
        const ftTime = getTimeStr('ftHr', 'ftMin');
        const txoTime = getTimeStr('txoHr', 'txoMin');
        const txiTime = getTimeStr('txiHr', 'txiMin');

        if (!curfewTime || !ftTime || !txoTime || !txiTime) {
            if(els.resultEOBT) els.resultEOBT.textContent = '--:--';
            if(els.resultETOT) els.resultETOT.textContent = '--:--';
            return;
        }

        const curfewMins = timeToMins(curfewTime);
        const ftMins = timeToMins(ftTime);
        const txoMins = timeToMins(txoTime);
        const txiMins = timeToMins(txiTime);

        let targetTouchdownMins = curfewMins;
        if (state.curfewType === 'parking') {
            targetTouchdownMins = curfewMins - txiMins;
        }

        const takeoffMins = targetTouchdownMins - ftMins;
        const offBlockMins = takeoffMins - txoMins;

        if(els.resultETOT) els.resultETOT.textContent = minsToTime(takeoffMins);
        if(els.resultEOBT) els.resultEOBT.textContent = minsToTime(offBlockMins);
    }

    function updateTypeToggleUI() {
        els.typeBtns.forEach(btn => {
            if (btn.dataset.type === state.curfewType) btn.classList.add('active');
            else btn.classList.remove('active');
        });
        if(els.typeBgPill) els.typeBgPill.style.transform = state.curfewType === 'landing' ? 'translateX(0)' : 'translateX(100%)';
    }

    function updateCondToggleUI() {
        els.condBtns.forEach(btn => {
            if (btn.dataset.cond === state.curfewCondition) btn.classList.add('active');
            else btn.classList.remove('active');
        });
        if(els.condBgPill) els.condBgPill.style.transform = state.curfewCondition === 'before' ? 'translateX(0)' : 'translateX(100%)';
    }

    els.typeBtns.forEach(btn => {
        btn.onclick = (e) => {
            state.curfewType = e.target.dataset.type;
            updateTypeToggleUI();
            calculateTimes();
        };
    });

    els.condBtns.forEach(btn => {
        btn.onclick = (e) => {
            state.curfewCondition = e.target.dataset.cond;
            updateCondToggleUI();
            calculateTimes();
        };
    });

    dropdownIds.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.onchange = calculateTimes;
    });

    if(els.resetBtn) {
        els.resetBtn.onclick = () => {
            state.curfewType = 'parking'; 
            state.curfewCondition = 'before';
            updateTypeToggleUI();
            updateCondToggleUI();
            populateDropdowns();
            calculateTimes();
        };
    }

    populateDropdowns();
    updateTypeToggleUI();
    updateCondToggleUI();
}

// ==========================================
// ❄️ ICAO 寒冷溫度修正 (Altimetry)
// ==========================================
function calculateCorrection(temp, elevation, altitude) {
  if (temp === '' || elevation === '' || altitude === '') return '';
  
  const t = parseFloat(temp);
  const elev = parseFloat(elevation);
  const alt = parseFloat(altitude);
  
  if (isNaN(t) || isNaN(elev) || isNaN(alt)) return '';
  const height = alt - elev;
  if (t >= 15 || height <= 0) return 0;

  const clampedT = Math.max(-50, Math.min(10, t));
  const clampedH = Math.max(0, height);

  const temps = [10, 0, -10, -20, -30, -40, -50];
  const heights = [0, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1500, 2000, 3000, 4000, 5000];

  const table = [
    [0, 10, 10, 10, 10, 20, 20, 20, 20, 20, 30, 40, 60, 80, 90],
    [0, 20, 20, 30, 30, 40, 40, 50, 50, 60, 90, 120, 170, 230, 280],
    [0, 20, 30, 40, 50, 60, 70, 80, 90, 100, 150, 200, 290, 390, 490],
    [0, 30, 50, 60, 70, 90, 100, 120, 130, 140, 210, 280, 420, 570, 710],
    [0, 40, 60, 80, 100, 120, 140, 150, 170, 190, 280, 380, 570, 760, 950],
    [0, 50, 80, 100, 120, 150, 170, 190, 220, 240, 360, 480, 720, 970, 1210],
    [0, 60, 90, 120, 150, 180, 210, 240, 270, 300, 450, 590, 890, 1190, 1500]
  ];

  let t0 = 0, t1 = 0;
  for (let i = 0; i < temps.length - 1; i++) {
    if (clampedT <= temps[i] && clampedT >= temps[i + 1]) {
      t0 = i; t1 = i + 1; break;
    }
  }
  if (clampedT === temps[temps.length - 1]) { t0 = temps.length - 1; t1 = temps.length - 1; }

  let h0 = 0, h1 = 0;
  if (clampedH >= heights[heights.length - 1]) {
    h0 = heights.length - 1; h1 = heights.length - 1;
  } else {
    for (let i = 0; i < heights.length - 1; i++) {
      if (clampedH >= heights[i] && clampedH <= heights[i + 1]) {
        h0 = i; h1 = i + 1; break;
      }
    }
  }

  const tempRatio = t0 === t1 ? 0 : (clampedT - temps[t0]) / (temps[t1] - temps[t0]);
  const heightRatio = h0 === h1 ? 0 : (clampedH - heights[h0]) / (heights[h1] - heights[h0]);

  const c00 = table[t0][h0];
  const c01 = table[t0][h1];
  const c10 = table[t1][h0];
  const c11 = table[t1][h1];

  const c0 = c00 + heightRatio * (c01 - c00);
  const c1 = c10 + heightRatio * (c11 - c10);

  let correction = c0 + tempRatio * (c1 - c0);

  if (height > 5000) {
    const slopeT0 = (table[t0][14] - table[t0][13]) / 1000;
    const slopeT1 = (table[t1][14] - table[t1][13]) / 1000;
    const extraH = height - 5000;
    const extraCorrection = (slopeT0 * extraH) + tempRatio * ((slopeT1 * extraH) - (slopeT0 * extraH));
    correction += extraCorrection;
  }

  return Math.round(correction);
}

function calculateCorrectedFPA(temp, elevation, nominalFPA) {
  if (temp === '' || elevation === '' || nominalFPA === '') return '';
  const t = parseFloat(temp);
  const fpa = parseFloat(nominalFPA);
  
  if (isNaN(t) || isNaN(fpa) || t >= 15) return fpa.toFixed(2);
  
  const c1000 = calculateCorrection(temp, 0, 1000);
  if (c1000 === '') return '';
  
  const ratio = (1000 + c1000) / 1000;
  const fpaRad = fpa * (Math.PI / 180);
  const correctedFpaRad = Math.atan(ratio * Math.tan(fpaRad));
  
  return (correctedFpaRad * (180 / Math.PI)).toFixed(2);
}

function getRabText(type, rowId) {
  switch(type) {
    case 'NPA(2D)':
      if (['iaf', 'if', 'faf', 'da'].includes(rowId)) return 'Required';
      break;
    case 'APV-Baro(3D)':
      if (['iaf', 'if'].includes(rowId)) return 'Not Recommended \n(see note)';
      if (['faf', 'da'].includes(rowId)) return 'Not Required';
      break;
    case 'PA (ILS)':
      if (['iaf', 'if', 'faf'].includes(rowId)) return 'Required \n(see note)';
      if (rowId === 'da') return 'Required';
      break;
  }
  return '';
}

function setAltApproach(type, index) {
  document.getElementById('altAppType').value = type;
  const btns = document.querySelectorAll('#altimetryBox .app-toggle-btn');
  btns.forEach(b => b.classList.remove('active'));
  document.querySelector(`#altimetryBox .app-toggle-btn[data-type="${type}"]`).classList.add('active');
  
  const pill = document.getElementById('altAppPill');
  if(pill) pill.style.transform = `translateX(${index * 100}%)`;

  const notesBox = document.getElementById('altNotesBox');
  if(notesBox) {
      if (type === 'APV-Baro(3D)') {
        notesBox.innerHTML = `<strong>ℹ️ RAB 6.10.2 Notes:</strong><br><span style="color:#d97706; font-weight:bold;">Not Recommended:</span> Not recommended for IF and IAF when FMC coded with "above" to generate a stable CDFA to FAP.`;
        notesBox.classList.add('active');
      } else if (type === 'PA (ILS)') {
        notesBox.innerHTML = `<strong>ℹ️ RAB 6.10.2 Notes:</strong><br><span style="color:#e74c3c; font-weight:bold;">Required:</span> If overflying IF/IAF/FAF/FAP, and not being Radar Vectored, unless already descending on G/S.`;
        notesBox.classList.add('active');
      } else {
        notesBox.classList.remove('active');
      }
  }
  recalculateAltimetryValues();
}

function updateAltimetry() { recalculateAltimetryValues(); }
function handleAltRowChange(id, value) { const row = altimetryRows.find(r => r.id === id); if(row) row.altitude = value; recalculateAltimetryValues(); }
function handleAltLabelChange(id, value) { const row = altimetryRows.find(r => r.id === id); if(row) row.label = value; }

function addAltCustomRow() {
  const newId = `custom-${Date.now()}`;
  altimetryRows.push({ id: newId, label: 'Custom', altitude: '', isCustom: true });
  renderAltimetryRows(); 
}

function removeAltRow(id) {
  altimetryRows = altimetryRows.filter(r => r.id !== id);
  renderAltimetryRows(); 
}

function recalculateAltimetryValues() {
  const tempEl = document.getElementById('altTemp');
  const elevEl = document.getElementById('altElev');
  const appTypeEl = document.getElementById('altAppType');
  const fpaEl = document.getElementById('altFpa');
  if (!tempEl || !elevEl || !appTypeEl || !fpaEl) return;

  const temp = tempEl.value;
  const elev = elevEl.value;
  const appType = appTypeEl.value;
  const fpa = fpaEl.value;

  const fpaRes = calculateCorrectedFPA(temp, elev, fpa);
  const altFpaResEl = document.getElementById('altFpaResult');
  if(altFpaResEl) altFpaResEl.textContent = fpaRes ? `${fpaRes}°` : '--°';

  altimetryRows.forEach(row => {
    const correction = calculateCorrection(temp, elev, row.altitude);
    const hasCorrection = correction !== '' && correction !== 0;
    const correctedAlt = !hasCorrection ? (row.altitude || '') : (parseFloat(row.altitude) + correction);
    
    const rabText = getRabText(appType, row.id);
    let rabColor = '#9ca3af';
    if (rabText.includes('Required') && !rabText.includes('Not Required')) rabColor = '#ef4444';
    if (rabText.includes('Not Recommended')) rabColor = '#f59e0b';

    const rabEl = document.getElementById(`alt-rab-${row.id}`);
    if (rabEl) {
      rabEl.textContent = rabText;
      rabEl.style.color = rabColor;
    }

    const badgeEl = document.getElementById(`alt-badge-${row.id}`);
    if (badgeEl) {
      badgeEl.textContent = hasCorrection ? '+' + correction : '-';
      badgeEl.className = `alt-badge ${hasCorrection ? 'active' : 'inactive'}`;
    }

    const correctedEl = document.getElementById(`alt-corrected-${row.id}`);
    if (correctedEl) {
      correctedEl.value = correctedAlt;
    }
  });
}

function renderAltimetryRows() {
  const container = document.getElementById('altRowsContainer');
  if(!container) return;
  container.innerHTML = '';

  altimetryRows.forEach(row => {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'alt-row';

    let labelHtml = '';
    if (row.isCustom) {
      labelHtml = `<input type="text" value="${row.label}" oninput="handleAltLabelChange('${row.id}', this.value)" style="width:100%; text-align:right; border:none; border-bottom:1px dashed #ccc; background:transparent; font-weight:bold; color:#444; outline:none;">`;
    } else {
      labelHtml = row.label;
    }

    const removeBtnHtml = row.isCustom ? `<span style="position:absolute; right:-25px; color:#ccc; cursor:pointer; font-size:1.2em; top:5px;" onclick="removeAltRow('${row.id}')">×</span>` : '';

    rowDiv.innerHTML = `
      <div id="alt-rab-${row.id}" class="alt-rab-text" style="padding-left:10px;"></div>
      <div class="alt-fix-col">${labelHtml}</div>
      <div><input type="number" class="app-text-input" style="text-align:center; padding:6px; background:#fff; border:1px solid #e2e8f0;" value="${row.altitude}" oninput="handleAltRowChange('${row.id}', this.value)" placeholder="Value"></div>
      <div style="text-align:center;">
        <div id="alt-badge-${row.id}" class="alt-badge inactive">-</div>
      </div>
      <div style="position:relative;">
        <input id="alt-corrected-${row.id}" type="text" class="alt-readonly-input" readonly value="">
        ${removeBtnHtml}
      </div>
    `;

    container.appendChild(rowDiv);
  });
  recalculateAltimetryValues();
}

function resetAltimetryCalculator() {
  const altElev = document.getElementById('altElev');
  const altTemp = document.getElementById('altTemp');
  const altFpa = document.getElementById('altFpa');
  
  if(altElev) altElev.value = '';
  if(altTemp) altTemp.value = '';
  if(altFpa) altFpa.value = '3.0';
  
  altimetryRows = [
    { id: 'msa', label: 'MSA', altitude: '', isCustom: false },
    { id: 'iaf', label: 'IAF', altitude: '', isCustom: false },
    { id: 'if', label: 'IF', altitude: '', isCustom: false },
    { id: 'faf', label: 'FAF/FAP', altitude: '', isCustom: false },
    { id: 'da', label: 'DA/MDA', altitude: '', isCustom: false },
    { id: 'maa', label: 'MAA', altitude: '', isCustom: false },
    { id: 'eo', label: 'EO ACC', altitude: '', isCustom: false }
  ];

  setAltApproach('NPA(2D)', 0);
  renderAltimetryRows(); 
}

// ==========================================
// 📡 NOTAM Radar 核心邏輯 (極速雙引擎版)
// ==========================================
function initNotamRadar() {
    if (notamMapInstance !== null) {
        notamMapInstance.remove();
        notamMapInstance = null;
    }

    const mapContainer = document.getElementById('notam-map');
    if (!mapContainer) return;

    notamMapInstance = L.map('notam-map', { zoomControl: false }).setView([25.03, 121.5], 6);
    L.control.zoom({ position: 'bottomright' }).addTo(notamMapInstance);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap'
    }).addTo(notamMapInstance);

    notamActiveLayers = [];
    notamFeatures = [];
    notamRoutes = [];
    renderNotamList();
    renderNotamRoutes();

    const btnProcess = document.getElementById('btn-process-notam');
    if (btnProcess) btnProcess.onclick = processNotamData;

    const btnClear = document.getElementById('btn-clear-notam');
    if (btnClear) btnClear.onclick = clearNotamAll;
}

// ──────────────────────────────────────────
// 座標解讀：DMS / 度分 / 十進位 → 十進位度
// 支援 DDMMSS.ss 小數秒、DDMM[.mm] 度分、純十進位度
// ──────────────────────────────────────────
function dmsToDecimal(numStr, dir) {
    const isLat = (dir === 'N' || dir === 'S');
    const nums = String(numStr).replace(/\s+/g, '');
    const dotIdx = nums.indexOf('.');
    const intPart = dotIdx === -1 ? nums : nums.slice(0, dotIdx);
    const frac = dotIdx === -1 ? '' : nums.slice(dotIdx); // 含小數點
    const degLen = isLat ? 2 : 3;                          // 緯度 DD、經度 DDD
    let dec = NaN;

    if (intPart.length <= degLen) {
        // 純度數 (可帶小數)，如 25 / 121.5
        dec = parseFloat(intPart + frac);
    } else if (intPart.length <= degLen + 2) {
        // 度分 DDMM[.mm]
        const d = parseFloat(intPart.slice(0, degLen));
        const m = parseFloat(intPart.slice(degLen) + frac);
        dec = d + m / 60;
    } else {
        // 度分秒 DDMMSS[.ss]
        const d = parseFloat(intPart.slice(0, degLen));
        const m = parseFloat(intPart.slice(degLen, degLen + 2));
        const s = parseFloat(intPart.slice(degLen + 2) + frac);
        dec = d + m / 60 + s / 3600;
    }

    if (isNaN(dec)) return NaN;
    return (dir === 'S' || dir === 'W') ? -dec : dec;
}

// 從一段文字萃取所有「成對」座標，回傳含原文位置 index 供圓心定位
function extractCoordinates(text) {
    // 換行 / tab 收斂為空白，讓被換行拆開的座標 (lat↵lng) 能接回
    let s = text.replace(/[\r\n\t]+/g, ' ');
    // 前置方向格式 N2503 E12130 → 轉為後置 2503N 12130E
    s = s.replace(/\b([NS])\s*(\d{3,7}(?:\.\d+)?)\s+([EW])\s*(\d{3,7}(?:\.\d+)?)/g, '$2$1 $4$3');

    const results = [];
    // 後置方向，允許 lat/lng 之間有空白、逗號、斜線、破折號
    const pairRe = /(\d{2,6}(?:\.\d+)?)\s*([NS])[\s,/–—-]*(\d{2,7}(?:\.\d+)?)\s*([EW])/g;
    let m;
    while ((m = pairRe.exec(s)) !== null) {
        const lat = dmsToDecimal(m[1], m[2]);
        const lng = dmsToDecimal(m[3], m[4]);
        if (!isNaN(lat) && !isNaN(lng) &&
            lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            results.push({ lat, lng, index: m.index });
        }
    }
    return results;
}

// ──────────────────────────────────────────
// NOTAM 分類定義 (顏色 / 標籤 / 偵測關鍵字)
// ──────────────────────────────────────────
const NOTAM_CATEGORIES = {
    restricted: { label: '限航/演習', color: '#dc2626', keywords: /AIR\s*EXER|\bEXER\b|AIRSPACE\s+BLOCK|BLOCKED\s+AREA|RESTRICT|PROHIBIT|DANGER\s+AREA|FIRING|\bFRNG\b|GUNNERY|\bMIL\b|MILITARY|MISSILE|RESERVATION/i },
    uav:        { label: 'UAV/無人機', color: '#ea580c', keywords: /\bUAV\b|UNMANNED|\bDRONE\b|\bRPAS\b/i },
    obstacle:   { label: '障礙物',     color: '#7c3aed', keywords: /\bCRANE\b|\bOBST\b|OBSTACLE|\bTOWER\b|\bMAST\b|ANTENNA|WINDMILL|WIND\s+TURBINE|\bRIG\b/i },
    area:       { label: '一般區域',   color: '#2563eb', keywords: null }
};

// 航路/航跡：PACOTS、NAT track、CDR 等，不應填成多邊形
const NOTAM_ROUTE_RE = /\bPACOTS\b|\bTDM\b|\bTRK\b|\bTRACK\b|FLEX\s+ROUTE|\bNAR\b|\bCDR\b|RTS\//i;
// 區域關鍵字：用於判斷未封閉的座標串是否仍應視為區域
const NOTAM_AREA_RE = /\bAREA\b|BOUNDED\s+BY|AIRSPACE|DEFINED\s+AS|LATERAL|RESERVATION|\bLIMITS\b/i;

function categorizeNotam(text) {
    for (const key of ['restricted', 'uav', 'obstacle']) {
        if (NOTAM_CATEGORIES[key].keywords.test(text)) return key;
    }
    return 'area';
}

// 兩點是否幾乎相同 (用於封閉環偵測)
function coordsNear(a, b) {
    return Math.abs(a.lat - b.lat) < 1e-4 && Math.abs(a.lng - b.lng) < 1e-4;
}

// 把座標串切成多個環：遇到「回到環起點」即封閉並另起新環
// 可正確拆出一則 NOTAM 內的多個區塊 (如 BLOCK1 / BLOCK2)
function buildRings(coords) {
    const rings = [];
    let cur = [];
    for (const c of coords) {
        if (cur.length >= 3 && coordsNear(c, cur[0])) {
            cur.push(c);
            rings.push({ closed: true, pts: cur });
            cur = [];
        } else {
            cur.push(c);
        }
    }
    if (cur.length) rings.push({ closed: false, pts: cur });
    return rings;
}

// 以台灣 (約 121°E) 為基準，把經度攤平到 [REF-180, REF+180]。
// 使美洲等西經地物顯示在台灣「右側」(如 122°W → 238°)，
// 地圖以太平洋為中心、範圍緊湊，且自動處理跨換日線的區域連線。
const NOTAM_REF_LNG = 121;
function pacifyLng(lng) {
    let v = lng;
    while (v - NOTAM_REF_LNG > 180) v -= 360;
    while (v - NOTAM_REF_LNG < -180) v += 360;
    return v;
}
function pacify(ll) { return [ll[0], pacifyLng(ll[1])]; }
function pacifyAll(arr) { return arr.map(pacify); }


// 把整份 bulletin 依「NOTAM 編號」切成一則一則
function splitBulletin(text) {
    const lines = text.split(/\r?\n/);
    const idRe = /^\s*((?:[A-Z]{1,2}|\d[A-Z])\d{1,4}\/\d{2})\b/;
    const blocks = [];
    let cur = null;
    for (const line of lines) {
        const m = line.match(idRe);
        if (m) {
            if (cur) blocks.push(cur);
            cur = { id: m[1], lines: [line] };
        } else if (cur) {
            cur.lines.push(line);
        }
    }
    if (cur) blocks.push(cur);
    return blocks.map(b => ({ id: b.id, raw: b.lines.join('\n') }));
}

// 偵測半徑 (5NM RADIUS / RADIUS OF 5NM / 5 KM RDS)
function detectRadius(block) {
    const re = /(\d+(?:\.\d+)?)\s*(NM|KM)\s*(?:RADIUS|RDS)|(?:RADIUS|RDS)\s*(?:OF\s*)?(\d+(?:\.\d+)?)\s*(NM|KM)/i;
    const m = re.exec(block);
    if (!m) return null;
    const value = parseFloat(m[1] || m[3]);
    const unit = (m[2] || m[4]).toUpperCase();
    return { value, unit, meters: value * (unit === 'NM' ? 1852 : 1000) };
}

// 圓心：優先取 "CENTRED/CENTERED ON/AT、CENTER" 之後的座標，否則第一個座標
function pickRadiusCenter(block, coords) {
    const norm = block.replace(/[\r\n\t]+/g, ' ');
    const idx = norm.search(/CENT[A-Z]*\s+(?:ON|AT)?\s*\d{2,}[NS]/i);
    if (idx >= 0) {
        const after = coords.filter(c => c.index >= idx);
        if (after.length) return [after[0].lat, after[0].lng];
    }
    return [coords[0].lat, coords[0].lng];
}

// 高度帶：F) 下限 G) 上限，或 SFC-FL450 / SFC-10000FT
function extractAltitude(block) {
    const fg = block.match(/F\)\s*([A-Z0-9]+(?:\s+(?:AMSL|AGL|MSL))?)\s+G\)\s*([A-Z0-9]+(?:\s+(?:AMSL|AGL|MSL))?)/i);
    if (fg) return `${fg[1].trim()} ～ ${fg[2].trim()}`;
    const band = block.match(/\b(SFC|GND|\d{2,5}\s*FT(?:\s*(?:AMSL|AGL))?|FL\d{2,3})\s*[-–]\s*(\d{2,5}\s*FT(?:\s*(?:AMSL|AGL))?|FL\d{2,3})\b/i);
    if (band) return `${band[1].replace(/\s+/g, '').trim()} ～ ${band[2].replace(/\s+/g, '').trim()}`;
    return '';
}

// 生效時間
function extractValidity(block) {
    const m = block.match(/VALID(?:ITY)?:\s*([0-9A-Z]{4,12}\s*-\s*[0-9A-Z]{3,12})/i);
    return m ? m[1].replace(/\s+/g, ' ').trim() : '';
}

// 摘要：去 HTML 標籤與座標、收斂空白後取前段
function buildSummary(raw, id) {
    let s = raw.replace(/<\/?[a-z][^>]*>/gi, ' ');
    s = s.replace(/\b\d{2,7}(?:\.\d+)?[NS][\s,/–—-]*\d{2,7}(?:\.\d+)?[EW]\b/g, ' ');
    s = s.replace(/\s+/g, ' ').trim();
    if (s.startsWith(id)) s = s.slice(id.length).trim();
    return s;
}

function popupHtml(id, category, geomDesc, altText, validText, summary, ll) {
    const cat = NOTAM_CATEGORIES[category];
    let h = `<div style="min-width:210px">`;
    h += `<div style="font-weight:700;font-size:14px;color:#4a3627;margin-bottom:4px">${id}`;
    h += ` <span style="background:${cat.color};color:#fff;font-size:10px;padding:1px 6px;border-radius:8px;margin-left:4px">${cat.label}</span></div>`;
    h += `<div style="font-size:12px;color:#6b5847">${geomDesc}</div>`;
    if (ll) h += `<div style="font-size:11px;color:#8b7355">中心: ${ll[0].toFixed(4)}, ${ll[1].toFixed(4)}</div>`;
    if (altText) h += `<div style="font-size:12px;color:#6b5847">高度: ${altText}</div>`;
    if (validText) h += `<div style="font-size:11px;color:#8b7355">生效: ${validText}</div>`;
    if (summary) h += `<div style="font-size:11px;color:#78716c;margin-top:5px;line-height:1.5;border-top:1px solid #eee;padding-top:5px;max-height:4.6em;overflow-y:auto;-webkit-overflow-scrolling:touch">${summary}</div>`;
    h += `</div>`;
    return h;
}

function processNotamData() {
    const inputEl = document.getElementById('notamInput');
    if (!inputEl || !notamMapInstance) return;
    const input = inputEl.value;
    if (!input.trim()) return;

    notamActiveLayers.forEach(l => notamMapInstance.removeLayer(l));
    notamActiveLayers = [];
    notamFeatures = [];

    let blocks = splitBulletin(input);
    if (blocks.length === 0) blocks = [{ id: 'NOTAM', raw: input }];

    blocks.forEach(block => {
        const coords = extractCoordinates(block.raw);
        if (coords.length === 0) return;

        const radius = detectRadius(block.raw);
        const catKey = categorizeNotam(block.raw);             // restricted/uav/obstacle/area
        const rings = buildRings(coords);
        const hasClosed = rings.some(r => r.closed && r.pts.length >= 4);
        const isArea = NOTAM_AREA_RE.test(block.raw);
        const validText = extractValidity(block.raw);

        // 航路/航跡 (PACOTS/NAT/CDR…)：不繪於地圖，改收進頁面下方文字欄位
        const isRoute = !radius && !hasClosed && catKey !== 'obstacle' && NOTAM_ROUTE_RE.test(block.raw);
        if (isRoute) {
            notamRoutes.push({ id: block.id, count: coords.length, validText, text: buildRouteText(block.raw, block.id) });
            return;
        }

        const category = catKey;
        const color = NOTAM_CATEGORIES[category].color;
        const altText = extractAltitude(block.raw);
        const summary = buildSummary(block.raw, block.id);
        const layers = [];
        let geomLabel = '';

        // ll 傳入原始座標：繪圖位置以台灣為基準攤平 (pacify)，popup 仍顯示原始經緯度
        const mkMarker = (ll, desc) => {
            const mk = L.circleMarker(pacify(ll), { radius: 6, color, fillColor: color, fillOpacity: 0.85, weight: 2 });
            mk.bindPopup(popupHtml(block.id, category, desc, altText, validText, summary, ll));
            return mk;
        };
        const mkVertex = (ll) => L.circleMarker(pacify(ll), { radius: 3, color, fillColor: '#fff', fillOpacity: 1, weight: 1.5 });

        if (radius) {
            // 圓形範圍
            const center = pickRadiusCenter(block.raw, coords);
            const circle = L.circle(pacify(center), { color, fillColor: color, fillOpacity: 0.2, weight: 2, dashArray: '6,5', radius: radius.meters });
            circle.bindPopup(popupHtml(block.id, category, `圓形範圍 · 半徑 ${radius.value} ${radius.unit}`, altText, validText, summary, center));
            layers.push(circle);
            geomLabel = `圓 ${radius.value}${radius.unit}`;
        } else if (catKey === 'obstacle') {
            // 障礙物：每點各自獨立 marker
            coords.forEach((c, i) => layers.push(mkMarker([c.lat, c.lng], `障礙物點 ${i + 1}/${coords.length}`)));
            geomLabel = `障礙物 ×${coords.length}`;
        } else {
            // 依封閉環拆分：封閉環或有區域關鍵字 → 多邊形；其餘 → 離散點
            let polyCount = 0, ptCount = 0;
            rings.forEach(ring => {
                const lls = ring.pts.map(c => [c.lat, c.lng]);
                if ((ring.closed && lls.length >= 4) || (isArea && lls.length >= 3)) {
                    const poly = L.polygon(pacifyAll(lls), { color, fillColor: color, fillOpacity: 0.18, weight: 2.5 });
                    poly.bindPopup(popupHtml(block.id, category, `多邊形 · ${lls.length} 頂點`, altText, validText, summary));
                    layers.push(poly);
                    lls.forEach(ll => layers.push(mkVertex(ll)));
                    polyCount++;
                } else {
                    lls.forEach((ll, i) => { layers.push(mkMarker(ll, `點位 ${i + 1}`)); ptCount++; });
                }
            });
            geomLabel = polyCount && ptCount ? `多邊形 ×${polyCount} + 點 ×${ptCount}`
                : polyCount ? (polyCount > 1 ? `多邊形 ×${polyCount}` : `多邊形 ${rings[0].pts.length}點`)
                : `點位 ×${ptCount}`;
        }

        layers.forEach(l => { l.addTo(notamMapInstance); notamActiveLayers.push(l); });
        const group = L.featureGroup(layers);
        notamFeatures.push({ id: block.id, category, color, layers, bounds: group.getBounds(), geomLabel, altText, visible: true });
    });

    renderNotamList();
    renderNotamRoutes();

    // 自動縮放只看「目前顯示」的圖徵，避免被離群點拉太遠
    const b = L.latLngBounds([]);
    notamFeatures.forEach(f => { if (f.visible && f.bounds && f.bounds.isValid()) b.extend(f.bounds); });
    if (b.isValid()) {
        notamMapInstance.fitBounds(b, { padding: [40, 40] });
    } else if (notamFeatures.length === 0 && notamRoutes.length === 0) {
        alert('未在文字中偵測到可繪製的座標。');
    }
}

// ──────────────────────────────────────────
// 已偵測 NOTAM 清單側欄
// ──────────────────────────────────────────
function renderNotamList() {
    const box = document.getElementById('notam-results');
    if (!box) return;

    if (notamFeatures.length === 0) {
        box.innerHTML = `<div class="notam-results-empty">尚無偵測結果。貼上 NOTAM 文本後按「座標掃描」。</div>`;
        return;
    }

    let html = `<div class="notam-results-head">已偵測 ${notamFeatures.length} 則可繪製 NOTAM</div>`;
    notamFeatures.forEach((f, i) => {
        html += `<div class="notam-result-item" data-idx="${i}">`;
        html += `<input type="checkbox" class="notam-result-chk" data-idx="${i}" ${f.visible ? 'checked' : ''}>`;
        html += `<span class="notam-result-dot" style="background:${f.color}"></span>`;
        html += `<span class="notam-result-id">${f.id}</span>`;
        html += `<span class="notam-result-geom">${f.geomLabel}${f.altText ? ' · ' + f.altText : ''}</span>`;
        html += `</div>`;
    });
    box.innerHTML = html;

    box.querySelectorAll('.notam-result-item').forEach(el => {
        el.addEventListener('click', e => {
            if (e.target.classList.contains('notam-result-chk')) return;
            focusNotamFeature(parseInt(el.dataset.idx, 10));
        });
    });
    box.querySelectorAll('.notam-result-chk').forEach(chk => {
        chk.addEventListener('change', () => toggleNotamFeature(parseInt(chk.dataset.idx, 10), chk.checked));
    });
}

function focusNotamFeature(idx) {
    const f = notamFeatures[idx];
    if (!f || !notamMapInstance || !f.bounds || !f.bounds.isValid()) return;
    if (!f.visible) { f.visible = true; f.layers.forEach(l => l.addTo(notamMapInstance)); renderNotamList(); }
    notamMapInstance.fitBounds(f.bounds, { padding: [60, 60], maxZoom: 12 });
    const first = f.layers[0];
    if (first && first.openPopup) first.openPopup();
}

function toggleNotamFeature(idx, on) {
    const f = notamFeatures[idx];
    if (!f) return;
    f.visible = on;
    f.layers.forEach(l => { if (on) l.addTo(notamMapInstance); else notamMapInstance.removeLayer(l); });
}

// ──────────────────────────────────────────
// 航路/航跡文字欄位 (頁面下方，不繪於地圖)
// ──────────────────────────────────────────
function escNotamHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 航跡文字：去 HTML 標籤、收斂空白、去掉開頭的編號與 VALID (另外欄位顯示)
function buildRouteText(raw, id) {
    let s = raw.replace(/<\/?[a-z][^>]*>/gi, ' ');
    s = s.replace(/\s+/g, ' ').trim();
    if (s.startsWith(id)) s = s.slice(id.length).trim();
    s = s.replace(/^VALID(?:ITY)?:\s*[0-9A-Z]+\s*-\s*[0-9A-Z]+\s*/i, '');
    return s.length > 800 ? s.slice(0, 800) + '…' : s;
}

function renderNotamRoutes() {
    const box = document.getElementById('notam-routes');
    if (!box) return;

    if (notamRoutes.length === 0) {
        box.style.display = 'none';
        box.innerHTML = '';
        return;
    }
    box.style.display = '';

    // 下拉式 (預設收合)：點擊標題列才展開
    let html = `<details class="notam-routes-details">`;
    html += `<summary class="notam-routes-head"><span class="notam-routes-caret">▶</span>航路 / 航跡 — ${notamRoutes.length} 則（不繪於地圖，點此展開）</summary>`;
    html += `<div class="notam-routes-list">`;
    notamRoutes.forEach(r => {
        html += `<div class="notam-route-item">`;
        html += `<div class="notam-route-meta">`;
        html += `<span class="notam-route-id">${escNotamHtml(r.id)}</span>`;
        html += `<span class="notam-route-geom">航路/航跡 · ${r.count} 點</span>`;
        if (r.validText) html += `<span class="notam-route-valid">VALID: ${escNotamHtml(r.validText)}</span>`;
        html += `</div>`;
        html += `<div class="notam-route-body">${escNotamHtml(r.text)}</div>`;
        html += `</div>`;
    });
    html += `</div></details>`;
    box.innerHTML = html;
}

function clearNotamAll() {
    if (notamMapInstance) {
        notamActiveLayers.forEach(l => notamMapInstance.removeLayer(l));
        notamMapInstance.setView([25.03, 121.5], 6);
    }
    notamActiveLayers = [];
    notamFeatures = [];
    notamRoutes = [];
    renderNotamList();
    renderNotamRoutes();
    const inputEl = document.getElementById('notamInput');
    if (inputEl) inputEl.value = '';
}
