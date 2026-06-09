# 🌦️ METAR / TAF Proxy — Cloudflare Worker

讓 `https://zihchi.github.io/briefing-package/` 取得 METAR/TAF 時，
不必再依賴免費公用代理（corsproxy.io / codetabs / allorigins，常慢、不穩、回舊資料），
改走你自己的 Cloudflare Worker → **aviationweather.gov（NOAA 官方）**，又快又新鮮。

## 部署（跟 ELB / LIDO worker 一樣）
1. 到 Cloudflare，連到這個 GitHub repo，新增一個 Worker 專案、root 指向 `worker-metar/`
   （或本機：`cd worker-metar && wrangler deploy`）
2. 部署完會得到網址：`https://metar.<你的帳號>.workers.dev`
3. **把這串網址貼給 Claude**，由它接到 `app.js`（並列入 service-worker 的不快取白名單）

## 端點
| 用途 | 範例 |
|------|------|
| 即時 METAR | `GET /?type=metar&ids=RCTP,RCSS` |
| TAF | `GET /?type=taf&ids=RCTP` |
| 過去 N 小時 METAR | `GET /?type=metar&ids=RCTP&hours=24` |

回傳 JSON，CORS 只開放 `https://zihchi.github.io`（與本機開發網址）。
邊緣快取 `EDGE_TTL = 60` 秒（夠新鮮又快；要更即時可在 `worker.js` 改成 0）。
