import { API_MODE, API_URL_GAS, API_URL_NET_CORE } from '../config'
import { cachedFetch } from '../utils/api'

/**
 * apiService 服務層模組 (API Adapter Service Layer)
 * 
 * 採用 Adapter Pattern (適配器模式) 與 Strategy Pattern (策略模式)。
 * 第一層 React 元件僅傳遞統一的 DTO，本模組會根據 `config.js` 的 `API_MODE` 
 * 自動轉化為 Google Apps Script (GAS) 載荷或 ASP.NET Core RESTful API 請求。
 */

// 取得目前的 API URL 進入點
const getBaseUrl = () => (API_MODE === 'GAS' ? API_URL_GAS : API_URL_NET_CORE)

/**
 * 通用 Fetch 請求發送器 (支援 GAS 與 RESTful 自動適配)
 */
async function sendRequest({ path = '', method = 'GET', payload = null, actionName = '' }) {
  const url = getBaseUrl()
  const isGas = API_MODE === 'GAS'

  if (isGas) {
    // ── GAS 模式策略 ──
    if (method.toUpperCase() === 'GET') {
      const queryUrl = `${url}?action=${actionName}${path ? `&${path}` : ''}`
      const res = await cachedFetch(queryUrl)
      if (!res.ok) throw new Error(`[GAS API 錯誤] HTTP ${res.status}`)
      return await res.json()
    } else {
      // POST 傳送帶 action 的 JSON Payload
      const bodyPayload = JSON.stringify({
        action: actionName,
        ...payload
      })
      const res = await cachedFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: bodyPayload
      })
      const responseText = await res.text()
      let result = {}
      try {
        result = JSON.parse(responseText)
      } catch {
        // Fallback for non-json response text
        result = { text: responseText }
      }
      if (result.status === 'error' || result.error) {
        throw new Error(result.message || result.error || '操作失敗')
      }
      return result
    }
  } else {
    // ── ASP.NET Core RESTful 模式策略 ──
    const targetUrl = `${url}${path.startsWith('/') ? path : `/${path}`}`
    const options = {
      method: method.toUpperCase(),
      headers: { 'Content-Type': 'application/json' }
    }

    if (payload && options.method !== 'GET') {
      options.body = JSON.stringify(payload)
    }

    const res = await cachedFetch(targetUrl, options)
    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`[API 錯誤 ${res.status}] ${errText || '網路請求失敗'}`)
    }

    if (res.status === 204) return true // No Content
    return await res.json()
  }
}

export const apiService = {
  /**
   * 取得所有旅行計畫清單
   */
  async getTrips() {
    return await sendRequest({
      actionName: 'getTrips',
      path: API_MODE === 'GAS' ? '' : '/trips',
      method: 'GET'
    })
  },

  /**
   * 取得單一旅行計畫詳細資料
   * @param {string} tripId 
   */
  async getTripDetails(tripId) {
    return await sendRequest({
      actionName: 'getTripDetails',
      path: API_MODE === 'GAS' ? `tripId=${tripId}` : `/trips/${tripId}`,
      method: 'GET'
    })
  },

  /**
   * 建立新的旅行計畫
   * @param {Object} tripDto { name, startDate, endDate, ... }
   */
  async createTrip(tripDto) {
    return await sendRequest({
      actionName: 'createTrip',
      path: '/trips',
      method: 'POST',
      payload: tripDto
    })
  },

  /**
   * 刪除旅行計畫
   * @param {string} tripId 
   */
  async deleteTrip(tripId) {
    return await sendRequest({
      actionName: 'deleteTrip',
      path: `/trips/${tripId}`,
      method: API_MODE === 'GAS' ? 'POST' : 'DELETE',
      payload: { tripId }
    })
  },

  /**
   * 新增行程卡片或彈性備案
   * @param {Object} scheduleDto { tripId, day, date, groupId, altOrder, attractionName, startTime, endTime, remark, googleMapLink }
   */
  async addSchedule(scheduleDto) {
    return await sendRequest({
      actionName: 'addSchedule',
      path: '/schedules',
      method: 'POST',
      payload: scheduleDto
    })
  },

  /**
   * 更新行程卡片
   * @param {string} id 行程卡片 ID
   * @param {Object} scheduleDto { attractionName, startTime, endTime, remark, googleMapLink, ... }
   */
  async updateSchedule(id, scheduleDto) {
    return await sendRequest({
      actionName: 'updateSchedule',
      path: `/schedules/${id}`,
      method: API_MODE === 'GAS' ? 'POST' : 'PUT',
      payload: { id, ...scheduleDto }
    })
  },

  /**
   * 刪除單一行程卡片
   * @param {string} id 行程卡片 ID
   */
  async deleteSchedule(id) {
    return await sendRequest({
      actionName: 'deleteSchedule',
      path: `/schedules/${id}`,
      method: API_MODE === 'GAS' ? 'POST' : 'DELETE',
      payload: { id }
    })
  },

  /**
   * 更新行程卡片拖曳排序
   * @param {string} tripId 
   * @param {number} day 
   * @param {Array<string>} orderedIds 排序後的卡片/群組 ID 陣列
   */
  async updateScheduleOrder(tripId, day, orderedIds) {
    return await sendRequest({
      actionName: 'updateScheduleOrder',
      path: `/trips/${tripId}/days/${day}/reorder`,
      method: API_MODE === 'GAS' ? 'POST' : 'PUT',
      payload: { tripId, day, orderedIds }
    })
  },

  /**
   * 更新去回程航班或行程備註資訊
   * @param {string} tripId 
   * @param {Object} infoDto { outboundFlightNo..., inbound..., tripRemark }
   */
  async updateTripInfo(tripId, infoDto) {
    return await sendRequest({
      actionName: 'updateTripInfo',
      path: `/trips/${tripId}/info`,
      method: API_MODE === 'GAS' ? 'POST' : 'PUT',
      payload: { tripId, data: infoDto, ...infoDto }
    })
  },

  /**
   * 上傳航班/憑證圖片
   * @param {Object} uploadDto { tripId, type: 'outbound'|'inbound', imageBase64, fileName }
   */
  async uploadTripImage(uploadDto) {
    return await sendRequest({
      actionName: 'uploadTripImage',
      path: `/trips/${uploadDto.tripId}/info/upload`,
      method: 'POST',
      payload: uploadDto
    })
  },

  /**
   * 取得所有旅行攜帶品項清單
   */
  async getPackingItems() {
    return await sendRequest({
      actionName: 'getPackingItems',
      path: API_MODE === 'GAS' ? '' : '/packingitems',
      method: 'GET'
    })
  },

  /**
   * 新增攜帶品項
   * @param {Object} itemDto { name, isEssential }
   */
  async addPackingItem(itemDto) {
    return await sendRequest({
      actionName: 'addPackingItem',
      path: '/packingitems',
      method: 'POST',
      payload: itemDto
    })
  },

  /**
   * 切換品項勾選狀態
   * @param {string} itemId 
   * @param {boolean} checked 
   */
  async togglePackingItem(itemId, checked) {
    return await sendRequest({
      actionName: 'togglePackingItem',
      path: `/packingitems/${itemId}/toggle`,
      method: API_MODE === 'GAS' ? 'POST' : 'PATCH',
      payload: { itemId, checked }
    })
  },

  /**
   * 刪除攜帶品項
   * @param {string} itemId 
   */
  async deletePackingItem(itemId) {
    return await sendRequest({
      actionName: 'deletePackingItem',
      path: `/packingitems/${itemId}`,
      method: API_MODE === 'GAS' ? 'POST' : 'DELETE',
      payload: { itemId }
    })
  }
}
