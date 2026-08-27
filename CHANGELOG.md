# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2026-08-27

### Changed
- **主題設定解耦**：將原本寫在 `App.jsx` 內的 Ant Design 主題設定抽出至獨立的 [theme.js](file:///d:/Git/traveler/src/theme.js)，落實樣式與邏輯分離。
- **添加初學者教學註解**：在 [App.jsx](file:///d:/Git/traveler/src/App.jsx) 的所有 React 函式（如元件與點擊事件）中加入詳盡中文註解，協助釐清 State Hook 與重新渲染（Re-render）的概念。
- **首頁路由與元件整合**：在 `App.jsx` 中載入並配置 [HomePage.jsx](file:///d:/Git/traveler/src/components/HomePage.jsx) 元件，實作首頁、行程詳情與攜帶清單間的狀態路由機制。
- **GAS API 配接與相容性調整**：修改首頁的 API 請求格式，以相容 GAS 後端分支。讀取行程改為 `?action=getTrips` 查詢參數，刪除改為 `POST` 請求並攜帶包含 action 的 text/plain 載荷。
- **全域 CSS 樣式融合**：在 [index.css](file:///d:/Git/traveler/src/index.css) 中整合本質旅行（Esence Travel）色彩體系，讓首頁行程卡片、滑動刪除手勢與新增按鈕擁有溫暖象牙白與微直角質感。
- **首頁程式碼中文註解化**：針對首頁拖曳手勢物件 `TripSwipeItem` 及 `HomePage` 資料生命週期中所有函式補上詳盡註解，輔助學習。

## [0.1.0] - 2026-08-27

### Added
- **全新專案架構（Vite + React 19）**：建立重構版專案 `traveler`，廢除舊版 TS 設定以適配 JS/JSX 開發環境。
- **UI 色調重寫（Esence Travel 風格）**：
  - 背景改用暖象牙白（`#FAF8F5`），移除了富士山與櫻花背景圖。
  - 主題色導入深木褐（`#583f24`）與麥穗金（`#9e7a4e`）。
  - 套用 Noto Serif TC 與 Noto Sans TC 雙字體視覺設計。
- **Tailwind CSS v3 整合**：建立專屬 `tailwind.config.js`，包含直角邊框、細砂質感邊框與陰影設定。
- **Ant Design v6 整合**：完成 `ConfigProvider` 配置，將元件直角化並全域套用 slow-travel 質感配色。
- **PWA 與資產配置**：整合 `vite-plugin-pwa` 套件以利後續離線快取功能。
- **開發原始碼骨架**：建立 `components`、`pages`、`hooks`、`stores`、`utils` 等核心開發目錄。
