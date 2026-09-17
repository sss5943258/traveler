import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, ImagePlus } from 'lucide-react'
import { Input, DatePicker, Button } from 'antd'
import dayjs from 'dayjs'
import { apiService } from '../services/apiService'
import ImageLightbox from './ImageLightbox'
import './Modals.css'

/**
 * parseToDayjs 輔助函式
 * 將資料庫儲存的 "YYYY-MM-DD HH:mm" 或 "YYYY/MM/DD HH:mm" 字串轉換為 Ant Design DatePicker 所需的 Dayjs 物件。
 * 若傳入空值或格式無法解析，則安全回傳 null，避免元件報錯。
 * 
 * @param {string} val 後端或 initialData 傳來的日期時間字串
 * @returns {dayjs.Dayjs | null} 解析成功的 Dayjs 物件或 null
 */
const parseToDayjs = (val) => {
  if (!val) return null
  const str = String(val).trim()
  if (!str) return null
  // 統一將斜線轉換為破折號以利 Dayjs 相容解析
  const parsed = dayjs(str.replace(/\//g, '-'))
  return parsed.isValid() ? parsed : null
}

/**
 * TripInfoForm 元件 (去回程航班與行程備註表單核心元件)
 * 支援於桌面版右側側邊欄內嵌使用，或於手機版藉由 TripInfoFormModal 彈窗包裹展示。
 * 
 * @param {string} props.type 資料類型，可為 'outbound' (去程航班)、'inbound' (回程航班) 或 'remark' (行程備註)
 * @param {string} props.tripId 旅行計畫的 ID
 * @param {Object} props.initialData 行程最初的完整資料，包含現有的去回程航班資訊與備註，用於填寫預設值
 * @param {Function} props.onSaved 當儲存成功時觸發的 callback 函式，會將更新的欄位回傳給父層元件
 * @param {Function} props.onCancel 當點擊「取消」或關閉時觸發的 callback 函式
 */
export function TripInfoForm({ type, tripId, initialData, onSaved, onCancel }) {
  const isFlight = type === 'outbound' || type === 'inbound'
  const prefix = type === 'outbound' ? 'outbound' : 'inbound'

  // form 狀態：儲存表單各個輸入欄位的值 (時間格式統一以 "YYYY-MM-DD HH:mm" 字串維護)
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
  
  // isSaving 狀態：記錄目前是否正在與後端 API 傳輸儲存中，用於驅動按鈕 Loading 動畫與防連點
  const [isSaving, setIsSaving] = useState(false)
  
  // error 狀態：儲存欄位驗證失敗或後端 API 傳回的錯誤訊息字串
  const [error, setError] = useState(null)
  
  // lightboxSrc 狀態：紀錄當前點擊放大的圖片 URL (為 null 表示燈箱關閉)
  const [lightboxSrc, setLightboxSrc] = useState(null)

  // 圖片上傳相關狀態
  const [imageFile, setImageFile] = useState(null)               // 使用者新選取的本機 File 檔案物件
  const [imagePreview, setImagePreview] = useState(null)          // 圖片預覽路徑 (Base64 或遠端網址)
  const [existingImageUrl, setExistingImageUrl] = useState(null)  // 後端既有的遠端圖片網址
  const [isUploading, setIsUploading] = useState(false)          // 是否正在上傳圖片至儲存空間
  const fileInputRef = useRef(null)                               // 隱藏原生 input[type="file"] 的 DOM 參照

  /**
   * 監聽傳入的 initialData 或類型變更
   * 當使用者開啟不同航班卡片或父層資料更新時，同步將舊值填入表單與重置預覽圖
   */
  useEffect(() => {
    if (initialData) {
      if (isFlight) {
        setForm({
          flightNo: initialData[`${prefix}FlightNo`] || '',
          airline: initialData[`${prefix}Airline`] || '',
          departureTime: initialData[`${prefix}DepartureTime`] || '',
          arrivalTime: initialData[`${prefix}ArrivalTime`] || '',
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
   * handleChange 基礎文字欄位變更處理函式
   * 利用 HTML 元素的 name 屬性與 React 計算屬性名稱語法，動態更新對應的 state 欄位
   * 
   * @param {React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>} e 輸入框變更事件
   */
  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  /**
   * handleDateChange 日期時間選取器變更處理函式
   * 當使用者在 Ant Design DatePicker 選擇或清除時間時觸發，將 Dayjs 物件轉換為標準格式化字串存入 state
   * 
   * @param {string} fieldName 目標欄位名稱 ('departureTime' 或 'arrivalTime')
   * @param {dayjs.Dayjs | null} date 選取的時間 Dayjs 物件 (點清除時為 null)
   */
  const handleDateChange = (fieldName, date) => {
    setForm((prev) => ({
      ...prev,
      [fieldName]: date ? date.format('YYYY-MM-DD HH:mm') : ''
    }))
  }

  /**
   * handleImageSelect 圖片選取處理函式
   * 當使用者點選「上傳圖片」或「更換圖片」選擇本機檔案時執行，進行副檔名與 5MB 檔案大小驗證，並使用 FileReader 產出預覽
   * 
   * @param {React.ChangeEvent<HTMLInputElement>} e 檔案選取事件
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

    // 使用 FileReader 產生 Base64 網址以即時在前端預覽
    const reader = new FileReader()
    reader.onload = (ev) => {
      setImagePreview(ev.target.result)
    }
    reader.readAsDataURL(file)
  }

  /**
   * handleRemoveImage 移除圖片處理函式
   * 清除目前選取的檔案或資料庫現有圖片網址，並重設檔案輸入框的 value 避免重複選取同一檔案無反應
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
   * uploadImage 圖片上傳非同步輔助函式
   * 將本機圖片二進位內容讀取為 Base64 字串後，送交後端 API 寫入雲端或儲存空間
   * 
   * @param {File} file 使用者選擇的圖片檔案
   * @returns {Promise<Object>} 回傳包含 imageUrl 的結果物件
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
   * 整合航班資訊、備註文字與可能新上傳或刪除的圖片，呼叫後端 updateTripInfo API 完成更新
   * 
   * @param {React.FormEvent<HTMLFormElement>} e 表單提交事件
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
        outboundDepartureTime: form.departureTime,
        outboundArrivalTime: form.arrivalTime,
        outboundDepAirport: form.depAirport,
        outboundArrAirport: form.arrAirport,
        outboundFlightRemark: form.flightRemark
      }
      if (prefix === 'inbound') {
        updateData = {
          inboundFlightNo: form.flightNo,
          inboundAirline: form.airline,
          inboundDepartureTime: form.departureTime,
          inboundArrivalTime: form.arrivalTime,
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
      // 1. 若使用者選取了新的圖片檔案，先發送非同步上傳
      if (imageFile) {
        setIsUploading(true)
        const uploadResult = await uploadImage(imageFile)
        if (uploadResult.imageUrl) {
          updateData[`${prefix}ImageUrl`] = uploadResult.imageUrl
        }
        setIsUploading(false)
      }
      // 2. 若原本有圖片，但使用者按了「移除」，將圖片網址清空
      else if (existingImageUrl === null && initialData?.[`${prefix}ImageUrl`]) {
        updateData[`${prefix}ImageUrl`] = ''
      }

      // 3. 發送表單更新 API
      await apiService.updateTripInfo(tripId, updateData)

      // 4. 通知父層組件儲存完畢並傳遞最新資料
      onSaved(updateData)
    } catch (err) {
      setError(err.message)
      setIsUploading(false)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="trip-info-form-container">
      {/* 頂部標題區：固定吸頂 (flex-shrink: 0) */}
      <div className="form-modal-header">
        <div>
          <h2 className="modal-title">
            {type === 'outbound' ? '編輯去程航班' : type === 'inbound' ? '編輯回程航班' : '編輯行程備註'}
          </h2>
          <p className="modal-subtitle">旅程資訊</p>
        </div>
        {onCancel && (
          <button className="close-btn" onClick={onCancel} title="關閉" type="button">
            <X size={20} />
          </button>
        )}
      </div>

      {/* 表單主體區塊：軟性填滿剩餘高度並支援獨立滾動 (flex: 1; min-height: 0; overflow-y: auto) */}
      <div className="form-modal-body flex-fill-body">
        <form className="schedule-form" id="tripInfoForm" onSubmit={handleSubmit}>
          {isFlight ? (
            <>
              {/* 1. 航班編號與航空公司 (手機與桌面均為雙欄，簡短緊湊) */}
              <div className="form-row">
                <div className="form-group">
                  <label>航班編號</label>
                  <Input
                    name="flightNo"
                    value={form.flightNo}
                    onChange={handleChange}
                    placeholder="例如：IT654"
                    allowClear
                  />
                </div>
                <div className="form-group">
                  <label>航空公司</label>
                  <Input
                    name="airline"
                    value={form.airline}
                    onChange={handleChange}
                    placeholder="例如：虎航"
                    allowClear
                  />
                </div>
              </div>

              {/* 2. 起飛時間與抵達時間 (桌機雙欄，手機小螢幕特定切換為單欄滿寬，防止日期時間字串被擠壓重疊) */}
              <div className="form-row form-row-time">
                <div className="form-group">
                  <label>起飛時間</label>
                  <DatePicker
                    showTime={{ format: 'HH:mm' }}
                    format="YYYY-MM-DD HH:mm"
                    minuteStep={5}
                    value={parseToDayjs(form.departureTime)}
                    onChange={(date) => handleDateChange('departureTime', date)}
                    placeholder="請選擇起飛時間"
                    style={{ width: '100%' }}
                    needConfirm={false}
                  />
                </div>
                <div className="form-group">
                  <label>抵達時間</label>
                  <DatePicker
                    showTime={{ format: 'HH:mm' }}
                    format="YYYY-MM-DD HH:mm"
                    minuteStep={5}
                    value={parseToDayjs(form.arrivalTime)}
                    onChange={(date) => handleDateChange('arrivalTime', date)}
                    placeholder="請選擇抵達時間"
                    style={{ width: '100%' }}
                    needConfirm={false}
                  />
                </div>
              </div>

              {/* 3. 起訖機場 (手機與桌面維持雙欄) */}
              <div className="form-row">
                <div className="form-group">
                  <label>起飛機場 / 地點</label>
                  <Input
                    name="depAirport"
                    value={form.depAirport}
                    onChange={handleChange}
                    placeholder="例如：TPE (桃園)"
                    allowClear
                  />
                </div>
                <div className="form-group">
                  <label>抵達機場 / 地點</label>
                  <Input
                    name="arrAirport"
                    value={form.arrAirport}
                    onChange={handleChange}
                    placeholder="例如：CJU (濟州)"
                    allowClear
                  />
                </div>
              </div>

              {/* 4. 班機備註 */}
              <div className="form-group">
                <label>班機備註</label>
                <Input.TextArea
                  name="flightRemark"
                  value={form.flightRemark}
                  onChange={handleChange}
                  placeholder="航班注意事項、行李重量限制等..."
                  rows={2}
                  autoSize={{ minRows: 2, maxRows: 4 }}
                />
              </div>

              {/* 隱藏的原生檔案選取器 */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                style={{ display: 'none' }}
              />

              {/* 圖片上傳與預覽區域 */}
              {imagePreview ? (
                <div className="image-preview-container" style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                  <img
                    src={imagePreview}
                    alt="航班圖片預覽"
                    className="image-preview"
                    onClick={() => setLightboxSrc(imagePreview)}
                    title="點擊放大檢視"
                    style={{ width: '100%', maxHeight: '140px', objectFit: 'cover', borderRadius: '4px', cursor: 'pointer' }}
                  />
                  <div className="image-preview-actions" style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <Button
                      type="default"
                      onClick={() => fileInputRef.current?.click()}
                      style={{ flex: 1 }}
                      size="small"
                    >
                      更換圖片
                    </Button>
                    <Button
                      danger
                      onClick={handleRemoveImage}
                      style={{ flex: 1 }}
                      size="small"
                    >
                      移除
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  className="image-upload-area"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width: '100%',
                    height: '80px',
                    border: '2px dashed var(--glass-border)',
                    borderRadius: '4px',
                    background: 'rgba(255, 255, 255, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    marginTop: '0.5rem',
                    marginBottom: '0.5rem'
                  }}
                >
                  <ImagePlus size={24} className="upload-icon" style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '8px' }}>上傳航班憑證 / 票券圖片</span>
                </div>
              )}
            </>
          ) : (
            <div className="form-group remark-group">
              <label>行程備註</label>
              <Input.TextArea
                name="tripRemark"
                value={form.tripRemark}
                onChange={handleChange}
                placeholder="在此填寫行前準備、行程備忘等資訊..."
                rows={4}
                autoSize={{ minRows: 4, maxRows: 8 }}
              />
            </div>
          )}

          {error && <p className="form-error">{error}</p>}
        </form>
      </div>

      {/* 底部按鈕區：由 Flex 佈局固定於彈窗底部 */}
      <div className="form-modal-footer">
        {onCancel && (
          <Button onClick={onCancel} disabled={isSaving}>
            取消
          </Button>
        )}
        <Button
          type="primary"
          htmlType="submit"
          form="tripInfoForm"
          loading={isSaving}
          style={{ minWidth: '80px' }}
        >
          {isUploading ? '上傳圖片中...' : isSaving ? '儲存中...' : '儲存'}
        </Button>
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
 * 它使用 React 18/19 的 createPortal 將彈窗直接掛載到 document.body，
 * 避免受父層 CSS overflow、transform 或 z-index 階層影響而產生裁切。
 * 
 * @param {Object} props 傳遞給 TripInfoForm 的所有 props，包含 type, tripId, initialData, onClose, onSaved
 */
export default function TripInfoFormModal(props) {
  return createPortal(
    <div className="modal-overlay" onClick={props.onClose}>
      {/* stopPropagation 防止點擊彈窗內部白色卡片時誤觸遮罩的關閉事件 */}
      <div className="modal-content glass form-modal" onClick={(e) => e.stopPropagation()}>
        <TripInfoForm {...props} onCancel={props.onClose} />
      </div>
    </div>,
    document.body
  )
}
