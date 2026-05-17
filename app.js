// ==========================================
// 📦 簡報箱主核心引擎 (Core Engine) - 極速競速優化版 + 雙引擎解析架構
// 🆕 升級版：支援自訂 ICAO 地圖查詢 + 24H 歷史氣象紀錄整合
// ==========================================

// ------------------------------------------
// 🌐 全域變數與系統資料庫 (Global State)
// ------------------------------------------

let notamMapInstance = null;
let notamActiveLayers = [];
let curfewClockInterval = null;
let aviationMapInstance = null; 

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
  if (!rawTaf) return `<div style="background-color: #ebedef; padding: 12px; border-radius: 6px; text-align: left; font-family: 'Courier New', monospace; font-size: 13.5px; color: #2c3e50;">目前無有效或無法載入 TAF 報文</div>`;
  
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
              <span style="font-family: 'Courier New', Courier, monospace; font-size: 13.5px; color: #2c3e50; vertical-align: middle; word-break: break-word; ${highlightStyle}">${cleanLine}</span>
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

            // 安全喚醒對應邏輯
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

    const turbliBtn = document.getElementById("turbliBtn");
    if(turbliBtn) {
        turbliBtn.addEventListener("click", function () {
            const url = this.dataset.url;
            if (url) window.open(url, "_blank");
        });
    }
    console.log("✈️ 簡報箱主核心系統已全面整合上線 (Core Engine Online)");
});

function refreshIframe(id) {
    const iframe = document.getElementById(id);
    if (iframe) iframe.src = iframe.src;
}

function initFlightSelect() {
  const selectEl = document.getElementById("flightSelect");
  const dateSelectEl = document.getElementById("dateSelect");
  const btn = document.getElementById("turbliBtn");

  if (!selectEl || !dateSelectEl || !btn) return;

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
        opt.textContent = item.flightNo;
        optgroup.appendChild(opt);
      });
    selectEl.appendChild(optgroup);
  });

  function updateTurbliUrl() {
    const selectedFlight = selectEl.value;
    const selectedDate = dateSelectEl.value;

    if (!selectedFlight) {
      btn.disabled = true;
      btn.dataset.url = "";
      return;
    }

    const date = new Date();
    if (selectedDate === "tomorrow") date.setDate(date.getDate() + 1);

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const flight = window.flights.find(f => f.flightNo === selectedFlight);
    if (!flight) return;

    btn.dataset.url = `https://turbli.com/${flight.route}/${dateStr}/JX-${selectedFlight}/`;
    btn.disabled = false;
  }

  selectEl.addEventListener("change", updateTurbliUrl);
  dateSelectEl.addEventListener("change", updateTurbliUrl);
}

