#!/bin/bash
# ✈️ ELB Proxy Server 一鍵啟動腳本
# 使用方式：雙擊此檔案，或在終端機執行 bash start.sh

cd "$(dirname "$0")"

PYTHON=/usr/bin/python3

# 確認 Flask 和 Playwright 已安裝
$PYTHON -c "import flask, playwright" 2>/dev/null
if [ $? -ne 0 ]; then
  echo "⚙️  首次執行，安裝必要套件..."
  $PYTHON -m pip install flask playwright --user --quiet
  $PYTHON -m playwright install chromium
fi

echo ""
echo "✈️  ELB Proxy Server 啟動中..."
$PYTHON server.py
