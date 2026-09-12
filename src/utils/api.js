import { API_URL } from '../config'
import { refreshAccessToken } from '../services/authService'
import { useAuthStore } from '../stores/authStore'

// ---------------------------------------------------------------------------
// In-flight request deduplication map: 防止在同一瞬間（如 React StrictMode 或快速渲染）
// 重複對同一個 GET URL 發送請求
// ---------------------------------------------------------------------------
const _inflightRequests = new Map()

// 一次性清理瀏覽器 sessionStorage 中可能殘留的舊 API 快取資料
try {
  const staleKeys = []
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i)
    if (k && k.startsWith('api_cache_')) staleKeys.push(k)
  }
  staleKeys.forEach((k) => sessionStorage.removeItem(k))
} catch {
  // 忽略無 sessionStorage 存取權之環境例外
}

// ---------------------------------------------------------------------------
// Helper: sleep for `ms` milliseconds.
// ---------------------------------------------------------------------------
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// ---------------------------------------------------------------------------
// Helper: raw fetch with exponential backoff retry on 429 Too Many Requests.
// Retries up to `maxRetries` times, starting with `initialDelayMs` (doubles
// each attempt).
// ---------------------------------------------------------------------------
const fetchWithRetry = async (url, options = {}, maxRetries = 3, initialDelayMs = 1500) => {
  let delay = initialDelayMs
  let lastErr
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options)
      if (res.status !== 429) return res
      console.warn(
        `[api] 429 received for ${url}. Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`
      )
    } catch (err) {
      lastErr = err
      console.warn(`[api] Network fetch failed for ${url} (attempt ${attempt + 1}/${maxRetries + 1}):`, err)
    }
    if (attempt < maxRetries) {
      await sleep(delay)
      delay *= 2 // exponential backoff
    }
  }
  throw lastErr || new Error(`[api] Failed to fetch ${url}`)
}

// ---------------------------------------------------------------------------
// getAuthHeaders
//
// 取得帶有 Authorization Bearer token 的 header 物件。
// 如果 accessToken 快過期（提前 60 秒），先嘗試無感刷新。
// 刷新失敗（refreshToken 也過期）則執行登出。
// ---------------------------------------------------------------------------
let _isRefreshing = false  // 全域 flag，防止多個請求同時觸發 refresh
let _refreshPromise = null // 共用同一個 refresh Promise，避免重複打

export async function getAuthHeaders(existingHeaders = {}) {
  const store = useAuthStore.getState()
  const { accessToken, refreshToken, isAccessTokenExpired, updateAccessToken, logout } = store

  // 未登入狀態（公開 API）：不帶 token
  if (!accessToken) return existingHeaders

  // Access Token 還在有效期內：直接帶 token
  if (!isAccessTokenExpired()) {
    return { ...existingHeaders, Authorization: `Bearer ${accessToken}` }
  }

  // Access Token 過期：嘗試無感刷新
  if (!refreshToken) {
    logout()
    throw new Error('AUTH_EXPIRED')
  }

  // 防止多個 concurrent 請求同時 refresh，共用同一個 Promise
  if (!_isRefreshing) {
    _isRefreshing = true
    _refreshPromise = refreshAccessToken(refreshToken)
      .then((data) => {
        updateAccessToken(data.accessToken, data.accessExpiresAt)
        return data.accessToken
      })
      .catch((err) => {
        console.error('[api] Refresh token 失效，強制登出:', err)
        logout()
        throw new Error('AUTH_EXPIRED')
      })
      .finally(() => {
        _isRefreshing = false
        _refreshPromise = null
      })
  }

  const newToken = await _refreshPromise
  return { ...existingHeaders, Authorization: `Bearer ${newToken}` }
}

// ---------------------------------------------------------------------------
// cachedFetch
//
// ---------------------------------------------------------------------------
// cachedFetch：API 網路請求封裝器
//   1. 完全不儲存於 sessionStorage，確保每次請求皆向後端撈取最即時資料。
//   2. 保留 In-flight Deduplication（在同一瞬間發起相同 URL 的請求時共用 Promise，
//      避免 React StrictMode 或快速多次渲染造成的重發）。
//   3. 網路錯誤或 HTTP 429 時自動指數退避重試（exponential backoff）。
// ---------------------------------------------------------------------------
/**
 * 發送 API 請求封裝函式（不儲存快取於 sessionStorage，確保資料最新）
 * @param {string} url - 請求的完整 URL
 * @param {RequestInit} [options={}] - fetch 請求設定參數
 * @returns {Promise<Response>} 回應物件
 */
export const cachedFetch = async (url, options = {}) => {
  const isGet = !options.method || options.method.toUpperCase() === 'GET'

  // ── 非 GET 請求（POST / PUT / DELETE）直接走重試請求發送 ──
  if (!isGet) {
    return fetchWithRetry(url, options)
  }

  // ── GET 請求 ──
  // 1. 同一瞬間重複請求去重：若當前已有相同的 URL 請求在進行中，直接共用同一個 Promise
  if (_inflightRequests.has(url)) {
    try {
      const text = await _inflightRequests.get(url)
      return makeMockResponse(text)
    } catch (err) {
      throw err
    }
  }

  // 2. 直接發送網路請求（不讀取任何 sessionStorage）
  const fetchPromise = fetchWithRetry(url, options).then(async (res) => {
    if (res.ok) {
      return await res.text()
    }
    // 非 200 回應拋出錯誤
    const errText = await res.text()
    throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`)
  })

  // 記錄至 in-flight Map 中
  _inflightRequests.set(url, fetchPromise)
  try {
    const text = await fetchPromise
    _inflightRequests.delete(url)
    return makeMockResponse(text)
  } catch (err) {
    _inflightRequests.delete(url)
    throw err
  }
}

// ---------------------------------------------------------------------------
// Internal helper: returns a Response-like object from a cached text string.
// ---------------------------------------------------------------------------
function makeMockResponse(text) {
  return {
    ok: true,
    status: 200,
    json: async () => JSON.parse(text),
    text: async () => text,
    clone() { return this },
  }
}
