# 更新「選擇航班」清單(全自動)

網頁上方「選擇航班」下拉、亂流圖選單(`app.js` 的 `flightGroups`),以及 PA 廣播工具的
班號→航線(`pa.html` 的 `ROUTES`),都由這支腳本依 **TDX 國際線定期時刻表**自動產生。

現在**已設定成每週自動更新**(GitHub Actions),班表有變動才會自動提交、上線。
你平常**什麼都不用做**。以下只有「一次性設定」需要你動手一次。

---

## 一次性設定(只需做一次,之後全自動)

### 1. 取得 TDX API 金鑰(免費)
1. 到 <https://tdx.transportdata.tw> 註冊會員。
2. 會員中心 → 取得 **client_id** 與 **client_secret**。

### 2. 把金鑰加到 GitHub(當作 repo secrets)
1. 打開這個 repo 的網頁 → **Settings**(設定)。
2. 左側 **Secrets and variables** → **Actions**。
3. 按 **New repository secret**,新增兩個:
   - Name: `TDX_CLIENT_ID`,Secret: 你的 client_id
   - Name: `TDX_CLIENT_SECRET`,Secret: 你的 client_secret

設好之後就完成了。系統每週一會自動檢查 TDX 班表,有變動就自動更新網站。

### 想立刻跑一次(不等排程)
到 repo 的 **Actions** 分頁 → 左側點 **Update Flight List (TDX)** → 右邊 **Run workflow**。

---

## 手動在電腦跑(進階/備用)

若你想在自己電腦跑(需 Node 18+):

```bash
# 預覽,不改檔
TDX_CLIENT_ID=你的id TDX_CLIENT_SECRET=你的secret node scripts/update-flights.mjs --dry-run

# 實際寫回並自動 bump service worker 版本
TDX_CLIENT_ID=你的id TDX_CLIENT_SECRET=你的secret node scripts/update-flights.mjs
```

跑完 `git commit` / `git push` 即可。

---

## 它會做什麼

- 抓星宇(AirlineID=JX)所有「未過期」的國際定期航班。
- 依「非台灣端機場」分區(東北亞/港澳/東南亞/北美/歐洲…),支援台中(RMQ)出發航線。
- 覆蓋 `app.js` 的 `flightGroups` 與 `pa.html` 的 `ROUTES`(各自標記之間),
  並把 `service-worker.js` 版本號 +1。**只有在班表真的有變動時才會動檔**。

## 調整分區 / 排除航班

打開 `scripts/update-flights.mjs` 最上方:
- `REGION_OF_AIRPORT` / `REGION_ORDER`:分區對應與順序。新航點若落到「其他航線」,在這裡補上。
- `EXCLUDE_OUTSTATIONS`:排除清單(目前含 `AUH` 共掛)。
- 若腳本提示「pa.html 的 AP 缺某機場」,到 `pa.html` 的 `var AP` 補上該機場的中文名與時區,
  PA 工具才算得出當地時間。

## 備註

- 金鑰只存在 GitHub Secrets / 你本機環境變數,**不會寫進程式或 git**。
- 自動排程用 GitHub 內建的 `GITHUB_TOKEN` 推回 main,不需額外設定。
