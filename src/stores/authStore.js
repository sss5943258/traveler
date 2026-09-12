import { create } from 'zustand'

// localStorage key 常數，集中管理避免打錯
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'auth_access_token',
  REFRESH_TOKEN: 'auth_refresh_token',
  USER: 'auth_user',
  ACCESS_EXPIRES_AT: 'auth_access_expires_at',
}

/**
 * 從 localStorage 讀取初始狀態
 * 頁面重整後自動恢復登入狀態，不需要重新登入
 */
function loadFromStorage() {
  try {
    return {
      accessToken: localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) || null,
      refreshToken: localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN) || null,
      accessExpiresAt: Number(localStorage.getItem(STORAGE_KEYS.ACCESS_EXPIRES_AT)) || null,
      user: JSON.parse(localStorage.getItem(STORAGE_KEYS.USER) || 'null'),
    }
  } catch {
    return { accessToken: null, refreshToken: null, accessExpiresAt: null, user: null }
  }
}

/**
 * authStore - 使用 Zustand 管理全域登入狀態
 * 
 * Zustand 是一個輕量的 React 狀態管理庫
 * create() 建立一個 store，第一個參數是 setter 函式 (set)
 * 使用方式: const { user, login } = useAuthStore()
 */
export const useAuthStore = create((set, get) => ({
  // ── State ──────────────────────────────────────────────────────────────────
  ...loadFromStorage(),
  isLoading: false,        // 正在驗證 token 或登入中
  isInitialized: false,    // App 啟動時是否已完成初始化檢查

  // ── Actions ────────────────────────────────────────────────────────────────

  /**
   * login - 登入成功後呼叫，將 token 與使用者資料存入 state 和 localStorage
   * @param {string} accessToken - 短效 Access Token (15 分鐘)
   * @param {string} refreshToken - 長效 Refresh Token (30 天)
   * @param {number} accessExpiresAt - Access Token 到期時間 (Unix timestamp ms)
   * @param {Object} user - { userId, email, name, picture }
   */
  login: (accessToken, refreshToken, accessExpiresAt, user) => {
    // 同步寫入 localStorage，確保頁面重整後仍維持登入
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken)
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken)
    localStorage.setItem(STORAGE_KEYS.ACCESS_EXPIRES_AT, String(accessExpiresAt))
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user))

    set({ accessToken, refreshToken, accessExpiresAt, user, isLoading: false })
  },

  /**
   * logout - 登出，清除所有 token 和使用者資料
   * 後續由 ProtectedRoute 偵測到 user 為 null 後自動導向 /login
   */
  logout: () => {
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key))
    set({ accessToken: null, refreshToken: null, accessExpiresAt: null, user: null })
  },

  /**
   * updateAccessToken - 刷新 Access Token 後，更新 state 和 localStorage
   * (Refresh Token 不換，只換 Access Token)
   * @param {string} newAccessToken
   * @param {number} newExpiresAt - 新的到期時間 (Unix timestamp ms)
   */
  updateAccessToken: (newAccessToken, newExpiresAt) => {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, newAccessToken)
    localStorage.setItem(STORAGE_KEYS.ACCESS_EXPIRES_AT, String(newExpiresAt))
    set({ accessToken: newAccessToken, accessExpiresAt: newExpiresAt })
  },

  /**
   * isAccessTokenExpired - 判斷 Access Token 是否已過期或即將過期
   * 提前 60 秒視為過期，觸發 refresh，避免卡在邊界值
   */
  isAccessTokenExpired: () => {
    const { accessExpiresAt } = get()
    if (!accessExpiresAt) return true
    return Date.now() >= accessExpiresAt - 60 * 1000 // 提前 60 秒
  },

  /**
   * setLoading - 設定 loading 狀態 (登入流程中使用)
   */
  setLoading: (isLoading) => set({ isLoading }),

  /**
   * setInitialized - App 啟動初始化完成後呼叫
   */
  setInitialized: () => set({ isInitialized: true }),
}))
