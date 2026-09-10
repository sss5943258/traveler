/**
 * API 後端模式配置 (API Mode Configuration)
 * 
 * - 'GAS': 採用 Google Apps Script (通訊包含 action payload)
 * - 'NET_CORE': 採用 ASP.NET Core API (通訊採標準 RESTful HTTP 請求)
 */
export const API_MODE = 'GAS'; // 可切換為 'NET_CORE'

export const API_URL_GAS =
  'https://script.google.com/macros/s/AKfycbxCCQ0AucScXwWh4KiYJZKCHGkJO3AuHqqLrotwSeVws0NAq7wVZsQ-S1NmTxgl-ShRtg/exec';

export const API_URL_NET_CORE = 'http://localhost:5005/api';

// 自動根據 API_MODE 設定對應的 API 進入點
export const API_URL = API_MODE === 'GAS' ? API_URL_GAS : API_URL_NET_CORE;
