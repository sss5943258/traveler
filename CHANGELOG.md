# Changelog

All notable changes to this project will be documented in this file.

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
