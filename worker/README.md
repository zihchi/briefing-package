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

所有需要登入的請求要帶 `X-Session-Token: <session>` header。

## 改 worker 後重新部署

```bash
cd ~/briefing-package/worker
wrangler deploy
```

URL 不變，幾秒鐘就好。
