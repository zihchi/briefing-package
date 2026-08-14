# ELB Proxy Worker

讓 `https://zihchi.github.io/briefing-package/ELB_Fleet.html` 不必依靠本機伺服器，直接透過 Cloudflare 雲端代理打 ELB。

## 一次性部署（約 3 分鐘）

### 1. 註冊 Cloudflare 免費帳號

到 https://dash.cloudflare.com/sign-up 註冊（用 Email 即可，不要錢、不要信用卡）。

### 2. 安裝 wrangler CLI

需要 Node.js。Mac 終端機貼：

```bash
# 如果還沒有 Node.js，先裝（建議用 nvm）
brew install node

# 裝 wrangler
npm install -g wrangler
```

### 3. 登入 + 部署

```bash
cd ~/briefing-package/worker
wrangler login        # 會跳出瀏覽器，按 Allow
wrangler deploy
```

部署成功會看到類似：

```
✨ Successfully deployed elb
Published https://elb.<你的帳號>.workers.dev
```

把那串網址（`https://elb.xxx.workers.dev`）複製。

### 4. 設定到 ELB_Fleet.html

打開 `https://zihchi.github.io/briefing-package/ELB_Fleet.html`，
第一次會問你 Worker URL，貼進去就好。瀏覽器會記住。

---

## 端點清單

| Method | Path                          | 用途 |
|--------|-------------------------------|------|
| POST   | `/api/login`                  | `{user, pass}` → `{session}` |
| GET    | `/api/status?session=`        | 檢查 session 是否還有效 |
| GET    | `/api/fleet`                  | 機隊總覽（同 GAS 版） |
| GET    | `/api/aircraft/<tail>`        | 探測多個單機 endpoint，回報哪個能用 |
| GET    | `/api/proxy?path=/elb/...`    | 萬用轉發器，給除錯用 |
| GET    | `/api/aerodatabox?flight=JX123&date=2026-06-08` | 查非桃園機場 gate/terminal（AeroDataBox） |
| POST   | `/api/lido`                   | `{username, password, targetFlight, legId?, date?}` → LIDO 航班簡報（取代舊 GAS） |
| GET    | `/api/lido-probe`             | 探針:測 Cloudflare 出口能不能連到 LIDO（只需 `LIDO_BASE_URL`） |

所有需要登入的請求要帶 `X-Session-Token: <session>` header（`/api/lido` 例外，帳密放在 body）。

---

## LIDO 航班擷取提速（把 GAS 搬到這支 worker）

LIDOPRO4 原本主航班擷取走 Google Apps Script，冷啟動 + 逐步 fetch 常要 10~20s。
現在 worker 內建 `/api/lido`(文件平行下載,通常 2~4s)。前端**先試 worker、打不通自動退回 GAS**,
所以「設好 secret 前」照樣能用,設好且連得到 LIDO 就自動提速,不會壞。

### 1. 先確認 Cloudflare 到底連不連得到 LIDO(關鍵)

舊註解曾說「LIDO 防火牆擋 Cloudflare IP」。先設一個 secret 就能一翻兩瞪眼:

```bash
cd ~/briefing-package/worker
wrangler secret put LIDO_BASE_URL      # 輸入 LIDO 網址,例如 https://sjx.lido.aero
wrangler deploy
```

瀏覽器開 `https://briefing-package.<你的帳號>.workers.dev/api/lido-probe`：
- 看到 `"reachable": true` / `verdict: Cloudflare 可到達 LIDO` → 繼續下一步,提速生效
- 看到 `"reachable": false` / 連不到 → 防火牆屬實,**維持 GAS**(前端會自動退回,不用改)

### 2. 連得到 → 補齊另外 3 個 secret

值請從舊的 GAS 程式碼複製，不要外流：

```bash
wrangler secret put LIDO_CUSTOMER_ID    # 例如 LSY
wrangler secret put LIDO_AUTH_REALM      # 例如 LAS
wrangler secret put LIDO_DWR_SESSION_ID  # 一長串 scriptSessionId
wrangler deploy
```

完成後 LIDOPRO4 擷取就走 worker(快)。`wrangler secret list` 應看到 4 個 LIDO_* secret。

> 日期選擇:LIDOPRO4 的「📅 日期 (Z)」預設今天(UTC),擷取時帶 `date` 給 worker,
> 讓航班總表窗口移到那天。此功能走 worker;若退回 GAS 則以 GAS 既有的「現在 ±24h」為準。

---

## AeroDataBox 機坪查詢（非桃園機場）設定

桃園機坪走 TDX（不用設定）。非桃園機場的 DEP/ARR BAY 由 LIDOPRO4 自動打
`/api/aerodatabox`，背後是 AeroDataBox（RapidAPI 免費額度）。API key **不寫在前端**，
而是放成 Cloudflare worker secret。一次性設定步驟：

### 1. 申請 AeroDataBox 免費 key（約 3 分鐘）

1. 到 https://rapidapi.com/aedbx-aedbx/api/aerodatabox 註冊 / 登入 RapidAPI（免費，用 Email 或 Google）。
2. 在該 API 頁面點 **Subscribe to Test** → 選 **Basic（$0 / Free）方案** 訂閱。
   - 免費方案大約每月數百次額度、每秒數次上限，搭配本工具的快取夠日常用。
3. 訂閱後，在 API 頁面右側「Header Parameters」會看到 `X-RapidAPI-Key: xxxxxxxx`，
   把那串 key 複製起來（這就是要設成 secret 的值）。

### 2. 把 key 設成 worker secret

```bash
cd ~/briefing-package/worker
wrangler secret put AERODATABOX_KEY
# 貼上剛剛複製的 X-RapidAPI-Key,按 Enter
```

### 3. 重新部署

```bash
wrangler deploy
```

完成後，LIDOPRO4 解析非桃園航班時就會自動補上機坪/航廈。
查過的航班會在瀏覽器（與 worker 端）快取，重複看不會再消耗額度。

> 註：AeroDataBox 的 gate/terminal 涵蓋率因機場而異，部分小機場可能查不到 gate
> （會維持 `--`，這是資料源本身沒有，不是錯誤）。
>
> 確認 key 已設定：`wrangler secret list` 應看到 `AERODATABOX_KEY`。

## 改 worker 後重新部署

```bash
cd ~/briefing-package/worker
wrangler deploy
```

URL 不變，幾秒鐘就好。
