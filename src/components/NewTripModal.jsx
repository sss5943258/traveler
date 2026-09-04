import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Save, Loader, Plane } from 'lucide-react'
import { apiService } from '../services/apiService'
import { validateTripForm, hasErrors } from '../utils/validator'
import './Modals.css'

export default function NewTripModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '',
    startDate: '',
    endDate: '',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState(null)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const formErrors = validateTripForm(form)
    if (hasErrors(formErrors)) {
      setErrors(formErrors)
      return
    }
    setErrors({})
    setIsSaving(true)
    setApiError(null)
    try {
      const data = await apiService.createTrip(form)
      onCreated(data)
    } catch (err) {
      setApiError(err.message)
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
          <form className="schedule-form" id="newTripForm" onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label>
                行程名稱 <span className="required">*</span>
              </label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="例：2025 日本關西之旅"
                className={errors.name ? 'input-has-error' : ''}
              />
              {errors.name && <span className="field-error-text">{errors.name}</span>}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>出發日期</label>
                <input
                  type="date"
                  name="startDate"
                  value={form.startDate}
                  onChange={handleChange}
                  className={errors.startDate ? 'input-has-error' : ''}
                />
                {errors.startDate && <span className="field-error-text">{errors.startDate}</span>}
              </div>
              <div className="form-group">
                <label>回程日期</label>
                <input
                  type="date"
                  name="endDate"
                  value={form.endDate}
                  onChange={handleChange}
                  className={errors.endDate ? 'input-has-error' : ''}
                />
                {errors.endDate && <span className="field-error-text">{errors.endDate}</span>}
              </div>
            </div>

            {apiError && <p className="form-error">{apiError}</p>}
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
