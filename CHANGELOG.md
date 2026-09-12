# Changelog

All notable changes to this project will be documented in this file.

## [0.9.1] - 2026-09-12

### Added
- **全套應用程式圖示與 Favicon 煥新 (PWA & Web App Icons Refactor)**：
  - **視覺統一與品牌對齊**：底色全面改用專案標準背景色（`#FAF8F5` 暖象牙白），並置中採用專案官方 Lucide 飛機線條圖標（`#583f24` 深木褐），比例為 52% 寬高，視覺留白均勻俐落。
  - **多平台圖示規格完整輸出**：
    - `icon.png` (512x512 高解析預覽圖)
    - `public/pwa-512x512.png` & `public/pwa-192x192.png` (Android / PWA 桌面與啟動圖示)
    - `public/apple-touch-icon.png` (180x180 iOS 主畫面專用圖示)
    - `public/favicon.ico` (64x64 標準 ICO 檔案，修復部分瀏覽器預設抓取顯示為地球圖案的問題)
    - `public/favicon.png` (64x64 PNG 頁籤圖示)
    - `public/favicon.svg` (SVG 向量檔)
  - **瀏覽器快取與 PWA 設定優化 (`index.html`, `vite.config.js`)**：
    - 在 `index.html` 的 Favicon 連結加上版本快取破壞參數（`?v=2`），確保瀏覽器即時反映最新圖示。
    - 在 `vite.config.js` 的 `includeAssets` 補齊 `favicon.ico` 與 `favicon.png` 宣告。

---

## [0.9.0] - 2026-09-12

### Added
- **Google OAuth 2.0 完整身分認證系統 (Google OAuth 2.0 Authentication System)**：
  - **前端登入與權限保護路由 (`LoginPage.jsx`, `ProtectedRoute.jsx`, `authStore.js`)**：
    - 整合 Google Identity Services (GSI) Client SDK，提供一鍵 Google 帳號登入體驗。
    - 採用 Zustand 狀態管理庫實作 `authStore`，支援 Token 自動無感刷新（Silent Refresh）與持久化機制。
    - 建立 `ProtectedRoute` 元件，攔截未登入或過期訪問並優雅導向登入頁面。
    - **登入頁視覺與體驗優化 (`LoginPage.jsx`)**：色調全面對齊內頁暖象牙白（`#FAF8F5`）與柔光毛玻璃卡片，標題正式更新為 `Traveler`，將登入中的 Loading 改配置於 Google 按鈕正下方並結合 Ant Design `Spin`。
  - **後端 Google Apps Script 認證服務 (`backend/AuthService.gs`)**：
    - 實作 `handleLogin`、`handleRefreshToken` 與 `handleLogout`。
    - 透過 Google TokenInfo API 校驗 Google ID Token，自動建立或維護 `Users` 工作表與 `Sessions` 工作表。
  - **首頁右上角登出按鈕與確認彈窗 (`HomePage.jsx`, `LogoutConfirmModal.jsx`)**：
    - 在首頁卡片 Header 右上角配置自適應定位之毛玻璃圓形 `LogOut` 圖示按鈕。
    - 採用與專案既有 `DeleteConfirmModal` 一致的置中全螢幕毛玻璃遮罩 Modal（`LogoutConfirmModal`），具備深木褐品牌操作按鈕（`btn-save`）與 Loading 狀態防呆。
    - 搭配 Ant Design `Tooltip` 懸停顯示當前登入者名稱與 Email。
    - 點擊確認後呼叫後端徹底刪除 Sessions 工作表的 Session 紀錄，並同步重置 Zustand `authStore` 狀態，安全導向登入頁面。
