/**
 * LIDO 擷取後端 (Google Apps Script) — 優化版
 * 在原版基礎上加了 3 件事,其餘邏輯與你原本一字不差:
 *
 *   ① 登入 session 暫存(CacheService,10 分鐘)
 *      → 同一使用者第 2 次之後的擷取「跳過登入」,省掉 2 趟來回。
 *        若暫存的 session 失效(總表非 200),自動清掉、重登一次再試。
 *
 *   ② 支援 date 參數(前端「📅 日期」選擇器)
 *      → 有給 date(YYYY-MM-DD)就把總表窗口移到那天,並只留該日候選。
 *
 *   ③ 每步計時 _perf(回應裡多一個 _perf 物件)
 *      → 直接看出登入/總表/明細/文件各花幾毫秒,以及回應總大小。
 *        用來確認「天氣圖 base64」是不是主要瓶頸。
 *
 * 4 個識別性字串一樣走 Script Properties:
 *   LIDO_BASE_URL, LIDO_CUSTOMER_ID, LIDO_AUTH_REALM, LIDO_DWR_SESSION_ID
 */
function doPost(e) {
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  var _perf = {};
  var _t = Date.now();
  function lap(name) { var d = Date.now(); _perf[name] = d - _t; _t = d; }

  try {
    var requestData = JSON.parse(e.postData.contents);
    var username = requestData.username;
    var password = requestData.password;
    var targetFlight = requestData.targetFlight;
    var requestedLegId = requestData.legId;
    var requestedDate = requestData.date;   // ② 'YYYY-MM-DD' 或 undefined

    if (!username || !password || !targetFlight) {
      throw new Error("未提供完整的帳號、密碼或目標航班號。");
    }

    var props = PropertiesService.getScriptProperties();
    var BASE     = props.getProperty('LIDO_BASE_URL');
    var CUSTOMER = props.getProperty('LIDO_CUSTOMER_ID');
    var REALM    = props.getProperty('LIDO_AUTH_REALM');
    var DWR_SS   = props.getProperty('LIDO_DWR_SESSION_ID');
    if (!BASE || !CUSTOMER || !REALM || !DWR_SS) {
      throw new Error('Script Properties 未完整設定 (需要 LIDO_BASE_URL / LIDO_CUSTOMER_ID / LIDO_AUTH_REALM / LIDO_DWR_SESSION_ID)');
    }

    var target = targetFlight.replace(/\s+/g, '').toUpperCase();

    // ── ① 取得 session:先看暫存,沒有才登入 ──
    var cache = CacheService.getScriptCache();
    var cacheKey = 'lido_sess_' + username;
    var finalCookies = cache.get(cacheKey);
    var fromCache = !!finalCookies;
    if (!finalCookies) {
      finalCookies = lidoLogin_(BASE, DWR_SS, username, password);
      cache.put(cacheKey, finalCookies, 600); // 10 分鐘
    }
    lap('login_ms');            // 命中快取時這步會接近 0
    _perf.login_from_cache = fromCache;

    // ── 總表時間窗:有 date 就移到那天(±,涵蓋跨日),否則現在 -24h ~ +48h ──
    var now = new Date();
    var startTime, endTime;
    if (requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
      var dayMs = new Date(requestedDate + 'T00:00:00.000Z').getTime();
      startTime = new Date(dayMs - 24 * 60 * 60 * 1000).toISOString();
      endTime   = new Date(dayMs + 48 * 60 * 60 * 1000).toISOString();
    } else {
      startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      endTime   = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
    }
    var listApiUrl = BASE + "/lido/lcb/ui/flightlist?startDateTime=" + startTime + "&endDateTime=" + endTime;

    // 取總表(暫存 session 失效就重登一次再試)
    var listResponse = UrlFetchApp.fetch(listApiUrl, { "method": "get", "headers": buildHeaders_(finalCookies, "SearchFlights", BASE, REALM, CUSTOMER), "muteHttpExceptions": true });
    if (listResponse.getResponseCode() !== 200 && fromCache) {
      cache.remove(cacheKey);
      finalCookies = lidoLogin_(BASE, DWR_SS, username, password);
      cache.put(cacheKey, finalCookies, 600);
      _perf.relogin = true;
      listResponse = UrlFetchApp.fetch(listApiUrl, { "method": "get", "headers": buildHeaders_(finalCookies, "SearchFlights", BASE, REALM, CUSTOMER), "muteHttpExceptions": true });
    }
    if (listResponse.getResponseCode() !== 200) throw new Error("總表取得失敗，HTTP 狀態碼：" + listResponse.getResponseCode());
    var flights = JSON.parse(listResponse.getContentText());
    if (!Array.isArray(flights)) flights = [flights];
    lap('list_ms');
    _perf.list_count = flights.length;

    // ── 比對班號(parseInt 避免 leading-zero;SJX/JX 互通) ──
    var targetDigits = parseInt((target.match(/\d+/) || ['0'])[0], 10);
    var targetOp = target.replace(/[0-9]/g, '').toUpperCase();
    var matchedFlights = [];
    for (var i = 0; i < flights.length; i++) {
      var fNumRaw = flights[i].flightNumber;
      if (fNumRaw === undefined || fNumRaw === null) continue;
      var fDigits = parseInt(String(fNumRaw).replace(/[^0-9]/g, ''), 10);
      if (isNaN(fDigits)) continue;
      var fOp = String(flights[i].aircraftOperator || '').toUpperCase();
      var opMatch = (fOp === targetOp) || (fOp === 'JX' && targetOp === 'SJX') || (fOp === 'SJX' && targetOp === 'JX') || (targetOp === '');
      if (fDigits === targetDigits && opMatch) matchedFlights.push(flights[i]);
    }
    if (matchedFlights.length === 0) throw new Error("找不到代號為 " + targetFlight + " 的航班" + (requestedDate ? ("(" + requestedDate + ")") : "") + "。");

    // ② 有指定日期 → 只留該日;同日仍多班才交給 picker
    if (requestedDate && !requestedLegId && matchedFlights.length > 1) {
      var sameDay = [];
      for (var s = 0; s < matchedFlights.length; s++) {
        var od = String(matchedFlights[s].dateOfOperation || matchedFlights[s].dateOfOrigin || matchedFlights[s].std || '').slice(0, 10);
        if (od === requestedDate) sameDay.push(matchedFlights[s]);
      }
      if (sameDay.length > 0) matchedFlights = sameDay;
    }

    var targetFlightData = null;
    if (requestedLegId) {
      for (var k = 0; k < flights.length; k++) {
        if (flights[k].legId === requestedLegId) { targetFlightData = flights[k]; break; }
      }
      if (!targetFlightData) throw new Error("找不到 legId 為 " + requestedLegId + " 的航班。");
    } else if (matchedFlights.length === 1) {
      targetFlightData = matchedFlights[0];
    } else {
      var candidates = matchedFlights.map(function(f) {
        return {
          legId: f.legId,
          scheduledDepartureTime: f.std,
          scheduledTimeOfArrival: f.sta,
          flightOriginDate: f.dateOfOperation || f.dateOfOrigin,
          flightNumber: f.flightNumber,
          aircraftOperator: f.aircraftOperator,
          originStationCode: f.departureAirport || '',
          destinationStationCode: f.destinationAirport || '',
          registration: f.aircraftRegistration || ''
        };
      });
      output.setContent(JSON.stringify({ status: "multiple", message: "找到 " + candidates.length + " 筆同班號航班", candidates: candidates, _perf: _perf }));
      return output;
    }

    // ── 明細 ──
    var encodedLegId = encodeURIComponent(targetFlightData.legId);
    var detailUrl = BASE + "/lido/lcb/ui/" + encodedLegId + "/briefing";
    var detailResponse = UrlFetchApp.fetch(detailUrl, { "method": "get", "headers": buildHeaders_(finalCookies, "GetFlightBriefing", BASE, REALM, CUSTOMER), "muteHttpExceptions": true });
    lap('detail_ms');

    if (detailResponse.getResponseCode() === 200) {
      var briefingData = JSON.parse(detailResponse.getContentText());
      targetFlightData.ofpDetails = briefingData;
      targetFlightData.rawTexts = {};

      try {
        var cats = briefingData.categories || (briefingData.briefingPackages && briefingData.briefingPackages[0] && briefingData.briefingPackages[0].categories) || [];
        var requiredTypes = ['OFP', 'ATS', 'NOTAM', 'CREWINFO', 'RAIM', 'VERTPROF', 'SIGWXROUTE'];
        var multiImageTypes = ['SIGWXROUTE'];
        var docRequests = [];
        var docTypes = [];

        for (var c = 0; c < cats.length; c++) {
          if (requiredTypes.indexOf(cats[c].type) !== -1 && cats[c].documents) {
            for (var d = 0; d < cats[c].documents.length; d++) {
              var doc = cats[c].documents[d];
              var isMultiType = multiImageTypes.indexOf(cats[c].type) !== -1;
              if (doc.mediaType === "text/plain" || doc.mediaType.indexOf("image") !== -1 || isMultiType) {
                var docUrl = BASE + "/lido/lcb/ui/" + encodedLegId + "/briefing/" + doc.fileId + "/docs";
                var reqHeaders = buildHeaders_(finalCookies, "GetDocument", BASE, REALM, CUSTOMER);
                reqHeaders["Accept"] = "text/plain, image/*, */*";
                docRequests.push({ "url": docUrl, "method": "get", "headers": reqHeaders, "muteHttpExceptions": true });
                docTypes.push(isMultiType ? (cats[c].type + '_' + d) : cats[c].type);
                if (!isMultiType) break;
              }
            }
          }
        }

        if (docRequests.length > 0) {
          var docResponses = UrlFetchApp.fetchAll(docRequests);
          var imgBytes = 0, txtBytes = 0;
          for (var r = 0; r < docResponses.length; r++) {
            if (docResponses[r].getResponseCode() === 200) {
              var cTypeH = docResponses[r].getHeaders()['Content-Type'] || '';
              if (cTypeH.indexOf('image') !== -1 || docTypes[r].indexOf('VERTPROF') !== -1 || docTypes[r].indexOf('SIGWXROUTE') !== -1) {
                var blob = docResponses[r].getBlob();
                var b64 = Utilities.base64Encode(blob.getBytes());
                var mime = blob.getContentType() || "image/png";
                targetFlightData.rawTexts[docTypes[r]] = "data:" + mime + ";base64," + b64;
                imgBytes += b64.length;
              } else {
                var t = docResponses[r].getContentText();
                targetFlightData.rawTexts[docTypes[r]] = t;
                txtBytes += t.length;
              }
            } else {
              targetFlightData.rawTexts[docTypes[r]] = "下載失敗";
            }
          }
          _perf.doc_count = docResponses.length;
          _perf.img_b64_kb = Math.round(imgBytes / 1024);
          _perf.txt_kb = Math.round(txtBytes / 1024);
        }
      } catch (err) {
        targetFlightData.rawTextsError = err.toString();
      }
    } else {
      targetFlightData.ofpDetails = { error: "OFP 詳細資料取得失敗" };
    }
    lap('docs_ms');

    var payload = JSON.stringify({ status: "success", data: targetFlightData, _perf: _perf });
    _perf.total_response_kb = Math.round(payload.length / 1024);
    // 把最終大小補進去(重新序列化一次,成本極小)
    payload = JSON.stringify({ status: "success", data: targetFlightData, _perf: _perf });
    output.setContent(payload);

  } catch (error) {
    output.setContent(JSON.stringify({ status: "error", message: error.toString(), _perf: _perf }));
  }
  return output;
}