// ==========================================
// 🌍 首頁模組二：NOAA AWC 航空氣象儀表板
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
                    <div class="raw-text" style="font-size: 12.5px; padding: 0; background: transparent; border: none; white-space: pre-wrap; word-break: break-word;">${data.arrival || "無 Arrival 資料"}</div>
                </div>
                <div style="background-color: #f8fafc; border-left: 4px solid #e67e22; padding: 10px; border-radius: 6px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                        <span style="font-weight: bold; color: #e67e22; font-size: 13px;">🛫 DEPARTURE ATIS</span>
                        ${depAgeBadge}
                    </div>
                    <div class="raw-text" style="font-size: 12.5px; padding: 0; background: transparent; border: none; white-space: pre-wrap; word-break: break-word;">${data.departure || "無 Departure 資料"}</div>
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
// ✈️ 地圖彈出視窗(Popup) 組件產生器 (抽象化以供重複使用)
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

    return `
    <div class="weather-popup">
        <div class="airport-title">${airport.name} (${airport.icao})</div>
        
        <div class="data-block">
            <div class="section-title">
                <span style="display:inline-flex; align-items:center;">
                    METAR (即時天氣)
                    ${rawMetarText ? `<span class="badge" style="background-color: ${badgeColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-left: 8px; font-weight: bold;">${displayCat}</span>${metarEmojiHtml}` : ''}
                </span>
                <span style="font-size:12.5px; color:#7f8c8d; font-weight:normal; margin-left:10px; margin-top:2px;">${metarAgeStr}</span>
            </div>
            <div class="raw-text" style="border-left: 4px solid ${badgeColor}; white-space: pre-wrap; word-break: break-word; background-color: #f8fafc; padding: 10px; border-radius: 4px; font-family: 'Courier New', monospace; font-size: 13px;">${rawMetarText || "目前無有效 METAR 報文"}</div>
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

        <!-- NEW: 歷史氣象 (過去 24 小時) -->
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

        const executeFetch = async (url, ms) => {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), ms);
            try {
                const res = await fetch(url, { signal: controller.signal });
                clearTimeout(id);
                if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
                return await res.json();
            } catch (err) {
                clearTimeout(id);
                throw err;
            }
        };

        let data;
        try {
            data = await executeFetch(cleanUrl, 4500); // 官方主鏈路
        } catch (errorA) {
            try {
                data = await executeFetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(cleanUrl)}`, 5500); // 備援 A
            } catch (errorB) {
                data = await executeFetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(cleanUrl)}`, 6000); // 備援 B
            }
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
                        <span style="font-family: 'Courier New', monospace;">${timeStr}</span>
                    </div>
                    <div style="font-family: 'Courier New', Courier, monospace; font-size: 13px; color: #2c3e50; word-break: break-word;">
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

function initAviationMap() {
    const mapContainer = document.getElementById('map');
    if (!mapContainer) return;

    if (window.aviationMapInstance) {
        window.aviationMapInstance.remove();
    }

    window.aviationMapInstance = L.map('map').setView([31.0, 130.0], 5);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap & CARTO',
        maxZoom: 20
    }).addTo(window.aviationMapInstance);

    const airports = [
        { icao: 'RCTP', name: '臺灣桃園國際機場', lat: 25.0777, lng: 121.2328 },
        { icao: 'RCSS', name: '臺北松山機場', lat: 25.0043, lng: 122.2451 },
        { icao: 'RCKH', name: '高雄國際機場', lat: 22.5771, lng: 120.3500 },
        { icao: 'RCMQ', name: '臺中清泉崗機場', lat: 24.2646, lng: 120.6200 },
        { icao: 'RJAA', name: '成田國際機場', lat: 35.7647, lng: 140.3863 },
        { icao: 'RJBB', name: '關西國際機場', lat: 34.4273, lng: 135.2440 },
        { icao: 'RJCC', name: '新千歲機場', lat: 42.7752, lng: 141.6923 },
        { icao: 'RJCH', name: '函館機場', lat: 41.7700, lng: 140.8220 },
        { icao: 'RJFF', name: '福岡機場', lat: 33.5859, lng: 130.4507 },
        { icao: 'RJFK', name: '鹿兒島機場', lat: 31.8034, lng: 130.7194 },
        { icao: 'RJFT', name: '熊本機場', lat: 32.8372, lng: 130.8553 },
        { icao: 'RJGG', name: '中部國際機場', lat: 34.8583, lng: 136.8053 },
        { icao: 'RJSS', name: '仙台機場', lat: 38.1397, lng: 140.9169 },
        { icao: 'RJTT', name: '東京羽田國際機場', lat: 35.5523, lng: 139.7797 },
        { icao: 'RJOT', name: '高松機場', lat: 34.2144, lng: 134.0156 }, 
        { icao: 'RJBE', name: '神戶機場', lat: 34.6328, lng: 135.2239 }, 
        { icao: 'ROAH', name: '那霸機場', lat: 26.1958, lng: 127.6458 },
        { icao: 'VHHH', name: '香港國際機場', lat: 22.3089, lng: 113.9146 },
        { icao: 'VMMC', name: '澳門國際機場', lat: 22.1496, lng: 113.5915 },
        { icao: 'WMKK', name: '吉隆坡國際機場', lat: 2.7456, lng: 101.7099 },
        { icao: 'VDPP', name: '金邊國際機場', lat: 11.5466, lng: 104.8441 },
        { icao: 'VVCR', name: '金蘭國際機場', lat: 11.9981, lng: 109.2193 },
        { icao: 'WMKP', name: '檳城國際機場', lat: 5.2971, lng: 100.2769 },
        { icao: 'RPLC', name: '克拉克國際機場', lat: 15.1858, lng: 120.5599 },
        { icao: 'RPLL', name: '馬尼拉國際機場', lat: 14.5090, lng: 121.0194 },
        { icao: 'WSSS', name: '新加坡樟宜機場', lat: 1.3592, lng: 103.9893 },
        { icao: 'VTBD', name: '曼谷廊曼國際機場', lat: 13.9126, lng: 100.6068 },
        { icao: 'VTBS', name: '曼谷蘇凡納布機場', lat: 13.6811, lng: 100.7473 },
        { icao: 'VVDN', name: '峴港國際機場', lat: 16.0439, lng: 108.1994 },
        { icao: 'VVNB', name: '河內內排國際機場', lat: 21.2212, lng: 105.8072 },
        { icao: 'VVPQ', name: '富國國際機場', lat: 10.1656, lng: 103.9944 },
        { icao: 'VVTS', name: '胡志明市新山一機場', lat: 10.8188, lng: 106.6520 },
        { icao: 'VTBU', name: '芭達雅-烏塔拋國際機場', lat: 12.6797, lng: 101.0051 }, 
        { icao: 'RPVM', name: '麥克坦-宿霧國際機場', lat: 10.3075, lng: 123.9794 }, 
        { icao: 'WIII', name: '雅加達-蘇加諾-哈達國際機場', lat: -6.1256, lng: 106.6558 }, 
        { icao: 'WADD', name: '峇里島-伍拉·賴國際機場', lat: -8.7482, lng: 115.1675 }, 
        { icao: 'WARR', name: '泗水-朱安達國際機場', lat: -7.3798, lng: 112.7836 }
    ];

    const weatherCache = {};
    let isDataReady = false;
    airports.forEach(a => { weatherCache[a.icao] = { metar: "", taf: "" }; });

    const fetchBulkWeatherFast = async (icaoList, type) => {
        const cleanUrl = `https://aviationweather.gov/api/data/${type}?ids=${icaoList}&format=json`;

        const executeFetch = async (targetUrl, timeoutMs) => {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const res = await fetch(targetUrl, { signal: controller.signal });
                clearTimeout(id);
                if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
                return await res.json();
            } catch (err) {
                clearTimeout(id);
                throw err;
            }
        };

        try {
            const data = await executeFetch(cleanUrl, 4500);
            return Array.isArray(data) ? data : [];
        } catch (errorA) {
            console.warn(`[主鏈路失效] ${type.toUpperCase()} 直連受阻，啟動備援系統 A...`);
            try {
                const proxyA = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(cleanUrl)}`;
                const dataA = await executeFetch(proxyA, 5500);
                return Array.isArray(dataA) ? dataA : [];
            } catch (errorB) {
                console.warn(`[系統 A 失效] ${type.toUpperCase()} 備援 A 受阻，切換至最後防線 B...`);
                try {
                    const proxyB = `https://api.allorigins.win/raw?url=${encodeURIComponent(cleanUrl)}`;
                    const dataB = await executeFetch(proxyB, 6000);
                    return Array.isArray(dataB) ? dataB : [];
                } catch (errorC) {
                    console.error(`[全面失效] 無法為 ${type.toUpperCase()} 建立任何資料鏈路。`);
                    throw new Error(`無法連接至氣象資料庫`); 
                }
            }
        }
    };

    const bootSequence = async () => {
        const statusIndicator = document.getElementById('sync-status');
        if (statusIndicator) {
            statusIndicator.style.backgroundColor = "#f39c12"; 
            statusIndicator.innerText = "🚀 建立氣象資料鏈路中...";
        }
        
        const icaoString = airports.map(a => a.icao).join(',');

        try {
            const [allMetars, allTafs] = await Promise.all([
                fetchBulkWeatherFast(icaoString, 'metar'),
                fetchBulkWeatherFast(icaoString, 'taf')
            ]);

            if (allMetars.length === 0 && allTafs.length === 0) {
                throw new Error("無法連接天氣伺服器");
            }

            allMetars.forEach(m => { 
                if(m.icaoId && weatherCache[m.icaoId]) weatherCache[m.icaoId].metar = m.rawOb || m.raw; 
            });
            
            allTafs.forEach(t => { 
                if(t.icaoId && weatherCache[t.icaoId]) weatherCache[t.icaoId].taf = t.rawTAF || t.raw; 
            });

            isDataReady = true;
            if (statusIndicator) {
                statusIndicator.innerText = "✅ 氣象同步完成";
                statusIndicator.classList.remove('status-error');
                statusIndicator.classList.add('status-loaded');
                statusIndicator.style.backgroundColor = ""; 
            }
        } catch (error) {
            console.error("同步程序中斷：", error.message);
            isDataReady = false; 
            if (statusIndicator) {
                statusIndicator.innerText = "❌ 氣象同步失敗 (請檢查連線)";
                statusIndicator.classList.remove('status-loaded');
                statusIndicator.classList.add('status-error');
                statusIndicator.style.backgroundColor = "";
            }
        }
    };

    const refreshBtn = document.getElementById('btn-refresh-map');
    if(refreshBtn) {
        refreshBtn.onclick = () => {
            refreshBtn.disabled = true;
            refreshBtn.style.opacity = "0.5";
            refreshBtn.style.cursor = "not-allowed";
            refreshBtn.innerText = "⏳ 同步中...";

            isDataReady = false;
            airports.forEach(a => { weatherCache[a.icao] = { metar: "", taf: "" }; });
            
            bootSequence();

            setTimeout(() => {
                refreshBtn.disabled = false;
                refreshBtn.style.opacity = "1";
                refreshBtn.style.cursor = "pointer";
                refreshBtn.innerText = "手動更新氣象";
            }, 2000);
        };

        // 🌟 核心升級：注入自訂 ICAO 搜尋介面
        let searchContainer = document.getElementById('custom-icao-search-container');
        if (!searchContainer) {
            searchContainer = document.createElement('div');
            searchContainer.id = 'custom-icao-search-container';
            searchContainer.style.display = 'inline-flex';
            searchContainer.style.alignItems = 'center';
            searchContainer.style.gap = '8px';
            searchContainer.style.marginLeft = '15px';
            searchContainer.style.flexWrap = 'wrap';

            searchContainer.innerHTML = `
                <input type="text" id="custom-icao-input" placeholder="查詢其他機場 (例: KLAX)" maxlength="4" style="padding: 6px 10px; border-radius: 6px; border: 1px solid #cbd5e1; width: 180px; text-transform: uppercase; font-weight: bold; outline: none;">
                <button id="btn-search-icao" style="padding: 6px 12px; background: #8e44ad; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; transition: 0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">🔍 搜尋機場</button>
            `;

            // 將搜尋組件插入到更新按鈕的後方
            if (refreshBtn.parentNode) {
                refreshBtn.parentNode.insertBefore(searchContainer, refreshBtn.nextSibling);
            }

            // 綁定自訂搜尋事件
            document.getElementById('btn-search-icao').addEventListener('click', async function() {
                const inputEl = document.getElementById('custom-icao-input');
                let icao = inputEl.value.trim().toUpperCase();
                const btn = this;

                if(icao.length !== 4) {
                    const origText = btn.innerText;
                    btn.innerText = "⚠️ 請輸入四碼";
                    btn.style.background = "#e74c3c";
                    setTimeout(() => { btn.innerText = origText; btn.style.background = "#8e44ad"; }, 2000);
                    return;
                }

                btn.disabled = true;
                btn.innerText = "⏳ 尋找中...";
                btn.style.opacity = "0.7";

                try {
                    // 1. 索取機場座標 (Station Info)
                    const stationRes = await fetch(`https://aviationweather.gov/api/data/stationinfo?ids=${icao}&format=json`);
                    if(!stationRes.ok) throw new Error("API 異常");
                    const stationData = await stationRes.json();

                    if(!stationData || stationData.length === 0) {
                        throw new Error("查無此機場");
                    }

                    const station = stationData[0];
                    const lat = station.lat;
                    const lon = station.lon;
                    const siteName = station.site || "Custom Station";

                    // 2. 獲取該機場氣象資料
                    const [metarData, tafData] = await Promise.all([
                        fetchBulkWeatherFast(icao, 'metar'),
                        fetchBulkWeatherFast(icao, 'taf')
                    ]);

                    let rawMetarText = "";
                    let rawTafText = "";
                    if (metarData.length > 0) rawMetarText = metarData[0].rawOb || metarData[0].raw;
                    if (tafData.length > 0) rawTafText = tafData[0].rawTAF || tafData[0].raw;

                    // 3. 建立自定義🌟座標標記
                    const customIcon = L.divIcon({
                        html: '<div style="font-size:26px; text-shadow: 2px 2px 4px rgba(0,0,0,0.5); line-height: 1; transform: translate(-5px, -15px);">🌟</div>',
                        className: 'custom-icao-icon',
                        iconSize: [30, 30],
                        iconAnchor: [15, 30]
                    });

                    const customMarker = L.marker([lat, lon], {icon: customIcon, zIndexOffset: 1000}).addTo(window.aviationMapInstance);

                    // 4. 動態計算邊界防護與寬度
                    const mapElement = document.getElementById('map');
                    const mapWidth = mapElement ? mapElement.clientWidth : window.innerWidth;
                    const isMobile = window.innerWidth < 768;
                    const dynamicMaxWidth = isMobile ? Math.max(mapWidth - 50, 200) : Math.max(500, mapWidth * 0.70);
                    const dynamicMinWidth = isMobile ? Math.min(mapWidth - 60, 260) : 300;

                    // 5. 綁定 Popup 面板 (共用新的 buildAirportPopupHtml 邏輯)
                    const popupHtml = buildAirportPopupHtml({ icao: icao, name: siteName }, rawMetarText, rawTafText);

                    customMarker.bindPopup(popupHtml, {
                        maxWidth: dynamicMaxWidth,
                        minWidth: dynamicMinWidth,
                        maxHeight: 450,
                        autoPanPadding: [20, 20],
                        keepInView: true
                    }).openPopup();

                    // 平移過去
                    window.aviationMapInstance.flyTo([lat, lon], 6, { duration: 1.5 });

                    // 恢復按鈕狀態
                    btn.disabled = false;
                    btn.innerText = "🔍 搜尋機場";
                    btn.style.opacity = "1";
                    inputEl.value = ""; 

                } catch (err) {
                    console.error("自訂機場搜尋失敗:", err);
                    btn.innerText = "❌ 查無資料";
                    btn.style.background = "#e74c3c";
                    setTimeout(() => {
                        btn.disabled = false;
                        btn.innerText = "🔍 搜尋機場";
                        btn.style.background = "#8e44ad";
                        btn.style.opacity = "1";
                    }, 2500);
                }
            });
        }
    }

    // 將預載機場加入地圖
    airports.forEach(airport => {
        const marker = L.marker([airport.lat, airport.lng]).addTo(window.aviationMapInstance);

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

            if (!isDataReady) {
                L.popup(popupOpts)
                    .setLatLng(marker.getLatLng())
                    .setContent(`
                    <div class="weather-popup">
                        <div class="airport-title">${airport.name} (${airport.icao})</div>
                        <div style="color: #e67e22; font-weight: bold;">⚠️ 資料尚未就緒，請稍候或點擊「手動更新氣象」。</div>
                    </div>
                `).openOn(window.aviationMapInstance);
                return;
            }

            const rawMetarText = weatherCache[airport.icao].metar;
            const rawTafText = weatherCache[airport.icao].taf;
            
            // 使用重構後的 HTML 產生器 (同時包含歷史 METAR 的框架)
            const popupHtml = buildAirportPopupHtml(airport, rawMetarText, rawTafText);

            L.popup(popupOpts)
                .setLatLng(marker.getLatLng())
                .setContent(popupHtml)
                .openOn(window.aviationMapInstance);
        });
    });

    bootSequence();
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

    const btnProcess = document.getElementById('btn-process-notam');
    if (btnProcess) btnProcess.onclick = processNotamData;
    
    const btnClear = document.getElementById('btn-clear-notam');
    if (btnClear) btnClear.onclick = clearNotamAll;
}

