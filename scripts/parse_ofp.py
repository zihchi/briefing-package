#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
parse_ofp.py — 從 OFP (Operational Flight Plan) 擷取航點座標並併入航點資料庫。

用途
    NOTAM Radar 的「航路具現化」需要一份「航點名稱 -> 經緯度」的資料庫
    (data/waypoints.json)。本工具從 OFP 的 NAVIGATION LOG 逐一擷取航點與其
    座標，併入資料庫；未來有新的 OFP，重跑本工具即可累積更新。

用法
    python3 scripts/parse_ofp.py OFP1.pdf OFP2.pdf ...          # 直接吃 PDF
    python3 scripts/parse_ofp.py OFP.txt                        # 或已萃取的純文字
    python3 scripts/parse_ofp.py --db data/waypoints.json *.pdf # 指定資料庫路徑

設計
    * NAVIGATION LOG 每個航點為三行區塊：
          NAME   F/L  W/V ...            <- 航點名（區塊第 1 行）
          AWY    TMORA TEMP/WS ...        <- 航路段（區塊第 2 行）
          N####.# E#####.#                <- 座標（區塊第 3 行，度分格式 DDMM.m）
      因此對每個座標行，往回數 2 個「非空白行」即為航點名稱行。
    * 排除計算用的虛擬點：T_O_C / T_O_D（含底線）、E.ENT / E.ETP1 / E.EXT
      （含小數點）、FIR 邊界行（以 '-' 開頭）等，皆因含特殊字元被過濾。
    * 進場跑道行 "VTBS/20R" 視為機場，記為機場代碼 VTBS。
    * 座標衝突（同名但差距超過容忍值）時保留既有值並印出警告，避免不同 OFP
      的四捨五入造成資料庫抖動。
