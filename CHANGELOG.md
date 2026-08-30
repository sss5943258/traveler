# Changelog

All notable changes to this project will be documented in this file.

## [0.3.0] - 2026-08-30

### Added
- **桌面三欄版面（行程頁重構）**：網頁版行程頁由原本的單欄 + Dialog 改為三欄並排佈局。
  - 左欄（`300px`）：天數 / 旅程資訊選擇器（sidebar）
  - 中欄（`50%`）：行程卡片垂直清單
  - 右欄（`50%`）：行程編輯區，選取卡片後直接在此顯示表單，取代彈窗
- **右側編輯區 Placeholder**：未選取任何行程時，右欄顯示「請選擇行程」提示框，含金色虛線框與暖象牙白背景。
- **全域頂部導覽列（`top-navbar`）**：將返回、標題、分享按鈕從天數側欄移至整個畫面的最上方，採 10% / 80% / 10% 固定比例三區塊排版，確保標題不壓縮到兩側按鈕。

### Changed
- **手機版佈局修正（橫向溢出 Bug）**：
  - `html` 與 `body` 加入 `overflow-x: hidden`，防止任何元素造成手機版右側出現空白背景。
  - `app-container` 加入 `width: 100%; max-width: 100vw; overflow-x: hidden`。
  - `trip-main-layout`、`trip-content-wrapper`、`main-content` 的 `overflow-hidden` 與 `min-h-0` 改為 `md:` 前綴，僅在桌面版套用；手機版改為頁面自然滾動。
  - 移除 `main-content` 的 `max-width: 600px; margin: 0 auto`，改為 `width: 100%; min-width: 0` 確保手機版填滿視窗。
  - `header` 與 `main-content` 的 `border-r` 改為 `md:border-r`，手機版不顯示右側分隔線。
  - `date-selector` 加入 `max-width: 100%; min-width: 0; overflow-y: hidden` 防止橫向超出父容器。
- **頂部 Title 截斷修正**：
  - 標題採 `fontSize: 1.2rem`、`whiteSpace: nowrap`、`overflow: hidden`、`textOverflow: ellipsis` inline style 確保一行顯示，超出部分以 `...` 截斷。
  - 以 Inline style 直接設定，避免瀏覽器 h1 預設樣式（`font-size: 2em`）覆蓋 Tailwind 類別。
- **返回 / 分享按鈕縮小**：返回按鈕由 `36px` 縮至 `24px`，分享圖示由 `size=20` 縮至 `size=16`。
- **行程與編輯欄 1:1 比例**：桌面版中欄與右欄各佔 `50%`，取代先前不固定的 flex 比例。
- **天數選擇器箭頭置中**：中欄行程卡片間的 `↓` 連接箭頭改為 flex 水平置中。

### Fixed
- 桌面版行程卡片列表的 scrollbar 出現在頁面中段（因 `overflow-y-auto` 套用在手機版），改為僅桌面版套用。
- 手機版頂部導覽列因 `flex-1` 三欄平分導致標題過長時分享按鈕消失，改為固定寬度三區塊解決。

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
