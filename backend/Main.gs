// ============================================
// 【1】 讀取資料：支援「所有旅程清單」與「特定旅程詳情」
// ============================================
function doGet(e) {
  const action = (e.parameter && e.parameter.action) ? e.parameter.action : 'getTrips';
  
  if (action === 'getTrips') {
    const sheet = getMySpreadsheet().getSheetByName(SHEET_TRIPS);
    const data = parseSheetData(sheet.getDataRange().getDisplayValues());
    return createJsonResponse(data);
  } 
  else if (action === 'getTripDetails') {
    const targetTripId = e.parameter.tripId; 
    if (!targetTripId) return createJsonResponse({ error: "缺少 tripId 參數" });
    
    // 將邏輯委派給 TripsService.gs 中的 getTripDetails，那邊有正確的 sortOrder 排序！
    const tripDetails = getTripDetails(targetTripId);
    return createJsonResponse(tripDetails);
  }
  
  return createJsonResponse({ error: "未知的 action 參數" });
}

// ============================================
// 【輔助】驗證傳入 ID 是可編輯的 tripId（非 readOnlyId）
// ============================================
function isValidEditTripId(tripId) {
  if (!tripId) return false;
  const sheet = getMySpreadsheet().getSheetByName(SHEET_TRIPS);
  const data = parseSheetData(sheet.getDataRange().getValues());
  return data.some(t => String(t.tripId) === String(tripId));
}

// 以 scheduleId 反查所屬 tripId，再驗證是否為可編輯 ID
function isValidEditByScheduleId(scheduleId) {
  if (!scheduleId) return false;
  const sheet = getMySpreadsheet().getSheetByName(SHEET_SCHEDULES);
  const data = parseSheetData(sheet.getDataRange().getValues());
  const item = data.find(s => String(s.id) === String(scheduleId));
  if (!item) return false;
  return isValidEditTripId(item.tripId);
}

// ============================================
// 【2】 處理前端新增 (POST)
// ============================================
function doPost(e) {
  let payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (error) {
    return createJsonResponse({ status: 'error', message: 'JSON 解析失敗' });
  }

  switch (payload.action) {
    // 既有
    case 'createTrip': {
      const sheet = getMySpreadsheet().getSheetByName(SHEET_TRIPS);
      appendDataToSheet(sheet, payload.data);
      return createJsonResponse({ status: 'success', message: '建立旅遊計畫成功' });
    }
    case 'createSchedule': {
      if (!isValidEditTripId(payload.data && payload.data.tripId)) {
        return createJsonResponse({ status: 'error', message: '無編輯權限' });
      }
      const sheet = getMySpreadsheet().getSheetByName(SHEET_SCHEDULES);
      appendDataToSheet(sheet, payload.data);
      return createJsonResponse({ status: 'success', message: '新增行程項目成功' });
    }

    // 新增 CRUD
    case 'addSchedule':
      if (!isValidEditTripId(payload.tripId)) return createJsonResponse({ status: 'error', message: '無編輯權限' });
      return createJsonResponse(addSchedule(payload));
    case 'updateSchedule':
      if (!isValidEditByScheduleId(payload.id)) return createJsonResponse({ status: 'error', message: '無編輯權限' });
      return createJsonResponse(updateSchedule(payload));
    case 'deleteSchedule':
      if (!isValidEditByScheduleId(payload.id)) return createJsonResponse({ status: 'error', message: '無編輯權限' });
      return createJsonResponse(deleteSchedule(payload));
    case 'updateScheduleOrder':
      if (!isValidEditTripId(payload.tripId)) return createJsonResponse({ status: 'error', message: '無編輯權限' });
      return createJsonResponse(updateScheduleOrder(payload));
    case 'updateTripInfo':
      if (!isValidEditTripId(payload.tripId)) return createJsonResponse({ status: 'error', message: '無編輯權限' });
      return createJsonResponse(updateTripInfo(payload));
    case 'uploadTripImage':
      if (!isValidEditTripId(payload.tripId)) return createJsonResponse({ status: 'error', message: '無編輯權限' });
      return createJsonResponse(uploadTripImage(payload));

    default:
      return createJsonResponse({ status: 'error', message: '未知的 action' });
  }
}
