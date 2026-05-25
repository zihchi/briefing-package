"""
Turbli 湍流圖截取服務
- 後端 Flask，使用 Playwright 開無頭 Chromium 抓取 turbli.com
- 用 clip 截圖只截 "Turbulence (edr)" 那塊
- 內建記憶體快取（同一航班+日期 30 分鐘內不重抓）
"""
from __future__ import annotations

import io
import re
import threading
import time
from pathlib import Path

from flask import Flask, Response, jsonify, request, send_from_directory
from flask_cors import CORS
from playwright.sync_api import sync_playwright

BASE_DIR = Path(__file__).resolve().parent
CACHE_TTL_SEC = 30 * 60  # 30 分鐘

app = Flask(__name__)
CORS(app)

# 簡易記憶體快取： {cache_key: (png_bytes, timestamp)}
_cache: dict[str, tuple[bytes, float]] = {}
_cache_lock = threading.Lock()


def _valid_flight(v: str) -> bool:
    return bool(re.fullmatch(r"[A-Z0-9]{1,5}", v or ""))


def _valid_route(v: str) -> bool:
    return bool(re.fullmatch(r"[A-Z]{3}/[A-Z]{3}", v or ""))


def _valid_date(v: str) -> bool:
    return bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}", v or ""))


class TurbliUnavailable(Exception):
    """turbli 對該航班沒資料（410 已起飛/太遠、404 找不到）"""
    pass


def fetch_turbulence_chart(route: str, date: str, flight: str) -> bytes:
    """開瀏覽器抓圖。回傳 PNG bytes。"""
    url = f"https://turbli.com/{route}/{date}/JX-{flight}/"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            context = browser.new_context(
                viewport={"width": 1400, "height": 2400},
                user_agent=(
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/148.0.0.0 Safari/537.36"
                ),
            )
            page = context.new_page()
            response = page.goto(url, wait_until="domcontentloaded", timeout=60000)
            status = response.status if response else 0
            if status == 410:
                raise TurbliUnavailable("航班已起飛或不在 turbli 的 48 小時預報範圍內")
            if status == 404:
                raise TurbliUnavailable("turbli 找不到這個航班，可能不營運或航線錯誤")
            if status != 200:
                raise RuntimeError(f"turbli 回 HTTP {status}")
            page.wait_for_selector("#chartTurbulence svg", timeout=30000)
            page.wait_for_timeout(1500)

            # 算出涵蓋標題列 + 圖表本體 + 圖例 的截圖區
            bbox = page.evaluate(
                """
                () => {
                    const header = document.querySelector('#header_turbulence_chart');
                    const body = document.querySelector('#container_turbulence');
                    if (!header || !body) return null;
                    const hr = header.getBoundingClientRect();
                    const br = body.getBoundingClientRect();
                    // 對齊 body 的左右（圖表寬度），標題往上抓 30px 邊距
                    const x = br.left - 4;
                    const y = hr.top - 6;
                    const right = br.right + 4;
                    const bottom = br.bottom + 4;
                    return {
                        x: Math.max(0, x),
                        y: Math.max(0, y),
                        width: right - x,
                        height: bottom - y,
                    };
                }
                """
            )
            if not bbox:
                raise RuntimeError("找不到湍流圖容器元素")

            png_bytes = page.screenshot(
                clip=bbox,
                type="png",
                omit_background=False,
            )
            return png_bytes
        finally:
            browser.close()


@app.route("/")
def index():
    return send_from_directory(str(BASE_DIR), "index.html")


@app.route("/<path:filename>")
def static_files(filename):
    # 防止離開 BASE_DIR
    target = (BASE_DIR / filename).resolve()
    try:
        target.relative_to(BASE_DIR)
    except ValueError:
        return "Forbidden", 403
    if not target.is_file():
        return "Not Found", 404
    return send_from_directory(str(BASE_DIR), filename)


@app.route("/api/chart")
def api_chart():
    flight = (request.args.get("flight") or "").strip().upper()
    route = (request.args.get("route") or "").strip().upper()
    date = (request.args.get("date") or "").strip()

    if not _valid_flight(flight):
        return jsonify({"error": "flight 參數格式錯誤"}), 400
    if not _valid_route(route):
        return jsonify({"error": "route 參數格式錯誤，需如 NRT/TPE"}), 400
    if not _valid_date(date):
        return jsonify({"error": "date 參數格式錯誤，需如 2026-05-25"}), 400

    cache_key = f"{route}|{date}|{flight}"
    now = time.time()

    with _cache_lock:
        cached = _cache.get(cache_key)
        if cached and now - cached[1] < CACHE_TTL_SEC:
            png = cached[0]
            return Response(
                png,
                mimetype="image/png",
                headers={
                    "Cache-Control": "public, max-age=1800",
                    "X-Cache": "HIT",
                },
            )

    try:
        png = fetch_turbulence_chart(route, date, flight)
    except TurbliUnavailable as e:
        return jsonify({"error": str(e), "unavailable": True}), 404
    except Exception as e:
        return jsonify({"error": f"抓取失敗：{e}"}), 502

    with _cache_lock:
        _cache[cache_key] = (png, now)

    return Response(
        png,
        mimetype="image/png",
        headers={
            "Cache-Control": "public, max-age=1800",
            "X-Cache": "MISS",
        },
    )


if __name__ == "__main__":
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        lan_ip = s.getsockname()[0]
        s.close()
    except Exception:
        lan_ip = None

    print("✈️  簡報箱 + Turbli 湍流圖服務啟動")
    print(f"    本機：       http://127.0.0.1:5050")
    if lan_ip:
        print(f"    區網（手機/iPad 可連）： http://{lan_ip}:5050")
    print(f"    API：        http://127.0.0.1:5050/api/chart?flight=805&route=NRT/TPE&date=2026-05-25")
    app.run(host="0.0.0.0", port=5050, debug=False, threaded=True)
