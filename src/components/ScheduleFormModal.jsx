import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Save, Loader } from 'lucide-react'
import { TimePicker } from 'antd'
import dayjs from 'dayjs'
import { apiService } from '../services/apiService'
import { validateScheduleForm, hasErrors } from '../utils/validator'
import { analyzeTimeConflict, reorderSchedulesByTime } from '../utils/timeSortUtils'
import ConflictModal from './ConflictModal'
import './Modals.css'

/**
 * ScheduleForm 元件 (獨立的行程表單元件)
 * @param {string} props.mode 表單模式，為 'add' (新增)、'edit' (編輯) 或 'addBackup' (新增彈性備案)
 * @param {Object} props.item 當編輯或新增備案時，傳入的行程卡片資料物件
 * @param {number} props.day 目前行程所在的天數 (如 1, 2, 3...)
 * @param {string} props.date 目前行程所在的日期 (格式如 "2026-08-30")
 * @param {string} props.groupId 排定行程的群組 ID
 * @param {number} props.altOrder 備案順序編號 (主行程為 0，備案依序為 1, 2...)
 * @param {string} props.tripId 所屬旅行計畫的 ID
 * @param {Array} props.daySchedules 當天已有的行程資料陣列 (用於時間衝突檢測與排序)
 * @param {Function} props.onSaved 當資料儲存成功時觸發的回呼函式，會傳回儲存後的行程資料與最新排序
 * @param {Function} props.onCancel 當點擊「取消」或關閉時觸發的回呼函式
 */
