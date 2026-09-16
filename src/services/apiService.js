import { API_MODE, API_URL_GAS, API_URL_NET_CORE } from '../config'
import { cachedFetch, getAuthHeaders } from '../utils/api'
import { useAuthStore } from '../stores/authStore'

/**
 * apiService 服務層模組 (API Adapter Service Layer)
 * 
 * 採用 Adapter Pattern (適配器模式) 與 Strategy Pattern (策略模式)。
 * 第一層 React 元件僅傳遞統一的 DTO，本模組會根據 `config.js` 的 `API_MODE` 
 * 自動轉化為 Google Apps Script (GAS) 載荷或 ASP.NET Core RESTful API 請求。
 * 
 * 認證機制：
 * - GAS 模式：accessToken 放在 POST body 的 token 欄位（CORS 不允許自訂 header）
 * - NET_CORE 模式：accessToken 放在 Authorization: Bearer <token> header
 */

// 取得目前的 API URL 進入點
const getBaseUrl = () => (API_MODE === 'GAS' ? API_URL_GAS : API_URL_NET_CORE)


/**
 * 通用 Fetch 請求發送器 (支援 GAS 與 RESTful 自動適配)
 * 
 * GAS 模式：token 放在 body（因為 GAS CORS preflight 不允許自訂 header）
 * NET_CORE 模式：token 放在 Authorization: Bearer header
 */