- **Google Sheet 多使用者資料隔離機制 (Multi-User Data Isolation)**：
  - **資料庫欄位擴充與防呆自動補齊 (`Trips`, `PackingItems`, `Until.gs`)**：
    - `Trips` 工作表新增 `userId` 欄位（標記行程擁有者）與 `readOnlyId`（安全唯讀分享短代碼）。
    - `PackingItems` 工作表新增 `userId` 欄位（標記個人專屬攜帶清單）。
    - 於 `Until.gs` 實作 `ensureSheetHeaders` 函式，程式運行時自動檢查並補齊缺失欄位，免去手動維護試算表負擔。
  - **歷史舊資料無痛自動認領遷移機制 (`TripsService.gs`, `InitData.gs`)**：
    - 登入查詢旅程時，自動掃描並將未標記 `userId` 的舊測試資料綁定至當前登入者，確保升級後既有行程無痛繼承。
    - 於 `InitData.gs` 額外提供 `migrateLegacyDataToUser` 手動遷移工具腳本。
  - **嚴密後端擁有者權限守門 (`backend/Main.gs`, `TripsService.gs`)**：
    - GET 請求（`getTrips`、`getPackingItems`）強制依登入者 `userId` 進行過濾隔離。
    - 所有寫入、更新與刪除操作（`createSchedule`、`updateSchedule`、`deleteSchedule`、`updateTripInfo`、`uploadTripImage`、`deleteTrip` 等）全面驗證是否為該行程之 Owner，杜絕越權篡改。
    - 行程詳情（`getTripDetails`）支援雙軌分流：真實 `tripId` 需為 Owner，`readOnlyId` 則提供訪客唯讀瀏覽。
  - **個人行李清單專屬服務模組 (`backend/PackingItemsService.gs`)**：
    - 新增獨立服務模組，完整支援 `getUserPackingItems`、`addPackingItem`、`togglePackingItem` 與 `deletePackingItem`，並落實 `userId` 資料隔離。
  - **旅程級聯刪除實作 (`TripsService.gs`)**：
    - 實作 `deleteTrip`，刪除旅程時連帶清理 `Trips_Info` 與 `Schedules` 的所有關聯列。

### Changed
- **前端快取策略調整：全面停用 sessionStorage 快取 (`src/utils/api.js`)**：
  - 移除 GET 請求對 `sessionStorage` 的寫入與讀取，確保每次進入首頁清單或旅程詳情皆向後端發起即時 API 請求，取得試算表最新現況。
  - 載入時自動清理瀏覽器歷史殘留的 `api_cache_` 項目。
  - 保留微毫秒級併發請求去重機制 (`_inflightRequests`)，防止 React StrictMode 重複發送相同請求。
- **首頁錯誤提示體驗優化 (`HomePage.jsx`)**：
  - 將原本覆蓋全螢幕的「讀取失敗」畫面改為 Header 下方的輕量級 Warning Banner，在 API 連線異常時仍保留攜帶清單與新增旅程等功能按鈕操作。
- **GAS 後端部署進入點更新 (`src/config.js`)**：
  - 更新 `API_URL_GAS` 至最新發布之 Web App 部署端點。

---

## [0.8.5] - 2026-09-11

### Changed
- **行程間交通方式指示箭頭 UI 緊湊化佈局 (Compact Horizontal Transit Arrow UI)**：
  - **Icon 與時間左右水平並排收攏 (`TransportArrow`)**：將原本上下三行垂直堆疊（Icon 圓徽章 ➔ 時間 ➔ 箭頭）改為單一圓角膠囊 Badge 內水平並排（`[ 🚌 5m ]`），下方居中配置向下箭頭 `↓`。
  - **垂直高度縮減與微質感優化**：縮減卡片間垂直高度（`my-1.5`、Icon 由 20px 調整為 15px），搭配精緻毛玻璃圓角膠囊與微陰影，解決上下排列導致卡片間距過長的問題，提升整體視覺俐落感與瀏覽節奏。

## [0.8.4] - 2026-09-10

