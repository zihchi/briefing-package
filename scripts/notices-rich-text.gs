/**
 * 公告欄（notices.html）的「文字顏色／粗體」資料來源。
 *
 * 試算表發布成 CSV 時，儲存格裡的文字顏色、粗體會全部消失；
 * 這支 Google Apps Script 直接讀試算表的 Rich Text，把每段文字的顏色與粗體一起回傳給網站。
 *
 * 安裝（只需一次）：
 *   1. 打開公告試算表 → 上方選單「擴充功能」→「Apps Script」
 *   2. 把這整個檔案的內容貼上（取代原本的 function myFunction…）→ 存檔
 *   3. 右上角「部署」→「新增部署作業」→ 類型選「網頁應用程式」
 *        執行身分：我
 *        誰可以存取：所有人
 *      → 部署 → 第一次會要求授權，照畫面允許
 *   4. 複製「網頁應用程式網址」（https://script.google.com/macros/s/…/exec），
 *      填到 notices.html 的 RICH_URL
 *
 * 之後試算表內容或顏色改了，不需要重新部署；改了這支程式本身才需要「管理部署作業」→ 編輯 → 新版本。
 *
 * 回傳格式：
 *   {ok:true, rows:[{日期, 來源, 摘要, 機隊, 緊急度, runs:[{t:文字, c:"#rrggbb", b:粗體, i:斜體, u:底線}]}]}
 */

// 公告所在的工作表名稱；找不到就用第一個有「日期」「摘要」標題列的工作表
var SHEET_NAME = 'Form_Responses';

function doGet() {
  try {
    var sheet = findSheet_();
    var range = sheet.getDataRange();
    var values = range.getDisplayValues();
    var rich = range.getRichTextValues();

    // 標題列：第一個同時有「日期」和「摘要」的列
    var headRow = -1;
    for (var r = 0; r < Math.min(values.length, 10); r++) {
      if (values[r].indexOf('日期') >= 0 && values[r].indexOf('摘要') >= 0) { headRow = r; break; }
    }
    if (headRow < 0) return json_({ ok: false, error: '找不到「日期」「摘要」標題列' });

    var head = values[headRow].map(function (h) { return String(h).trim(); });
    var col = function (name) { return head.indexOf(name); };
    var mi = col('摘要');

    var rows = [];
    for (var i = headRow + 1; i < values.length; i++) {
      var v = values[i];
      if (!v.some(function (x) { return String(x).trim(); })) continue;
      var row = {
        日期: col('日期') >= 0 ? v[col('日期')] : '',
        來源: col('來源') >= 0 ? v[col('來源')] : '',
        摘要: mi >= 0 ? v[mi] : '',
        機隊: col('機隊') >= 0 ? v[col('機隊')] : '',
        緊急度: col('緊急度') >= 0 ? v[col('緊急度')] : ''
      };
      var rt = mi >= 0 ? rich[i][mi] : null;
      if (rt) {
        row.runs = rt.getRuns().map(function (run) {
          var st = run.getTextStyle();
          var color = null;
          try { color = st.getForegroundColor(); } catch (e) { color = null; }
          return { t: run.getText(), c: color, b: st.isBold(), i: st.isItalic(), u: st.isUnderline() };
        });
      }
      rows.push(row);
    }
    return json_({ ok: true, rows: rows });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function findSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var byName = ss.getSheetByName(SHEET_NAME);
  if (byName) return byName;
  var sheets = ss.getSheets();
  for (var s = 0; s < sheets.length; s++) {
    var top = sheets[s].getRange(1, 1, Math.min(sheets[s].getLastRow(), 10) || 1, sheets[s].getLastColumn() || 1).getDisplayValues();
    for (var r = 0; r < top.length; r++) {
      if (top[r].indexOf('日期') >= 0 && top[r].indexOf('摘要') >= 0) return sheets[s];
    }
  }
  return sheets[0];
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
