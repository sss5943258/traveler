import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader, ImagePlus, Trash2 } from 'lucide-react'
import { apiService } from '../services/apiService'
import ImageLightbox from './ImageLightbox'
import './Modals.css'

/**
 * TripInfoForm 元件 (獨立的去回程航班與行程備註表單元件)
 * @param {string} props.type 資料類型，可為 'outbound' (去程航班)、'inbound' (回程航班) 或 'remark' (行程備註)
 * @param {string} props.tripId 旅行計畫的 ID
 * @param {Object} props.initialData 行程最初的完整資料，包含現有的去回程航班資訊與備註，用於填寫預設值
 * @param {Function} props.onSaved 當儲存成功時觸發的 callback 函式
 * @param {Function} props.onCancel 當點擊「取消」或關閉時觸發的 callback 函式
 */
export function TripInfoForm({ type, tripId, initialData, onSaved, onCancel }) {
  const isFlight = type === 'outbound' || type === 'inbound'
  const prefix = type === 'outbound' ? 'outbound' : 'inbound'

  // form 狀態：儲存表單各個輸入欄位的值
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
  
  // isSaving 狀態：記錄目前是否正在與後端 API 傳輸儲存中，用於顯示轉圈圈與停用按鈕
  const [isSaving, setIsSaving] = useState(false)
  
  // error 狀態：儲存欄位驗證失敗或後端 API 傳回的錯誤訊息
  const [error, setError] = useState(null)
  
  // lightboxSrc 狀態：紀錄當前點擊放大的圖片 URL (為 null 表示關閉)
  const [lightboxSrc, setLightboxSrc] = useState(null)

  // 圖片上傳相關 state
  const [imageFile, setImageFile] = useState(null)         // 使用者新選擇的本機圖片檔案
  const [imagePreview, setImagePreview] = useState(null)    // 圖片預覽 URL (可以是 Base64 或遠端網址)
  const [existingImageUrl, setExistingImageUrl] = useState(null) // 資料庫原有的圖片 URL
  const [isUploading, setIsUploading] = useState(false)    // 是否正在進行圖片上傳的狀態
  const fileInputRef = useRef(null)                         // 對應隱藏 input[type="file"] 的 Ref 指標

  /**
   * toDatetimeLocal 輔助函式
   * 將資料庫儲存的 "YYYY-MM-DD HH:mm" 格式，轉換成 HTML5 datetime-local 欄位接受的 "YYYY-MM-DDTHH:mm" 格式
   */
  const toDatetimeLocal = (val) => {
    if (!val) return ''
    const str = String(val).trim();
    if (!str) return '';

    const date = new Date(str);
    if (!isNaN(date.getTime())) {
      const yyyy = date.getFullYear();
      const MM = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const HH = String(date.getHours()).padStart(2, '0');
      const mm = String(date.getMinutes()).padStart(2, '0');
      return `${yyyy}-${MM}-${dd}T${HH}:${mm}`;
    }

    return str.replace(' ', 'T').slice(0, 16);
  }

  /**
   * fromDatetimeLocal 輔助函式
   * 將 HTML5 datetime-local 欄位的值轉換回資料庫接受的標準 "YYYY-MM-DD HH:mm" 格式
   */
  const fromDatetimeLocal = (val) => {
    if (!val) return ''
    return val.replace('T', ' ')
  }

  // 監聽傳入的 initialData 或類型，初始化表單的輸入值與現有圖片
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
        const existingUrl = initialData[`${prefix}ImageUrl`] || ''
        if (existingUrl) {
          setExistingImageUrl(existingUrl)
          setImagePreview(existingUrl)
        } else {
          setExistingImageUrl(null)
          setImagePreview(null)
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
        setExistingImageUrl(null)
        setImagePreview(null)
      }
    }
  }, [type, initialData, prefix, isFlight])

  /**
   * handleChange 欄位變更處理函式
   * 當表單欄位值變更時，同步寫入 React state 中以驅動組件重新渲染
   */
  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  /**
   * handleImageSelect 選擇圖片處理函式
   * 當使用者點選圖片上傳區並選擇檔案時觸發，進行檔案類型與大小（上限 5MB）的防呆驗證
   */
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('請選擇圖片檔案')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('圖片大小不能超過 5MB')
      return
    }

    setImageFile(file)
    setError(null)

    // 透過 FileReader 讀取圖片，生成 Base64 data URI 用以提供本機即時預覽
    const reader = new FileReader()
    reader.onload = (ev) => {
      setImagePreview(ev.target.result)
    }
    reader.readAsDataURL(file)
  }

  /**
   * handleRemoveImage 移除圖片處理函式
   * 當使用者點擊「移除圖片」按鈕時，清除所有相關狀態，並重設 input[type="file"] 的值
   */
  const handleRemoveImage = () => {
    setImageFile(null)
    setImagePreview(null)
    setExistingImageUrl(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  /**
   * uploadImage 圖片上傳非同步函式
   * 將本機圖片轉換為 Base64 字串後，發送到後端 API 伺服器進行儲存，並回傳儲存後的遠端 URL
   */
  const uploadImage = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = async (ev) => {
        try {
          const base64 = ev.target.result
          const result = await apiService.uploadTripImage({
            tripId,
            type: prefix,
            imageBase64: base64,
            fileName: `${tripId}_${prefix}_${Date.now()}.${file.name.split('.').pop()}`
          })
          resolve(result)
        } catch (err) {
          reject(err)
        }
      }
      reader.onerror = () => reject(new Error('讀取檔案失敗'))
      reader.readAsDataURL(file)
    })
  }

  /**
   * handleSubmit 表單提交處理函式
   * 將去回程航班資料或行程備註，連同上傳後的圖片 URL 傳送至後端進行持久化儲存
   */
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
      // 1. 若有新選擇的圖片檔案，先發送上傳請求
      if (imageFile) {
        setIsUploading(true)
        const uploadResult = await uploadImage(imageFile)
        if (uploadResult.imageUrl) {
          updateData[`${prefix}ImageUrl`] = uploadResult.imageUrl
        }
        setIsUploading(false)
      }
      // 2. 若原本有圖片，但點選了「移除」，則將資料庫中的欄位清空
      else if (existingImageUrl === null && initialData?.[`${prefix}ImageUrl`]) {
        updateData[`${prefix}ImageUrl`] = ''
      }

      // 3. 發送表單主體資料更新請求
      await apiService.updateTripInfo(tripId, updateData)

      onSaved(updateData)
    } catch (err) {
      setError(err.message)
      setIsUploading(false)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="trip-info-form-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 頂部標題區 */}
      <div className="form-modal-header">
        <div>
          <h2 className="modal-title">
            {type === 'outbound' ? '編輯去程航班' : type === 'inbound' ? '編輯回程航班' : '編輯行程備註'}
          </h2>
          <p className="modal-subtitle">旅程資訊</p>
        </div>
        {onCancel && (
          <button className="close-btn" onClick={onCancel} title="關閉">
            <X size={20} />
          </button>
        )}
      </div>

      {/* 表單主體滾動區 */}
      <div className="form-modal-body" style={{ flex: 1, overflowY: 'auto' }}>
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

              {/* 隱藏的檔案選取器 */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                style={{ display: 'none' }}
              />

              {/* 圖片上傳與預覽區域 */}
              {imagePreview ? (
                <div className="image-preview-container" style={{ marginTop: '0.5rem', marginBottom: '1rem' }}>
                  <img
                    src={imagePreview}
                    alt="航班圖片預覽"
                    className="image-preview"
                    onClick={() => setLightboxSrc(imagePreview)}
                    title="點擊放大檢視"
                    style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer' }}
                  />
                  <div className="image-preview-actions" style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      className="image-action-btn change btn-esence-outline"
                      onClick={() => fileInputRef.current?.click()}
                      style={{ flex: 1, padding: '0.4rem', fontSize: '0.85rem' }}
                    >
                      <ImagePlus size={14} style={{ marginRight: '4px', display: 'inline' }} />
                      更換圖片
                    </button>
                    <button
                      type="button"
                      className="image-action-btn remove danger"
                      onClick={handleRemoveImage}
                      style={{ flex: 1, padding: '0.4rem', fontSize: '0.85rem', color: '#e53e3e', border: '1px solid #e53e3e', background: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      <Trash2 size={14} style={{ marginRight: '4px', display: 'inline' }} />
                      移除
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="image-upload-area"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width: '100%',
                    height: '100px',
                    border: '2px dashed var(--glass-border)',
                    borderRadius: '4px',
                    background: 'rgba(255, 255, 255, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    marginTop: '0.5rem',
                    marginBottom: '1rem'
                  }}
                >
                  <ImagePlus size={28} className="upload-icon" style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '8px' }}>上傳航班憑證 / 票券圖片</span>
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

      {/* 底部按鈕區 */}
      <div className="form-modal-footer">
        {onCancel && (
          <button type="button" className="btn-cancel" onClick={onCancel} disabled={isSaving}>
            取消
          </button>
        )}
        <button type="submit" form="tripInfoForm" className="btn-save" disabled={isSaving}>
          {isSaving && <Loader size={16} className="spin-icon" style={{ display: 'inline', marginRight: '4px' }} />}
          {isUploading ? '上傳圖片中...' : isSaving ? '儲存中...' : '儲存'}
        </button>
      </div>

      {lightboxSrc && (
        <ImageLightbox
          src={lightboxSrc}
          alt="航班圖片"
          onClose={() => setLightboxSrc(null)}
        />
      )}
    </div>
  )
}

/**
 * TripInfoFormModal 元件 (用於手機版或獨立 Dialog 彈窗時包裹 TripInfoForm)
 * 它使用 createPortal 將 React 元件直接掛載到 body 層，確保層級（z-index）不被父容器遮擋。
 */
export default function TripInfoFormModal(props) {
  return createPortal(
    <div className="modal-overlay" onClick={props.onClose}>
      <div className="modal-content glass form-modal" onClick={(e) => e.stopPropagation()}>
        <TripInfoForm {...props} onCancel={props.onClose} />
      </div>
    </div>,
    document.body
  )
}