### Added
- **彈性備案左右順序調換與轉正主要行程功能 (Reorder & Promote Backup Schedules)**：
  - **備案卡片操作選單分流 (`CardMenu`)**：
    - 主要行程卡片（`altOrder === 0`）維持原有管理選單。
    - 彈性備案卡片（`altOrder > 0`）精簡非必要選項，專屬提供「向左移 (`ArrowLeft`)」、「向右移 (`ArrowRight`)」、「設為主要行程 (`CheckCircle2`)」。
    - 邊界防呆機制：最右側末位備案之「向右移」按鈕自動置灰並停用點擊（`disabled`），首位備案之「向左移」按鈕亦自動停用。
  - **智慧主行程變更與交通資訊無縫繼承**：
    - 當備案卡片透過「向左移」置於群組首位（index 0）或點選「設為主要行程」時，該備案正式升格為主要行程（`altOrder = 0`），原主行程與其他備案依序向後順延。
    - GAS 後端演算於變更主行程時，自動將原主行程的前置抵達交通資訊（`transportType`、`transportDurationMinutes` 等）移轉給新主行程繼承，原主行程交通資訊清空，確保上一行程至此點的交通箭頭連接不斷裂。
    - 主行程變更成功後，前端即時以 Ant Design `message.success('主行程被變更了, 記得調整交通方式與時間喔')` 提示使用者檢查交通與時間。
  - **自動聚焦滾動與批次 State 響應 (`TripPage.jsx`)**：
    - 完成換位後透過 `scrollToIndex` 平滑滾動聚焦至該卡片之最新排列位置。
    - 前端以 `Map` 批次合併後端回傳之更新項目至 React `journeys` state，達成即時無縫響應。
  - **前端 API 服務層與後端路由擴充 (`apiService.js`, `backend/SchedulesService.gs`, `backend/Main.gs`)**：
    - 新增 `reorderGroupBackups(tripId, groupId, orderedIds)` 介面。
    - 後端新增 `reorderGroupBackups(payload)` 商業邏輯，支援批次計算與寫回 Google 試算表。

### Fixed
- **修復 SortableGroup 中 Props 解構遺漏導致的 ReferenceError (`TripPage.jsx`)**：
  - 於 `SortableGroup` 元件參數列表中補齊 `onMoveBackupLeft`、`onMoveBackupRight` 與 `onPromoteToMain` 等回呼函式之解構接收，徹底修復點選「向右移」時因函式作用域未定義所引發的 `Uncaught ReferenceError: onMoveBackupRight is not defined` 錯誤。

## [0.8.3] - 2026-09-10

### Added
- **交通方式自動連鎖順延後續行程時間 (Automatic Cascading Time Shift for Transit)**：
  - **自動順延開關 (`TransportFormModal.jsx`)**：於交通方式表單中新增 Ant Design `Checkbox`「自動順延後續行程」（預設為勾選狀態），送出時直接連帶處理，無冗餘確認彈窗。
  - **後端單一 Single Source of Truth 演算架構 (`backend/SchedulesService.gs`)**：由 Google Apps Script 後端作為唯一商業邏輯來源，於 `updateSchedule` 處理 `autoShift: true`，單次 HTTP 請求即可在後端完成時間衝突檢測、連鎖推移與試算表寫入。
  - **智慧接續與停留時長維持**：當「前卡結束時間 + 交通時間 > 當前卡片開始時間」時自動順延，並維持該卡片原有的停留時長（`EndTime - StartTime`）；若擠壓到下一張卡片則繼續骨牌式連鎖後推，直到遇見足夠空檔為止。
  - **同群組彈性備案同步連動**：群組內的彈性備案（`altOrder > 0`）自動跟隨主方案進行相同時間差的同步推移；無填寫時間之卡片自動略過，不中斷推移鏈。
  - **跨日午夜邊界防呆截斷**：若連鎖順延導致卡片時間超過當日 23:59，後端自動將結束時間貼平於 `23:59` 並標記 `clampedToMidnight: true`，前端透過 Ant Design `message.info` 即時提醒使用者。
  - **批次 State 響應 (`TripPage.jsx`)**：API 回傳包含目標卡片與所有被推移卡片的最新資料，前端以 `Map` 批次合併至 `journeys` state，畫面即時無縫響應。

### Changed
- **後端查詢回傳交通欄位補齊 (`backend/Until.gs`)**：
  - 於 `groupToJourneys` 補齊 `transportType`、`transportCustomName`、`transportDurationMinutes` 與 `transportRemark` 欄位輸出，確保查詢行程時能完整載入交通資訊。
- **GAS 部署 API 端點更新 (`src/config.js`)**：
  - 更新 `API_URL_GAS` 至最新發布之 Google Apps Script Web App 進入點。

## [0.8.2] - 2026-09-04

