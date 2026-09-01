# Changelog

All notable changes to this project will be documented in this file.

## [0.6.0] - 2026-09-01

### Added
- **API 服務適配器層 (`apiService.js`)**：採用 Adapter Pattern 與 Strategy Pattern，建立全域統一 API 服務層，完美將前端 UI 元件與後端通訊傳輸細節完全解耦。
- **旅行攜帶清單（Packing List）API 串接與適配器擴充**：於 `apiService.js` 新增 `getPackingItems`, `addPackingItem`, `togglePackingItem`, `deletePackingItem` 4 個非同步 CRUD 方法，支援 GAS 與 .NET Core API 雙模式。

### Changed
- **第一層 Component 統一 DTO 化**：所有 React 元件 (`HomePage`, `TripPage`, `ScheduleFormModal`, `DeleteConfirmModal`, `TripInfoFormModal`, `NewTripModal`, `PackingListPage`) 改以標準 DTO 呼叫 `apiService`。
- **攜帶清單頁面視覺對齊**：重構 `PackingListPage.jsx` 解耦舊式內聯 `fetch` 呼叫，將自訂 Checkbox 與按鈕視覺全面統一為專案深木褐色調與莫蘭迪質感。
- **備案行程電腦版導覽優化**：於卡片右上角呈現 `1 / N` 頁數計數標籤，並於電腦版提供左右導覽箭頭按鈕 (`‹` `›`)，實現滑鼠一鍵平滑切換查看備案景點。
- **無縫雙後端切換 (`config.js`)**：提供 `API_MODE` (`'GAS'` 或 `'NET_CORE'`) 設定，可在 Google Apps Script 與 .NET Core API 之間一鍵切換，無需調整任何前端畫面邏輯。

### Fixed
- **API 通訊與 `Failed to fetch` 重試修復**：強化 `src/utils/api.js` 中 `fetchWithRetry` 異常捕獲與指數退避重試機制，徹底排除網路瞬斷或跨域重導向導致的 `Failed to fetch` 錯誤。

## [0.5.0] - 2026-09-01

### Added
- **Modal 檢視分隔線**：於詳情/備註檢視 Modal 的標題（`modal-title`）與備註內容（`modal-text`）之間新增實線分隔線（`.modal-divider`），以清楚區隔標題與內容。

### Changed
- **CSS 元件模組化拆分**：將原本單一大型 `index.css` 依 React 元件獨立拆分為專屬 CSS 樣式檔 (`HomePage.css`, `TripPage.css`, `PackingListPage.css`, `Modals.css`, `ImageLightbox.css`)，移除 JSX 內聯樣式 (`style={{ ... }}`)，`index.css` 僅保留全域變數、Tailwind 指令與 Base 設定。
- **還原 travel-app Modal 原始架構**：對齊原本 `travel-app` 專案簡潔的 Modal 彈窗結構，並全面升級為深木褐色調與莫蘭迪質感 UI。

### Fixed
- **全域 Loading 畫面垂直水平雙向置中**：修正 `TripPage`、`HomePage` 與 `PackingListPage` 的「正在載入行程，請稍候...」讀取畫面，確保載入文字與旋轉圖示在畫面上完全水平垂直置中。
- **手機版天數頁籤日期文字消失修復**：修正手機版點選 `DateTab`（如 `Day 2`）時選取狀態因 Tailwind 類別衝突導致日期副標題 (`.date-sub`) 白底白字消失的問題，統一由 `.date-tab.active` 控制高對比度文字。

## [0.4.0] - 2026-08-31

### Added
- **GitHub Pages 自動部署支援**：建立 `.github/workflows/deploy.yml` 檔案，利用 GitHub Actions 自動打包並發布 `dist/` 目錄的靜態資源至 GitHub Pages（在推送到 `main` 分支時觸發）。

### Changed
- **調整 Vite 基底路徑**：於 `vite.config.js` 設定 `base: '/traveler/'`，確保專案發布至 GitHub Pages 非網域根目錄（`/traveler/`）時，靜態資源（CSS, JS）能正常加載。

### Fixed
- **Loading 畫面水平垂直置中**：修正首頁載入中（`.home-loading`）的 CSS 排版，加入 `justify-content: center` 並將 `margin-top: 30vh` 改為 `margin: auto`，以確保載入文字與旋轉圖示在畫面上完美居中。

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