"""
import argparse
import json
import os
import re
import sys

# 座標行：N/S 緯度、E/W 經度，度分格式 (DDMM.m / DDDMM.m)
COORD_RE = re.compile(r'^([NS])(\d{3,4}(?:\.\d+)?)\s+([EW])(\d{4,5}(?:\.\d+)?)$')
# 合法航點名：3~5 碼字母，或字母+數字（如 BS507、TP240）；不含 _ . / -
NAME_RE = re.compile(r'^[A-Z]{2,5}\d{0,3}$')
# 進場/離場跑道行的機場代碼：VTBS/20R -> VTBS
APT_RUNWAY_RE = re.compile(r'^([A-Z]{4})/\d')

# 併入時的座標容忍值（度）；約 0.02 度 ~ 1.2 海浬
COORD_TOL = 0.02

# 補充的機場基準點 (ARP)；OFP NAVIGATION LOG 通常不含起降機場自身座標，
# 但航路兩端的機場對繪圖很有用，故以公開 ARP 座標補齊。src 標為 "ARP-ref"。
AIRPORT_REF = {
    "RCTP": (25.0777, 121.2325),   # Taipei Taoyuan
    "RCSS": (25.0694, 121.5519),   # Taipei Songshan
    "VTBS": (13.6811, 100.7472),   # Bangkok Suvarnabhumi
    "VTBD": (13.9126, 100.6068),   # Bangkok Don Mueang
    "VTBU": (9.1326, 99.1355),     # Surat Thani
}


def dm_to_decimal(num_str, is_lat):
    """DDMM.m / DDDMM.m 度分格式 -> 十進位度。"""
    dot = num_str.find('.')
    intp = num_str if dot < 0 else num_str[:dot]
    frac = '' if dot < 0 else num_str[dot:]
    deg_len = 2 if is_lat else 3
    deg = int(intp[:deg_len])
    minutes = float(intp[deg_len:] + frac) if intp[deg_len:] else 0.0
    return round(deg + minutes / 60.0, 5)


def extract_text(path):
    """讀取 OFP 文字：PDF 走 pdfminer，其餘視為純文字。"""
    if path.lower().endswith('.pdf'):
        try:
            from pdfminer.high_level import extract_text as _extract
        except ImportError:
            sys.exit("需要 pdfminer.six 才能讀 PDF：pip install pdfminer.six")
        return _extract(path)
    with open(path, encoding='utf-8', errors='replace') as f:
        return f.read()


def ofp_tag(text):
    """從 OFP 抬頭取一個簡短來源標籤，例如 'SJX745/11AUG26'。"""
    m = re.search(r'\b([A-Z]{2,3}\d{2,4})\s+(\d{1,2}[A-Z]{3}\d{2})\b', text)
    if m:
        return f"{m.group(1)}/{m.group(2)}"
    return os.path.basename(text[:0] or 'OFP')


def parse_navlog(text, src):
    """回傳 {name: {lat, lng, type, src}}。"""
    lines = [ln.rstrip() for ln in text.splitlines()]
    nonempty = [ln.strip() for ln in lines if ln.strip()]
    found = {}
    for i, ln in enumerate(nonempty):
        cm = COORD_RE.match(ln)
        if not cm or i < 2:
            continue
        name_line = nonempty[i - 2]
        token = name_line.split()[0] if name_line.split() else ''

        ptype = "waypoint"
        apt = APT_RUNWAY_RE.match(token)
        if apt:
            token = apt.group(1)
            ptype = "airport"
        elif not NAME_RE.match(token):
            continue  # 虛擬點 / FIR 邊界 / 計數行等，略過

        lat = dm_to_decimal(cm.group(2), cm.group(1) in 'NS')
        lat = -lat if cm.group(1) == 'S' else lat
        lng = dm_to_decimal(cm.group(4), False)
        lng = -lng if cm.group(3) == 'W' else lng

        # 同一份 OFP 內某點重複出現（如 FIR 邊界與航點同座標）時，第一次即可
        found.setdefault(token, {"lat": lat, "lng": lng, "type": ptype, "src": src})
    return found


def merge(db, new_points):
    added, updated, conflicts = 0, 0, []
    for name, info in new_points.items():
        if name not in db:
            db[name] = info
            added += 1
            continue
        old = db[name]
        if (abs(old["lat"] - info["lat"]) > COORD_TOL or
                abs(old["lng"] - info["lng"]) > COORD_TOL):
            conflicts.append((name, old, info))
        elif old.get("src", "").startswith("ARP") and not info["src"].startswith("ARP"):
            # 既有為參考 ARP，改用 OFP 實測座標
            db[name] = info
            updated += 1
    return added, updated, conflicts


def main():
    ap = argparse.ArgumentParser(description="從 OFP 擷取航點座標併入資料庫")
    ap.add_argument("files", nargs="+", help="OFP 檔案（.pdf 或 .txt）")
    ap.add_argument("--db", default="data/waypoints.json", help="資料庫 JSON 路徑")
    ap.add_argument("--no-arp", action="store_true", help="不補機場 ARP 參考座標")
    args = ap.parse_args()

    if os.path.exists(args.db):
        with open(args.db, encoding='utf-8') as f:
            doc = json.load(f)
    else:
        doc = {"meta": {}, "points": {}}
    db = doc.setdefault("points", {})
    sources = set(doc.get("meta", {}).get("sources", []))

    total_added = 0
    for path in args.files:
        text = extract_text(path)
        src = ofp_tag(text)
        pts = parse_navlog(text, src)
        # 依 OFP 內出現的機場補 ARP 參考座標
        if not args.no_arp:
            for apt, (la, lo) in AIRPORT_REF.items():
                if re.search(rf'\b{apt}\b', text) and apt not in pts:
                    pts[apt] = {"lat": la, "lng": lo, "type": "airport", "src": "ARP-ref"}
        added, updated, conflicts = merge(db, pts)
        total_added += added
        sources.add(src)
        print(f"[{src}] 解析 {len(pts)} 點：新增 {added}、更新 {updated}、衝突 {len(conflicts)}")
        for name, old, new in conflicts:
            print(f"    ⚠ 衝突 {name}: 既有 {old['lat']},{old['lng']} vs 新 {new['lat']},{new['lng']}（保留既有）")

    doc["meta"] = {
        "updated": __import__("datetime").date.today().isoformat(),
        "count": len(db),
        "sources": sorted(sources),
        "format": "度分 DDMM.m 轉十進位度；經度為 Pacific 世界；type: waypoint/airport",
    }
    doc["points"] = dict(sorted(db.items()))

    os.makedirs(os.path.dirname(args.db) or ".", exist_ok=True)
    with open(args.db, "w", encoding='utf-8') as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)
    print(f"\n資料庫已寫入 {args.db}：共 {len(db)} 點（本次新增 {total_added}）。")


if __name__ == "__main__":
    main()
