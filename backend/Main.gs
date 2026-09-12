// Main.gs

// ============================================
// 【1】 讀取資料 (GET)：支援「所有旅程清單」、「特定旅程詳情」與「行李清單」
// ============================================
/**
 * 處理 GET 請求，包含 Access Token 驗證與資料隔離過濾
 * @param {Object} e - Google Apps Script 事件物件 (含 e.parameter)
 * @returns {GoogleAppsScript.Content.TextOutput} JSON 格式回應
 */
function doGet(e) {
  try {
    const params = e.parameter || {};
    const action = params.action || 'getTrips';
    const token  = params.token; // 前端 GET 請求時 token 放在 query string

    let userId = null;

    // ── 驗證 Token ──
    try {
      if (token) {
        userId = validateAccessToken(token);
      }
    } catch (authErr) {
      // 唯讀分享模式例外處理：若使用者是透過 readOnlyId 瀏覽旅程詳情，允許未登入存取
      if (action === 'getTripDetails') {
        Logger.log('[doGet] Token 驗證失敗但為 getTripDetails，嘗試以訪客/唯讀模式存取: ' + authErr.message);
      } else {
        throw authErr;
      }
    }

    // 1. 取得使用者旅程清單（隔離 userId）
    if (action === 'getTrips') {
      if (!userId) {
        return createJsonResponse({ status: 'error', code: 'TOKEN_NOT_FOUND', message: '請先登入以讀取旅程' });
      }
      const data = getUserTrips(userId);
      return createJsonResponse(data);
    }
    // 2. 取得單一旅程詳情（支援 owner 驗證與 readOnlyId 唯讀瀏覽）
    else if (action === 'getTripDetails') {
      const targetTripId = params.tripId;
      if (!targetTripId) return createJsonResponse({ error: '缺少 tripId 參數' });
      const tripDetails = getTripDetails(targetTripId, userId);
      return createJsonResponse(tripDetails);
    }
    // 3. 取得個人行李清單（隔離 userId）
    else if (action === 'getPackingItems') {
      if (!userId) {
        return createJsonResponse({ status: 'error', code: 'TOKEN_NOT_FOUND', message: '請先登入以讀取行李清單' });
      }
      const data = getUserPackingItems(userId);
      return createJsonResponse(data);
    }

    return createJsonResponse({ error: '未知的 action 參數: ' + action });

  } catch (err) {
    const message = err.message || '未知錯誤';
    // token 相關錯誤回傳特定 status 與 code，前端可自動觸發 refresh 或導向登入
    if (message === 'TOKEN_EXPIRED' || message === 'TOKEN_REVOKED' || message === 'TOKEN_NOT_FOUND') {
      return createJsonResponse({ status: 'error', code: message, message: '請重新登入' });
    }
    return createJsonResponse({ status: 'error', message: message });
  }
}

// ============================================
// 【輔助】驗證傳入 ID 是該登入使用者的可編輯 tripId
// ============================================
/**
 * 檢查指定的 tripId 是否屬於該登入使用者
 * @param {string} tripId - 旅程 ID
 * @param {string} userId - 當前登入者 ID
 * @returns {boolean} 是否具備編輯權限
 */
function isValidEditTripId(tripId, userId) {
  if (!tripId || !userId) return false;
  return isTripOwner(tripId, userId);
}

/**
 * 以 scheduleId 反查所屬 tripId，並驗證當前使用者是否具備編輯權限
 * @param {string} scheduleId - 行程細項 ID
 * @param {string} userId - 當前登入者 ID
 * @returns {{ valid: boolean, message?: string }} 驗證結果物件
 */
function isValidEditByScheduleId(scheduleId, userId) {
  if (!scheduleId) return { valid: false, message: '缺少行程 ID' };
  if (!userId) return { valid: false, message: '缺少使用者驗證資訊' };

  const sheet = getMySpreadsheet().getSheetByName(SHEET_SCHEDULES);
  if (!sheet) return { valid: false, message: '找不到 Schedules 工作表' };

  const data = parseSheetData(sheet.getDataRange().getValues());
  const item = data.find(s => String(s.id) === String(scheduleId));
  if (!item) return { valid: false, message: `找不到指定的行程項目 (${scheduleId})` };
  if (!isValidEditTripId(item.tripId, userId)) return { valid: false, message: '無編輯權限或非此旅程擁有者' };
  return { valid: true };
}

// ============================================
// 【2】 處理前端操作 (POST)：包含認證、建立旅程、修改與刪除
// ============================================
/**
 * 處理 POST 請求，包含 Token 驗證、權限檢查與業務邏輯調用
 * @param {Object} e - Google Apps Script 事件物件 (含 e.postData.contents)
 * @returns {GoogleAppsScript.Content.TextOutput} JSON 格式回應
 */