### Added
- **PWA App 圖示與分頁 Favicon 圖示分流設定 (PWA App Icon & Favicon Disambiguation)**：
  - **PWA App 圖示 (`pwa-192x192.png`, `pwa-512x512.png`, `apple-touch-icon.png`)**：將「現代飛機輪廓與火柴人」圖案設定為獨立的 PWA 安裝圖示、主畫面應用程式圖示與 iOS Apple Touch Icon。
  - **網頁分頁 Favicon (`favicon.svg`)**：將瀏覽器分頁頁籤圖示設定為首頁同款的深木褐小飛機（`#583f24`），維持網頁分頁素雅質感。
  - **PWA Web Manifest & Vite 靜態資產配置 (`vite.config.js` & `index.html`)**：完整更新 PWA 資源包含清單、主題色（`#583f24`）、背景色（`#faf8f5`）與 iOS / Android 裝置專屬圖示關聯。

## [0.8.1] - 2026-09-04

### Added
- **行程時間衝突檢測與雙向自動推移機制 (Time Conflict Detection & Auto-Resolution)**：
  - **雙向時間衝突演算法 (`timeSortUtils.js` / GAS `backend/SchedulesService.gs`)**：支援雙向衝突檢測（包含新行程覆蓋既有行程開頭，或既有行程結尾覆蓋新行程），並依據重疊區間自動計算建議推移時間（`startTime` 或 `endTime`）。
  - **衝突提醒彈窗 (`ConflictModal.jsx`)**：當行程時間重疊時彈窗提示使用者，提供「是 (調整時間)」自動更新被影響行程時間，與「否 (置於當天最後)」選項；當行程同時與多張卡片重疊時，精確提示「與『XXX』等多個行程時間嚴重衝突，將置於當天最後面」。
  - **實體按鈕視覺質感 (`Modals.css`)**：為 `ConflictModal` 補齊 `.modal-btn`, `.primary-btn`, `.secondary-btn` 的外框、陰影、懸停上浮質感，取代傳統純文字外框。

### Changed
- **後端統一衝突檢測與自動排序架構 (Backend-Driven Conflict Architecture)**：
  - **單一 API 傳輸與衝突職責下沉**：將時間衝突分析、行程推移與 `sortOrder` 自動重排計算完全移至 Google Apps Script 後端處理。前端提交表單時若有衝突，後端暫不寫入試算表並回傳 `hasConflict: true`；前端點選彈窗選項後再發送帶有相應旗標（`confirmAdjust` / `skipConflictCheck`）之二次請求。
  - **Spreadsheet 狀態同步與寫回**：GAS 於異動與重排後執行 `SpreadsheetApp.flush()`，確保資料庫與試算表數據實時一致性。
- **對接底層全域 Loading 遮罩 (`actionLoading`)**：
  - 表單儲存與衝突彈窗選項點擊時，無縫對接 `TripPage.jsx` 底層現有的全螢幕毛玻璃 Loading 遮罩 (`action-loading-overlay`)，為非同步請求提供明確且防重複點擊的加載體驗。

### Fixed
- **頁面行程分組排序權重修正 (`TripPage.jsx`)**：
  - 修正 `scheduleGroups` 排序邏輯改為優先比較 `sortOrder`（與後端 `TripsService.gs` 一致），解決點選「否」置於當天最後的卡片因 `startTime` 被誤排在中間的問題。
- **網頁版新增行程表單狀態初始化修正 (`ScheduleFormModal.jsx` & `TripPage.jsx`)**：
  - 修正 `ScheduleForm` 的 `useEffect` 初始邏輯並為元件補上動態 `key` 屬性，徹底解決在網頁版點選查看卡片後再點選「新增行程」時，右側編輯欄位未清空而保留舊卡片資料的 Bug。

## [0.8.0] - 2026-09-04

### Added
- **跨天數移動行程 (Move Schedule Across Days) 功能**：
  - **行程卡片操作選單選單項目**：於行程卡片右上方 `CardMenu` 新增「移動至其他天」選項 (搭配 `ArrowRightLeft` 雙向導覽圖示)。
  - **天數選擇彈窗 (`MoveDayModal.jsx`)**：新建天數選擇 Portal 彈窗，清晰列出 `Day 1` ~ `Day N` 與對應日期，自動過濾 `Day 0 (旅程資訊)`，並將「當前天數」進行狀態標示與點選停用防呆。
  - **彈性備案整組連帶搬移與尾端排程**：跨天移動時會將同屬一個 `groupId` 的主行程與附屬彈性備案一併移動至目標天數，並自動接續於該天現有行程清單的最末端 (`sortOrder = maxSortOrder + 1`)。
