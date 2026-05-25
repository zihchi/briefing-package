# chartcache

GitHub Actions 每 6 小時自動產生的湍流圖 PNG。

- 檔名格式：`{flightNo}-{YYYY-MM-DD}.png`，例如 `805-2026-05-25.png`
- 範圍：所有航班 × 今天、明天
- 過期圖會自動刪除（不是今天/明天的就清掉）

請勿手動編輯此資料夾，會在下次 workflow 跑時被覆蓋。