// ── 登入(回傳合併後的 cookie 字串)。抽成函式,供快取未命中 / session 失效重登共用 ──
function lidoLogin_(BASE, DWR_SS, username, password) {
  var initialUrl = BASE + "/lido/las/login.jsp?DESMON_RESULT_PAGE=" + BASE + "/briefing/";
  var response1 = UrlFetchApp.fetch(initialUrl, { "method": "get", "followRedirects": false, "muteHttpExceptions": true });
  var initialCookies = extractCookies(response1.getAllHeaders());

  var dwrUrl = BASE + "/lido/las/dwr/call/plaincall/LoginBean.login.dwr";
  var dwrPayload =
    "callCount=1\nnextReverseAjaxIndex=0\nc0-scriptName=LoginBean\nc0-methodName=login\nc0-id=0\n" +
    "c0-param0=string:" + username + "\n" +
    "c0-param1=string:" + password + "\n" +
    "c0-param2=string:\nc0-param3=string:LIDO\nc0-param4=string:en\n" +
    "batchId=0\ninstanceId=0\n" +
    "page=%2Flido%2Flas%2Flogin.jsp%3FDESMON_RESULT_PAGE%3D" + encodeURIComponent(BASE) +
    "%2Fbriefing%26DESMON_CODE%3DLAS_001%26DESMON_LANG%3Dnull\n" +
    "scriptSessionId=" + DWR_SS + "\n";
  var response2 = UrlFetchApp.fetch(dwrUrl, {
    "method": "post",
    "payload": dwrPayload,
    "headers": { "Cookie": initialCookies, "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" },
    "contentType": "text/plain",
    "followRedirects": false,
    "muteHttpExceptions": true
  });
  return combineCookies(initialCookies, extractCookies(response2.getAllHeaders()));
}

