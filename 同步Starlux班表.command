#!/bin/bash
# 一鍵同步：自動登入抓班表 → 寫進 Google 日曆 → 拆成 Flighty 可辨識事件
cd "$(dirname "$0")"
echo "▶ 同步班表…"
.venv/bin/python sync_once.py

echo ""
echo "▶ 產生 Flighty 航班事件…"
.venv/bin/python sync_flighty.py

echo ""
read -p "完成。按 Enter 關閉視窗" _
