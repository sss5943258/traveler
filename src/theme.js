// src/theme.js
// 本檔案用來管理 Ant Design 的全域 UI 主題設定 (Design Tokens)
// 透過集中管理，可以讓 App.jsx 保持乾淨，並方便未來隨時調整整個網站的品牌色調與字體

export const customTheme = {
  // 全域基礎變數設定 (Design Tokens)
  token: {
    colorPrimary: '#583f24',      // 本質深木褐 (品牌主色，如主要按鈕背景、連結顏色)
    colorInfo: '#9e7a4e',         // 麥穗金 (輔助色，如狀態提示、滑鼠懸停)
    colorTextBase: '#2C2A29',     // 炭灰褐 (文字預設主色)
    colorBgBase: '#FAF8F5',       // 暖象牙白 (全域元件預設背景)
    borderRadius: 6,              // 微圓角設計 (控制 Card、Modal、Input 等圓角弧度)
    fontFamily: '"Noto Sans TC", sans-serif', // 設定 Ant Design 元件採用的預設字型
  },
  // 個別元件微調設定 (Override specific components)
  components: {
    Button: {
      borderRadius: 8,            // 圓潤圓角設計 (改善先前 2px 過於銳利鋒利的問題)
      controlHeight: 42,          // 按鈕的預設高度 (px)
      paddingInline: 22,          // 加強文字與外框左右內距 (更多呼吸空間)
      paddingBlock: 8,            // 加強文字與外框上下內距
    },
  },
};
