import React, { useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'

/**
 * ProtectedRoute - 路由守衛元件
 * 
 * 包裹在需要登入才能存取的頁面外層。
 * 若使用者未登入，會渲染 LoginPage 而非子元件。
 * 
 * React 設計模式：Render Props / Conditional Rendering
 * - 這不是真正的 react-router-dom ProtectedRoute（因為目前 App 用手動路由）
 * - 而是一個「守門員」元件，根據登入狀態決定要渲染什麼
 * 
 * @param {React.ReactNode} children - 要保護的子元件
 * @param {React.ReactNode} fallback - 未登入時渲染的元件（通常是 LoginPage）
 */
export default function ProtectedRoute({ children, fallback }) {
  const user = useAuthStore((state) => state.user)
  const isInitialized = useAuthStore((state) => state.isInitialized)

  // App 初始化尚未完成時（首次載入）先不渲染，避免閃爍
  if (!isInitialized) {
    return null
  }

  // 未登入 → 顯示 fallback（LoginPage）
  if (!user) {
    return fallback
  }

  // 已登入 → 正常渲染子元件
  return children
}