function doPost(e) {
  let payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (error) {
    return createJsonResponse({ status: 'error', message: 'JSON 解析失敗' });
  }

  const { action } = payload;

  // ── 認證相關 action（不需要驗證 token，這些是登入/刷新入口）──
  try {
    if (action === 'login') {
      return createJsonResponse(handleLogin(payload));
    }
    if (action === 'refreshToken') {
      return createJsonResponse(handleRefreshToken(payload));
    }
    if (action === 'logout') {
      return createJsonResponse(handleLogout(payload));
    }
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.message || '認證失敗' });
  }

  // ── 需要驗證 token 的業務 action ──
  let userId;
  try {
    userId = validateAccessToken(payload.token);
  } catch (err) {
    const message = err.message || '';
    if (message === 'TOKEN_EXPIRED' || message === 'TOKEN_REVOKED' || message === 'TOKEN_NOT_FOUND') {
      return createJsonResponse({ status: 'error', code: message, message: '請重新登入' });
    }
    return createJsonResponse({ status: 'error', message: '認證失敗: ' + message });
  }

  // Token 驗證通過，執行具體業務操作（帶入 userId 確保資料隔離）
  try {
    switch (action) {
      // ── 旅程建立 ──
      case 'createTrip': {
        const sheet = ensureSheetHeaders(SHEET_TRIPS, ['tripId', 'name', 'startDate', 'endDate', 'coverUrl', 'readOnlyId', 'userId']);
        const tripData = Object.assign({}, payload.data || {});
        // 自動注入當前建立者的 userId 與分享用的 readOnlyId
        tripData.userId = userId;
        if (!tripData.readOnlyId) {
          tripData.readOnlyId = Utilities.getUuid().slice(0, 8);
        }
        appendDataToSheet(sheet, tripData);
        SpreadsheetApp.flush();
        return createJsonResponse({ status: 'success', message: '建立旅遊計畫成功', data: tripData });
      }

      case 'createSchedule': {
        const targetTripId = payload.data && payload.data.tripId;
        if (!isValidEditTripId(targetTripId, userId)) {
          return createJsonResponse({ status: 'error', message: '無編輯權限或非旅程擁有者' });
        }
        const sheet = getMySpreadsheet().getSheetByName(SHEET_SCHEDULES);
        appendDataToSheet(sheet, payload.data);
        SpreadsheetApp.flush();
        return createJsonResponse({ status: 'success', message: '新增行程項目成功' });
      }

      // ── 行程項目 CRUD ──
      case 'addSchedule':
        if (!isValidEditTripId(payload.tripId, userId)) {
          return createJsonResponse({ status: 'error', message: '無編輯權限或非旅程擁有者' });
        }
        return createJsonResponse(addSchedule(payload));

      case 'updateSchedule': {
        const check = isValidEditByScheduleId(payload.id, userId);
        if (!check.valid) return createJsonResponse({ status: 'error', message: check.message });
        return createJsonResponse(updateSchedule(payload));
      }

      case 'deleteSchedule': {
        const check = isValidEditByScheduleId(payload.id, userId);
        if (!check.valid) return createJsonResponse({ status: 'error', message: check.message });
        return createJsonResponse(deleteSchedule(payload));
      }

      case 'updateScheduleOrder':
        if (!isValidEditTripId(payload.tripId, userId)) {
          return createJsonResponse({ status: 'error', message: '無編輯權限或非旅程擁有者' });
        }
        return createJsonResponse(updateScheduleOrder(payload));

      case 'reorderGroupBackups':
        if (!isValidEditTripId(payload.tripId, userId)) {
          return createJsonResponse({ status: 'error', message: '無編輯權限或非旅程擁有者' });
        }
        return createJsonResponse(reorderGroupBackups(payload));

      // ── 旅程資訊與圖片 ──
      case 'updateTripInfo':
        if (!isValidEditTripId(payload.tripId, userId)) {
          return createJsonResponse({ status: 'error', message: '無編輯權限或非旅程擁有者' });
        }
        return createJsonResponse(updateTripInfo(payload));

      case 'uploadTripImage':
        if (!isValidEditTripId(payload.tripId, userId)) {
          return createJsonResponse({ status: 'error', message: '無編輯權限或非旅程擁有者' });
        }
        return createJsonResponse(uploadTripImage(payload));

      // ── 刪除旅程 ──
      case 'deleteTrip': {
        if (!isValidEditTripId(payload.tripId, userId)) {
          return createJsonResponse({ status: 'error', message: '無編輯權限或非旅程擁有者' });
        }
        return createJsonResponse(deleteTrip(payload, userId));
      }

      // ── 行李攜帶清單 (PackingItems) ──
      case 'addPackingItem':
      case 'togglePackingItem':
      case 'deletePackingItem':
        return createJsonResponse(handlePackingItem(action, payload, userId));

      default:
        return createJsonResponse({ status: 'error', message: '未知的 action: ' + action });
    }
  } catch (err) {
    Logger.log('[doPost] 執行錯誤: ' + err.message);
    return createJsonResponse({ status: 'error', message: err.message || '操作失敗' });
  }
}
