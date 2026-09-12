/**
 * API 後端模式配置 (API Mode Configuration)
 * 
 * - 'GAS': 採用 Google Apps Script (通訊包含 action payload)
 * - 'NET_CORE': 採用 ASP.NET Core API (通訊採標準 RESTful HTTP 請求)
 */
export const API_MODE = 'GAS'; // 可切換為 'NET_CORE'

export const API_URL_GAS =
  'https://script.google.com/macros/s/AKfycbwChDnIedPcpNn_lwfLowUxvtYKRkk6Awb47-NTaQlmmyIEh3xD4cXQDe4QGrGTwtj2sg/exec';

export const API_URL_NET_CORE = 'http://localhost:5005/api';

// 自動根據 API_MODE 設定對應的 API 進入點
export const API_URL = API_MODE === 'GAS' ? API_URL_GAS : API_URL_NET_CORE;

/**
 * Google OAuth 2.0 Client ID
 * 從 .env 的 VITE_GOOGLE_CLIENT_ID 讀取
 * 需在 Google Cloud Console 建立 OAuth 2.0 用戶端 ID (應用程式類型: Web 應用程式)
 */
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
