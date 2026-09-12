import React, { useEffect, useRef, useState } from 'react'
import { Plane } from 'lucide-react'
import { Spin } from 'antd'
import { GOOGLE_CLIENT_ID } from '../config'
import { loginWithGoogle } from '../services/authService'
import { useAuthStore } from '../stores/authStore'

/**
 * LoginPage - 全螢幕登入頁面
 * 
 * 流程：
 * 1. 頁面載入時動態注入 Google Identity Services (GIS) SDK script
 * 2. SDK 準備就緒後渲染 Google Sign-In 按鈕
 * 3. 使用者點擊授權 → 取得 id_token
 * 4. 呼叫 GAS 後端 login action 換取 accessToken + refreshToken
 * 5. 寫入 authStore → ProtectedRoute 偵測已登入 → 自動切換為主畫面
 */
export default function LoginPage() {
  // googleBtnRef：用於掛載 Google 官方按鈕的 DOM 容器
  const googleBtnRef = useRef(null)
  // isLoading：標記是否正在向後端驗證登入中
  const [isLoading, setIsLoading] = useState(false)
  // error：儲存登入失敗時的錯誤訊息字串
  const [error, setError] = useState(null)
  // 取得 Zustand authStore 的登入方法
  const login = useAuthStore((state) => state.login)

  // 網頁載入時動態載入 Google GIS SDK
  useEffect(() => {
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
      // 若 SDK 已載入過，直接進行初始化
      initializeGoogleSignIn()
    }
  }, [])

  /**
   * initializeGoogleSignIn - 初始化 Google 官方登入按鈕
   * 輪詢等待 window.google 物件注入後完成客戶端初始化與按鈕渲染
   */
  function initializeGoogleSignIn() {
    let attempts = 0
    const maxAttempts = 50
    const checkInterval = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(checkInterval)

        // 初始化 Google Identity Services
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCallback,  // 授權成功回呼函式
          auto_select: false,              // 讓使用者主動選擇 Google 帳號
          cancel_on_tap_outside: true,
        })

        // 渲染官方 Google 登入按鈕（採用簡約 outline 風格）
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
        setError('Google 登入服務載入失敗，請檢查網路連線或重新整理頁面')
      }
    }, 100)
  }

  /**
   * handleGoogleCallback - Google 授權成功後的回呼函式
   * @param {Object} response - { credential: id_token }
   */
  async function handleGoogleCallback(response) {
    setIsLoading(true)
    setError(null)

    try {
      // 呼叫後端驗證 Google id_token 並取得 Access Token 與 User 資料
      const { accessToken, refreshToken, accessExpiresAt, user } = await loginWithGoogle(response.credential)

      // 寫入 Zustand 全域狀態與 localStorage，觸發自動路由跳轉
      login(accessToken, refreshToken, accessExpiresAt, user)
    } catch (err) {
      console.error('[LoginPage] 登入驗證失敗:', err)
      setError(err.message || '登入失敗，請稍後再試')
      setIsLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center relative overflow-hidden px-4"
      style={{ background: '#FAF8F5' }}
    >
      {/* 柔和環境光暈背景（與內頁暖調一致） */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-[-15%] left-[-10%] w-[550px] h-[550px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(158, 122, 78, 0.08) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute bottom-[-15%] right-[-10%] w-[500px] h-[500px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(212, 169, 106, 0.1) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* 主登入毛玻璃卡片（白底微透、柔和陰影與邊框） */}
      <div
        className="relative z-10 w-full max-w-[380px] rounded-3xl p-8 sm:p-10 flex flex-col items-center gap-6"
        style={{
          background: 'rgba(255, 255, 255, 0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(88, 63, 36, 0.12)',
          boxShadow: '0 20px 48px rgba(88, 63, 36, 0.06), 0 2px 8px rgba(88, 63, 36, 0.03)',
        }}
      >
        {/* 頂部 Logo 與標題 */}
        <div className="flex flex-col items-center gap-3">
          {/* 飛機圖示膠囊圓徽章 */}
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center transition-transform hover:scale-105"
            style={{
              background: 'linear-gradient(135deg, rgba(158, 122, 78, 0.15) 0%, rgba(88, 63, 36, 0.2) 100%)',
              border: '1px solid rgba(88, 63, 36, 0.15)',
              boxShadow: '0 4px 12px rgba(88, 63, 36, 0.06)',
            }}
          >
            <Plane size={28} style={{ color: '#583f24' }} />
          </div>

          <div className="text-center">
            <h1
              className="text-3xl font-bold tracking-tight"
              style={{
                fontFamily: "'Noto Serif TC', serif",
                color: 'var(--text-main, #2C2A29)',
                letterSpacing: '0.02em',
              }}
            >
              Traveler
            </h1>
            <p
              className="text-sm mt-1.5 font-normal"
              style={{ color: 'var(--text-muted, #7A7571)' }}
            >
              記錄每一段值得珍藏的旅程
            </p>
          </div>
        </div>

        {/* 輕量柔和分隔線 */}
        <div
          className="w-full h-px"
          style={{
            background: 'linear-gradient(to right, transparent, rgba(88, 63, 36, 0.12), transparent)',
          }}
        />

        {/* 登入說明 */}
        <div className="text-center">
          <p
            className="text-sm font-medium"
            style={{ color: 'var(--text-main, #2C2A29)' }}
          >
            使用 Google 帳號安全登入
          </p>
          <p
            className="text-xs mt-1"
            style={{ color: 'var(--text-muted, #7A7571)' }}
          >
            登入後即可管理專屬於你的個人旅遊計畫
          </p>
        </div>

        {/* Google 登入按鈕區 */}
        <div className="flex flex-col items-center gap-3.5 w-full">
          {/* 官方 Google 登入按鈕（Loading 時加上 pointer-events-none 避免重複點擊） */}
          <div
            ref={googleBtnRef}
            id="google-signin-button"
            className={`flex justify-center transition-opacity duration-200 ${
              isLoading ? 'opacity-60 pointer-events-none' : 'opacity-100'
            }`}
          />

          {/* 登入中 Loading 指示器：放置於 Google 登入按鈕正下方 */}
          {isLoading && (
            <div className="flex items-center justify-center gap-2.5 py-1.5 animate-fade-in">
              <Spin size="small" />
              <span
                className="text-xs font-medium"
                style={{ color: 'var(--text-muted, #7A7571)' }}
              >
                正在驗證 Google 登入資訊...
              </span>
            </div>
          )}

          {/* 錯誤訊息提示 */}
          {error && (
            <div
              className="w-full text-center text-xs px-3.5 py-2.5 rounded-xl transition-all"
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#dc2626',
              }}
            >
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* 底部隱私與安全說明 */}
        <p
          className="text-center text-[11px] leading-relaxed"
          style={{ color: '#9E9893' }}
        >
          登入即代表你同意本服務的使用規範
          <br />
          系統僅會同步基本身分資訊，不會儲存你的 Google 密碼
        </p>
      </div>
    </div>
  )
}