function smartToDec(val) {
    if (!val) return NaN;
    const cleanVal = val.toUpperCase().replace(/\s+/g, '');
    const dirMatch = cleanVal.match(/[NSEW]/);
    if (!dirMatch) return NaN;
    
    const dir = dirMatch[0];
    const nums = cleanVal.replace(/[NSEW]/, "");
    
    let dec = NaN;

    if (nums.includes('.') && nums.split('.')[0].length <= 3) {
       dec = parseFloat(nums);
    } else {
        const isLat = (dir === 'N' || dir === 'S');
        const degLen = isLat ? 2 : 3;

        if (nums.length >= degLen + 2) {
            const d = parseFloat(nums.slice(0, degLen));
            const rest = nums.slice(degLen);
            
            if (rest.includes('.')) {
                 const dotIndex = rest.indexOf('.');
                 if (dotIndex === 2) { 
                     const m = parseFloat(rest);
                     dec = d + (m / 60);
                 } else if (dotIndex === 4) { 
                     const m = parseFloat(rest.slice(0, 2));
                     const s = parseFloat(rest.slice(2));
                     dec = d + (m / 60) + (s / 3600);
                 }
            } else {
                const m = parseFloat(rest.slice(0, 2));
                const s = rest.length >= 4 ? parseFloat(rest.slice(2, 4)) : 0;
                dec = d + (m / 60) + (s / 3600);
            }
        }
    }
    
    if (!isNaN(dec)) {
         return (dir === 'S' || dir === 'W') ? -dec : dec;
    }
    return NaN;
}

