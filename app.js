// ==========================================
// 📦 簡報箱主核心引擎 (Core Engine) - app.js
// ==========================================

// ------------------------------------------
// 🌐 全域變數集中管理區 (Global State)
// ------------------------------------------
let notamMapInstance = null;
let notamActiveLayers = [];
let notamClockInterval = null;
let curfewClockInterval = null;

// ⛽ 油量計算機基礎數據
const fuelTable = [
  { total: 9.0,    inner: 9.0,    outer: 0.0,   trim: 0.0,  center: 0.0 },
  { total: 14.73,  inner: 9.0,    outer: 5.73,  trim: 0.0,  center: 0.0 },
  { total: 23.9,   inner: 18.17,  outer: 5.73,  trim: 0.0,  center: 0.0 }, 
  { total: 27.5,   inner: 18.17,  outer: 5.73,  trim: 3.60, center: 0.0 }, 
  { total: 30.0,   inner: 20.67,  outer: 5.73,  trim: 3.60, center: 0.0 },
  { total: 40.0,   inner: 30.39,  outer: 5.73,  trim: 3.88, center: 0.0 },
  { total: 60.0,   inner: 49.83,  outer: 5.73,  trim: 4.44, center: 0.0 },
  { total: 75.0,   inner: 64.40,  outer: 5.73,  trim: 4.87, center: 0.0 },
  { total: 100.0,  inner: 65.50,  outer: 5.73,  trim: 4.88, center: 23.89 },
  { total: 109.18, inner: 65.94,  outer: 5.73,  trim: 4.89, center: 32.62 }
];

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

// ------------------------------------------
// 🚀 面板切換與生命週期管理
// ------------------------------------------

// 🧹 記憶體釋放邏輯 (防護機制)
function cleanUpPanel() {
    // 主動卸載 NOTAM 地圖實例，避免重複初始化導致當機
    if (typeof notamMapInstance !== 'undefined' && notamMapInstance !== null) {
        notamMapInstance.remove();
        notamMapInstance = null;
    }
    // 清理殘留的時鐘計時器，釋放 CPU 資源
    if (typeof notamClockInterval !== 'undefined' && notamClockInterval !== null) {
        clearInterval(notamClockInterval);
        notamClockInterval = null;
    }
    if (typeof curfewClockInterval !== 'undefined' && curfewClockInterval !== null) {
        clearInterval(curfewClockInterval);
        curfewClockInterval = null;
    }

    // 清除上次動態載入的腳本，防止事件疊加
    const oldScripts = document.querySelectorAll('.dynamic-script');
    oldScripts.forEach(script => script.remove());
}

