import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader } from 'lucide-react'
import { APP_VERSION } from '../config'
import './Modals.css'

/**
 * LogoutConfirmModal 元件 (登出確認彈跳視窗)
 * 套用專案統一的 Header / Body / Footer 佈局風格，左上角為 LogOut 圖示與「確認登出」標題
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
      <div className="modal-content glass form-modal confirm-modal" onClick={(e) => e.stopPropagation()}>
        {/* 頂部 Header：左上角「確認登出」標題、右上角關閉按鈕 */}
        <div className="form-modal-header">
          <h2 className="modal-title" style={{ margin: 0 }}>確認登出</h2>
          <button className="close-btn" onClick={onClose} disabled={isLoggingOut} aria-label="關閉視窗">
            <X size={20} />
          </button>
        </div>

        {/* 中間 Body：說明內文與錯誤提示 */}
        <div className="form-modal-body confirm-modal-body">
          <p className="modal-text" style={{ textAlign: 'left', lineHeight: '1.6' }}>
            確定要登出「<strong>{user?.name || user?.email || '目前帳號'}</strong>」嗎？
            <br />
            <span style={{ fontSize: '13px', opacity: 0.7 }}>登出後需重新透過 Google 帳號驗證登入。</span>
          </p>
          {error && <p className="form-error" style={{ marginTop: '12px' }}>{error}</p>}
        </div>

        {/* 底部 Footer：左側版號、右側操作按鈕，保持同一排且嚴格不換行 */}
        <div className="form-modal-footer" style={{ justifyContent: 'space-between', flexWrap: 'nowrap', gap: '8px' }}>
          {/* 左側版本號：低調、單行不折行 */}
          <span
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              opacity: 0.65,
              whiteSpace: 'nowrap',
              flexShrink: 0,
              userSelect: 'none'
            }}
          >
            v{APP_VERSION}
          </span>

          {/* 右側操作按鈕群組：嚴格防折行與保持按鈕比例 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'nowrap',
              flexShrink: 0
            }}
          >
            <button
              className="btn-cancel"
              onClick={onClose}
              disabled={isLoggingOut}
              style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              取消
            </button>
            <button
              className="btn-save"
              onClick={handleConfirm}
              disabled={isLoggingOut}
              style={{
                minWidth: '92px',
                justifyContent: 'center',
                whiteSpace: 'nowrap',
                flexShrink: 0
              }}
            >
              {isLoggingOut && <Loader size={16} className="spin-icon" />}
              {isLoggingOut ? '登出中...' : '確認登出'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
