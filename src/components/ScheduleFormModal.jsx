import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Save, Loader } from 'lucide-react'
import { TimePicker } from 'antd'
import dayjs from 'dayjs'
import { apiService } from '../services/apiService'
import { validateScheduleForm, hasErrors } from '../utils/validator'
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
 * @param {Function} props.onSaved 當資料儲存成功時觸發的回呼函式，會傳回儲存後的行程資料
 * @param {Function} props.onCancel 當點擊「取消」或關閉時觸發的回呼函式
 */
export function ScheduleForm({ mode, item, day, date, groupId, altOrder, tripId, onSaved, onCancel }) {
  const isEdit = mode === 'edit'

  // form 狀態：儲存表單各個輸入欄位的值
  const [form, setForm] = useState({
    attractionName: '',
    startTime: '',
    endTime: '',
    remark: '',
    googleMapLink: '',
  })
  
  // isSaving 狀態：記錄目前是否正在與後端 API 傳輸儲存中，用於顯示轉圈圈與停用按鈕
  const [isSaving, setIsSaving] = useState(false)
  
  // errors 狀態：儲存各欄位獨立驗證失敗訊息 (鍵值對)
  const [errors, setErrors] = useState({})

  // error 狀態：儲存後端 API 傳回的通用全域錯誤訊息
  const [apiError, setApiError] = useState(null)

  // 監聽傳入的 item 或模式變化，當在「編輯」模式且資料存在時，將原行程資料填入 form 狀態中 (初始化)
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
      // 若是新增彈性備案，預設自動帶入主行程的起訖時間，簡化使用者填寫
      setForm((prev) => ({ ...prev, startTime: item.startTime || '', endTime: item.endTime || '' }))
    }
  }, [isEdit, mode, item])

  /**
   * handleChange 欄位變更處理函式
   * 當 input 或 textarea 內容改變時觸發，並即時清除該欄位的紅字錯誤標示
   */
  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  /**
   * handleSubmit 表單提交處理函式
   * 點選「儲存」時觸發，負責進行欄位防呆驗證，並依據模式向 GAS 發送 API 請求
   */
  const handleSubmit = async (e) => {
    e.preventDefault()
    // 呼叫全域驗證服務進行欄位防呆檢核
    const formErrors = validateScheduleForm(form)
    if (hasErrors(formErrors)) {
      setErrors(formErrors)
      return
    }
    setErrors({})
    setIsSaving(true)
    setApiError(null)
    try {
      const targetDate = isEdit || mode === 'addBackup' ? item.date : date;
      const targetDay = isEdit || mode === 'addBackup' ? item.day : day;

      let savedItem = null
      const isPlaceholder = isEdit && item?.isDefaultPlaceholder

      // 若是編輯「非佔位」的既有行程，呼叫 apiService.updateSchedule
      if (isEdit && !isPlaceholder) {
        await apiService.updateSchedule(item.id, form)
        savedItem = {
          ...form,
          id: item.id,
          day: targetDay,
          date: targetDate,
          groupId: item.groupId,
          altOrder: item.altOrder,
          sortOrder: item.sortOrder
        }
      } else {
        // 新增行程或寫入預留佔位卡片，呼叫 apiService.addSchedule
        const tempId = isEdit ? item.id : `t3-d${targetDay}-${Date.now()}`
        const scheduleDto = {
          tripId,
          id: tempId,
          day: targetDay,
          date: targetDate,
          groupId: isEdit ? item.groupId : (groupId || tempId),
          altOrder: isEdit ? item.altOrder : (altOrder || 0),
          ...form
        }
        const res = await apiService.addSchedule(scheduleDto)
        const finalId = res?.id || res?.data?.id || tempId
        savedItem = {
          ...scheduleDto,
          id: finalId,
          groupId: isEdit ? item.groupId : (groupId || finalId),
          sortOrder: isEdit ? item.sortOrder : 999
        }
      }

      onSaved(savedItem)
    } catch (err) {
      setApiError(err.message)
    } finally {
      setIsSaving(false)
    }
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
              placeholder={['開始時間 (必填)', '結束時間 (選填)']}
              allowEmpty={[false, true]}
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
