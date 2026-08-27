import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Save, Loader, Plane } from 'lucide-react'
import { API_URL } from '../config'
import { cachedFetch } from '../utils/api'

export default function NewTripModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '',
    startDate: '',
    endDate: '',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('行程名稱為必填欄位')
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      const res = await cachedFetch(`${API_URL}/trips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.error || data.status === 'error') throw new Error(data.error || data.message)
      onCreated(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass form-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="form-modal-header">
          <div>
            <h2 className="modal-title">新增行程</h2>
            <p className="modal-subtitle">建立一趟全新旅程</p>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="form-modal-body">
          <form className="schedule-form" id="newTripForm" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>
                行程名稱 <span className="required">*</span>
              </label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="例：2025 日本關西之旅"
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>出發日期</label>
                <input
                  type="date"
                  name="startDate"
                  value={form.startDate}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label>回程日期</label>
                <input
                  type="date"
                  name="endDate"
                  value={form.endDate}
                  onChange={handleChange}
                />
              </div>
            </div>

            {error && <p className="form-error">{error}</p>}
          </form>
        </div>

        {/* Footer */}
        <div className="form-modal-footer">
          <button type="button" className="btn-cancel" onClick={onClose} disabled={isSaving}>
            取消
          </button>
          <button type="submit" form="newTripForm" className="btn-save" disabled={isSaving}>
            {isSaving ? <Loader size={16} className="spin-icon" /> : <Plane size={16} />}
            {isSaving ? '建立中...' : '建立行程'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
