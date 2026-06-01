# LIDO Worker

取代原本的 Google Apps Script 端點,代理 LIDO 飛行計畫擷取。

## 安全設計

- **使用者帳密**: 由前端隨請求送來,Worker 用一次就丟,不寫 log、不快取、不存
- **STARLUX 識別字串**: URL / customer ID / auth realm / DWR session ID 全部走 Cloudflare secrets,**不在 git 裡**
- **CORS allowlist**: 只接受來自 `https://zihchi.github.io` 的請求

## 部署步驟

### 1. 安裝 wrangler 並登入

```bash
npm install -g wrangler
wrangler login   # 會開瀏覽器跳 Cloudflare 授權
```

### 2. 設定 4 個 secret

每條指令會等你輸入一個值。**值請從原本的 GAS 程式碼複製**(或從你存在他處的備忘錄),不要傳到任何聊天/郵件:

```bash
cd worker-lido

wrangler secret put LIDO_BASE_URL
# 輸入: https://sjx.lido.aero

wrangler secret put LIDO_CUSTOMER_ID
# 輸入: <你的 LIDO customer id,例如 LSY>

wrangler secret put LIDO_AUTH_REALM
# 輸入: <你的 LIDO auth realm,例如 LAS>

wrangler secret put LIDO_DWR_SESSION_ID
# 輸入: <你的 DWR scriptSessionId 那一長串字串>
```

### 3. 部署

```bash
wrangler deploy
```

完成後會印出 URL,類似:
```
Published lido.<你的帳號>.workers.dev
```
這個 URL 已經寫死在 `LIDOPRO4.html`(假設為 `https://lido.zihchi.workers.dev`)。如果你的帳號名不同,要對應修改該檔案。

## 操作小抄

```bash
# 修改某個 secret (重新輸入即覆蓋)
wrangler secret put LIDO_BASE_URL

# 看 worker 即時 log
wrangler tail

# 在本地跑 (需要 .dev.vars 檔放 secrets,該檔已被 .gitignore)
wrangler dev

# 列出已設定的 secrets
wrangler secret list

# 刪掉某個 secret
wrangler secret delete LIDO_BASE_URL
```

## 本地開發 (選用)

如果你要在本地 `wrangler dev` 測試,在 `worker-lido/` 建一個 `.dev.vars`:

```
LIDO_BASE_URL=https://sjx.lido.aero
LIDO_CUSTOMER_ID=...
LIDO_AUTH_REALM=...
LIDO_DWR_SESSION_ID=...
```

⚠️ `.dev.vars` 已在 `.gitignore`,**不會** commit。確認指令: `git status` 應該看不到它。

## 與舊 GAS 行為對照

| GAS doPost() 流程 | Worker 對應 |
|---|---|
| `UrlFetchApp.fetch(initialUrl)` 拿初始 cookie | 同 |
| DWR `LoginBean.login` POST | 同,payload 一字不差 |
| flightlist API (now ±24h) | 同 |
| 重複班號取最接近 `now` 的那班 | 同 |
| 平行下載 OFP/ATS/NOTAM/CREWINFO/RAIM/VERTPROF/SIGWXROUTE | `Promise.all` 替代 `fetchAll` |
| SIGWXROUTE 允許多圖,以 `_index` 區隔 key | 同 |
| 影像 base64 編碼 | 內建 `btoa` + chunked 編碼 |
| 回傳 `{status, data}` JSON | 同 |
