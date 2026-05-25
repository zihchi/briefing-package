"""
Turbli 湍流圖批次預先抓取
- 在 GitHub Actions 跑：iterate 所有航班 × (今天, 明天) 抓圖存到 chartcache/
- 4-way 並行 (4 個 page 同時跑) 縮短時間
- 失敗的航班跳過不終止整個 job

執行：
    python3 scripts/generate_charts.py [--concurrency 4]
"""
from __future__ import annotations

import argparse
import asyncio
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from playwright.async_api import async_playwright

# Asia/Taipei (UTC+8)；不用 zoneinfo 避免不同 Python 版本相容性
TAIPEI = timezone(timedelta(hours=8))

REPO_ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = REPO_ROOT / "chartcache"

# 與 app.js flightGroups 同步
FLIGHTS: list[tuple[str, str]] = [
    # (flightNo, route)
    # 東北亞 (日本)
    ("800", "TPE/NRT"), ("801", "NRT/TPE"),
    ("802", "TPE/NRT"), ("803", "NRT/TPE"),
    ("804", "TPE/NRT"), ("805", "NRT/TPE"),
    ("820", "TPE/KIX"), ("821", "KIX/TPE"),
    ("822", "TPE/KIX"), ("823", "KIX/TPE"),
    ("834", "TPE/UKB"), ("835", "UKB/TPE"),
    ("838", "TPE/NGO"), ("839", "NGO/TPE"),
    ("840", "TPE/FUK"), ("841", "FUK/TPE"),
    ("846", "TPE/KMJ"), ("847", "KMJ/TPE"),
    ("850", "TPE/CTS"), ("851", "CTS/TPE"),
    ("860", "TPE/HKD"), ("861", "HKD/TPE"),
    ("862", "TPE/SDJ"), ("863", "SDJ/TPE"),
    ("870", "TPE/OKA"), ("871", "OKA/TPE"),
    ("886", "TPE/SHI"), ("887", "SHI/TPE"),
    # 港澳
    ("201", "TPE/MFM"), ("202", "MFM/TPE"),
    ("205", "TPE/MFM"), ("206", "MFM/TPE"),
    ("233", "TPE/HKG"), ("234", "HKG/TPE"),
    ("235", "TPE/HKG"), ("236", "HKG/TPE"),
    # 東南亞
    ("703", "TPE/DAD"), ("704", "DAD/TPE"),
    ("705", "TPE/PQC"), ("706", "PQC/TPE"),
    ("711", "TPE/SGN"), ("712", "SGN/TPE"),
    ("713", "TPE/SGN"), ("714", "SGN/TPE"),
    ("715", "TPE/HAN"), ("716", "HAN/TPE"),
    ("717", "TPE/HAN"), ("718", "HAN/TPE"),
    ("725", "TPE/KUL"), ("726", "KUL/TPE"),
    ("741", "TPE/BKK"), ("742", "BKK/TPE"),
    ("745", "TPE/BKK"), ("746", "BKK/TPE"),
    ("751", "TPE/CNX"), ("752", "CNX/TPE"),
    ("761", "TPE/CGK"), ("762", "CGK/TPE"),
    ("771", "TPE/SIN"), ("772", "SIN/TPE"),
    ("781", "TPE/CEB"), ("782", "CEB/TPE"),
    ("783", "TPE/CEB"), ("784", "CEB/TPE"),
    ("785", "TPE/MNL"), ("786", "MNL/TPE"),
    ("789", "TPE/CRK"), ("790", "CRK/TPE"),
    ("791", "TPE/CRK"), ("792", "CRK/TPE"),
    # 北美
    ("001", "LAX/TPE"), ("002", "TPE/LAX"),
    ("009", "ONT/TPE"), ("010", "TPE/ONT"),
    ("011", "SFO/TPE"), ("012", "TPE/SFO"),
    ("025", "PHX/TPE"), ("026", "TPE/PHX"),
    ("031", "SEA/TPE"), ("032", "TPE/SEA"),
]


