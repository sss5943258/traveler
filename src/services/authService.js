import { API_URL_GAS } from '../config'

/**
 * authService - 負責與 GAS 後端的認證相關 API 通訊
 * 
 * 注意：這個 service 不走 apiService 的 sendRequest，
 * 因為 authService 是 sendRequest 的依賴方（需要先拿到 token 才能打其他 API）
 * 避免循環依賴，直接使用 fetch。
 */

const GAS_URL = API_URL_GAS

/**
 * 共用 GAS POST 請求發送器
 * GAS 要求 Content-Type 為 text/plain 才能正確接收 JSON body (CORS 限制)
 */
async function gasPost(payload) {
  const res = await fetch(GAS_URL, {
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
 * loginWithGoogle - 用 Google GIS 拿到的 id_token 換取後端 Session Token
 * 
 * 流程：
 * 1. 前端用 GIS SDK 取得 Google id_token (1 小時有效)
 * 2. 呼叫此函式，將 id_token 傳給 GAS
 * 3. GAS 驗證 id_token 真實性後，發行 accessToken + refreshToken
 * 4. 回傳 { accessToken, refreshToken, accessExpiresAt, user }
 * 
 * @param {string} idToken - Google GIS 回傳的 JWT id_token
 * @returns {{ accessToken, refreshToken, accessExpiresAt, user }}
 */
export async function loginWithGoogle(idToken) {
  return gasPost({
    action: 'login',
    idToken,
  })
}

/**
 * refreshAccessToken - 用 refreshToken 換取新的 accessToken
 * 
 * 當 accessToken 過期（15 分鐘），自動呼叫此函式無感刷新，
 * 使用者不需要重新登入，直到 refreshToken 也過期（30 天）
 * 
 * @param {string} refreshToken - 存在 localStorage 的 Refresh Token
 * @returns {{ accessToken, accessExpiresAt }}
 */
export async function refreshAccessToken(refreshToken) {
  return gasPost({
    action: 'refreshToken',
    refreshToken,
  })
}

/**
 * logoutFromServer - 通知 GAS 後端撤銷 token（選擇性呼叫）
 * 即使網路失敗，前端也應該清除本地 token 完成登出
 * 
 * @param {string} accessToken - 目前的 Access Token
 */
export async function logoutFromServer(accessToken) {
  try {
    await gasPost({
      action: 'logout',
      accessToken,
    })
  } catch (err) {
    // 後端撤銷失敗不阻止登出流程，只記錄 warning
    console.warn('[authService] 後端 logout 失敗（本地 token 已清除）:', err)
  }
}
