import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader } from 'lucide-react'
import { apiService } from '../services/apiService'
import './Modals.css'

/**
 * DeleteConfirmModal 元件 (刪除確認彈跳視窗)
 * 套用專案統一的 Header / Body / Footer 佈局風格，純文字無圖示的簡潔 Header
 * 
 * @param {Object} props
 * @param {Object} props.item - 欲刪除的資料物件 (相容 { id, attractionName } 或 { name })
 * @param {Function} props.onClose - 關閉彈窗的回呼函式
 * @param {Function} props.onDeleted - 刪除成功後的回呼函式
 * @param {Function} props.onConfirm - 自訂刪除非同步函式 (若有提供則優先呼叫)
 */
export default function DeleteConfirmModal({ item, onClose, onDeleted, onConfirm }) {
  // isDeleting 狀態：記錄目前是否正在發送 API 刪除請求中，用於防止重複點擊與展示轉圈動畫
  const [isDeleting, setIsDeleting] = useState(false)
  
  // error 狀態：儲存刪除過程中後端或網路傳回的錯誤訊息
  const [error, setError] = useState(null)

  /**
   * handleDelete 處理點擊「確認刪除」按鈕
   * 優先執行外部傳入的 onConfirm 回呼函式，否則預設透過 apiService 刪除景點行程
   */
  const handleDelete = async () => {
    setIsDeleting(true)
    setError(null)
    try {
      if (onConfirm) {
        await onConfirm()
      } else {
        await apiService.deleteSchedule(item.id)
      }
      onDeleted()
    } catch (err) {
      setError(err.message)
      setIsDeleting(false)
    }
  }

  // 取得欲顯示的目標名稱 (兼容景點名稱 attractionName 或旅行計畫名稱 name)
  const targetName = item?.attractionName || item?.name || '此項目'

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass form-modal confirm-modal" onClick={(e) => e.stopPropagation()}>
        {/* 頂部 Header：左上角「確認刪除」標題、右上角關閉按鈕 */}
        <div className="form-modal-header">
          <h2 className="modal-title" style={{ margin: 0, color: '#e53e3e' }}>確認刪除</h2>
          <button className="close-btn" onClick={onClose} disabled={isDeleting} aria-label="關閉視窗">
            <X size={20} />
          </button>
        </div>

        {/* 中間 Body：說明內文與錯誤提示 */}
        <div className="form-modal-body confirm-modal-body">
          <p className="modal-text" style={{ textAlign: 'left', lineHeight: '1.6' }}>
            確定要刪除「<strong>{targetName}</strong>」嗎？
            <br />
            <span style={{ fontSize: '13px', opacity: 0.7 }}>此操作無法復原。</span>
          </p>
          {error && <p className="form-error" style={{ marginTop: '12px' }}>{error}</p>}
        </div>

        {/* 底部 Footer：右側取消與確認刪除按鈕 */}
        <div className="form-modal-footer">
          <button
            className="btn-cancel"
            onClick={onClose}
            disabled={isDeleting}
            style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            取消
          </button>
          <button
            className="btn-delete"
            onClick={handleDelete}
            disabled={isDeleting}
            style={{
              minWidth: '92px',
              justifyContent: 'center',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            {isDeleting && <Loader size={16} className="spin-icon" />}
            {isDeleting ? '刪除中...' : '確認刪除'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
