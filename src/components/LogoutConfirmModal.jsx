import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, LogOut, Loader } from 'lucide-react'
import './Modals.css'

/**
 * LogoutConfirmModal 元件 (登出確認彈跳視窗)
 * 採用專案統一的置中毛玻璃遮罩 Modal 樣式，提供一致的視覺體驗
 * 
 * @param {Object} props
 * @param {Function} props.onClose - 關閉 Modal 的 callback 函式
 * @param {Function} props.onConfirm - 使用者確認登出時呼叫的非同步處理函式
 * @param {boolean} props.isLoggingOut - 外部傳入之登出載入狀態
 * @param {Object} props.user - 目前登入的使用者資訊 { name, email }
 */
export default function LogoutConfirmModal({ onClose, onConfirm, isLoggingOut, user }) {
  // 錯誤狀態：儲存登出過程中的錯誤訊息
  const [error, setError] = useState(null)

  /**
   * handleConfirm 處理點擊「確認登出」按鈕
   * 呼叫傳入的 onConfirm 執行撤銷 Session 與清除狀態
   */
  const handleConfirm = async () => {
    setError(null)
    try {
      await onConfirm()
    } catch (err) {
      setError(err.message || '登出發生錯誤，請稍後再試')
    }
  }

  // 透過 React Portal 掛載在 body 上，確保覆蓋全螢幕不受父元件層級限制
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass delete-modal" onClick={(e) => e.stopPropagation()}>
        {/* 右上角關閉按鈕 */}
        <button className="close-btn" onClick={onClose} disabled={isLoggingOut} aria-label="關閉視窗">
          <X size={20} />
        </button>

        {/* 頂部 Icon 圓徽章：品牌深木褐色圖示 */}
        <div className="delete-icon-wrap" style={{ color: 'var(--primary, #583f24)' }}>
          <LogOut size={32} />
        </div>

        {/* 標題與內文 */}
        <h2 className="modal-title">確認登出</h2>
        <p className="modal-text">
          確定要登出「<strong>{user?.name || user?.email || '目前帳號'}</strong>」嗎？
          <br />
          <span style={{ fontSize: '13px', opacity: 0.7 }}>登出後需重新透過 Google 帳號驗證登入。</span>
        </p>

        {/* 錯誤訊息提示 */}
        {error && <p className="form-error" style={{ marginTop: '12px' }}>{error}</p>}

        {/* 底部操作按鈕區（置於右下角，確認按鈕不帶 icon） */}
        <div className="form-actions" style={{ marginTop: '24px', justifyContent: 'flex-end' }}>
          <button className="btn-cancel" onClick={onClose} disabled={isLoggingOut}>
            取消
          </button>
          <button
            className="btn-save"
            onClick={handleConfirm}
            disabled={isLoggingOut}
            style={{ minWidth: '96px', justifyContent: 'center' }}
          >
            {isLoggingOut && <Loader size={16} className="spin-icon" />}
            {isLoggingOut ? '登出中...' : '確認登出'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
