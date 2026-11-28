/*
 * METAR parser + mapping to FAA HOT inputs (Winter 2026-2027 guidelines).
 * Works in the browser (window.MetarHOT) and in Node (module.exports) for testing.
 *
 * Only the main body of the METAR is used: everything from RMK or a trend group
 * (TEMPO / BECMG / NOSIG / PROBxx) onward is ignored, as are runway groups (Rxx/...,
 * i.e. RVR and runway state), recent weather (RExx) and vicinity weather (VCxx).
 */
(function (root) {
    'use strict';

    const CUT_TOKENS = /^(RMK|TEMPO|BECMG|NOSIG|PROB\d{2}|FM\d{6}|TL\d{4}|AT\d{4})$/;
    const DESCRIPTORS = ['MI', 'PR', 'BC', 'DR', 'BL', 'SH', 'TS', 'FZ'];
    const PHENOMENA = ['DZ', 'RA', 'SN', 'SG', 'IC', 'PL', 'GR', 'GS', 'UP', 'BR', 'FG', 'FU', 'VA', 'DU', 'SA', 'HZ', 'PY', 'PO', 'SQ', 'FC', 'SS', 'DS'];

    // Present-weather group, e.g. "-FZRAPLSN", "+SHSN", "PLFZRA", "FZFG". FZ is attached to the
    // phenomenon that follows it (FZRA / FZDZ / FZFG) wherever it appears in the group.
    function parseWx(t) {
        const m = t.match(/^(\+|-)?([A-Z]+)$/);
        if (!m || m[2].length % 2) return null;
        const codes = m[2].match(/../g);
        const descriptors = [], phen = [];
        let fz = false;
        for (const c of codes) {
            if (c === 'FZ') { fz = true; descriptors.push(c); continue; }
            if (DESCRIPTORS.includes(c)) { descriptors.push(c); continue; }
            if (!PHENOMENA.includes(c)) return null;
            if (fz && ['RA', 'DZ', 'FG'].includes(c)) { phen.push('FZ' + c); fz = false; }
            else phen.push(c);
        }
        if (!phen.length) return null;
        return { raw: t, intensity: m[1] === '-' ? 'light' : m[1] === '+' ? 'heavy' : 'moderate', descriptors, phen };
    }

    // Table 57 visibility row upper limits (index 0..9; index 10 = above the last limit)
    const VIS_LIMITS_M = [600, 1000, 1400, 1800, 2200, 2600, 3000, 3600, 4400, 5200];
    const VIS_LIMITS_SM = [3 / 8, 5 / 8, 7 / 8, 9 / 8, 11 / 8, 13 / 8, 15 / 8, 9 / 4, 11 / 4, 13 / 4];

    function visIndex(value, unit) {
        const lim = unit === 'sm' ? VIS_LIMITS_SM : VIS_LIMITS_M;
        for (let i = 0; i < lim.length; i++) if (value <= lim[i] + 1e-9) return i;
        return 10;
    }

    function bodyTokens(raw) {
        let toks = String(raw || '').replace(/=+\s*$/, '').trim().split(/\s+/).filter(Boolean);
        if (toks[0] === 'METAR' || toks[0] === 'SPECI') toks = toks.slice(1);
        const cut = toks.findIndex(t => CUT_TOKENS.test(t));
        return cut >= 0 ? toks.slice(0, cut) : toks;
    }

    function obsDate(ddhhmm, now) {
        const dd = +ddhhmm.slice(0, 2), hh = +ddhhmm.slice(2, 4), mi = +ddhhmm.slice(4, 6);
        now = now || new Date();
        let y = now.getUTCFullYear(), mo = now.getUTCMonth();
        if (dd > now.getUTCDate() + 1) { mo -= 1; if (mo < 0) { mo = 11; y -= 1; } }
        return new Date(Date.UTC(y, mo, dd, hh, mi));
    }

    function parse(raw, now) {
        const toks = bodyTokens(raw);
        const out = { station: null, time: null, auto: false, tempC: null, vis: null, wx: [], cavok: false };
        let i = 0;
        if (toks[i] && /^[A-Z][A-Z0-9]{3}$/.test(toks[i])) out.station = toks[i++];
        if (toks[i] && /^\d{6}Z$/.test(toks[i])) { out.time = obsDate(toks[i], now); i++; }

        let visDone = false;
        for (; i < toks.length; i++) {
            const t = toks[i];
            if (t === 'AUTO') { out.auto = true; continue; }
            if (/^(COR|CC[A-Z]|NIL)$/.test(t)) continue;
            if (/^(\d{3}|VRB|\/{3})(\d{2,3}|\/\/)(G\d{2,3})?(KT|MPS|KMH)$/.test(t)) continue;  // wind
            if (/^\d{3}V\d{3}$/.test(t)) continue;                                              // variable wind
            if (/^R\d{2}/.test(t)) continue;                                                     // RVR / runway state – never visibility
            if (/^RE/.test(t)) continue;                                                         // recent weather
            if (/^VC/.test(t)) continue;                                                         // vicinity weather

            const tm = t.match(/^(M?\d{2})\/(M?\d{2}|\/\/)?$/);
            if (tm) {
                const v = parseInt(tm[1].replace('M', ''), 10);
                out.tempC = tm[1].startsWith('M') ? -v : v;
                if (out.tempC === 0) out.tempC = 0;   // normalise -0
                continue;
            }

            if (!visDone) {
                if (t === 'CAVOK') { out.cavok = true; out.vis = { value: 10000, unit: 'm', text: 'CAVOK' }; visDone = true; continue; }
                let m = t.match(/^(\d{4})(NDV)?$/);
                if (m) { out.vis = { value: +m[1], unit: 'm', text: t }; visDone = true; continue; }
                // Statute miles: "10SM", "1/2SM", "M1/4SM", "P6SM", or "1 1/2SM" (two tokens)
                m = t.match(/^([MP])?(\d+)(?:\/(\d+))?SM$/);
                if (m) {
                    let v = m[3] ? (+m[2] / +m[3]) : +m[2];
                    let text = t;
                    if (m[3] && i > 0 && /^\d$/.test(toks[i - 1])) { v += +toks[i - 1]; text = toks[i - 1] + ' ' + t; }
                    if (m[1] === 'M') v -= 0.01;   // less than
                    out.vis = { value: v, unit: 'sm', text }; visDone = true; continue;
                }
                if (/^\d$/.test(t) && toks[i + 1] && /^\d\/\d+SM$/.test(toks[i + 1])) continue; // whole part of "1 1/2SM"
                m = t.match(/^(\d+)KM$/);
                if (m) { out.vis = { value: +m[1] * 1000, unit: 'm', text: t }; visDone = true; continue; }
            }

            const w = parseWx(t);
            if (w) out.wx.push(w);
        }
        if (out.vis) out.vis.index = visIndex(out.vis.value, out.vis.unit);
        return out;
    }

    /*
     * Map parsed weather to the calculator's precipitation selection.
     * Returns { precip, allowance, reason, warnings[] }.
     * precip === '' means "no automatic selection – choose manually" (reason explains why).
     */
    function mapPrecip(p) {
        const warnings = [];
        // Blowing / drifting snow (BLSN, DRSN …) is not precipitation
        const precipGroups = p.wx.filter(g => !(g.descriptors.includes('BL') || g.descriptors.includes('DR')) || g.phen.some(x => !['SN', 'SA', 'DU'].includes(x)));
        const has = ph => precipGroups.some(g => g.phen.includes(ph));
        const grp = ph => precipGroups.find(g => g.phen.includes(ph));
        const codes = precipGroups.map(g => g.raw).join(' ');
        const res = (precip, reason, extra) => Object.assign({ precip, allowance: '', reason, warnings }, extra || {});

        if (!precipGroups.length) return res('', 'METAR 未報告降水或凍霧（No precipitation / freezing fog reported）。若有結霜請手動選擇 Active Frost。');

        if (has('GR')) return res('other', `${codes}：冰雹 (Hail) → Other，無防護時間（No HOT for hail）。`);
        if (has('GS')) return res('', `${codes}：GS 可能是雪丸或小冰雹，各國回報方式不同，請手動判斷（GS may be snow pellets or small hail; reporting varies by country）。`);
        if (has('UP')) return res('', `${codes}：未知降水 (UP)，請手動選擇（Unknown precipitation）。`);

        // ---- Ice pellets → Allowance Times (Tables 55 / 56) ----
        if (has('PL')) {
            const plg = grp('PL');
            const comp = new Set();
            const compIntensities = new Set();
            precipGroups.forEach(g => g.phen.forEach(ph => {
                const k = (ph === 'SN' || ph === 'SG') ? 'SN' : ['DZ', 'FZDZ', 'RA', 'FZRA'].includes(ph) ? ph : null;
                if (k) { comp.add(k); if (g !== plg) compIntensities.add(g.intensity); }
            }));
            if (plg.intensity === 'heavy' || compIntensities.has('heavy')) {
                return res('other', `${codes}：重度冰珠或重度伴隨降水 → 無寬限時間（Heavy ice pellets / heavy mixed precipitation: no allowance times）。`);
            }
            const key = [...comp].sort().join('+');
            const light = { '': 'pl', 'SN': 'pl_sn', 'FZDZ': 'pl_fzdz', 'DZ': 'pl_dz', 'FZRA': 'pl_fzra', 'RA': 'pl_ra', 'FZRA+SN': 'pl_fzra_sn', 'RA+SN': 'pl_ra_sn' };
            const mod = { '': 'mod_pl', 'SN': 'mod_pl_sn', 'FZDZ': 'mod_pl_fzdz', 'DZ': 'mod_pl_dz', 'RA': 'mod_pl_ra' };
            const level = plg.intensity === 'light' ? 'light' : 'moderate';
            // separate groups reported with a different intensity (e.g. "-PL SN") are not listed in Tables 55/56
            const mixedIntensity = [...compIntensities].some(x => x !== plg.intensity);
            const row = (level === 'light' ? light : mod)[key];
            if (!row || mixedIntensity) {
                return res('', `${codes}：此冰珠組合在 Table 55/56 中沒有直接對應項目，請手動判斷（No matching allowance-time row for this combination）。`);
            }
            return res('allowance_pl', `${codes} → ${level === 'light' ? 'Light' : 'Moderate'} Ice Pellets${key ? ' + ' + key : ''}（Allowance Times）`, { allowance: row });
        }

        // ---- Freezing rain / drizzle ----
        const fzra = grp('FZRA'), fzdz = grp('FZDZ');
        const snow = has('SN') || has('SG');
        if (fzra) {
            if (fzra.intensity !== 'light') return res('other', `${codes}：中度/重度凍雨 → Other，無防護時間（Moderate/heavy freezing rain: no HOT）。`);
            if (snow) return res('', `${codes}：輕凍雨混合雪在 HOT 表中沒有直接對應，請手動判斷（Light freezing rain mixed with snow: no direct HOT column）。`);
            if (fzdz) warnings.push('同時有凍毛毛雨與輕凍雨，採用輕凍雨（Both FZDZ and -FZRA reported: light freezing rain used）。');
            return res('light_fz_rain', `${codes} → Light Freezing Rain`);
        }
        if (fzdz) {
            if (snow) return res('', `${codes}：凍毛毛雨混合雪在 HOT 表中沒有直接對應，請手動判斷（Freezing drizzle mixed with snow: no direct HOT column）。`);
            return res('fz_drizzle', `${codes} → Freezing Drizzle`);
        }

        // ---- Snow ----
        if (snow) {
            const sg = grp('SN') || grp('SG');
            if (sg.intensity === 'heavy') warnings.push('METAR 報告大雪 (+SN)；FAA 規定以 Table 57 能見度判定降雪強度（Use Table 57 to determine snowfall intensity）。');
            if (has('RA') || has('DZ')) return res('mod_snow_mix_rain', `${codes} → Snow mixed with Rain / Drizzle（強度依 Table 57）`);
            if (has('FZFG')) return res('snow_mix_fz_fog', `${codes} → Snow mixed with Freezing Fog（強度依 Table 57）`);
            return res('snow', `${codes} → Snow / Snow Grains（強度依 Table 57）`);
        }

        // ---- Freezing fog / ice crystals / mist ----
        if (has('FZFG') || has('IC')) return res('fz_fog', `${codes} → Freezing Fog / Ice Crystals`);
        if (has('BR') && p.tempC !== null && p.tempC <= 0) {
            warnings.push('METAR 不會報告凍霧 (Freezing mist)；0 °C 以下有霧 (BR) 時可能發生，須以實際觀測確認（Freezing mist is never reported by METAR; confirm by observation）。');
            return res('fz_fog', `${codes}（BR，OAT ≤ 0 °C）→ 可能為 Freezing Mist，請確認`);
        }

        // ---- Liquid rain / drizzle ----
        if (has('RA') || has('DZ')) {
            return res('', `${codes}：降雨/毛毛雨（非凍結）。若有冷浸機翼請手動選擇 Rain on Cold-Soaked Wing（Rain/drizzle: select Rain on Cold-Soaked Wing manually if applicable）。`);
        }
        return res('', `${codes}：無對應的 HOT 降水類型（No HOT precipitation type）。`);
    }

    // Solar elevation (degrees) – NOAA simplified algorithm, accurate to ~0.1°
    function sunElevation(date, lat, lon) {
        const rad = Math.PI / 180;
        const jd = date.getTime() / 86400000 + 2440587.5;
        const T = (jd - 2451545) / 36525;
        const L0 = (280.46646 + T * (36000.76983 + 0.0003032 * T)) % 360;
        const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
        const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
        const C = Math.sin(M * rad) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(2 * M * rad) * (0.019993 - 0.000101 * T) + Math.sin(3 * M * rad) * 0.000289;
        const trueLong = L0 + C;
        const omega = 125.04 - 1934.136 * T;
        const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(omega * rad);
        const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
        const eps = eps0 + 0.00256 * Math.cos(omega * rad);
        const decl = Math.asin(Math.sin(eps * rad) * Math.sin(lambda * rad));
        const y = Math.tan(eps * rad / 2) ** 2;
        const eqTime = 4 / rad * (y * Math.sin(2 * L0 * rad) - 2 * e * Math.sin(M * rad) + 4 * e * y * Math.sin(M * rad) * Math.cos(2 * L0 * rad) - 0.5 * y * y * Math.sin(4 * L0 * rad) - 1.25 * e * e * Math.sin(2 * M * rad));
        const minutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
        let tst = (minutes + eqTime + 4 * lon) % 1440;
        if (tst < 0) tst += 1440;
        let ha = tst / 4 - 180;
        const cosZen = Math.sin(lat * rad) * Math.sin(decl) + Math.cos(lat * rad) * Math.cos(decl) * Math.cos(ha * rad);
        return 90 - Math.acos(Math.max(-1, Math.min(1, cosZen))) / rad;
    }

    const api = { parse, mapPrecip, visIndex, sunElevation };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.MetarHOT = api;
})(typeof window !== 'undefined' ? window : this);