function parseCoordinates(text) {
    let results = parseCoordinatesLegacy(text);
    if (results.length === 0) {
        console.log("⚠️ 標準解析未命中，啟動深度特徵萃取備援系統 (Dual-Engine Engaged)...");
        results = parseCoordinatesAdvanced(text);
    }
    return results;
}

function parseCoordinatesLegacy(text) {
    const cleanText = text.replace(/[\t\r\n]+/g, " ");
    let results = [];
    
    const universalPattern = /([NS]\s*\d{4,}(?:\.\d+)?|\d{4,}(?:\.\d+)?[NS])[\s/]*([EW]\s*\d{5,}(?:\.\d+)?|\d{5,}(?:\.\d+)?[EW])/gi;
    let m;
    while ((m = universalPattern.exec(cleanText)) !== null) {
        const lat = smartToDec(m[1]);
        const lng = smartToDec(m[2]);
        if (!isNaN(lat) && !isNaN(lng)) results.push([lat, lng]);
    }

    if (results.length === 0) {
        const symRegex = /([NS])\s*(\d{1,2})[°\s](\d{2})['’\s](\d{2}(?:\.\d+)?)[”"\s]*([EW])\s*(\d{1,3})[°\s](\d{2})['’\s](\d{2}(?:\.\d+)?)/gi;
        while ((m = symRegex.exec(cleanText)) !== null) {
            results.push([
                parseFloat(m[2]) + parseFloat(m[3])/60 + parseFloat(m[4])/3600 * (m[1].toUpperCase()==='S'?-1:1),
                parseFloat(m[6]) + parseFloat(m[7])/60 + parseFloat(m[8])/3600 * (m[5].toUpperCase()==='W'?-1:1)
            ]);
        }
    }
    return results;
}