// ── 組 API headers(依 cookie 現算 csrf) ──
function buildHeaders_(cookies, businessId, BASE, REALM, CUSTOMER) {
  return {
    "Cookie": cookies,
    "Accept": "application/vnd.lsy.lido.lcb.v1.hal+json, application/json, text/plain, */*",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Referer": BASE + "/briefing/",
    "X-Requested-With": "XMLHttpRequest",
    "x-lido-applicationid": "lido-lcb",
    "x-lido-auth": REALM,
    "x-lido-businessid": businessId,
    "x-lido-clientid": "lido-lcb-ui",
    "x-lido-customerid": CUSTOMER,
    "x-lido-csrf": getCookieValue(cookies, "lido_csrf") || "",
    "x-lido-timestamp": new Date().toISOString(),
    "x-lido-traceid": generateUUID()
  };
}

function extractCookies(headers) {
  var cookieHeader = headers['Set-Cookie'];
  if (!cookieHeader) return "";
  return Array.isArray(cookieHeader) ? cookieHeader.map(function(c) { return c.split(';')[0]; }).join('; ') : cookieHeader.split(';')[0];
}

function combineCookies(oldCookies, newCookies) {
  if (!newCookies) return oldCookies;
  if (!oldCookies) return newCookies;
  var cookieMap = {};
  var allCookies = (oldCookies + "; " + newCookies).split('; ');
  for (var i = 0; i < allCookies.length; i++) {
    var parts = allCookies[i].split('=');
    if (parts.length >= 2) cookieMap[parts[0]] = parts.slice(1).join('=');
  }
  var result = [];
  for (var key in cookieMap) result.push(key + "=" + cookieMap[key]);
  return result.join('; ');
}

function getCookieValue(cookieString, cookieName) {
  if (!cookieString) return null;
  var match = cookieString.match(new RegExp('(^|;\\s*)(' + cookieName + ')=([^;]*)'));
  return (match ? match[3] : null);
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function doOptions(e) { return ContentService.createTextOutput(); }
