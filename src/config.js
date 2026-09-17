import packageJson from '../package.json';

/**
 * 系統環境與 API 後端模式配置 (API Environment & Mode Configuration)
 * 
 * 支援三種切換模式：
 * - 'GAS': Google Apps Script 後端 (試算表架構)
 * - 'LOCAL': 本地端 ASP.NET Core 後端 (http://localhost:5005/api)
 * - 'RENDER': 雲端 Render ASP.NET Core 後端 (https://travel-app-api-h5ix.onrender.com/api)
 */
/**
 * 應用程式版本號 (Application Version)
 * 自動讀取 package.json 中的 version 欄位，確保前後版本資訊同步一致
 */
export const APP_VERSION = packageJson.version || '1.0.0';

// ── 系統環境判定 ──────────────────────────────────────────────────
// 1. 優先讀取 .env 的 VITE_ENV ('GAS' | 'LOCAL' | 'RENDER')
// 2. 若未手動指定，依據打包模式自動切換：
//    - 開發模式 (npm run dev)：預設連線本地 'LOCAL'
//    - 正式建置 (npm run build / GitHub Pages)：自動切換為雲端 'RENDER'
export const ENV =
  import.meta.env.VITE_ENV ||
  (import.meta.env.PROD ? 'RENDER' : 'LOCAL');

// ── 1. Google Apps Script 進入點 ──────────────────────────────────
export const API_URL_GAS =
  'https://script.google.com/macros/s/AKfycbxnsi1P1YBh0ovDiMq5vsDc6BsGSx0P4HUW0EXulWWsA83_3k3BZph0WBhHuYiND_CJOg/exec';

// ── 2. ASP.NET Core 本地與雲端進入點 ──────────────────────────────
export const API_URL_NET_CORE_LOCAL = 'http://localhost:5005/api';
export const API_URL_NET_CORE_RENDER = 'https://travel-app-api-h5ix.onrender.com/api';

// 自動根據 ENV 決定當前指向的 .NET Core 網址 (向下相容 apiService.js)
export const API_URL_NET_CORE =
  ENV === 'LOCAL' ? API_URL_NET_CORE_LOCAL : API_URL_NET_CORE_RENDER;

// 自動判斷協議模式：提供給 apiService 用於決定是走 GAS 封裝還是標準 RESTful (向下相容)
export const API_MODE = ENV === 'GAS' ? 'GAS' : 'NET_CORE';

// ── 3. 目前環境啟用的統一 API 進入點 ────────────────────────────────
export const API_URL = ENV === 'GAS' ? API_URL_GAS : API_URL_NET_CORE;

/**
 * Google OAuth 2.0 Client ID
 * 從 .env 的 VITE_GOOGLE_CLIENT_ID 讀取
 * 需在 Google Cloud Console 建立 OAuth 2.0 用戶端 ID (應用程式類型: Web 應用程式)
 */
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
