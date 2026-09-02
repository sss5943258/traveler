import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Trash2, Loader } from 'lucide-react'
import { apiService } from '../services/apiService'
import './Modals.css'

/**
 * TransportForm 元件 (交通方式表單)
 */
export function TransportForm({ item, onSaved, onCancel }) {
  const [type, setType] = useState(item?.transportType || 'walk')
  const [customName, setCustomName] = useState(item?.transportCustomName || '')
  const [hours, setHours] = useState(Math.floor((item?.transportDurationMinutes || 0) / 60))
  const [minutes, setMinutes] = useState((item?.transportDurationMinutes || 0) % 60)
  const [remark, setRemark] = useState(item?.transportRemark || '')

  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (item) {
      setType(item.transportType || 'walk')
      setCustomName(item.transportCustomName || '')
      setHours(Math.floor((item.transportDurationMinutes || 0) / 60))
      setMinutes((item.transportDurationMinutes || 0) % 60)
      setRemark(item.transportRemark || '')
    }
  }, [item])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (type === 'custom' && !customName.trim()) {
      setError('請輸入自訂交通方式名稱')
      return
    }

    setIsSaving(true)
    setError(null)

    const totalMinutes = (Number(hours) * 60) + Number(minutes)
    const updatePayload = {
      transportType: type,
      transportCustomName: type === 'custom' ? customName.trim() : '',
      transportDurationMinutes: totalMinutes,
      transportRemark: remark.trim()
    }

    try {
      await apiService.updateSchedule(item.id, updatePayload)
      onSaved({
        ...item,
        ...updatePayload
      })
    } catch (err) {
      setError(err.message || '儲存交通方式失敗')
    } finally {
      setIsSaving(false)
    }
  }

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
      onSaved({
        ...item,
        ...clearPayload
      })
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
          
          {/* 第一欄：交通方式 Selector (無 Icon) */}
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

          {/* 第二欄：花費時間 (外框包住「數值 + 箭頭 + 灰字單位」) */}
          <div className="form-group">
            <label>預估花費時間</label>
            <div className="flex items-center gap-3">
              {/* 左側：小時 Input 組合框 */}
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

              {/* 右側：分鐘 Input 組合框 */}
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

      {/* 底部按鈕區 (確定按鈕無 Icon) */}
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
 */
export default function TransportFormModal(props) {
  return createPortal(
    <div className="modal-overlay" onClick={props.onClose}>
      <div className="modal-content glass form-modal max-w-sm" onClick={(e) => e.stopPropagation()}>
        <TransportForm item={props.item} onSaved={props.onSaved} onCancel={props.onClose} />
      </div>
    </div>,
    document.body
  )
}
