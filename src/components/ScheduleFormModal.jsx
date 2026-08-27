import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Save, Loader } from 'lucide-react'
import { TimePicker } from 'antd'
import dayjs from 'dayjs'
import { API_URL } from '../config'
import { cachedFetch } from '../utils/api'

// mode: 'add', 'edit', 'addBackup'
// item: 編輯時傳入原卡片，或是新增備案時傳入主卡片
export default function ScheduleFormModal({ mode, item, day, date, groupId, altOrder, tripId, onClose, onSaved }) {
  const isEdit = mode === 'edit'

  const [form, setForm] = useState({
    attractionName: '',
    startTime: '',
    endTime: '',
    remark: '',
    googleMapLink: '',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)

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
      // 備案自動帶入主行程的時間
      setForm((prev) => ({ ...prev, startTime: item.startTime || '', endTime: item.endTime || '' }))
    }
  }, [isEdit, mode, item])

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.attractionName.trim()) {
      setError('名稱為必填欄位')
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      const targetDate = isEdit || mode === 'addBackup' ? item.date : date;
      const targetDay = isEdit || mode === 'addBackup' ? item.day : day;

      const isPlaceholder = isEdit && item?.isDefaultPlaceholder;

      if (isEdit && !isPlaceholder) {
        const res = await cachedFetch(`${API_URL}/schedules/${item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error('儲存失敗')
      } else {
        const res = await cachedFetch(`${API_URL}/schedules`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tripId,
            day: targetDay,
            date: targetDate,
            groupId: isEdit ? item.groupId : (groupId || null),
            altOrder: isEdit ? item.altOrder : (altOrder || 0),
            ...form
          }),
        })
        if (!res.ok) throw new Error('新增失敗')
      }

      const newItem = {
        ...form,
        id: isEdit ? item.id : `t3-d${targetDay}-${Date.now()}`,
        day: targetDay,
        date: targetDate,
        groupId: isEdit ? item.groupId : (groupId || undefined),
        altOrder: isEdit ? item.altOrder : (altOrder || 0),
        sortOrder: isEdit ? item.sortOrder : 999
      }
      onSaved(newItem)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass form-modal" onClick={(e) => e.stopPropagation()}>
        {/* Fixed Header */}
        <div className="form-modal-header">
          <div>
            <h2 className="modal-title">
              {mode === 'edit' ? '編輯行程' : mode === 'addBackup' ? '新增彈性備案' : '新增行程'}
            </h2>
            {isEdit && <p className="modal-subtitle">{item.day === 0 ? '旅程資訊' : `Day ${item.day} · ${item.date}`}</p>}
            {mode === 'addBackup' && <p className="modal-subtitle">Day {item.day} · {item.date} (主行程: {item.attractionName})</p>}
            {mode === 'add' && <p className="modal-subtitle">{day === 0 ? '旅程資訊' : `Day ${day} · ${date}`}</p>}
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="form-modal-body">
          <form className="schedule-form" id="scheduleForm" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>行程名稱 <span className="required">*</span></label>
              <input
                name="attractionName"
                value={form.attractionName}
                onChange={handleChange}
                placeholder="例：清水寺 (景點)"
                required
              />
            </div>

            <div className="form-group">
              <label>時間</label>
              <TimePicker.RangePicker
                format="HH:mm"
                minuteStep={5}
                placeholder={['開始時間', '結束時間']}
                allowEmpty={[true, true]}
                value={[
                  form.startTime ? dayjs(form.startTime, 'HH:mm') : null,
                  form.endTime ? dayjs(form.endTime, 'HH:mm') : null
                ]}
                onChange={(dates, dateStrings) => {
                  setForm(prev => ({
                    ...prev,
                    startTime: dateStrings ? dateStrings[0] : '',
                    endTime: dateStrings ? dateStrings[1] : ''
                  }))
                }}
                style={{
                  width: '100%',
                  padding: '0.6rem 0.85rem',
                  borderRadius: '10px',
                  border: '1.5px solid rgba(0, 0, 0, 0.12)',
                  background: 'rgba(255, 255, 255, 0.7)',
                  fontSize: '0.95rem'
                }}
              />
            </div>

            <div className="form-group">
              <label>備註</label>
              <textarea
                name="remark"
                value={form.remark}
                onChange={handleChange}
                placeholder="補充說明、交通方式、注意事項..."
                rows={3}
              />
            </div>

            <div className="form-group">
              <label>Google Map 連結</label>
              <input
                name="googleMapLink"
                value={form.googleMapLink}
                onChange={handleChange}
                placeholder="https://maps.app.goo.gl/..."
              />
            </div>

            {error && <p className="form-error">{error}</p>}
          </form>
        </div>

        {/* Fixed Footer */}
        <div className="form-modal-footer">
          <button type="button" className="btn-cancel" onClick={onClose} disabled={isSaving}>
            取消
          </button>
          <button type="submit" form="scheduleForm" className="btn-save" disabled={isSaving}>
            {isSaving ? <Loader size={16} className="spin-icon" /> : <Save size={16} />}
            {isSaving ? '儲存中...' : '儲存'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

