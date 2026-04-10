// 負責無縫切換頁面與喚醒 JS 邏輯的核心引擎
function loadPage(pageUrl) {
    const displayArea = document.getElementById('content-display');
    
    // 顯示載入中的過場提示
    displayArea.innerHTML = '<div style="text-align: center; padding: 2em; color: #3c79ff; font-weight: bold;">讀取模組中 (Loading)...</div>';

    fetch(pageUrl)
        .then(response => {
            if (!response.ok) throw new Error('網路回應異常');
            return response.text();
        })
        .then(html => {
            // 將子分頁的 HTML 注入主畫面
            displayArea.innerHTML = html;

            // 【關鍵步驟】依照載入的頁面，重新啟動對應的 JavaScript 函數
            if (pageUrl === 'curfew.html') {
                initCurfewCalculator(); // 喚醒 Curfew 邏輯
            } 
            else if (pageUrl === 'time.html') {
                initTimeCalculator(); // 喚醒時間計算機邏輯
                // 重新綁定時間計算機的 Reset 按鈕
                document.getElementById("resetTimeCalcBtn").addEventListener("click", resetTimeCalculator);
            } 
            else if (pageUrl === 'altimetry.html') {
                resetAltimetryCalculator(); // 喚醒並初始化寒溫修正表格
                // 重新綁定寒溫修正的 Reset 按鈕
                document.getElementById("resetAltimetryBtn").addEventListener("click", resetAltimetryCalculator);
            }
            // 註：fuel.html 使用的是 HTML 內聯的 onclick，不需額外喚醒
        })
        .catch(error => {
            console.error('Fetch 錯誤:', error);
            displayArea.innerHTML = '<div style="text-align: center; padding: 2em; color: #e74c3c; font-weight: bold;">載入失敗，請確認檔案路徑是否正確。</div>';
        });
}
