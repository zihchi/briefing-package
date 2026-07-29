// Tailwind 設定：用來把 Captain_Logbook_Cloud.html 內用到的 utility class
// 預編譯成本地靜態 CSS（../logbook.tailwind.css），供離線 / 弱網時完整排版。
// 使用方式見同資料夾 build-logbook-tailwind.sh。
module.exports = {
  content: ["../Captain_Logbook_Cloud.html"],
  // 少數 class 由 JS 以 classList 動態切換，保險起見列入 safelist
  safelist: ["hidden", "flex", "animate-spin", "show", "active"],
  theme: { extend: {} },
  corePlugins: { preflight: true },
};