function parseCoordinatesAdvanced(text) {
    let cleanText = text.toUpperCase().replace(/[°'"’”/\\,-]/g, " ");
    cleanText = cleanText.replace(/\b([NSEW])[ \t]*([\d][\d \t.]+)\b/g, "$2$1");

    const coordRegex = /(?:\b|^)([\d]{2}[\d \t.]+)([NSEW])\b/g;
    let match;
    let tokens = [];

    while ((match = coordRegex.exec(cleanText)) !== null) {
        let numStr = match[1].replace(/[ \t]+/g, "");
        let dir = match[2];
        if (numStr.length < 4 && !numStr.includes('.')) continue;
        tokens.push({ numStr, dir });
    }

    let results = [];
    let currentLat = null;

    tokens.forEach(token => {
        const { numStr, dir } = token;
        let dec = NaN;

        if (numStr.includes('.') && numStr.indexOf('.') <= 3) {
            dec = parseFloat(numStr);
        } else {
            let parts = numStr.split('.');
            let main = parts[0];
            let fraction = parts[1] ? "." + parts[1] : "";
            let d = 0, m = 0, s = 0;

            if (main.length === 4 || main.length === 5) {
                m = parseFloat(main.slice(-2) + fraction);
                d = parseFloat(main.slice(0, -2));
            } else if (main.length >= 6) {
                s = parseFloat(main.slice(-2) + fraction);
                m = parseFloat(main.slice(-4, -2));
                d = parseFloat(main.slice(0, -4));
            }

            if (!isNaN(d)) {
                dec = d + (m / 60) + (s / 3600);
            }
        }

        if (!isNaN(dec)) {
            dec = dec * ((dir === 'S' || dir === 'W') ? -1 : 1);
            const isLat = (dir === 'N' || dir === 'S');

            if (isLat) {
                if (dec >= -90 && dec <= 90) currentLat = dec;
            } else if (!isLat && currentLat !== null) {
                if (dec >= -180 && dec <= 180) {
                    results.push([currentLat, dec]);
                }
                currentLat = null;
            }
        }
    });
    return results;
}

function processNotamData() {
    const inputEl = document.getElementById('notamInput');
    if (!inputEl) return;
    const input = inputEl.value;
    if (!input.trim() || !notamMapInstance) return;

    notamActiveLayers.forEach(l => notamMapInstance.removeLayer(l));
    notamActiveLayers = [];

    const blocks = input.split(/(?=\d\.\s*FLT AREA|AREA\s+\d+|1\.THE AREA)/i);

    blocks.forEach((block, index) => {
        const coords = parseCoordinates(block);
        if (coords.length === 0) return;

        const cleanBlock = block.replace(/\s+/g, " ");
        
        const radiusRegex = /(?:RADIUS\s+(?:OF\s+)?(\d+(?:\.\d+)?)\s*(NM|KM))|(\d+(?:\.\d+)?)\s*(NM|KM)\s*RADIUS/gi;
        let radiusMatches = [...cleanBlock.matchAll(radiusRegex)];

        if (radiusMatches.length > 0) {
            radiusMatches.forEach(match => {
                const rValue = parseFloat(match[1] || match[3]);
                const rUnit = (match[2] || match[4]).toUpperCase();
                const meters = rValue * (rUnit === "NM" ? 1852 : 1000);
                const center = coords[0]; 

                const circle = L.circle(center, {
                    color: '#10b981', fillColor: '#10b981', fillOpacity: 0.25, radius: meters, weight: 2, dashArray: '5, 5'
                }).addTo(notamMapInstance);
                notamActiveLayers.push(circle);
                circle.bindPopup(`<b>Radius Area</b><br>中心: ${center[0].toFixed(4)}, ${center[1].toFixed(4)}<br>半徑: ${rValue} ${rUnit}`);
            });
        } 
        
        if (coords.length >= 3) {
            const poly = L.polygon(coords, {
                color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.2, weight: 3
            }).addTo(notamMapInstance);
            notamActiveLayers.push(poly);
            poly.bindPopup(`<b>Polygon Area</b><br>頂點數: ${coords.length}`);
        } 
        
        if (radiusMatches.length === 0 && coords.length < 3) {
            coords.forEach(c => {
                const marker = L.circleMarker(c, { radius: 6, color: '#f43f5e', fillOpacity: 0.8 }).addTo(notamMapInstance);
                notamActiveLayers.push(marker);
                marker.bindPopup(`<b>Waypoint</b><br>${c[0].toFixed(5)}, ${c[1].toFixed(5)}`);
            });
        }
    });

    if (notamActiveLayers.length > 0) {
        const group = new L.featureGroup(notamActiveLayers);
        notamMapInstance.fitBounds(group.getBounds(), { padding: [40, 40] });
    }
}

function clearNotamAll() {
    if(notamMapInstance) {
        notamActiveLayers.forEach(l => notamMapInstance.removeLayer(l));
        notamMapInstance.setView([25.03, 121.5], 6);
    }
    notamActiveLayers = [];
    
    const inputEl = document.getElementById('notamInput');
    if (inputEl) inputEl.value = "";
}
