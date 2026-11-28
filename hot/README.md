# Holdovertime

FAA Holdover Time (HOT) 計算器 — 資料版本：**FAA Holdover Time Guidelines, Winter 2026-2027 (Original Issue, August 11, 2026)**。

- `index.html`：網頁介面與計算邏輯
- `data/hot-2026-27.js`：由 FAA PDF 解析產生的資料（Table 1、2、3、20–52、55、56、57）
- `js/metar.js`：METAR 解析（溫度、盛行能見度、天氣現象 → 降水類型、日/夜判定）
- `images/2026-27/`：FAA 原始表格頁面圖片（依 Table 編號命名）

涵蓋：
- SAE Type I（Aluminum / Composite，Table 2 / 3）
- SAE Type IV Generic（Table 20）及全部 32 種 fluid-specific Type IV（Table 21–52）
- Active Frost（Table 1）、Allowance Times（Table 53 驗證狀態、Table 55 EG / Table 56 PG）、降雪強度（Table 57）

METAR 來源：`briefing-package.zihchi.workers.dev/api/wx`（與 briefing package 相同的 Worker，合併 NOAA tgftp 與 AWC 取較新報文），失敗時改用 VATSIM。取得 METAR 後自動帶入溫度、盛行能見度（不使用 RVR）、日/夜（依機場日出日落）與降水類型。

未包含：Type II、Type III，以及 Appendix A（flaps/slats 預先放下的 Adjusted HOT）。