export function ScheduleForm({ mode, item, day, date, groupId, altOrder, tripId, daySchedules = [], setActionLoading, onSaved, onCancel }) {
  const isEdit = mode === 'edit'

  // form 狀態：儲存表單各個輸入欄位的值
  const [form, setForm] = useState({
    attractionName: '',
    startTime: '',
    endTime: '',
    remark: '',
    googleMapLink: '',
  })

  // isSaving 狀態：記錄目前是否正在與後端 API 傳輸儲存中
  const [isSaving, setIsSaving] = useState(false)

  // errors 狀態：儲存各欄位獨立驗證失敗訊息 (鍵值對)
  const [errors, setErrors] = useState({})

  // error 狀態：儲存後端 API 傳回的通用全域錯誤訊息
  const [apiError, setApiError] = useState(null)

  // conflictState 狀態：衝突彈窗控制狀態
  const [conflictState, setConflictState] = useState({ isOpen: false, data: null })

  // 監聽傳入的 item 或模式變化，當模式切換時正確初始化或清空表單
  useEffect(() => {
    if (isEdit && item) {
      setForm({
        attractionName: item.attractionName || '',
        startTime: item.startTime || '',
        endTime: item.endTime || '',
        remark: item.remark || '',
        googleMapLink: item.googleMapLink || '',
      })
    } else if (mode === 'addBackup' && item) {
      // 若是新增彈性備案，預設自動帶入主行程的起訖時間，其餘欄位清空
      setForm({
        attractionName: '',
        startTime: item.startTime || '',
        endTime: item.endTime || '',
        remark: '',
        googleMapLink: '',
      })
    } else {
      // 若為一般新增模式 ('add')，完整重置並清空表單
      setForm({
        attractionName: '',
        startTime: '',
        endTime: '',
        remark: '',
        googleMapLink: '',
      })
    }
    setErrors({})
    setApiError(null)
  }, [isEdit, mode, item, day, date])

  /**
   * handleChange 欄位變更處理函式
   */
  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  /**
   * saveScheduleToServer 實際發送 API 儲存與處理後端衝突回應之函式
   */
  const saveScheduleToServer = async (extraPayload = {}) => {
    setIsSaving(true)
    if (setActionLoading) setActionLoading('儲存中...')
    setApiError(null)
    try {
      const targetDate = isEdit || mode === 'addBackup' ? item.date : date
      const targetDay = isEdit || mode === 'addBackup' ? item.day : day
      const isPlaceholder = isEdit && item?.isDefaultPlaceholder

      let res = null
      let savedItem = null

      if (isEdit && !isPlaceholder) {
        res = await apiService.updateSchedule(item.id, { ...form, ...extraPayload })
      } else {
        const tempId = isEdit ? item.id : `t3-d${targetDay}-${Date.now()}`
        const currentAlt = isEdit ? item.altOrder : (altOrder || 0)

        const scheduleDto = {
          tripId,
          id: tempId,
          day: targetDay,
          date: targetDate,
          groupId: isEdit ? item.groupId : (groupId || tempId),
          altOrder: currentAlt,
          ...form,
          ...extraPayload
        }
        res = await apiService.addSchedule(scheduleDto)
      }

      // 檢查後端是否回傳時間衝突
      if (res && res.hasConflict) {
        setConflictState({ isOpen: true, data: res.conflictResult })
        setIsSaving(false)
        if (setActionLoading) setActionLoading(null)
        return
      }

      // 儲存成功且無衝突
      const savedId = res?.id || (isEdit ? item.id : null) || `t3-d${targetDay}-${Date.now()}`
      savedItem = {
        ...form,
        id: savedId,
        day: targetDay,
        date: targetDate,
        groupId: isEdit ? item.groupId : (groupId || savedId),
        altOrder: isEdit ? item.altOrder : (altOrder || 0)
      }

      // 構建當天最新行程
      let updatedDaySchedules = [...(daySchedules || [])]

      // 若為同意推移，樂觀更新受影響卡片的時間
      if (extraPayload.confirmAdjust && extraPayload.targetCardId && extraPayload.proposedNewTime && extraPayload.proposedField) {
        updatedDaySchedules = updatedDaySchedules.map(s => {
          if (s.id === extraPayload.targetCardId) {
            return { ...s, [extraPayload.proposedField]: extraPayload.proposedNewTime }
          }
          return s
        })
      }

      if (isEdit) {
        updatedDaySchedules = updatedDaySchedules.map(s => s.id === savedItem.id ? { ...s, ...savedItem, isDefaultPlaceholder: false } : s)
      } else {
        updatedDaySchedules.push(savedItem)
      }

      const currentAltOrder = Number(isEdit ? (item?.altOrder || 0) : (altOrder || 0)) || 0
      if (targetDay > 0 && currentAltOrder === 0) {
        const mainCards = updatedDaySchedules.filter(s => (Number(s.altOrder) || 0) === 0 && !s.isDefaultPlaceholder)
        let sortedMainCards
        if (extraPayload.skipConflictCheck) {
          const regularCards = mainCards.filter(s => s.id !== savedItem.id)
          sortedMainCards = reorderSchedulesByTime(regularCards)
          const maxSort = sortedMainCards.reduce((max, s) => Math.max(max, s.sortOrder || 0), 0)
          sortedMainCards.push({ ...savedItem, sortOrder: maxSort + 1 })
        } else {
          sortedMainCards = reorderSchedulesByTime(mainCards)
        }

        const mainCardMap = new Map(sortedMainCards.map(m => [m.id, m]))
        updatedDaySchedules = updatedDaySchedules.map(s => mainCardMap.has(s.id) ? mainCardMap.get(s.id) : s)
      }

      onSaved(savedItem, updatedDaySchedules)
    } catch (err) {
      setApiError(err.message)
    } finally {
      setIsSaving(false)
      if (setActionLoading) setActionLoading(null)
    }
  }

  /**
   * handleSubmit 表單提交處理函式
   */
  const handleSubmit = async (e) => {
    e.preventDefault()
    const formErrors = validateScheduleForm(form)
    if (hasErrors(formErrors)) {
      setErrors(formErrors)
      return
    }
    setErrors({})
    setApiError(null)

    await saveScheduleToServer()
  }

  const handleConfirmAdjust = () => {
    const data = conflictState.data
    setConflictState({ isOpen: false, data: null })
    saveScheduleToServer({
      confirmAdjust: true,
      targetCardId: data?.targetCardId || data?.targetCard?.id,
      proposedNewTime: data?.proposedNewTime,
      proposedField: data?.proposedField
    })
  }

  const handleDeclineAdjust = () => {
    const data = conflictState.data
    setConflictState({ isOpen: false, data: null })
    saveScheduleToServer({
      skipConflictCheck: true
    })
  }

  return (
    <div className="schedule-form-container">
      {/* 頂部標題區 */}
      <div className="form-modal-header">
        <div>
          <h2 className="modal-title">
            {mode === 'edit' ? '編輯行程' : mode === 'addBackup' ? '新增彈性備案' : '新增行程'}
          </h2>
          {isEdit && <p className="modal-subtitle">{item.day === 0 ? '旅程資訊' : `Day ${item.day} · ${item.date}`}</p>}
          {mode === 'addBackup' && <p className="modal-subtitle">Day {item.day} · {item.date} (主行程: {item.attractionName})</p>}
          {mode === 'add' && <p className="modal-subtitle">{day === 0 ? '旅程資訊' : `Day ${day} · ${date}`}</p>}
        </div>
        {onCancel && (
          <button className="close-btn" onClick={onCancel} title="關閉">
            <X size={20} />
          </button>
        )}
      </div>

      {/* 表單內容區塊：軟性填滿剩餘高度 */}
      <div className="form-modal-body flex-fill-body">
        <form className="schedule-form" id="scheduleForm" onSubmit={handleSubmit} noValidate>
          {/* 1. 行程名稱 (1 行) */}
          <div className="form-group">
            <label>行程名稱 <span className="required">*</span></label>
            <input
              name="attractionName"
              value={form.attractionName}
              onChange={handleChange}
              placeholder="例：清水寺 (景點)"
              className={errors.attractionName ? 'input-has-error' : ''}
            />
            {errors.attractionName && <span className="field-error-text">{errors.attractionName}</span>}
          </div>

          {/* 2. 時間 (1 行) */}
          <div className="form-group">
            <label>時間 <span className="required">*</span></label>
            <TimePicker.RangePicker
              format="HH:mm"
              minuteStep={5}
              placeholder={['開始時間 (必填)', '結束時間 (必填)']}
              allowEmpty={[false, false]}
              value={[
                form.startTime ? dayjs(form.startTime, 'HH:mm') : null,
                form.endTime ? dayjs(form.endTime, 'HH:mm') : null
              ]}
              onChange={(dates, dateStrings) => {
                const startTime = dateStrings ? dateStrings[0] : ''
                const endTime = dateStrings ? dateStrings[1] : ''
                setForm((prev) => ({ ...prev, startTime, endTime }))
                setErrors((prev) => ({ ...prev, startTime: '', endTime: '' }))
              }}
              className={`time-picker-custom ${errors.startTime || errors.endTime ? 'input-has-error' : ''}`}
            />
            {errors.startTime && <span className="field-error-text">{errors.startTime}</span>}
            {errors.endTime && <span className="field-error-text">{errors.endTime}</span>}
          </div>

          {/* 3. 備註 (自動垂直延伸填滿剩餘高度空間，放置於 Google Map 連結上方) */}
          <div className="form-group remark-group">
            <label>備註</label>
            <textarea
              name="remark"
              value={form.remark}
              onChange={handleChange}
              placeholder="補充說明、交通方式、注意事項..."
            />
          </div>

          {/* 4. Google Map 連結 (1 行) */}
          <div className="form-group">
            <label>Google Map 連結</label>
            <input
              name="googleMapLink"
              value={form.googleMapLink}
              onChange={handleChange}
              placeholder="https://maps.app.goo.gl/..."
            />
          </div>

          {apiError && <p className="form-error">{apiError}</p>}
        </form>
      </div>

      {/* 底部按鈕區 */}
      <div className="form-modal-footer">
        {onCancel && (
          <button type="button" className="btn-cancel" onClick={onCancel} disabled={isSaving}>
            取消
          </button>
        )}
        <button type="submit" form="scheduleForm" className="btn-save" disabled={isSaving}>
          {isSaving ? <Loader size={16} className="spin-icon" /> : <Save size={16} />}
          {isSaving ? '儲存中...' : '儲存'}
        </button>
      </div>

      {/* 衝突確認彈窗 */}
      <ConflictModal
        isOpen={conflictState.isOpen}
        conflictData={conflictState.data}
        onConfirmAdjust={handleConfirmAdjust}
        onDeclineAdjust={handleDeclineAdjust}
        onClose={() => setConflictState({ isOpen: false, data: null })}
      />
    </div>
  )
}

/**
 * ScheduleFormModal 元件 (用於手機版或獨立 Dialog 彈窗時包裹 ScheduleForm)
 * 它使用 createPortal 將 React 元件直接掛載到 body 層，確保層級（z-index）不被父容器遮擋。
 */
export default function ScheduleFormModal(props) {
  return createPortal(
    <div className="modal-overlay" onClick={props.onClose}>
      <div className="modal-content glass form-modal" onClick={(e) => e.stopPropagation()}>
        <ScheduleForm {...props} onCancel={props.onClose} />
      </div>
    </div>,
    document.body
  )
}
