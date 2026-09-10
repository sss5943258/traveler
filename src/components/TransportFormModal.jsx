import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Trash2, Loader } from 'lucide-react'
import { Checkbox, message } from 'antd'
import { apiService } from '../services/apiService'
import './Modals.css'

/**
 * TransportForm 元件 (交通方式表單)
 * 
 * 用於設定兩個景點之間的交通方式、花費時間與備註。
 * 支援「自動順延後續行程」功能：
 * 將 autoShift 旗標傳送至後端 API (GAS / .NET)，由後端作為 Single Source of Truth 執行骨牌連鎖推算並落庫。
 * 
 * @param {Object} props.item - 當前正在設定交通資訊的目標行程卡片
 * @param {Array} props.daySchedules - 當天所有行程清單 (可供擴充使用)
 * @param {Function} props.onSaved - 儲存成功後的回呼函式 (savedItem, shiftedItems)
 * @param {Function} props.onCancel - 取消或關閉表單的回呼函式
 */
export function TransportForm({ item, daySchedules = [], onSaved, onCancel }) {
  // 表單內部各欄位 state 定義
  const [type, setType] = useState(item?.transportType || 'walk')
  const [customName, setCustomName] = useState(item?.transportCustomName || '')
  const [hours, setHours] = useState(Math.floor((item?.transportDurationMinutes || 0) / 60))
  const [minutes, setMinutes] = useState((item?.transportDurationMinutes || 0) % 60)
  const [remark, setRemark] = useState(item?.transportRemark || '')

  // 自動順延後續行程開關 (依訪談決策預設為 true 打勾)
  const [autoShift, setAutoShift] = useState(true)

  // 儲存狀態與錯誤提示訊息 state
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)

  // 監聽 item 變化，當外部傳入的卡片切換時重新初始化表單資料
  useEffect(() => {
    if (item) {
      setType(item.transportType || 'walk')
      setCustomName(item.transportCustomName || '')
      setHours(Math.floor((item.transportDurationMinutes || 0) / 60))
      setMinutes((item.transportDurationMinutes || 0) % 60)
      setRemark(item.transportRemark || '')
      setAutoShift(true) // 重設為預設勾選
    }
  }, [item])

  /**
   * handleSubmit 處理表單提交儲存
   * 
   * 1. 驗證自訂名稱
   * 2. 組裝 payload（包含交通欄位與 autoShift 旗標）
   * 3. 呼叫單一 API 請求交由後端完成推移運算與 Google Sheets / 資料庫交易儲存
   * 4. 若後端回傳有行程被截斷至 23:59，以 Ant Design message.info 提示
   * 5. 呼叫 onSaved 通知父層刷新 State
   */
  const handleSubmit = async (e) => {
    e.preventDefault()

    // 若選擇自訂交通方式，檢查名稱不可為空
    if (type === 'custom' && !customName.trim()) {
      setError('請輸入自訂交通方式名稱')
      return
    }

    // 計算總分鐘數
    const totalMinutes = (Number(hours) * 60) + Number(minutes)

    setIsSaving(true)
    setError(null)

    // 送交後端的 Payload：包含交通資料與 autoShift 旗標，由後端統一進行推移運算與資料庫交易
    const updatePayload = {
      transportType: type,
      transportCustomName: type === 'custom' ? customName.trim() : '',
      transportDurationMinutes: totalMinutes,
      transportRemark: remark.trim(),
      autoShift: autoShift
    }

    try {
      // 呼叫單一 API 進行儲存與連鎖推移
      const res = await apiService.updateSchedule(item.id, updatePayload)

      // 若後端偵測到推移卡片超過 23:59，且已自動貼平在 23:59，跳出 Ant Design 提示
      if (res?.clampedToMidnight) {
        message.info('行程已自動順延，部分行程時間已調整至當日上限 23:59')
      }

      // 取得後端回傳的受影響卡片清單 (含目標卡片與所有被連鎖推移的卡片)
      const shiftedItems = res?.shiftedItems || []
      const savedItem = res?.item || { ...item, ...updatePayload }

      // 呼叫父層 onSaved 回呼，批次更新 React state
      onSaved(savedItem, shiftedItems)
    } catch (err) {
      setError(err.message || '儲存交通方式失敗')
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * handleClear 清除當前卡片的交通資訊
   * 
   * 重設交通欄位為空並儲存至 API，不變動行程的時間排程。
   */
  const handleClear = async () => {
    setIsSaving(true)
    setError(null)

    const clearPayload = {
      transportType: '',
      transportCustomName: '',
      transportDurationMinutes: 0,
      transportRemark: ''
    }

    try {
      await apiService.updateSchedule(item.id, clearPayload)
      onSaved(
        { ...item, ...clearPayload },
        []
      )
    } catch (err) {
      setError(err.message || '清除交通方式失敗')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="schedule-form-container">
      {/* 頂部標題區 */}
      <div className="form-modal-header">
        <div>
          <h2 className="modal-title">新增 / 編輯交通方式</h2>
          <p className="modal-subtitle">前往「{item?.attractionName}」的交通資訊</p>
        </div>
        {onCancel && (
          <button className="close-btn" onClick={onCancel} title="關閉">
            <X size={20} />
          </button>
        )}
      </div>

      {/* 表單內容區 */}
      <div className="form-modal-body flex-fill-body">
        <form className="schedule-form" id="transportForm" onSubmit={handleSubmit}>
          
          {/* 第一欄：交通方式 Selector */}
          <div className="form-group">
            <label>交通方式 <span className="required">*</span></label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="walk">步行</option>
              <option value="car">開車</option>
              <option value="bus">公車</option>
              <option value="subway">地鐵</option>
              <option value="custom">自訂</option>
            </select>
          </div>

          {/* 若選擇自訂，額外顯示名稱輸入框 */}
          {type === 'custom' && (
            <div className="form-group">
              <label>自訂交通名稱 <span className="required">*</span></label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="例如：渡輪、纜車、腳踏車"
                required
              />
            </div>
          )}

          {/* 第二欄：花費時間 (小時 + 分鐘) */}
          <div className="form-group">
            <label>預估花費時間</label>
            <div className="flex items-center gap-3">
              {/* 左側：小時 Input */}
              <div className="flex items-center border border-gray-300 rounded px-3 bg-white flex-1 focus-within:border-[var(--primary)] focus-within:ring-1 focus-within:ring-[var(--primary)]">
                <input
                  type="number"
                  min="0"
                  max="24"
                  list="hours-autocomplete"
                  value={hours === 0 ? '' : hours}
                  onChange={(e) => {
                    const val = e.target.value
                    setHours(val === '' ? 0 : Math.max(0, Math.min(24, Number(val) || 0)))
                  }}
                  style={{ border: 'none', background: 'transparent', outline: 'none', boxShadow: 'none', padding: '0.5rem 0' }}
                  className="w-full text-left pr-1"
                />
                <span className="text-xs text-gray-400 font-normal whitespace-nowrap shrink-0 ml-1 pointer-events-none">小時</span>
                <datalist id="hours-autocomplete">
                  {[...Array(25).keys()].map((h) => (
                    <option key={h} value={h} />
                  ))}
                </datalist>
              </div>

              {/* 右側：分鐘 Input */}
              <div className="flex items-center border border-gray-300 rounded px-3 bg-white flex-1 focus-within:border-[var(--primary)] focus-within:ring-1 focus-within:ring-[var(--primary)]">
                <input
                  type="number"
                  min="0"
                  max="60"
                  list="minutes-autocomplete"
                  value={minutes === 0 ? '' : minutes}
                  onChange={(e) => {
                    const val = e.target.value
                    setMinutes(val === '' ? 0 : Math.max(0, Math.min(60, Number(val) || 0)))
                  }}
                  style={{ border: 'none', background: 'transparent', outline: 'none', boxShadow: 'none', padding: '0.5rem 0' }}
                  className="w-full text-left pr-1"
                />
                <span className="text-xs text-gray-400 font-normal whitespace-nowrap shrink-0 ml-1 pointer-events-none">分鐘</span>
                <datalist id="minutes-autocomplete">
                  {[...Array(60).keys()].map((m) => (
                    <option key={m + 1} value={m + 1} />
                  ))}
                </datalist>
              </div>
            </div>
          </div>

          {/* 自動順延後續行程開關 (使用 Ant Design Checkbox) */}
          <div className="form-group py-1">
            <Checkbox
              checked={autoShift}
              onChange={(e) => setAutoShift(e.target.checked)}
              className="text-sm font-medium text-gray-700 select-none"
            >
              自動順延後續行程
            </Checkbox>
            <p className="text-xs text-gray-400 mt-1 pl-6">
              若交通時間造成後方行程時間不足，將自動依序往後順延。
            </p>
          </div>

          {/* 第三欄：備註 */}
          <div className="form-group remark-group">
            <label>備註</label>
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="補充說明、搭乘路線、票價備註..."
            />
          </div>

          {error && <p className="form-error">{error}</p>}
        </form>
      </div>

      {/* 底部按鈕區 */}
      <div className="form-modal-footer flex justify-between items-center">
        {item?.transportType ? (
          <button
            type="button"
            className="btn-delete flex items-center gap-1 text-red-500 hover:text-red-700 text-sm font-medium border-0 bg-transparent cursor-pointer"
            onClick={handleClear}
            disabled={isSaving}
          >
            <Trash2 size={15} />
            清除交通資訊
          </button>
        ) : <div />}

        <div className="flex gap-2">
          {onCancel && (
            <button type="button" className="btn-cancel" onClick={onCancel} disabled={isSaving}>
              取消
            </button>
          )}
          <button type="submit" form="transportForm" className="btn-save flex items-center justify-center px-4" disabled={isSaving}>
            {isSaving ? <Loader size={16} className="spin-icon mr-1" /> : null}
            {isSaving ? '儲存中...' : '確定'}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * TransportFormModal 元件 (用於 Modal 彈窗)
 * 
 * @param {Object} props.item - 當前卡片資料
 * @param {Array} props.daySchedules - 當天行程資料清單
 * @param {Function} props.onSaved - 儲存成功回呼函式
 * @param {Function} props.onClose - 關閉彈窗回呼函式
 */
export default function TransportFormModal(props) {
  return createPortal(
    <div className="modal-overlay" onClick={props.onClose}>
      <div className="modal-content glass form-modal max-w-sm" onClick={(e) => e.stopPropagation()}>
        <TransportForm
          item={props.item}
          daySchedules={props.daySchedules}
          onSaved={props.onSaved}
          onCancel={props.onClose}
        />
      </div>
    </div>,
    document.body
  )
}

