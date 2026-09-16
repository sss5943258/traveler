import { API_MODE, API_URL_GAS, API_URL_NET_CORE } from '../config'

/**
 * authService - 負責與後端進行使用者認證與權杖管理
 * 
 * 支援雙後端模式適配：
 * 1. GAS 模式：透過純文字 POST 與 Google Apps Script 通訊
 * 2. NET_CORE 模式：透過標準 RESTful JSON POST 與 ASP.NET Core 的 /api/auth 通訊
 * 
 * 注意：本模組不走 apiService 的 sendRequest，以避免 circular dependency (循環依賴)
 */

/**
 * 共用 GAS POST 請求發送器
 * GAS 要求 Content-Type 為 text/plain 才能正確接收 JSON body (CORS 限制)
 * @param {Object} payload 傳遞給 GAS 的資料載荷
 */
async function gasPost(payload) {
  const res = await fetch(API_URL_GAS, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload),
  })

  const text = await res.text()
  let result
  try {
    result = JSON.parse(text)
  } catch {
    throw new Error(`GAS 回傳非 JSON 格式: ${text.slice(0, 200)}`)
  }

  if (result.status === 'error' || result.error) {
    throw new Error(result.message || result.error || '認證失敗')
  }

  return result
}

/**
 * 共用 .NET Core RESTful POST 請求發送器
 * 使用標準 application/json 標頭與 ASP.NET Core API 溝通
 * 
 * [React 小白觀念解析]：
 * 當後端發生 500 錯誤或噴出例外堆疊時，回傳的可能是一段純文字（如 Npgsql.PostgresException），
 * 而不是標準的 JSON 格式。若直接呼叫 res.json() 就會爆出 "Unexpected token 'N'... is not valid JSON"，
 * 導致後端真實的錯誤訊息被掩蓋。
 * 因此先以 res.text() 取出字串再嘗試 JSON.parse()，解析失敗時直接呈現後端真實錯誤。
 * 
 * @param {string} endpoint 子路徑 (例如 '/auth/google')
 * @param {Object} payload 傳遞給 API 的 JSON 載荷
 */
async function netCorePost(endpoint, payload) {
  const res = await fetch(`${API_URL_NET_CORE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const text = await res.text()
  let result
  try {
    result = JSON.parse(text)
  } catch {
    // 若後端回傳非 JSON (例如 500 的例外字串)，直接拋出該文字以便精準除錯
    throw new Error(`[後端伺服器錯誤 ${res.status}] ${text.slice(0, 300)}`)
  }

  if (!res.ok || result.status === 'error' || result.error) {
    throw new Error(result.message || result.error || `請求失敗 (HTTP ${res.status})`)
  }

  return result
}

/**
 * loginWithGoogle - 用 Google GIS 拿到的 id_token 換取後端 Session Token
 * 
 * [React 小白觀念解析]：
 * 使用者在點擊 Google 登入按鈕後，Google SDK 會回傳一個 id_token (JWT)。
 * 前端不能直接信任該 Token，而是必須把它送到我們自己的後端伺服器；
 * 後端會與 Google 官方伺服器確認真偽，並發行專屬於我們系統的 accessToken 與 refreshToken。
 * 
 * @param {string} idToken - Google GIS 回傳的 JWT id_token
 * @returns {Promise<{ accessToken, refreshToken, accessExpiresAt, user }>}
 */
export async function loginWithGoogle(idToken) {
  if (API_MODE === 'NET_CORE') {
    return await netCorePost('/auth/google', { idToken })
  }
  return await gasPost({
    action: 'login',
    idToken,
  })
}

/**
 * refreshAccessToken - 用 refreshToken 換取新的 accessToken (無感自動刷新)
 * 
 * [React 小白觀念解析]：
 * accessToken 通常為了安全性只有 15 分鐘有效壽命。
 * 當 API 攔截器 (api.js) 發現 token 快過期或過期時，會在背景自動執行此函式，
 * 拿存在本地的 refreshToken 換取新的 accessToken，避免使用者操作到一半被迫跳回登入頁。
 * 
 * @param {string} refreshToken - 存在 localStorage 的 Refresh Token
 * @returns {Promise<{ accessToken, accessExpiresAt }>}
 */
export async function refreshAccessToken(refreshToken) {
  if (API_MODE === 'NET_CORE') {
    return await netCorePost('/auth/refresh', { refreshToken })
  }
  return await gasPost({
    action: 'refreshToken',
    refreshToken,
  })
}

/**
 * logoutFromServer - 通知後端撤銷當前 Session 與權杖 (選擇性呼叫)
 * 
 * [React 小白觀念解析]：
 * 登出時，除了前端要把 Zustand Store 與 LocalStorage 中的 token 清空外，
 * 也應通知後端將 Session 標記為失效 (isRevoked = true)，防止 token 被惡意盜用。
 * 
 * @param {string} accessToken - 目前的 Access Token
 * @param {string} [refreshToken] - 目前的 Refresh Token (供 .NET Core 撤銷)
 */
export async function logoutFromServer(accessToken, refreshToken) {
  try {
    if (API_MODE === 'NET_CORE') {
      await netCorePost('/auth/logout', { accessToken, refreshToken })
    } else {
      await gasPost({
        action: 'logout',
        accessToken,
      })
    }
  } catch (err) {
    // 後端撤銷失敗不阻止前端登出流程，只記錄警告
    console.warn('[authService] 後端 logout 失敗（本地 token 已清除）:', err)
  }
}