def date_strs() -> list[str]:
    """回傳台北時間 [今天, 明天] 的 YYYY-MM-DD"""
    today = datetime.now(TAIPEI).date()
    tomorrow = today + timedelta(days=1)
    return [today.isoformat(), tomorrow.isoformat()]


async def fetch_one(browser, flight: str, route: str, date: str) -> tuple[str, bool, str]:
    """抓單一航班一天的圖。回傳 (cache_key, success, message)"""
    cache_key = f"{flight}-{date}"
    out_path = CACHE_DIR / f"{cache_key}.png"
    url = f"https://turbli.com/{route}/{date}/JX-{flight}/"

    context = await browser.new_context(viewport={"width": 1400, "height": 2400})
    page = await context.new_page()
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=45000)
        await page.wait_for_selector("#chartTurbulence svg", timeout=20000)
        await page.wait_for_timeout(1200)

        bbox = await page.evaluate(
            """
            () => {
                const header = document.querySelector('#header_turbulence_chart');
                const body = document.querySelector('#container_turbulence');
                if (!header || !body) return null;
                const hr = header.getBoundingClientRect();
                const br = body.getBoundingClientRect();
                const x = br.left - 4;
                const y = hr.top - 6;
                return {
                    x: Math.max(0, x),
                    y: Math.max(0, y),
                    width: (br.right + 4) - x,
                    height: (br.bottom + 4) - y,
                };
            }
            """
        )
        if not bbox:
            return cache_key, False, "找不到湍流圖元素 (可能 turbli 沒這個航班的資料)"

        png = await page.screenshot(clip=bbox, type="png")
        out_path.write_bytes(png)
        return cache_key, True, f"{len(png)//1024} KB"
    except Exception as e:
        return cache_key, False, f"{type(e).__name__}: {e}"
    finally:
        await context.close()


async def worker(name: int, browser, queue: asyncio.Queue, stats: dict):
    while True:
        try:
            item = queue.get_nowait()
        except asyncio.QueueEmpty:
            return
        flight, route, date = item
        t0 = time.time()
        cache_key, ok, msg = await fetch_one(browser, flight, route, date)
        dt = time.time() - t0
        status = "✅" if ok else "❌"
        print(f"  [worker {name}] {status} JX-{flight} {route} {date} ({dt:.1f}s) {msg}", flush=True)
        if ok:
            stats["ok"] += 1
        else:
            stats["fail"] += 1
        queue.task_done()


async def main(concurrency: int):
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    dates = date_strs()
    print(f"📅 目標日期：{dates}")
    print(f"✈️  航班數：{len(FLIGHTS)}")
    print(f"🎯 總抓取數：{len(FLIGHTS) * len(dates)}")
    print(f"⚡ 並行數：{concurrency}\n")

    # 清掉舊圖（任何不是今天/明天的）
    valid_keys = {f"{flight}-{d}.png" for flight, _ in FLIGHTS for d in dates}
    removed = 0
    for old in CACHE_DIR.glob("*.png"):
        if old.name not in valid_keys:
            old.unlink()
            removed += 1
    if removed:
        print(f"🗑️  清掉 {removed} 張過期/不在清單的圖\n")

    queue: asyncio.Queue = asyncio.Queue()
    for flight, route in FLIGHTS:
        for date in dates:
            queue.put_nowait((flight, route, date))

    stats = {"ok": 0, "fail": 0}
    t_start = time.time()

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            workers = [
                asyncio.create_task(worker(i + 1, browser, queue, stats))
                for i in range(concurrency)
            ]
            await asyncio.gather(*workers)
        finally:
            await browser.close()

    elapsed = time.time() - t_start
    print(f"\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print(f"完成：✅ {stats['ok']}  ❌ {stats['fail']}  共 {elapsed:.1f} 秒")
    print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

    # 即使有部分失敗也不讓 workflow 整體失敗
    sys.exit(0)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--concurrency", type=int, default=4)
    args = parser.parse_args()
    asyncio.run(main(args.concurrency))
