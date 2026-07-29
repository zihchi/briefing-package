/* ============================================================================
 * OFP 截圖 → 自動填入 Entry 表單（純前端、離線、免費）
 * ----------------------------------------------------------------------------
 * 來源：STARLUX EFB「OFP / JOURNEY LOG」畫面截圖（深底白字）。
 * 技術：Tesseract.js 本地 OCR + 版面錨點解析 + 圓圈相對亮度判讀。
 *   - 文字（航班/機號/機型/日期/航路/OOOI 時間）→ 用 OCR 文字＋座標錨點抓取
 *   - 圓圈（PF/PM/T/O/L/D）不做 OCR，改在原圖對應座標「取像素亮度」判斷選取
 * 設計原則：非破壞性。只把值填進表單、由使用者複核後才儲存；任何失敗都不
 *   影響原本的手動輸入流程。Pilot 1 一律留空由使用者自行選擇。
 * ========================================================================== */
(function () {
  'use strict';

  // ── 本人身分（用來鎖定「我那一列」讀 T/O、L/D）。員編或姓名任一符合即可 ──
  const OWNER = {
    id: '2313068',
    nameTokens: ['ZIH-CHI', 'ZIHCHI', 'ZIH', 'HUNG'],
  };

  // Tesseract 資產（jsdelivr，已在 service worker CDN 快取清單；首次需連線，之後離線可用）
  const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';

  // ────────────────────────────────────────────────────────────────────────
  // 小工具
  // ────────────────────────────────────────────────────────────────────────
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('載入失敗: ' + src));
      document.head.appendChild(s);
    });
  }

  async function ensureTesseract() {
    if (window.Tesseract) return window.Tesseract;
    await loadScript(TESSERACT_URL);
    if (!window.Tesseract) throw new Error('Tesseract 未就緒');
    return window.Tesseract;
  }

  // 把來源（File / Blob / dataURL / HTMLImageElement）轉成 <img>
  function toImage(src) {
    return new Promise((resolve, reject) => {
      if (src instanceof HTMLImageElement) return resolve(src);
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('圖片解碼失敗'));
      if (src instanceof Blob) img.src = URL.createObjectURL(src);
      else img.src = src; // dataURL / URL
    });
  }

  // ────────────────────────────────────────────────────────────────────────
  // 影像前處理：回傳「OCR 用的處理後 canvas」與「取像素用的原色 canvas」（同座標系）
  // ────────────────────────────────────────────────────────────────────────
  function preprocess(img) {
    // 高解析截圖不放大；較小的放大 2× 幫助 OCR
    const scale = img.naturalWidth >= 1400 ? 1 : 2;
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);

    const orig = document.createElement('canvas');
    orig.width = w; orig.height = h;
    const octx = orig.getContext('2d', { willReadFrequently: true });
    octx.drawImage(img, 0, 0, w, h);

    const src = octx.getImageData(0, 0, w, h);
    const d = src.data;

    // 判斷底色明暗（決定是否反相）
    let sum = 0;
    for (let i = 0; i < d.length; i += 4 * 97) sum += (d[i] + d[i + 1] + d[i + 2]) / 3;
    const meanLum = sum / (d.length / (4 * 97));
    const invert = meanLum < 115; // 深色主題 → 反相成深字淺底，OCR 較準

    const proc = document.createElement('canvas');
    proc.width = w; proc.height = h;
    const pctx = proc.getContext('2d', { willReadFrequently: true });
    const out = pctx.createImageData(w, h);
    const o = out.data;
    for (let i = 0; i < d.length; i += 4) {
      let v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; // 灰階
      if (invert) v = 255 - v;
      v = (v - 90) * 2.2 + 90;                                    // 輕度對比拉伸
      v = v < 0 ? 0 : v > 255 ? 255 : v;
      o[i] = o[i + 1] = o[i + 2] = v; o[i + 3] = 255;
    }
    pctx.putImageData(out, 0, 0);
    return { proc, orig: octx, w, h, invert };
  }

  // ────────────────────────────────────────────────────────────────────────
  // OCR
  // ────────────────────────────────────────────────────────────────────────
  async function runOCR(procCanvas, onProgress) {
    const Tesseract = await ensureTesseract();
    const worker = await Tesseract.createWorker('eng', 1, {
      logger: (m) => {
        if (onProgress && m.status === 'recognizing text') onProgress(0.3 + m.progress * 0.65);
      },
    });
    try {
      const { data } = await worker.recognize(procCanvas);
      // 攤平出所有 word（含 bbox）
      const words = [];
      (data.blocks || []).forEach((b) =>
        (b.paragraphs || []).forEach((p) =>
          (p.lines || []).forEach((ln) =>
            (ln.words || []).forEach((wd) => {
              if (wd.text && wd.text.trim()) {
                words.push({
                  text: wd.text.trim(),
                  x0: wd.bbox.x0, y0: wd.bbox.y0, x1: wd.bbox.x1, y1: wd.bbox.y1,
                  cx: (wd.bbox.x0 + wd.bbox.x1) / 2, cy: (wd.bbox.y0 + wd.bbox.y1) / 2,
                });
              }
            })
          )
        )
      );
      return { text: data.text || '', words };
    } finally {
      await worker.terminate();
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // 文字解析（錨點式，不用死座標）
  // ────────────────────────────────────────────────────────────────────────
  const ICAO_BLACKLIST = new Set(['OOOI', 'DUTY', 'NAME', 'TIME', 'REST', 'FLT', 'BLK', 'DAY', 'PAGE', 'INFO', 'PROF']);
  const norm = (s) => (s || '').toUpperCase().replace(/[^A-Z0-9:./-]/g, '');

  function parseText(text, words) {
    const result = { fields: {}, notes: [] };
    const T = text.toUpperCase();

    // 航班號：JX + 3~4 碼
    let m = T.match(/\bJX\s*0*(\d{3,4})\b/);
    if (m) result.fields.flt = m[1];

    // 機號：B + 5 碼 → B-58306
    m = T.match(/\bB\s*-?\s*(\d{5})\b/);
    if (m) result.fields.reg = 'B-' + m[1];

    // 機型：A3xx / B7xx
    m = T.match(/\b(A3\d{2}|B7\d{2}|A2\d{2})\b/);
    if (m) result.fields.type = m[1];

    // 日期：dd-mm-yyyy（OFP OOOI 格式）→ yyyy-mm-dd
    m = T.match(/\b(\d{2})-(\d{2})-(\d{4})\b/);
    if (m) result.fields.date = `${m[3]}-${m[2]}-${m[1]}`;

    // OOOI 時間：找 OUT/OFF/ON/IN 標籤，取同列右方最近的 HH:MM
    const timeWords = words.filter((w) => /^\d{1,2}:\d{2}$/.test(norm(w.text)));
    const labelMap = { OUT: 'out', OFF: 'off', ON: 'on', IN: 'in' };
    for (const w of words) {
      const t = norm(w.text).replace(/\*+$/, '');
      if (labelMap[t]) {
        const band = Math.max(18, (w.y1 - w.y0) * 1.2);
        const cand = timeWords
          .filter((tw) => Math.abs(tw.cy - w.cy) < band && tw.x0 > w.x0)
          .sort((a, b) => a.x0 - b.x0)[0];
        if (cand) {
          const hhmm = norm(cand.text);
          const [hh, mm] = hhmm.split(':');
          result.fields[labelMap[t]] = hh.padStart(2, '0') + ':' + mm;
        }
      }
    }

    // 航路：取「最上方」兩個像 ICAO 的 4 碼字母（排除表頭字），依 x 排序 → dep, arr
    const icao = words
      .map((w) => ({ code: norm(w.text), x: w.cx, y: w.cy }))
      .filter((o) => /^[A-Z]{4}$/.test(o.code) && !ICAO_BLACKLIST.has(o.code) && /^[RVKPZWEULNYFSMOAGDBC]/.test(o.code));
    if (icao.length >= 2) {
      const minY = Math.min(...icao.map((o) => o.y));
      const top = icao.filter((o) => o.y < minY + 60).sort((a, b) => a.x - b.x);
      const pair = top.length >= 2 ? top : icao.slice(0, 2);
      if (pair[0]) result.fields.dep = pair[0].code;
      if (pair[1] && pair[1].code !== pair[0].code) result.fields.arr = pair[1].code;
    }

    // FLT / BLK 參考時間（用來交叉驗算），例如 "2h 24m"
    m = T.match(/FLT\s*TIME\s*(\d{1,2})\s*H\s*(\d{1,2})\s*M/);
    if (m) result.fields.ref_air = pad2(m[1]) + ':' + pad2(m[2]);
    m = T.match(/BLK\s*TIME\s*(\d{1,2})\s*H\s*(\d{1,2})\s*M/);
    if (m) result.fields.ref_block = pad2(m[1]) + ':' + pad2(m[2]);

    return result;
  }

  const pad2 = (n) => String(n).padStart(2, '0');

  // ────────────────────────────────────────────────────────────────────────
  // 圓圈判讀：定位「我那一列」與 PF/PM/T/O/L/D 欄位 X，取原圖像素相對亮度
  // ────────────────────────────────────────────────────────────────────────
  function detectRadios(words, origCtx, w, h) {
    const res = { to: null, ld: null, confident: false, note: '' };

    // 1) 找「我那一列」的 Y（員編優先，姓名次之）
    let rowWord = words.find((wd) => norm(wd.text).includes(OWNER.id));
    if (!rowWord) {
      rowWord = words.find((wd) => OWNER.nameTokens.some((t) => norm(wd.text).includes(t)));
    }
    if (!rowWord) { res.note = '找不到你的機組列（員編/姓名），起降請自行勾選'; return res; }
    const rowY = rowWord.cy;

    // 2) 找欄位表頭 X（PF / PM / T/O / L/D）；抓不到就用 PF、PM 間距外推
    const headerY = findHeaderY(words, rowY);
    const colX = {};
    for (const wd of words) {
      if (headerY !== null && Math.abs(wd.cy - headerY) > 40) continue;
      const t = norm(wd.text).replace(/\*+$/, '');
      if ((t === 'PF' || t === 'PE') && colX.pf == null) colX.pf = wd.cx;
      else if (t === 'PM' && colX.pm == null) colX.pm = wd.cx;
      else if ((t === 'T/O' || t === 'TO' || t === 'T/0' || t === 'VO') && colX.to == null) colX.to = wd.cx;
      else if ((t === 'L/D' || t === 'LD' || t === 'L/0' || t === 'LO') && colX.ld == null) colX.ld = wd.cx;
    }
    // 外推補齊（欄位大致等距）
    if (colX.pf != null && colX.pm != null) {
      const gap = colX.pm - colX.pf;
      if (colX.to == null) colX.to = colX.pm + gap;
      if (colX.ld == null) colX.ld = colX.pm + 2 * gap;
    }
    if (colX.to == null || colX.ld == null) { res.note = '找不到 T/O、L/D 欄位，起降請自行勾選'; return res; }

    // 3) 在原圖對 PF/PM/T/O/L/D 中心取像素亮度
    const lum = {};
    for (const k of ['pf', 'pm', 'to', 'ld']) {
      if (colX[k] != null) lum[k] = sampleLum(origCtx, Math.round(colX[k]), Math.round(rowY), w, h);
    }
    const vals = Object.values(lum);
    if (vals.length < 2) { res.note = '圓圈取樣不足，起降請自行勾選'; return res; }
    const maxL = Math.max(...vals), minL = Math.min(...vals);
    const spread = maxL - minL;

    // 同列一定「至少一個被選(PF或PM)、至少一個未選」→ 用相對門檻分類
    if (spread < 22) {
      res.note = '無法可靠判讀圓圈（對比不足），起降請自行勾選';
      return res;
    }
    const thr = (maxL + minL) / 2;
    res.to = lum.to != null ? lum.to > thr : null;
    res.ld = lum.ld != null ? lum.ld > thr : null;
    res.confident = spread >= 35; // 對比夠大才視為高信心
    return res;
  }

  function findHeaderY(words, rowY) {
    // 表頭應在「我那一列」上方，含 ID / NAME / CM 之一
    let best = null;
    for (const wd of words) {
      const t = norm(wd.text).replace(/\*+$/, '');
      if ((t === 'ID' || t === 'NAME' || t === 'CM') && wd.cy < rowY) {
        if (best === null || wd.cy > best) best = wd.cy; // 取最接近該列上方者
      }
    }
    return best;
  }

  function sampleLum(ctx, cx, cy, w, h) {
    const r = 9;
    const x0 = Math.max(0, cx - r), y0 = Math.max(0, cy - r);
    const sw = Math.min(w - x0, r * 2), sh = Math.min(h - y0, r * 2);
    if (sw <= 0 || sh <= 0) return 0;
    const dd = ctx.getImageData(x0, y0, sw, sh).data;
    let s = 0, n = 0;
    for (let i = 0; i < dd.length; i += 4) {
      // 亮度（實心藍點較亮；空心暗底較暗）
      s += 0.299 * dd[i] + 0.587 * dd[i + 1] + 0.114 * dd[i + 2];
      n++;
    }
    return n ? s / n : 0;
  }

  // ────────────────────────────────────────────────────────────────────────
  // 主流程
  // ────────────────────────────────────────────────────────────────────────
  async function extract(src, onProgress) {
    onProgress && onProgress(0.05);
    const img = await toImage(src);
    const { proc, orig, w, h } = preprocess(img);
    onProgress && onProgress(0.15);
    const { text, words } = await runOCR(proc, onProgress);
    onProgress && onProgress(0.97);
    const parsed = parseText(text, words);
    const radios = detectRadios(words, orig, w, h);
    parsed.fields.chk_to = radios.to;
    parsed.fields.chk_ld = radios.ld;
    parsed.radioConfident = radios.confident;
    if (radios.note) parsed.notes.push(radios.note);
    parsed.rawText = text;
    onProgress && onProgress(1);
    return parsed;
  }

  window.OFPImport = { extract, OWNER, _parseText: parseText, _detectRadios: detectRadios };
})();
