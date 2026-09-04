/**
 * validator.js - 通用表單驗證服務模組 (Form Validation Service)
 * 
 * 提供可重用的單純驗證函式 (Atomic Validators) 以及各表單層級的 Schema 驗證器 (Form Validators)。
 * 驗證器回傳物件 (e.g. { attractionName: '請填寫行程名稱', startTime: '請選擇開始時間' })，
 * 以便在各輸入框下方獨立渲染紅字提示與高亮紅色邊框。
 */

/**
 * 檢查數值是否已填寫 (非 null, undefined 或純空白字串)
 * @param {*} val 欄位數值
 * @param {string} fieldName 欄位顯示名稱 (如 "行程名稱")
 * @param {boolean} isSelect 是否為選擇類型的欄位 (預設為 false)
 * @returns {string|null} 錯誤訊息字串，若驗證通過則回傳 null
 */
export function isRequired(val, fieldName = '此欄位', isSelect = false) {
  const prefix = isSelect ? '請選擇' : '請填寫'
  if (val === null || val === undefined) return `${prefix}${fieldName}`
  if (typeof val === 'string' && !val.trim()) return `${prefix}${fieldName}`
  return null
}

/**
 * 檢查結束時間/日期是否大於或等於開始時間/日期
 * 支援 'HH:mm' 時間字串格式與 'YYYY-MM-DD' 日期字串格式
 * @param {string} start 開始時間/日期
 * @param {string} end 結束時間/日期
 * @param {string} errorMsg 自訂錯誤訊息內容
 * @returns {string|null} 錯誤訊息字串，若驗證通過則回傳 null
 */
export function isDateOrderValid(start, end, errorMsg = '結束時間不能早於開始時間') {
  if (!start || !end) return null
  if (end < start) return errorMsg
  return null
}

/**
 * 檢查網址格式是否符合 http:// 或 https:// 開頭 (若留空則不檢查)
 * @param {string} url 網址字串
 * @returns {string|null} 錯誤訊息字串，若驗證通過則回傳 null
 */
export function isValidUrl(url) {
  if (!url || !url.trim()) return null
  const pattern = /^(https?:\/\/)/i
  if (!pattern.test(url.trim())) return '網址格式不正確，需以 http:// 或 https:// 開頭'
  return null
}

/**
 * 檢查驗證結果物件是否包含任何錯誤
 * @param {Object} errorsObj 錯誤物件 { fieldKey: errorMsg }
 * @returns {boolean} 若包含至少一個錯誤字串則回傳 true
 */
export function hasErrors(errorsObj = {}) {
  return Object.values(errorsObj).some((msg) => Boolean(msg))
}

/**
 * 行程表單 (ScheduleForm) 專用驗證器
 * @param {Object} form { attractionName, startTime, endTime, googleMapLink }
 * @returns {Object} 回傳錯誤物件 { attractionName, startTime, endTime, googleMapLink }
 */
export function validateScheduleForm(form = {}) {
  const errors = {}

  // 1. 行程名稱必填
  const nameError = isRequired(form.attractionName, '行程名稱')
  if (nameError) errors.attractionName = nameError

  // 2. 開始時間必填
  const startTimeError = isRequired(form.startTime, '開始時間', true)
  if (startTimeError) errors.startTime = startTimeError

  // 3. 結束時間不得早於開始時間 (若有填寫結束時間)
  const orderError = isDateOrderValid(form.startTime, form.endTime, '結束時間不能早於開始時間')
  if (orderError) errors.endTime = orderError

  return errors
}

/**
 * 新增/編輯旅行計畫表單 (TripForm) 專用驗證器
 * @param {Object} form { name, startDate, endDate }
 * @returns {Object} 回傳錯誤物件 { name, startDate, endDate }
 */
export function validateTripForm(form = {}) {
  const errors = {}

  // 1. 旅程名稱必填
  const nameError = isRequired(form.name, '行程名稱')
  if (nameError) errors.name = nameError

  // 2. 回程日期不得早於出發日期
  const dateOrderError = isDateOrderValid(form.startDate, form.endDate, '回程日期不能早於出發日期')
  if (dateOrderError) errors.endDate = dateOrderError

  return errors
}