// 負責無縫切換頁面與喚醒 JS 邏輯的核心引擎
function loadPage(pageUrl) {
    const displayArea = document.getElementById('content-display');
    
    cleanUpPanel(); // 載入前先執行大掃除

    displayArea.innerHTML = '<div style="text-align: center; padding: 2em; color: #3c79ff; font-weight: bold;">讀取模組中 (Loading)...</div>';

    fetch(pageUrl)
        .then(response => {
            if (!response.ok) throw new Error('網路回應異常');
            return response.text();
        })
        .then(html => {
            displayArea.innerHTML = html;

            // 抓出 HTML 裡所有的 <script> 並強制瀏覽器執行
            const scripts = displayArea.querySelectorAll('script');
            scripts.forEach(oldScript => {
                const newScript = document.createElement('script');
                newScript.className = 'dynamic-script'; // 標記為動態，方便下次清除
                Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                newScript.appendChild(document.createTextNode(oldScript.innerHTML));
                oldScript.parentNode.replaceChild(newScript, oldScript);
            });

            // 依照載入的頁面，安全喚醒對應邏輯 (改用 onclick 防止事件疊加)
            if (pageUrl === 'curfew.html') {
                initCurfewCalculator(); 
            } 
            else if (pageUrl === 'time.html') {
                initTimeCalculator(); 
                const resetBtn = document.getElementById("resetTimeCalcBtn");
                if (resetBtn) resetBtn.onclick = resetTimeCalculator;
            } 
            else if (pageUrl === 'altimetry.html') {
                resetAltimetryCalculator(); 
                const resetAltBtn = document.getElementById("resetAltimetryBtn");
                if (resetAltBtn) resetAltBtn.onclick = resetAltimetryCalculator;
            }
            else if (pageUrl === 'notam.html') {
                initNotamRadar(); 
            }
            else if (pageUrl === 'TPE_Flight_Data_Link.html') { 
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
    cleanUpPanel(); // 關閉面板時徹底清理記憶體
    displayArea.innerHTML = `
        <div class="section" style="text-align: center; color: #666;">
            <h3>👈 請點擊上方按鈕載入計算工具</h3>
        </div>
    `;
}

// ------------------------------------------
// 📋 總指揮中心與勾選表初始化
// ------------------------------------------
function setupChecklist(listId) {
    const list = document.getElementById(listId);
    if (!list) return;
    list.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
}

document.addEventListener("DOMContentLoaded", function () {
    setupChecklist("briefingChecklist1");
    setupChecklist("personalChecklist");
    console.log("✈️ 簡報箱主核心系統已啟動 (Core Engine Online)");
});

// ==========================================
// ⛽ 油量計算機邏輯 
// ==========================================
function interpolateFuel(total) {
  const table = fuelTable;
  const n = table.length;
  if (n === 0) return null;
  if (total < table[0].total || total > table[n - 1].total) return null;
  for (let i = 0; i < n; i++) {
    if (Math.abs(total - table[i].total) < 1e-6) {
      return { total: total, inner: table[i].inner, outer: table[i].outer, trim: table[i].trim, center: table[i].center };
    }
  }
  for (let i = 1; i < n; i++) {
    const prev = table[i - 1], curr = table[i];
    if (total < curr.total + 1e-6) {
      const ratio = (total - prev.total) / (curr.total - prev.total);
      const lerp = (a, b) => a + (b - a) * ratio;
      return { total: total, inner: lerp(prev.inner, curr.inner), outer: lerp(prev.outer, curr.outer), trim: lerp(prev.trim, curr.trim), center: lerp(prev.center, curr.center) };
    }
  }
  const last = table[n - 1];
  return { total: total, inner: last.inner, outer: last.outer, trim: last.trim, center: last.center };
}

function formatFuel(value) { return value.toFixed(1); }
function formatTimeMin(value) { return value.toFixed(1); }
function formatTimeHHMM(value) {
  if (!isFinite(value) || value <= 0) return "0 分鐘";
  const totalMin = Math.round(value);
  const h = Math.floor(totalMin / 60), m = totalMin % 60;
  if (h === 0) return m + " 分鐘";
  return h + " 小時 " + m + " 分";
}

function computeIOCRefuel(dInner, dOuter, dCenter) {
  const remaining = { inner: Math.max(dInner, 0), outer: Math.max(dOuter, 0), center: Math.max(dCenter, 0) };
  const original = { inner: remaining.inner, outer: remaining.outer, center: remaining.center };
  const finishTime = { inner: 0, outer: 0, center: 0 };
  let t = 0; const eps = 1e-8; const order = ["inner", "outer", "center"];

  while (true) {
    const active = order.filter(key => remaining[key] > eps);
    if (active.length === 0) break;
    const k = active.length; let dt = Infinity;
    for (const key of active) {
      const timeToFinish = remaining[key] * k; 
      if (timeToFinish < dt) dt = timeToFinish;
    }
    t += dt;
    for (const key of active) {
      remaining[key] -= dt / active.length; 
      if (remaining[key] < eps) {
        remaining[key] = 0;
        if (finishTime[key] === 0 && original[key] > 0) finishTime[key] = t; 
      }
    }
  }
  return { tInner: finishTime.inner, tOuter: finishTime.outer, tCenter: finishTime.center, groupTime: t };
}

function computeRefuel(currentTotal, targetTotal, finalDist) {
  let currentDist = interpolateFuel(currentTotal);
  if (!currentDist) currentDist = { inner: currentTotal, outer: 0.0, trim: 0.0, center: 0.0 };

  const inner0 = currentDist.inner, outer0 = currentDist.outer, trim0 = currentDist.trim, center0 = currentDist.center;
  let dInner = Math.max(finalDist.inner - inner0, 0);
  let dOuter = Math.max(finalDist.outer - outer0, 0);
  let dTrim = Math.max(finalDist.trim - trim0, 0);
  let dCenter = Math.max(finalDist.center - center0, 0);

  const ioc = computeIOCRefuel(dInner, dOuter, dCenter);
  const rateTrim = 0.10;
  const tTrim = dTrim > 0 ? dTrim / rateTrim : 0;
  const totalDelta = dInner + dOuter + dTrim + dCenter;
  const totalTime = Math.max(ioc.groupTime, tTrim);
  const effRate = totalTime > 0 ? totalDelta / totalTime : 0;

  return { dInner, dOuter, dTrim, dCenter, tInner: ioc.tInner, tOuter: ioc.tOuter, tCenter: ioc.tCenter, tTrim, totalDelta, totalTime, effRate };
}

function onCalculate() {
  const currentEl = document.getElementById("currentFuel");
  const targetEl  = document.getElementById("targetFuel");
  const messageEl = document.getElementById("message");
  const currentTotal = parseFloat(currentEl.value);
  const targetTotal  = parseFloat(targetEl.value);

  if (Number.isNaN(currentTotal) || Number.isNaN(targetTotal)) {
    messageEl.textContent = "請輸入有效的『目前剩油』與『目標 Total Fuel』（噸）。";
    updateDistribution(null, null); updateTimeTable(null); return;
  }
  if (targetTotal <= currentTotal) {
    messageEl.textContent = "目標 Total Fuel 必須大於目前剩油。";
    updateDistribution(null, null); updateTimeTable(null); return;
  }

  let currentDist = interpolateFuel(currentTotal);
  if (!currentDist) currentDist = { total: currentTotal, inner: currentTotal, outer: 0.0, trim: 0.0, center: 0.0 };

  const finalDist = interpolateFuel(targetTotal);
  if (!finalDist) {
    messageEl.textContent = "超出資料範圍。";
    updateDistribution(null, null); updateTimeTable(null); return;
  }
  messageEl.textContent = "";
  updateDistribution(currentDist, finalDist);
  const refuel = computeRefuel(currentTotal, targetTotal, finalDist);
  updateTimeTable(refuel);
}

function updateDistribution(curr, target) {
  const tbody = document.getElementById("resultBody");
  if (!curr || !target) {
    tbody.innerHTML = `<tr><td>Inner Tank</td><td>-</td><td>-</td><td>-</td></tr>
                       <tr><td>Outer Tank</td><td>-</td><td>-</td><td>-</td></tr>
                       <tr><td>Trim Tank</td><td>-</td><td>-</td><td>-</td></tr>
                       <tr><td>Center Tank</td><td>-</td><td>-</td><td>-</td></tr>
                       <tr><th>Total</th><th>-</th><th>-</th><th>-</th></tr>`;
    return;
  }

  const dInner = Math.max(0, target.inner - curr.inner);
  const dOuter = Math.max(0, target.outer - curr.outer);
  const dTrim = Math.max(0, target.trim - curr.trim);
  const dCenter = Math.max(0, target.center - curr.center);
  
  const sumCurr = curr.inner + curr.outer + curr.trim + curr.center;
  const sumTarg = target.inner + target.outer + target.trim + target.center;
  const sumDiff = dInner + dOuter + dTrim + dCenter;

  const cCurr = '#64748b'; 
  const cTarg = '#007aff'; 
  const cDiff = '#16a34a'; 

  const makeRow = (name, vCurr, vTarg, vDiff, isTh = false) => {
    const tag = isTh ? 'th' : 'td';
    const fw = isTh ? 'font-weight: 800;' : 'font-weight: 700;';
    return `<tr>
      <${tag}>${name}</${tag}>
      <${tag} style="color:${cCurr}; ${fw}">${formatFuel(vCurr)}</${tag}>
      <${tag} style="color:${cTarg}; ${fw}">${formatFuel(vTarg)}</${tag}>
      <${tag} style="color:${cDiff}; ${fw}">+${formatFuel(vDiff)}</${tag}>
    </tr>`;
  };

  tbody.innerHTML = 
    makeRow('Inner Tank', curr.inner, target.inner, dInner) +
    makeRow('Outer Tank', curr.outer, target.outer, dOuter) +
    makeRow('Trim Tank', curr.trim, target.trim, dTrim) +
    makeRow('Center Tank', curr.center, target.center, dCenter) +
    makeRow('Total (I+O+T+C)', sumCurr, sumTarg, sumDiff, true);
}

function updateTimeTable(data) {
  const tbody = document.getElementById("timeBody");
  if (!data) {
    tbody.innerHTML = `<tr><td>Inner Tank</td><td>-</td><td>動態分配 (共 1.0)</td><td>-</td></tr><tr><td>Outer Tank</td><td>-</td><td>動態分配 (共 1.0)</td><td>-</td></tr><tr><td>Trim Tank</td><td>-</td><td>0.10</td><td>-</td></tr><tr><td>Center Tank</td><td>-</td><td>動態分配 (共 1.0)</td><td>-</td></tr><tr><th>總加油量 (t)</th><th>-</th><th>等效流量 (t/min)</th><th>-</th></tr><tr><th>總加油時間</th><th colspan="3">-</th></tr>`;
    return;
  }
  const { dInner, dOuter, dTrim, dCenter, tInner, tOuter, tTrim, tCenter, totalDelta, totalTime, effRate } = data;
  tbody.innerHTML = `<tr><td>Inner Tank</td><td>${formatFuel(dInner)}</td><td>動態分配 (共 1.0)</td><td>${formatTimeMin(tInner)}</td></tr><tr><td>Outer Tank</td><td>${formatFuel(dOuter)}</td><td>動態分配 (共 1.0)</td><td>${formatTimeMin(tOuter)}</td></tr><tr><td>Trim Tank</td><td>${formatFuel(dTrim)}</td><td>0.10</td><td>${formatTimeMin(tTrim)}</td></tr><tr><td>Center Tank</td><td>${formatFuel(dCenter)}</td><td>動態分配 (共 1.0)</td><td>${formatTimeMin(tCenter)}</td></tr><tr><th>總加油量 (t)</th><th>${formatFuel(totalDelta)}</th><th>等效流量 (t/min)</th><th>${effRate.toFixed(2)}</th></tr><tr><th>總加油時間</th><th colspan="3">${formatTimeHHMM(totalTime)} （約 ${formatTimeMin(totalTime)} 分）</th></tr>`;
}

// ==========================================
// ⏳ Curfew Calculator 核心邏輯 (原生重構版)
// ==========================================
function initCurfewCalculator() {
    let state = {
        curfewType: 'parking', // 預設: parking
        curfewCondition: 'before' // 預設: before
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
    
    // 清理殘留的計時器後重新綁定
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

    // 替換 addEventListener 為 onclick，確保防護連點重疊
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
// ⏱️ 時間計算器核心邏輯
// ==========================================
function switchTimeTab(tabId) {
    document.querySelectorAll('.time-tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.time-tab-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    document.querySelector(`.time-tab-btn[data-tab="${tabId}"]`).classList.add('active');
}

function setSimpleOp(op) {
    document.getElementById('simpleOp').value = op;
    const btnAdd = document.getElementById('btnOpAdd');
    const btnSub = document.getElementById('btnOpSub');
    const pill = document.getElementById('simpleOpPill');
    
    if (op === 'add') {
        btnAdd.classList.add('active');
        btnSub.classList.remove('active');
        pill.style.transform = 'translateX(0)';
    } else {
        btnSub.classList.add('active');
        btnAdd.classList.remove('active');
        pill.style.transform = 'translateX(100%)';
    }
}

function setBaseOp(op) {
    document.getElementById('operationType').value = op;
    const btnAdd = document.getElementById('btnBaseAdd');
    const btnSub = document.getElementById('btnBaseSub');
    const pill = document.getElementById('baseOpPill');
    
    if (op === 'add') {
        btnAdd.classList.add('active');
        btnSub.classList.remove('active');
        pill.style.transform = 'translateX(0)';
    } else {
        btnSub.classList.add('active');
        btnAdd.classList.remove('active');
        pill.style.transform = 'translateX(100%)';
    }
}

function calculateSimple() {
    const h1 = parseInt(document.getElementById('simpleH1').value || 0);
    const m1 = parseInt(document.getElementById('simpleM1').value || 0);
    const op = document.getElementById('simpleOp').value;
    const h2 = parseInt(document.getElementById('simpleH2').value || 0);
    const m2 = parseInt(document.getElementById('simpleM2').value || 0);

    let resultMins = (h1 * 60 + m1) + (op === 'add' ? (h2 * 60 + m2) : -(h2 * 60 + m2));
    const isNegative = resultMins < 0;
    resultMins = Math.abs(resultMins);

    const finalH = Math.floor(resultMins / 60);
    const finalM = resultMins % 60;
    const formattedTime = `${finalH}:${String(finalM).padStart(2, '0')}`;

    const box = document.getElementById('simpleResultBox');
    const text = document.getElementById('simpleResultText');
    const detail = document.getElementById('simpleResultDetail');
    
    box.style.display = 'block';
    if (isNegative) {
        text.innerHTML = `<span style="color:#e74c3c;">-${formattedTime}</span>`;
        detail.textContent = `時數短缺 ${finalH} 小時 ${finalM} 分鐘`;
    } else {
        text.innerHTML = formattedTime;
        detail.textContent = `總時長 ${finalH} 小時 ${finalM} 分鐘`;
    }
}

function calculateTimeDiff() {
    const start = new Date(`${document.getElementById('diffStartDate').value}T${document.getElementById('diffStartHour').value}:${document.getElementById('diffStartMin').value}:00`);
    const end = new Date(`${document.getElementById('diffEndDate').value}T${document.getElementById('diffEndHour').value}:${document.getElementById('diffEndMin').value}:00`);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) { alert("請確保日期已填寫"); return; }

    let diffMs = end.getTime() - start.getTime();
    const isNegative = diffMs < 0;
    diffMs = Math.abs(diffMs);

    const hours = Math.floor(diffMs / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    const displayResult = `${hours}:${String(minutes).padStart(2, '0')}`;

    const box = document.getElementById('diffResultBox');
    const text = document.getElementById('diffResultText');
    const detail = document.getElementById('diffResultDetail');

    box.style.display = 'block';
    if (isNegative) {
        text.innerHTML = `<span style="color:#e74c3c;">-${displayResult}</span>`;
        detail.textContent = `⚠️ 結束時間早於起始時間`;
    } else {
        text.innerHTML = displayResult;
        detail.textContent = `相差 ${hours} 小時 ${minutes} 分鐘`;
    }
}

function calculateAddSub() {
    const baseStr = `${document.getElementById('baseDate').value}T${document.getElementById('baseHour').value}:${document.getElementById('baseMin').value}:00`;
    const baseDate = new Date(baseStr);
    if(isNaN(baseDate.getTime())) { alert("請填寫基準日期"); return; }

    const op = document.getElementById('operationType').value;
    const d = parseInt(document.getElementById('addDays').value || 0);
    const h = parseInt(document.getElementById('addHours').value || 0);
    const m = parseInt(document.getElementById('addMins').value || 0);

    const msToAdd = (d * 86400000) + (h * 3600000) + (m * 60000);
    const targetDate = new Date(baseDate.getTime() + (op === 'add' ? msToAdd : -msToAdd));

    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dd = String(targetDate.getDate()).padStart(2, '0');
    const hh = String(targetDate.getHours()).padStart(2, '0');
    const min = String(targetDate.getMinutes()).padStart(2, '0');
    const formatted = `${yyyy}-${mm}-${dd} ${hh}:${min}`;

    document.getElementById('addsubResultBox').style.display = 'block';
    document.getElementById('addsubResultText').textContent = formatted;
    document.getElementById('addsubResultDetail').textContent = `推算目標為 ${['週日', '週一', '週二', '週三', '週四', '週五', '週六'][targetDate.getDay()]}`;
}

function initTimeCalculator() {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const currentHour = String(now.getHours()).padStart(2, '0');
    let nextHour = String(now.getHours() === 23 ? 23 : now.getHours() + 1).padStart(2, '0');

    function populate(elementId, max) {
        const select = document.getElementById(elementId);
        if(!select) return;
        select.innerHTML = '';
        for (let i = 0; i <= max; i++) {
            const val = String(i).padStart(2, '0');
            select.options.add(new Option(val, val));
        }
    }

    // Init Diff Tab
    document.getElementById('diffStartDate').value = today; 
    document.getElementById('diffEndDate').value = today;
    populate('diffStartHour', 23); populate('diffEndHour', 23);
    populate('diffStartMin', 59); populate('diffEndMin', 59);
    document.getElementById('diffStartHour').value = currentHour; 
    document.getElementById('diffEndHour').value = nextHour;

    // Init AddSub Tab
    document.getElementById('baseDate').value = today;
    populate('baseHour', 23); populate('baseMin', 59);
    document.getElementById('baseHour').value = currentHour;
}

function resetTimeCalculator() {
    switchTimeTab('tab-simple');
    
    document.getElementById('simpleH1').value = "";
    document.getElementById('simpleM1').value = "";
    document.getElementById('simpleH2').value = "";
    document.getElementById('simpleM2').value = "";
    setSimpleOp('add');
    document.getElementById('simpleResultBox').style.display = 'none';

    document.getElementById('diffResultBox').style.display = 'none';

    document.getElementById('addDays').value = "";
    document.getElementById('addHours').value = "";
    document.getElementById('addMins').value = "";
    setBaseOp('add');
    document.getElementById('addsubResultBox').style.display = 'none';

    initTimeCalculator();
}

// ==========================================
// ❄️ ICAO 寒冷溫度修正 (Altimetry) 核心邏輯
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
      if (['iaf', 'if', 'faf', 'da'].includes(rowId)) return 'Required 必須修正';
      break;
    case 'APV-Baro(3D)':
      if (['iaf', 'if'].includes(rowId)) return 'Not Recommended 不建議\n(see note)';
      if (['faf', 'da'].includes(rowId)) return 'Not Required 不需要';
      break;
    case 'PA (ILS)':
      if (['iaf', 'if', 'faf'].includes(rowId)) return 'Required 必須修正\n(see note)';
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

function updateAltimetry() {
  recalculateAltimetryValues();
}

function handleAltRowChange(id, value) {
  const row = altimetryRows.find(r => r.id === id);
  if(row) row.altitude = value;
  recalculateAltimetryValues();
}

function handleAltLabelChange(id, value) {
  const row = altimetryRows.find(r => r.id === id);
  if(row) row.label = value;
}

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
// 📡 NOTAM Radar 核心邏輯 (強化升級版)
// ==========================================
function initNotamRadar() {
    // 1. 時鐘邏輯 (防護殘留計時器)
    if (notamClockInterval) clearInterval(notamClockInterval);
    notamClockInterval = setInterval(() => {
        const clockEl = document.getElementById('clock');
        if (clockEl) {
            const now = new Date();
            clockEl.innerText = `UTC: ${now.toISOString().replace('T', ' ').slice(0, 19)}`;
        } else {
            clearInterval(notamClockInterval);
        }
    }, 1000);

    // 2. 地圖初始化 (防護重複載入)
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

    // 3. 綁定按鈕事件 (改用 onclick 防止疊加)
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

function parseNotamHeader(text) {
    const idMatch = text.match(/([A-Z]\d{4}\/\d{2,4})/);
    const timeMatchB = text.match(/B\)\s*(\d{10})/);
    const timeMatchC = text.match(/C\)\s*(\d{10}|PERM|EST)/);
    
    const formatTime = (ts) => {
        if (!ts || ts.length < 10) return ts;
        const year = "20" + ts.slice(0, 2);
        const month = ts.slice(2, 4);
        const day = ts.slice(4, 6);
        const hour = ts.slice(6, 8);
        const min = ts.slice(8, 10);
        const utcDate = new Date(`${year}-${month}-${day}T${hour}:${min}:00Z`);
        const localDate = new Date(utcDate.getTime() + (9 * 60 * 60 * 1000));
        return {
            utc: `${year}/${month}/${day} ${hour}:${min} UTC`,
            local: `${localDate.getFullYear()}/${(localDate.getMonth()+1).toString().padStart(2,'0')}/${localDate.getDate().toString().padStart(2,'0')} ${localDate.getHours().toString().padStart(2,'0')}:${localDate.getMinutes().toString().padStart(2,'0')} (Local)`
        };
    };

    return {
        id: idMatch ? idMatch[1] : "未知名編號",
        start: timeMatchB ? formatTime(timeMatchB[1]) : null,
        end: timeMatchC ? formatTime(timeMatchC[1]) : null
    };
}

function parseCoordinates(text) {
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

function processNotamData() {
    const inputEl = document.getElementById('notamInput');
    if (!inputEl) return;
    const input = inputEl.value;
    if (!input.trim() || !notamMapInstance) return;

    notamActiveLayers.forEach(l => notamMapInstance.removeLayer(l));
    notamActiveLayers = [];

    const headerInfo = parseNotamHeader(input);
    const blocks = input.split(/(?=\d\.\s*FLT AREA|AREA\s+\d+|1\.THE AREA)/i);
    let allCoords = [];

    blocks.forEach((block, index) => {
        const coords = parseCoordinates(block);
        if (coords.length === 0) return;
        allCoords = allCoords.concat(coords);

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

    updateNotamUI(allCoords, headerInfo, input);
    if (notamActiveLayers.length > 0) {
        const group = new L.featureGroup(notamActiveLayers);
        notamMapInstance.fitBounds(group.getBounds(), { padding: [40, 40] });
    }
}

function updateNotamUI(coords, header, raw) {
    const infoEl = document.getElementById('notamInfo');
    const logEl = document.getElementById('logArea');
    const contentEl = document.getElementById('infoContent');
    const coordListEl = document.getElementById('coordList');
    
    if (infoEl) infoEl.classList.remove('hidden');
    if (logEl) logEl.classList.remove('hidden');
    
    let translationHint = "";
    if (raw.includes("ACROBATIC")) translationHint = "🚩 偵測到特技飛行活動 (Acrobatic Flight)";
    if (raw.includes("GUNNERY")) translationHint = "⚠️ 偵測到實彈射擊訓練 (Gunnery Training)";

    if (contentEl) {
        contentEl.innerHTML = `
            <table class="notam-table w-full">
                <tr><th>NOTAM 編號</th><td>${header.id}</td></tr>
                <tr><th>開始時間</th><td>${header.start ? `UTC: ${header.start.utc}<br>${header.start.local}` : '---'}</td></tr>
                <tr><th>結束時間</th><td>${header.end ? (header.end.utc || header.end) : '---'}</td></tr>
                <tr><th>座標點數</th><td>${coords.length} Points</td></tr>
            </table>
            <div class="text-[11px] text-blue-600 font-bold mt-2">${translationHint}</div>
        `;
    }
    
    if (coordListEl) {
        coordListEl.innerHTML = coords.map((c, i) => `
            <div class="bg-slate-50 p-2 rounded-lg border border-slate-100 text-center shadow-sm">
                <span class="block text-[9px] text-slate-400 font-bold">PT ${i+1}</span>
                <span class="text-slate-700 font-mono">${c[0].toFixed(4)},${c[1].toFixed(4)}</span>
            </div>
        `).join('');
    }
}

function clearNotamAll() {
    if(notamMapInstance) {
        notamActiveLayers.forEach(l => notamMapInstance.removeLayer(l));
        notamMapInstance.setView([25.03, 121.5], 6);
    }
    notamActiveLayers = [];
    
    const inputEl = document.getElementById('notamInput');
    const infoEl = document.getElementById('notamInfo');
    const logEl = document.getElementById('logArea');
    
    if (inputEl) inputEl.value = "";
    if (infoEl) infoEl.classList.add('hidden');
    if (logEl) logEl.classList.add('hidden');
}