async function sendRequest({ path = '', method = 'GET', payload = null, actionName = '' }) {
  const url = getBaseUrl()
  const isGas = API_MODE === 'GAS'

  // 取得目前有效的 accessToken（若快過期會自動觸發 refresh）
  // 若 refresh 失敗則 throw AUTH_EXPIRED，由 ProtectedRoute 接手跳回登入頁
  const authHeaders = await getAuthHeaders({ 'Content-Type': 'application/json' })
  const accessToken = useAuthStore.getState().accessToken

  if (isGas) {
    // ── GAS 模式策略 ──
    if (method.toUpperCase() === 'GET') {
      // GAS GET：token 放在 query string（因為 GET 沒有 body）
      const tokenParam = accessToken ? `&token=${encodeURIComponent(accessToken)}` : ''
      const queryUrl = `${url}?action=${actionName}${path ? `&${path}` : ''}${tokenParam}`
      const res = await cachedFetch(queryUrl)
      if (!res.ok) throw new Error(`[GAS API 錯誤] HTTP ${res.status}`)
      return await res.json()
    } else {
      // GAS POST：token 放在 body 的 token 欄位
      const bodyPayload = JSON.stringify({
        action: actionName,
        token: accessToken,  // GAS 後端從 body 取 token 驗證
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
      headers: authHeaders,  // 含 Authorization: Bearer <token>
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
   * 
   * [React 觀念解析 - API 適配與向後相容 (Payload Normalization)]
   * 1. 為了確保無論後端 GAS 腳本是讀取頂層屬性 (payload.name) 或讀取 data 物件 (payload.data.name)，
   *    載荷同時注入兩者，達成 100% 向後與向前相容。
   * 2. 接收到回應後，自動檢查並標準化回傳的 tripId，確保呼叫端 (NewTripModal, HomePage)
   *    可直接透過 res.tripId 取得新建的行程 ID 進行頁面導向。
   * 
   * @param {Object} tripDto { name, startDate, endDate }
   * @returns {Promise<Object>} 建立結果物件 (含 tripId 與 readOnlyId)
   */
  async createTrip(tripDto) {
    const res = await sendRequest({
      actionName: 'createTrip',
      path: '/trips',
      method: 'POST',
      payload: {
        ...tripDto,
        data: tripDto, // 雙重兼容：供讀取 payload.data 的舊版或過渡期 GAS 腳本存取
      },
    })

    // 標準化 tripId：若後端回傳結構為 { data: { tripId } } 則提至頂層
    if (res && res.data && res.data.tripId && !res.tripId) {
      res.tripId = res.data.tripId
    }
    return res
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
   * 取得特定旅程的共編者名單與擁有者資訊
   * @param {string} tripId 旅程 ID
   * @returns {Promise<Object>} { status, tripName, owner, collaborators }
   */
  async getCollaborators(tripId) {
    return await sendRequest({
      actionName: 'getCollaborators',
      path: API_MODE === 'GAS' ? `tripId=${encodeURIComponent(tripId)}` : `/trips/${tripId}/collaborators`,
      method: 'GET'
    })
  },

  /**
   * 新增共編者 (輸入 Google Email)
   * @param {string} tripId 旅程 ID
   * @param {string} email 共編者 Email
   * @returns {Promise<Object>} 執行結果
   */
  async addCollaborator(tripId, email) {
    return await sendRequest({
      actionName: 'addCollaborator',
      path: API_MODE === 'GAS' ? '' : `/trips/${tripId}/collaborators`,
      method: 'POST',
      payload: { tripId, email }
    })
  },

  /**
   * 移除共編者
   * @param {string} tripId 旅程 ID
   * @param {string} email 要移除的共編者 Email
   * @returns {Promise<Object>} 執行結果
   */
  async removeCollaborator(tripId, email) {
    return await sendRequest({
      actionName: 'removeCollaborator',
      path: API_MODE === 'GAS' ? '' : `/trips/${tripId}/collaborators/${encodeURIComponent(email)}`,
      method: API_MODE === 'GAS' ? 'POST' : 'DELETE',
      payload: { tripId, email }
    })
  },

  /**
   * 新增行程卡片或彈性備案
   * 
   * [React 小白觀念解析 - API 適配與資料淨化 (Data Sanitization)]
   * 在 GAS 舊架構中，前端為了渲染流暢會先自己生成一個時間戳字串 (例如 "t3-d1-1773634250000") 作為暫時的 groupId；
   * 但後端 .NET Core 與 PostgreSQL 的 GroupId 是強型別 UUID (GUID)。
   * 如果將非 UUID 的字串傳給 .NET Core 就會報出 "The JSON value could not be converted..." 反序列化失敗。
   * 因此在此處進行「資料淨化」：
   * 1. 檢查 groupId 是否為符合標準 36 字元的 UUID 格式。
   * 2. 若不是合法 UUID (代表是新建主行程或前端暫時字串)，則轉為 null 傳送，讓後端資料庫自動生成乾淨合法的 GUID。
   * 3. 若是為既有行程新增備案 (例如已有合法的 UUID)，則保留該 UUID 傳送給後端綁定為同一個行程群組。
   * 
   * @param {Object} scheduleDto { tripId, day, date, groupId, altOrder, attractionName, startTime, endTime, remark, googleMapLink }
   */
  async addSchedule(scheduleDto) {
    const isGuid =
      typeof scheduleDto.groupId === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(scheduleDto.groupId)

    const payload = {
      ...scheduleDto,
      groupId: isGuid ? scheduleDto.groupId : null,
    }

    return await sendRequest({
      actionName: 'addSchedule',
      path: '/schedules',
      method: 'POST',
      payload: API_MODE === 'GAS' ? scheduleDto : payload,
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
   * 改變同一個行程群組內的備案順序與轉正主要行程
   * @param {string} tripId 旅程 ID
   * @param {string} groupId 群組 ID
   * @param {Array<string>} orderedIds 重新排序後的卡片 ID 陣列 (index 0 為新主要行程)
   */
  async reorderGroupBackups(tripId, groupId, orderedIds) {
    return await sendRequest({
      actionName: 'reorderGroupBackups',
      path: `/groups/${groupId}/reorder-backups`,
      method: API_MODE === 'GAS' ? 'POST' : 'PUT',
      payload: { tripId, groupId, orderedIds }
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
