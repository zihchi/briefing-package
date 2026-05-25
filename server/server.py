#!/usr/bin/env python3
"""
ELB Proxy Server  —  Starlux 機隊資料後端
使用 Playwright 在背景開啟真實 Chrome，登入 ELB 後透過 Vue API 取得資料

啟動：  python3 server.py
停止：  Ctrl+C
"""

import threading
import time
import json
import socket
from flask import Flask, jsonify, request

# ──────────────────────────────────────────────
# App & CORS
# ──────────────────────────────────────────────
app = Flask(__name__)

@app.after_request
def cors(r):
    r.headers["Access-Control-Allow-Origin"] = "*"
    r.headers["Access-Control-Allow-Headers"] = "Content-Type"
    r.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return r

@app.route("/api/<path:p>", methods=["OPTIONS"])
def options_handler(p):
    return jsonify({}), 200

# ──────────────────────────────────────────────
# Playwright 全域狀態
# ──────────────────────────────────────────────
_lock       = threading.Lock()
_pw         = None
_browser    = None
_context    = None
_page       = None
_logged_in  = False
_last_active = 0.0
SESSION_TTL = 25 * 60   # 25 分鐘無操作即視為過期

ELB_BASE = "https://elb.starlux-airlines.com"

# ──────────────────────────────────────────────
# 瀏覽器管理
# ──────────────────────────────────────────────
def _ensure_browser():
    global _pw, _browser, _context, _page, _logged_in
    from playwright.sync_api import sync_playwright
    if _pw is None:
        print("  🌐 啟動 Chromium ...")
        _pw = sync_playwright().start()
    if _browser is None or not _browser.is_connected():
        _browser = _pw.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"]
        )
        _context = None
        _logged_in = False
    if _context is None:
        _context = _browser.new_context(
            viewport={"width": 1366, "height": 768},
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
        )
        _page = None
        _logged_in = False
    if _page is None or _page.is_closed():
        _page = _context.new_page()
        _logged_in = False

def _check_vue_alive():
    """確認 Vue API 仍在線上"""
    try:
        ok = _page.evaluate("""
            () => {
                try {
                    const a = document.getElementById('app');
                    return !!(a && a.__vue__ && a.__vue__.$root && a.__vue__.$root.$api);
                } catch(e) { return false; }
            }
        """)
        return bool(ok)
    except Exception:
        return False

def _session_ok():
    global _logged_in, _last_active
    if not _logged_in:
        return False
    if time.time() - _last_active > SESSION_TTL:
        print("  ⏰ Session 超時，需重新登入")
        _logged_in = False
        return False
    return _check_vue_alive()

def _touch():
    global _last_active
    _last_active = time.time()

# ──────────────────────────────────────────────
# 登入
# ──────────────────────────────────────────────
def _do_login(username: str, password: str):
    global _logged_in, _last_active
    _ensure_browser()
    page = _page

    print(f"  🔐 登入 ELB as {username} ...")
    page.goto(ELB_BASE, wait_until="domcontentloaded", timeout=30_000)

    # 等登入表單出現（Spring Security 標準欄位）
    try:
        page.wait_for_selector(
            'input[name="j_username"]',
            timeout=15_000
        )
    except Exception:
        # 也許已登入，直接檢查 Vue
        if _check_vue_alive():
            print("  ✅ 已是登入狀態")
            _logged_in = True
            _touch()
            return
        raise RuntimeError("找不到登入表單，請確認 ELB URL 是否正確")

    page.fill('input[name="j_username"]', username)
    page.fill('input[name="j_password"]', password)

    # 按 Enter 提交（最可靠）
    page.press('input[name="j_password"]', "Enter")

    # 等 Vue $api 就緒
    try:
        page.wait_for_function(
            """
            () => {
                const a = document.getElementById('app');
                return !!(a && a.__vue__ && a.__vue__.$root && a.__vue__.$root.$api);
            }
            """,
            timeout=30_000,
        )
    except Exception:
        # 檢查是否有錯誤訊息
        err_text = ""
        for sel in ['.error', '.alert', '.login-error', '[class*="error"]', '[class*="alert"]']:
            el = page.query_selector(sel)
            if el:
                err_text = el.inner_text().strip()
                break
        if err_text:
            raise RuntimeError(f"登入失敗：{err_text}")
        raise RuntimeError("登入後未找到 Vue API，可能帳密錯誤或 ELB 介面有變更")

    print("  ✅ 登入成功，Vue API 就緒")
    _logged_in = True
    _touch()

