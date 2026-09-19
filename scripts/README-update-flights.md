# 更新「選擇航班」清單(flightGroups)

網頁上方「選擇航班」下拉,以及亂流圖的航班選單,都吃 `app.js` 裡的 `flightGroups` 陣列。
這支腳本會用 **TDX 國際線定期時刻表**自動產生該清單,免手動維護。

## 一次性準備:取得 TDX API 金鑰(免費)

1. 到 <https://tdx.transportdata.tw> 註冊會員。
2. 會員中心 → 取得 **client_id** 與 **client_secret**。

## 每次班表有變動時(通常一季一次)

在專案根目錄執行(把 xxx / yyy 換成你的金鑰):

```bash
# 先預覽會產生什麼,不改檔
TDX_CLIENT_ID=xxx TDX_CLIENT_SECRET=yyy node scripts/update-flights.mjs --dry-run

# 確認沒問題後,實際寫回 app.js
TDX_CLIENT_ID=xxx TDX_CLIENT_SECRET=yyy node scripts/update-flights.mjs
```

腳本會:
- 抓星宇(AirlineID=JX)所有「今天仍在有效期內」的國際定期航班。
- 依「非 TPE 那一端的機場」分區(東北亞/港澳/東南亞/北美/歐洲…)。
- 覆蓋 `app.js` 中兩個標記之間的 `flightGroups` 區塊:
  `// >>> FLIGHTGROUPS AUTO-GENERATED … // <<< FLIGHTGROUPS AUTO-GENERATED`

跑完自行檢查 → `git commit` → `git push`,GitHub Pages 會自動上線。

## 分區調整

若出現新航點被歸到「其他航線」(腳本會提示數量),打開 `scripts/update-flights.mjs`,
在 `REGION_OF_AIRPORT` 補上該機場 IATA → 區域名稱即可。分區名稱與順序也在同一處(`REGION_ORDER`)調整。

## 備註

- 需要 Node 18 以上(內建 fetch)。
- 這支腳本只更新 `app.js` 的 `flightGroups`。`pa.html` 內另有一份獨立的班號→航點對照表
  (`OUT`/`IN`),PA 廣播工具用,目前需另外手動維護;若要一併自動化再告知。
- 金鑰只在你本機當環境變數使用,不會寫進程式或 git。
