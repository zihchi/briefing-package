"""
Flighty 行事曆後處理腳本
────────────────────────
讀取 Google Calendar「STARLUX 班表」中的既有事件，
將合併航班（如 "233/234"）拆成個別航班事件（"JX 233"、"JX 234"），
讓 Flighty 的 Calendar Sync 能自動辨識。

用法：在既有的 sync_once.py 跑完之後執行：
    .venv/bin/python sync_flighty.py

前置需求：
    pip install google-api-python-client google-auth-oauthlib
    同目錄需有 credentials.json（Google Cloud OAuth 2.0 用戶端）
"""

import datetime
import os
import pickle
import re
import sys

from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/calendar"]
CALENDAR_NAME = "STARLUX 班表"
FLIGHTY_TAG = "flighty-auto"
LOOK_AHEAD_DAYS = 90

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TOKEN_PATH = os.path.join(BASE_DIR, "token.pickle")
CREDS_PATH = os.path.join(BASE_DIR, "credentials.json")


def get_service():
    creds = None
    if os.path.exists(TOKEN_PATH):
        with open(TOKEN_PATH, "rb") as f:
            creds = pickle.load(f)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(CREDS_PATH, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(TOKEN_PATH, "wb") as f:
            pickle.dump(creds, f)
    return build("calendar", "v3", credentials=creds)


def find_calendar_id(service):
    for cal in service.calendarList().list().execute().get("items", []):
        if cal["summary"] == CALENDAR_NAME:
            return cal["id"]
    return None


def parse_flights_from_notes(notes):
    """
    從附註解析航班資訊。
    支援格式：JX233 0800L-0955L / JX 233 0800-0955 等
    """
    flights = []
    if not notes:
        return flights
    for line in notes.splitlines():
        m = re.match(
            r"JX\s*(\d{1,4})\s+(\d{4})L?\s*[-–]\s*(\d{4})L?",
            line.strip(),
            re.IGNORECASE,
        )
        if m:
            flights.append({
                "number": m.group(1),
                "dep": m.group(2),
                "arr": m.group(3),
            })
    return flights


def event_date(event):
    start = event.get("start", {})
    if "dateTime" in start:
        return datetime.datetime.fromisoformat(start["dateTime"]).date()
    if "date" in start:
        return datetime.date.fromisoformat(start["date"])
    return None


def build_flighty_event(date, flight):
    dep_h, dep_m = int(flight["dep"][:2]), int(flight["dep"][2:])
    arr_h, arr_m = int(flight["arr"][:2]), int(flight["arr"][2:])

    start_dt = datetime.datetime(date.year, date.month, date.day, dep_h, dep_m)
    end_dt = datetime.datetime(date.year, date.month, date.day, arr_h, arr_m)
    if end_dt <= start_dt:
        end_dt += datetime.timedelta(days=1)

    return {
        "summary": f"JX {flight['number']}",
        "start": {"dateTime": start_dt.isoformat(), "timeZone": "Asia/Taipei"},
        "end": {"dateTime": end_dt.isoformat(), "timeZone": "Asia/Taipei"},
        "description": f"STARLUX JX{flight['number']}",
        "extendedProperties": {"private": {"source": FLIGHTY_TAG}},
    }


def run():
    service = get_service()
    cal_id = find_calendar_id(service)
    if not cal_id:
        print(f'❌ 找不到「{CALENDAR_NAME}」行事曆')
        sys.exit(1)

    now = datetime.datetime.utcnow()
    time_min = now.isoformat() + "Z"
    time_max = (now + datetime.timedelta(days=LOOK_AHEAD_DAYS)).isoformat() + "Z"

    all_events = (
        service.events()
        .list(
            calendarId=cal_id,
            timeMin=time_min,
            timeMax=time_max,
            singleEvents=True,
            orderBy="startTime",
        )
        .execute()
        .get("items", [])
    )

    # 先清除上一輪產生的 Flighty 事件，避免重複
    for ev in all_events:
        props = ev.get("extendedProperties", {}).get("private", {})
        if props.get("source") == FLIGHTY_TAG:
            service.events().delete(calendarId=cal_id, eventId=ev["id"]).execute()

    created = 0
    for ev in all_events:
        props = ev.get("extendedProperties", {}).get("private", {})
        if props.get("source") == FLIGHTY_TAG:
            continue

        notes = ev.get("description", "")
        flights = parse_flights_from_notes(notes)
        if not flights:
            continue

        date = event_date(ev)
        if not date:
            continue

        summary = ev.get("summary", "")
        print(f"📅 {date}  {summary}")
        for fl in flights:
            body = build_flighty_event(date, fl)
            service.events().insert(calendarId=cal_id, body=body).execute()
            print(f"   ✅ JX {fl['number']}  {fl['dep']}→{fl['arr']}")
            created += 1

    print(f"\n🎉 完成！已建立 {created} 個 Flighty 航班事件")


if __name__ == "__main__":
    run()
