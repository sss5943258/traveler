import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader, ImagePlus, Trash2 } from 'lucide-react'
import { API_URL } from '../config'
import { cachedFetch } from '../utils/api'
import ImageLightbox from './ImageLightbox'

export default function TripInfoFormModal({ type, tripId, initialData, onClose, onSaved }) {
  const isFlight = type === 'outbound' || type === 'inbound'
  const prefix = type === 'outbound' ? 'outbound' : 'inbound'

  const [form, setForm] = useState({
    // Flight fields
    flightNo: '',
    airline: '',
    departureTime: '',
    arrivalTime: '',
    depAirport: '',
    arrAirport: '',
    flightRemark: '',
    // Remark field
    tripRemark: ''
  })
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)
  const [lightboxSrc, setLightboxSrc] = useState(null)

  // 圖片上傳相關 state
  const [imageFile, setImageFile] = useState(null)         // 新選擇的檔案
  const [imagePreview, setImagePreview] = useState(null)    // 預覽 URL (base64 or existing URL)
  const [existingImageUrl, setExistingImageUrl] = useState(null) // 已儲存的圖片 URL
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef(null)

  // 輔助函式：將資料庫的 "YYYY-MM-DD HH:mm" 或 timezone 格式字串轉換成 input 需要的 "YYYY-MM-DDTHH:mm"
  const toDatetimeLocal = (val) => {
    if (!val) return ''
    const str = String(val).trim();
    if (!str) return '';

    // 如果是 ISO/Timezone 格式，將其解析並轉為本地時間格式 YYYY-MM-DDTHH:mm
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
      const yyyy = date.getFullYear();
      const MM = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const HH = String(date.getHours()).padStart(2, '0');
      const mm = String(date.getMinutes()).padStart(2, '0');
      return `${yyyy}-${MM}-${dd}T${HH}:${mm}`;
    }

    // 備用方案
    return str.replace(' ', 'T').slice(0, 16);
  }


  // 輔助函式：將 input 的 "YYYY-MM-DDTHH:mm" 轉換回資料庫的 "YYYY-MM-DD HH:mm"
  const fromDatetimeLocal = (val) => {
    if (!val) return ''
    return val.replace('T', ' ')
  }

  useEffect(() => {
    if (initialData) {
      if (isFlight) {
        setForm({
          flightNo: initialData[`${prefix}FlightNo`] || '',
          airline: initialData[`${prefix}Airline`] || '',
          departureTime: toDatetimeLocal(initialData[`${prefix}DepartureTime`]),
          arrivalTime: toDatetimeLocal(initialData[`${prefix}ArrivalTime`]),
          depAirport: initialData[`${prefix}DepAirport`] || '',
          arrAirport: initialData[`${prefix}ArrAirport`] || '',
          flightRemark: initialData[`${prefix}FlightRemark`] || '',
          tripRemark: ''
        })
        // 載入已有的圖片
        const existingUrl = initialData[`${prefix}ImageUrl`] || ''
        if (existingUrl) {
          setExistingImageUrl(existingUrl)
          setImagePreview(existingUrl)
        }
      } else {
        setForm({
          flightNo: '',
          airline: '',
          departureTime: '',
          arrivalTime: '',
          depAirport: '',
          arrAirport: '',
          flightRemark: '',
          tripRemark: initialData.tripRemark || ''
        })
      }
    }
  }, [type, initialData, prefix, isFlight])

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  // 選擇圖片
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 驗證檔案類型
    if (!file.type.startsWith('image/')) {
      setError('請選擇圖片檔案')
      return
    }

    // 驗證檔案大小 (最大 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('圖片大小不能超過 5MB')
      return
    }

    setImageFile(file)
    setError(null)

    // 產生預覽
    const reader = new FileReader()
    reader.onload = (ev) => {
      setImagePreview(ev.target.result)
    }
    reader.readAsDataURL(file)
  }

  // 移除圖片
  const handleRemoveImage = () => {
    setImageFile(null)
    setImagePreview(null)
    setExistingImageUrl(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // 上傳圖片到本地伺服器
  const uploadImage = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = async (ev) => {
        try {
          const base64 = ev.target.result
          const res = await cachedFetch(`${API_URL}/trips/${tripId}/info/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: prefix,
              imageBase64: base64,
              fileName: `${tripId}_${prefix}_${Date.now()}.${file.name.split('.').pop()}`
            })
          })

          if (!res.ok) throw new Error('圖片上傳失敗')
          const result = await res.json()
          resolve(result)
        } catch (err) {
          reject(err)
        }
      }
      reader.onerror = () => reject(new Error('讀取檔案失敗'))
      reader.readAsDataURL(file)
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)

    let updateData = {}
    if (isFlight) {
      updateData = {
        outboundFlightNo: form.flightNo,
        outboundAirline: form.airline,
        outboundDepartureTime: fromDatetimeLocal(form.departureTime),
        outboundArrivalTime: fromDatetimeLocal(form.arrivalTime),
        outboundDepAirport: form.depAirport,
        outboundArrAirport: form.arrAirport,
        outboundFlightRemark: form.flightRemark
      }
      // 如果不是 outbound，要換成 inbound 欄位名稱
      if (prefix === 'inbound') {
        updateData = {
          inboundFlightNo: form.flightNo,
          inboundAirline: form.airline,
          inboundDepartureTime: fromDatetimeLocal(form.departureTime),
          inboundArrivalTime: fromDatetimeLocal(form.arrivalTime),
          inboundDepAirport: form.depAirport,
          inboundArrAirport: form.arrAirport,
          inboundFlightRemark: form.flightRemark
        }
      }
    } else {
      updateData = {
        tripRemark: form.tripRemark
      }
    }

    try {
      // 如果有新圖片要上傳
      if (imageFile) {
        setIsUploading(true)
        const uploadResult = await uploadImage(imageFile)
        if (uploadResult.imageUrl) {
          updateData[`${prefix}ImageUrl`] = uploadResult.imageUrl
        }
        setIsUploading(false)
      }
      // 如果移成了圖片（原本有但現在沒有了）
      else if (existingImageUrl === null && initialData?.[`${prefix}ImageUrl`]) {
        updateData[`${prefix}ImageUrl`] = ''
      }

      const res = await cachedFetch(`${API_URL}/trips/${tripId}/info`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      if (!res.ok) throw new Error('更新失敗')

      onSaved(updateData)
    } catch (err) {
      setError(err.message)
      setIsUploading(false)
    } finally {
      setIsSaving(false)
    }
  }


  return (
    <>
      {createPortal(
        <div className="modal-overlay" onClick={onClose}>
          <div className="modal-content glass form-modal" onClick={(e) => e.stopPropagation()}>
            {/* Fixed Header */}
            <div className="form-modal-header">
              <div>
                <h2 className="modal-title">
                  {type === 'outbound' ? '編輯去程航班' : type === 'inbound' ? '編輯回程航班' : '編輯行程備註'}
                </h2>
                <p className="modal-subtitle">旅程資訊</p>
              </div>
              <button className="close-btn" onClick={onClose}>
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="form-modal-body">
              <form className="schedule-form" id="tripInfoForm" onSubmit={handleSubmit}>
                {isFlight ? (
                  <>
                    <div className="form-row">
                      <div className="form-group">
                        <label>航班編號</label>
                        <input
                          name="flightNo"
                          value={form.flightNo}
                          onChange={handleChange}
                          placeholder="例如：MM722"
                        />
                      </div>
                      <div className="form-group">
                        <label>航空公司</label>
                        <input
                          name="airline"
                          value={form.airline}
                          onChange={handleChange}
                          placeholder="例如：樂桃航空"
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>起飛時間</label>
                        <input
                          type="datetime-local"
                          name="departureTime"
                          value={form.departureTime}
                          onChange={handleChange}
                        />
                      </div>
                      <div className="form-group">
                        <label>抵達時間</label>
                        <input
                          type="datetime-local"
                          name="arrivalTime"
                          value={form.arrivalTime}
                          onChange={handleChange}
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>起飛機場 / 地點</label>
                        <input
                          name="depAirport"
                          value={form.depAirport}
                          onChange={handleChange}
                          placeholder="例如：TPE (桃園)"
                        />
                      </div>
                      <div className="form-group">
                        <label>抵達機場 / 地點</label>
                        <input
                          name="arrAirport"
                          value={form.arrAirport}
                          onChange={handleChange}
                          placeholder="例如：NGO (名古屋)"
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label>班機備註</label>
                      <textarea
                        name="flightRemark"
                        value={form.flightRemark}
                        onChange={handleChange}
                        placeholder="航班注意事項、行李重量限制等..."
                        rows={2}
                      />
                    </div>

                    {/* 圖片上傳區塊 */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      style={{ display: 'none' }}
                    />

                    {imagePreview ? (
                      <div className="image-preview-container">
                        <img
                          src={imagePreview}
                          alt="航班圖片預覽"
                          className="image-preview"
                          onClick={() => setLightboxSrc(imagePreview)}
                          title="點擊放大檢視"
                        />
                        <div className="image-preview-actions">
                          <button
                            type="button"
                            className="image-action-btn change"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <ImagePlus size={14} />
                            更換圖片
                          </button>
                          <button
                            type="button"
                            className="image-action-btn remove"
                            onClick={handleRemoveImage}
                          >
                            <Trash2 size={14} />
                            移除
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="image-upload-area"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <ImagePlus size={32} className="upload-icon" />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="form-group">
                    <label>行程備註</label>
                    <textarea
                      name="tripRemark"
                      value={form.tripRemark}
                      onChange={handleChange}
                      placeholder="在此填寫行前準備、行程備忘等資訊..."
                      rows={6}
                    />
                  </div>
                )}

                {error && <p className="form-error">{error}</p>}
              </form>
            </div>

            {/* Fixed Footer */}
            <div className="form-modal-footer">
              <button type="button" className="btn-cancel" onClick={onClose} disabled={isSaving}>
                取消
              </button>
              <button type="submit" form="tripInfoForm" className="btn-save" disabled={isSaving}>
                {isSaving && <Loader size={16} className="spin-icon" />}
                {isUploading ? '上傳圖片中...' : isSaving ? '儲存中...' : '儲存'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {lightboxSrc && (
        <ImageLightbox
          src={lightboxSrc}
          alt="航班圖片"
          onClose={() => setLightboxSrc(null)}
        />
      )}
    </>
  )
}