- **通用表單驗證服務模組 (`src/utils/validator.js`)**：
  - 新建全域驗證服務，包含 `isRequired` (非空判斷)、`isDateOrderValid` (時間與日期順序檢核) 與 `isValidUrl` (網址檢核) 等原子驗證函式。
  - 提供 `validateScheduleForm` 與 `validateTripForm` Schema 驗證器，將表單防呆邏輯與 Component UI 完全解耦。
- **欄位下方獨立錯誤訊息與外框高亮 (Field-Level Error Messages & Red Borders)**：
  - **欄位獨立紅字與紅框**：重構表單驗證呈現，將錯誤提示精確掛載於每個受影響的 Input / TimePicker 欄位正下方 (`.field-error-text`)，並套用顯眼的紅色外框高亮 (`.input-has-error`)。
  - **即時響應清除機制**：使用者開始在該欄位打字或選擇時間時 (`onChange`)，系統會立即清空該欄位的紅字提示與紅色外框。
  - **原生氣泡關閉**：於表單加上 `noValidate` 並移除 native `required` 屬性，徹底防止 HTML5 瀏覽器原生氣泡遮蓋自訂視覺 UI。

### Changed
- **前後端行程 ID 自動同步與刪除權限修復**：
  - 重構 `ScheduleFormModal.jsx` 新增行程後的回傳處理，確保前端 React State 立即同步 GAS 後端產生的正式卡片 ID，避免未重新整理頁面即進行刪除/編輯時發生前後端 ID 不一致。
  - 優化 `backend/Main.gs` 之 `isValidEditByScheduleId` 反查邏輯，若搜尋不到特定行程 ID 則回傳精確錯誤訊息（如 `找不到指定的行程項目`），解決過去誤報「無編輯權限」的問題。
- **首頁飛機圖案標誌置中修復 (Homepage Logo Alignment)**：
  - 修正首頁 `home-header` 的飛機 SVG 圖示因受 Tailwind CSS 預設重置 (`display: block`) 影響而偏左的問題。將 `.home-header` 改為 Flex Column 容器並結合 `align-items: center` 與 `margin: 0 auto`，確保飛機標誌於首頁頂部完美水平置中。
- **後端 Google Apps Script (GAS) `updateSchedule` 寫入補全**：
  - 於 `backend/SchedulesService.gs` 的 `updateSchedule` 寫入邏輯中補全對 `day` (天數)、`date` (日期) 與 `sortOrder` (排序) 欄位變更的寫入支援。

## [0.7.0] - 2026-09-02

### Added
- **行程間交通方式（Transit Between Spots）功能**：
  - 新增景點卡片間互動交通箭頭元件 (`TransportArrow`)，以「Icon + 預估時間 (如 `15m` 或 `1h 20m`) + 箭頭 (`↓`)」手繪視覺樣式呈現於景點與景點之間。
  - 新增交通方式編輯表單與彈窗 (`TransportFormModal.jsx` 與 `TransportForm`)，支援步行、開車、公車、地鐵、自訂（名稱輸入）、預估花費時間（小時/分鐘）與交通備註說明。
  - 新增交通資訊清除按鈕，點擊後可隨時將箭頭還原為預設淡色箭頭 `↓`。

### Changed
- **網頁版 (Desktop) 與手機版 (Mobile) 差異化編輯體驗**：
  - 網頁版點擊交通箭頭時，直接於右側編輯欄位 (`<aside className="edit-panel">`) 嵌入 `TransportForm`，與行程卡片及航班編輯體驗保持一致。
  - 手機版點擊交通箭頭時，彈出全螢幕/底端 Dialog 彈窗。
- **預估花費時間輸入框樣式優化**：
  - 採用左右兩組數值 Input (小時與分鐘分開)，搭配 HTML5 Datalist Autocomplete 下拉建議選單 (0-24 小時, 1-60 分鐘)。
  - 數值靠左對齊，採用單一外框完整包裹輸入區、Autocomplete 箭頭 `▼` 與右側灰色固定單位標籤 (`小時` / `分鐘`)，且徹底隱藏內層 Input 的預設邊框與背景，解決瀏覽器箭頭遮蓋單位文字的問題。
