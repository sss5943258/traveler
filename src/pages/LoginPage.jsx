import React, { useEffect, useRef, useState } from 'react'
import { GOOGLE_CLIENT_ID } from '../config'
import { loginWithGoogle } from '../services/authService'
import { useAuthStore } from '../stores/authStore'

/**
 * LoginPage - 全螢幕登入頁
 * 
 * 流程：
 * 1. 頁面載入時動態注入 Google GIS SDK script
 * 2. SDK 準備好後渲染 Google Sign-In 按鈕
 * 3. 使用者點擊 → Google 授權 → 拿到 id_token
 * 4. 呼叫 GAS 後端 login action 換取 accessToken + refreshToken
 * 5. 存入 authStore → ProtectedRoute 偵測到已登入 → 渲染主畫面
 */
export default function LoginPage() {
  const googleBtnRef = useRef(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const login = useAuthStore((state) => state.login)

  useEffect(() => {
    // 動態載入 Google GIS SDK
    // 避免直接在 index.html 寫死 script tag（更容易控制載入時機）
    const scriptId = 'google-gis-sdk'
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script')
      script.id = scriptId
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.onload = initializeGoogleSignIn
      document.head.appendChild(script)
    } else {
      // SDK 已載入（HMR 或頁面快取），直接初始化
      initializeGoogleSignIn()
    }
  }, [])

  /**
   * initializeGoogleSignIn - 初始化 Google Sign-In 按鈕
   * 等待 window.google 出現後才執行（SDK 非同步載入）
   */
  function initializeGoogleSignIn() {
    // 等待 google 物件可用（最多等 5 秒）
    let attempts = 0
    const maxAttempts = 50
    const checkInterval = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(checkInterval)

        // 初始化 Google Identity Services
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCallback,  // 使用者授權後的回呼函式
          auto_select: false,              // 不自動選帳號（讓使用者主動選）
          cancel_on_tap_outside: true,
        })

        // 渲染 Google 官方登入按鈕
        if (googleBtnRef.current) {
          window.google.accounts.id.renderButton(googleBtnRef.current, {
            type: 'standard',
            shape: 'rectangular',
            theme: 'outline',
            text: 'signin_with',
            size: 'large',
            logo_alignment: 'left',
            width: 280,
          })
        }
      } else if (++attempts >= maxAttempts) {
        clearInterval(checkInterval)
        setError('Google 登入服務載入失敗，請重新整理頁面')
      }
    }, 100)
  }

  /**
   * handleGoogleCallback - Google GIS 授權成功後的回呼
   * @param {Object} response - { credential: id_token }
   */
  async function handleGoogleCallback(response) {
    setIsLoading(true)
    setError(null)

    try {
      // response.credential 就是 Google id_token（JWT 格式，1 小時有效）
      const { accessToken, refreshToken, accessExpiresAt, user } = await loginWithGoogle(response.credential)

      // 寫入 Zustand store + localStorage
      login(accessToken, refreshToken, accessExpiresAt, user)
    } catch (err) {
      console.error('[LoginPage] 登入失敗:', err)
      setError(err.message || '登入失敗，請稍後再試')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #2C1A0E 0%, #583f24 40%, #9e7a4e 100%)' }}
    >
      {/* 背景裝飾光暈 */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #d4a96a 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #9e7a4e 0%, transparent 70%)' }}
        />
      </div>

      {/* 主卡片 */}
      <div
        className="relative z-10 w-full max-w-sm mx-4 rounded-2xl p-10 flex flex-col items-center gap-6"
        style={{
          background: 'rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 32px 64px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
        }}
      >
        {/* Logo / 品牌 */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
            style={{
              background: 'linear-gradient(135deg, rgba(158,122,78,0.6) 0%, rgba(88,63,36,0.8) 100%)',
              boxShadow: '0 8px 24px rgba(88,63,36,0.4)',
              border: '1px solid rgba(212,169,106,0.3)',
            }}
          >
            ✈️
          </div>
          <div className="text-center">
            <h1
              className="text-2xl font-bold tracking-wide"
              style={{
                fontFamily: "'Noto Serif TC', serif",
                color: '#FAF8F5',
                letterSpacing: '0.05em',
              }}
            >
              本質旅行
            </h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.55)' }}>
              記錄每一段值得珍藏的旅程
            </p>
          </div>
        </div>

        {/* 分隔線 */}
        <div
          className="w-full h-px"
          style={{ background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.15), transparent)' }}
        />

        {/* 登入說明 */}
        <div className="text-center">
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
            使用 Google 帳號安全登入
          </p>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
            登入後可儲存並管理你的旅行計畫
          </p>
        </div>

        {/* Google 登入按鈕區 */}
        <div className="flex flex-col items-center gap-3 w-full">
          {isLoading ? (
            <div className="flex items-center gap-2 py-3" style={{ color: 'rgba(255,255,255,0.7)' }}>
              <div
                className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: 'rgba(255,255,255,0.5)', borderTopColor: 'transparent' }}
              />
              <span className="text-sm">登入中...</span>
            </div>
          ) : (
            // Google GIS SDK 會在這個 div 內渲染官方按鈕
            <div
              ref={googleBtnRef}
              id="google-signin-button"
              className="flex justify-center"
            />
          )}

          {/* 錯誤訊息 */}
          {error && (
            <div
              className="w-full text-center text-xs px-3 py-2 rounded-lg"
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: 'rgba(252, 165, 165, 0.9)',
              }}
            >
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* 底部說明 */}
        <p className="text-center text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
          登入即表示你同意本服務的使用條款
          <br />
          我們不會儲存你的 Google 密碼
        </p>
      </div>
    </div>
  )
}