# ──────────────────────────────────────────────
# Vue API 呼叫
# ──────────────────────────────────────────────
VUE_API = "document.getElementById('app').__vue__.$root.$api"

def _vue(js: str, timeout: int = 40_000):
    """在 ELB 頁面中執行一段 async JS，回傳結果"""
    _touch()
    return _page.evaluate(f"async () => {{ return await {js}; }}", timeout=timeout)

# ──────────────────────────────────────────────
# Routes
# ──────────────────────────────────────────────

@app.route("/api/status")
def api_status():
    with _lock:
        alive = _session_ok()
    return jsonify({"loggedIn": alive, "version": "1.0"})


@app.route("/api/login", methods=["POST"])
def api_login():
    global _logged_in
    body = request.get_json(silent=True) or {}
    username = (body.get("username") or "").strip()
    password = body.get("password") or ""

    if not username or not password:
        return jsonify({"error": "請輸入帳號和密碼"}), 400

    with _lock:
        # 如果已登入就直接回傳 ok
        if _session_ok():
            return jsonify({"ok": True, "note": "已是登入狀態"})
        try:
            _do_login(username, password)
            return jsonify({"ok": True})
        except Exception as e:
            _logged_in = False
            return jsonify({"error": str(e)}), 500


@app.route("/api/fleet")
def api_fleet():
    with _lock:
        if not _session_ok():
            return jsonify({"error": "尚未登入", "code": "NOT_LOGGED_IN"}), 401
        try:
            data = _vue(
                f"{VUE_API}.getAircraftList({{extensions:['FleetDashboard:RecentDefects','FleetDashboard:ColumnConfiguration']}})"
            )
            return jsonify({"ok": True, "data": data})
        except Exception as e:
            return jsonify({"error": str(e)}), 500


@app.route("/api/fleet/<tail>")
def api_fleet_detail(tail):
    with _lock:
        if not _session_ok():
            return jsonify({"error": "尚未登入", "code": "NOT_LOGGED_IN"}), 401
        try:
            state = _vue(
                f"{VUE_API}.getAircraftState({{id:{json.dumps(tail)},extensions:['MEL','NTC','ActiveDefects','FleetDashboard:Detail']}})"
            )
            flight = _vue(
                f"{VUE_API}.getFlightLog({{id:{json.dumps(tail)},extensions:['Recent','History','AircraftHistory']}})"
            )
            return jsonify({"ok": True, "state": state, "flight": flight})
        except Exception as e:
            return jsonify({"error": str(e)}), 500


@app.route("/api/logout", methods=["POST"])
def api_logout():
    global _logged_in, _browser, _context, _page, _pw
    with _lock:
        _logged_in = False
        try:
            if _page and not _page.is_closed():
                _page.close()
            if _context:
                _context.close()
            if _browser and _browser.is_connected():
                _browser.close()
            if _pw:
                _pw.stop()
        except Exception:
            pass
        _page = _context = _browser = _pw = None
    return jsonify({"ok": True})


# ──────────────────────────────────────────────
# 取得本機 IP（方便手機連線）
# ──────────────────────────────────────────────
def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


# ──────────────────────────────────────────────
# 啟動
# ──────────────────────────────────────────────
if __name__ == "__main__":
    ip = get_local_ip()
    print("=" * 50)
    print("  ✈️  ELB Proxy Server 啟動中")
    print(f"  Mac本機：  http://localhost:3001")
    print(f"  區域網路：  http://{ip}:3001")
    print("  按 Ctrl+C 停止")
    print("=" * 50)
    # threaded=False → Playwright sync API 不需要多執行緒
    app.run(host="0.0.0.0", port=3001, debug=False, threaded=False)
