#!/usr/bin/env bash
# 重新編譯 logbook 的本地 Tailwind CSS。
#
# 什麼時候要跑：只要你在 Captain_Logbook_Cloud.html 新增/修改了任何 Tailwind
# utility class（例如新的 flex / p-4 / w-8 之類），就必須重跑此腳本，
# 讓 ../logbook.tailwind.css 產生對應樣式，否則離線時該新元素會沒有樣式。
#
# 需求：Node.js（會用 npx 自動下載 tailwindcss@3）。
# 跑完記得把 service-worker.js 的 CACHE_NAME 版本號 +1，讓裝置重新快取。
set -euo pipefail
cd "$(dirname "$0")"

TMP_IN="$(mktemp -t twin.XXXX.css)"
printf '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n' > "$TMP_IN"

npx -y tailwindcss@3.4.19 \
  -c ./tailwind.logbook.config.js \
  -i "$TMP_IN" \
  -o ../logbook.tailwind.css \
  --minify

rm -f "$TMP_IN"
echo "✅ 已更新 ../logbook.tailwind.css　（別忘了 bump service-worker.js 的 CACHE_NAME）"