- **後端 Google Apps Script (GAS) `Schedules` 欄位擴充**：
  - 於 `traveler/backend/SchedulesService.gs` 與 `InitData.gs` 擴充 `transportType`, `transportCustomName`, `transportDurationMinutes`, `transportRemark` 4 個欄位與對應 CRUD 邏輯。

## [0.6.0] - 2026-09-01

### Added
- **API 服務適配器層 (`apiService.js`)**：採用 Adapter Pattern 與 Strategy Pattern，建立全域統一 API 服務層，完美將前端 UI 元件與後端通訊傳輸細節完全解耦。
- **旅行攜帶清單（Packing List）API 串接與適配器擴充**：於 `apiService.js` 新增 `getPackingItems`, `addPackingItem`, `togglePackingItem`, `deletePackingItem` 4 個非同步 CRUD 方法，支援 GAS 與 .NET Core API 雙模式。

### Changed
- **第一層 Component 統一 DTO 化**：所有 React 元件 (`HomePage`, `TripPage`, `ScheduleFormModal`, `DeleteConfirmModal`, `TripInfoFormModal`, `NewTripModal`, `PackingListPage`) 改以標準 DTO 呼叫 `apiService`。
- **攜帶清單頁面視覺對齊**：重構 `PackingListPage.jsx` 解耦舊式內聯 `fetch` 呼叫，將自訂 Checkbox 與按鈕視覺全面統一為專案深木褐色調與莫蘭迪質感。
- **備案行程電腦版導覽優化**：於卡片右上角呈現 `1 / N` 頁數計數標籤，並於電腦版提供左右導覽箭頭按鈕 (`‹` `›`)，實現滑鼠一鍵平滑切換查看備案景點。
- **行程詳情表單版面與備註填滿優化**：調整行程編輯面板欄位順序（名稱 ➔ 時間 ➔ 備註 ➔ Google Map 連結），並將「備註」Textarea 設定為自動延伸填滿面板剩餘垂直空間。
- **手機版標題列與天數列置頂暨卡片獨立滾動**：將手機版畫面鎖定為 `100dvh` 全螢幕動態高度，頂部 Title 列與天數頁籤列恆久固定置頂，中段行程卡片區塊獨立垂直滾動，並於切換天數時自動將列表歸零至頂部。
- **手機端智慧型手勢分流 (備案滑動 vs 天數切換)**：實現手機端手勢智慧判斷，於備案卡片左右滑動可切換備案景點，於無備案卡片或背景空白處滑動可切換天數（附帶 300ms 滑動淡入動畫與天數標籤自動居中）。
- **行程卡片複製功能 (Copy Schedule Card)**：於行程卡片選單中新增「複製」選項（帶有 Copy 圖示），點擊後複製原卡片內容（時間清空）並自動排列於當天最下方，支援全域半透明 Loader 加載遮罩與即時 State 渲染。
- **無時間行程卡片標籤隱藏**：當卡片未設定起訖時間時，自動隱藏左上角灰色外框時間標籤（`.time`），維持畫面素雅乾淨。
- **全域操作 Loading 加載遮罩 (Action Loading Overlay)**：於底層 `src/index.css` 建立全域浮動加載遮罩樣式（`action-loading-overlay`），為非同步 API 快捷操作提供明確且防重複點擊的加載體驗。
- **CSS 行內樣式規範重構**：將 `ScheduleFormModal` 與 `TripInfoFormModal` 中所有 JSX 行內樣式 (`style={{ ... }}`) 全數抽離至對應的 `Modals.css` 專屬樣式檔。
- **無縫雙後端切換 (`config.js`)**：提供 `API_MODE` (`'GAS'` 或 `'NET_CORE'`) 設定，可在 Google Apps Script 與 .NET Core API 之間一鍵切換，無需調整任何前端畫面邏輯。

### Fixed
- **API 通訊與 `Failed to fetch` 重試修復**：強化 `src/utils/api.js` 中 `fetchWithRetry` 異常捕獲與指數退避重試機制，徹底排除網路瞬斷或跨域重導向導致的 `Failed to fetch` 錯誤。
- **選取行程卡片頂邊框修復**：修正 `.horizontal-scroll` 頂部內邊距與 overflow 屬性，排除高亮深木褐外框在卡片向上微移時頂邊框遭容器裁切的現象。

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
