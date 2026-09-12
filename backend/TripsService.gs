// TripsService.gs

/**
 * 取得指定使用者的所有旅程清單（資料隔離核心）
 * 若發現現有舊資料尚未設定 userId，將自動綁定給當前登入者（實現平滑無痛遷移）
 * @param {string} userId - 當前登入的使用者 ID
 * @returns {Array<Object>} 該使用者的旅程物件陣列
 */
function getUserTrips(userId) {
  const sheet = ensureSheetHeaders(SHEET_TRIPS, ['tripId', 'name', 'startDate', 'endDate', 'coverUrl', 'readOnlyId', 'userId']);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const headers = values[0].map(String);
  const userIdColIdx = headers.indexOf('userId');
  const tripIdColIdx = headers.indexOf('tripId');
  const readOnlyIdColIdx = headers.indexOf('readOnlyId');

  let needFlush = false;

  // 逐列檢查，若舊資料沒有 userId 且有登入者，自動幫其補上 userId
  for (let i = 1; i < values.length; i++) {
    const rowUserId = values[i][userIdColIdx];
    const rowTripId = values[i][tripIdColIdx];
    
    // 自動為沒有 readOnlyId 的行程產生短分享代碼
    if (readOnlyIdColIdx !== -1 && !values[i][readOnlyIdColIdx] && rowTripId) {
      const generatedReadOnlyId = Utilities.getUuid().slice(0, 8);
      sheet.getRange(i + 1, readOnlyIdColIdx + 1).setValue(generatedReadOnlyId);
      values[i][readOnlyIdColIdx] = generatedReadOnlyId;
      needFlush = true;
    }

    // 自動綁定未設定擁有者的歷史舊行程
    if (!rowUserId && userId && rowTripId) {
      sheet.getRange(i + 1, userIdColIdx + 1).setValue(userId);
      values[i][userIdColIdx] = userId;
      needFlush = true;
    }
  }

  if (needFlush) {
    SpreadsheetApp.flush();
  }

  const allTrips = parseSheetData(values);
  // 只回傳屬於目前登入使用者的旅程
  return allTrips.filter(t => String(t.userId) === String(userId));
}

/**
 * 驗證指定 tripId 是否屬於該登入使用者
 * @param {string} tripId - 旅程 ID
 * @param {string} userId - 當前登入者 ID
 * @returns {boolean} 是否為擁有者
 */
function isTripOwner(tripId, userId) {
  if (!tripId || !userId) return false;
  const sheet = ensureSheetHeaders(SHEET_TRIPS, ['tripId', 'name', 'startDate', 'endDate', 'coverUrl', 'readOnlyId', 'userId']);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return false;

  const headers = values[0].map(String);
  const tripIdColIdx = headers.indexOf('tripId');
  const userIdColIdx = headers.indexOf('userId');

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][tripIdColIdx]) === String(tripId)) {
      const rowUserId = values[i][userIdColIdx];
      // 若舊資料沒有 userId，自動認領並回傳 true
      if (!rowUserId) {
        sheet.getRange(i + 1, userIdColIdx + 1).setValue(userId);
        SpreadsheetApp.flush();
        return true;
      }
      return String(rowUserId) === String(userId);
    }
  }
  return false;
}

/**
 * 讀取特定旅程詳情（支援 owner 與唯讀分享連結）
 * @param {string} id - tripId 或 readOnlyId
 * @param {string} [userId] - 當前登入的使用者 ID（若是唯讀分享連結可為空）
 * @returns {Object} 旅程完整巢狀資料或錯誤物件
 */
function getTripDetails(id, userId) {
  const ss = getMySpreadsheet();
  const tripsSheet = ensureSheetHeaders(SHEET_TRIPS, ['tripId', 'name', 'startDate', 'endDate', 'coverUrl', 'readOnlyId', 'userId']);

  // 1. 找旅程基本資訊：先用 tripId 找，找不到再用 readOnlyId 找
  const tripsData = parseSheetData(tripsSheet.getDataRange().getValues());

  let trip = tripsData.find(t => String(t.tripId) === String(id));
  let isReadOnly = false;
  let tripId = id; // 用於後續查詢 Schedules 的真實 tripId

  if (trip) {
    // 使用真實 tripId 查詢：必須驗證是否為 owner
    if (!trip.userId && userId) {
      // 舊資料自動綁定
      isTripOwner(trip.tripId, userId);
      trip.userId = userId;
    } else if (trip.userId && String(trip.userId) !== String(userId)) {
      return { error: '無權限存取此旅程' };
    }
  } else {
    // 找不到 tripId，嘗試用 readOnlyId 尋找（唯讀分享模式）
    trip = tripsData.find(t => String(t.readOnlyId) === String(id));
    if (trip) {
      isReadOnly = true;
      tripId = trip.tripId; // 取得真實 tripId 供後續查詢 Schedules 與 Trips_Info 使用
    }
  }

  if (!trip) return { error: `找不到旅程 (${id})` };

  // 2. 撈該旅程的所有行程，依 day 然後依 sortOrder 排序
  const allSchedules = parseSheetData(ss.getSheetByName(SHEET_SCHEDULES).getDataRange().getValues());
  const filtered = allSchedules.filter(s => s.tripId === tripId);

  filtered.sort((a, b) => {
    const orderA = a.sortOrder !== undefined && a.sortOrder !== "" ? Number(a.sortOrder) : 999;
    const orderB = b.sortOrder !== undefined && b.sortOrder !== "" ? Number(b.sortOrder) : 999;
    
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return (a.startTime || "24:00").localeCompare(b.startTime || "24:00");
  });

  // 3. 組成巢狀結構
  const journeys = groupToJourneys(filtered);

  // 4. 取得旅程詳細資訊 (航班與行程備註)
  const defaultTripInfo = {
    tripId: tripId,
    outboundFlightNo: '',
    outboundAirline: '',
    outboundDepartureTime: '',
    outboundArrivalTime: '',
    outboundDepAirport: '',
    outboundArrAirport: '',
    inboundFlightNo: '',
    inboundAirline: '',
    inboundDepartureTime: '',
    inboundArrivalTime: '',
    inboundDepAirport: '',
    inboundArrAirport: '',
    outboundFlightRemark: '',
    inboundFlightRemark: '',
    outboundImageUrl: '',
    inboundImageUrl: '',
    tripRemark: ''
  };

  let tripInfo = Object.assign({}, defaultTripInfo);
  try {
    const infoSheet = ss.getSheetByName(SHEET_TRIPS_INFO);
    if (infoSheet) {
      const allInfos = parseSheetData(infoSheet.getDataRange().getValues());
      const foundInfo = allInfos.find(info => String(info.tripId) === String(tripId));
      if (foundInfo) {
        tripInfo = Object.assign({}, defaultTripInfo, foundInfo);
      }
    }
  } catch (err) {
    Logger.log("讀取 Trips_Info 失敗: " + err.message);
  }

  // 5. 回傳
  return {
    tripId: trip.tripId,
    readOnlyId: trip.readOnlyId || '',
    isReadOnly: isReadOnly,
    name:   trip.name,
    startDate: trip.startDate,
    endDate:   trip.endDate,
    coverUrl:  trip.coverUrl,
    journeys,
    tripInfo
  };
}

function updateTripInfo(payload) {
  const ss = getMySpreadsheet();
  const sheet = ss.getSheetByName(SHEET_TRIPS_INFO);
  if (!sheet) {
    return { status: 'error', message: '找不到 ' + SHEET_TRIPS_INFO + ' 工作表' };
  }
  
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  const headers = values[0];
  const tripId = payload.tripId;
  if (!tripId) {
    return { status: 'error', message: '缺少 tripId 參數' };
  }
  
  const tripIdColIdx = headers.indexOf('tripId');
  if (tripIdColIdx === -1) {
    return { status: 'error', message: '工作表缺少 tripId 欄位' };
  }
  
  let rowIndex = -1;
  for (let i = 1; i < values.length; i++) {
    if (values[i][tripIdColIdx] === tripId) {
      rowIndex = i + 1; // 1-based row index
      break;
    }
  }
  
  const updateData = payload.data || {};
  
  if (rowIndex === -1) {
    // 插入新列
    const newRow = headers.map(h => {
      if (h === 'tripId') return tripId;
      return updateData[h] !== undefined ? String(updateData[h]) : '';
    });
    sheet.appendRow(newRow);
  } else {
    // 更新既有列
    headers.forEach((h, colIdx) => {
      if (h === 'tripId') return;
      if (updateData[h] !== undefined) {
        sheet.getRange(rowIndex, colIdx + 1).setValue(String(updateData[h]));
      }
    });
  }
  SpreadsheetApp.flush();
  return { status: 'success', message: '更新旅程資訊成功' };
}

/**
 * 上傳圖片到 Google Drive，並將圖片 URL 寫入 Trips_Info
 * @param {Object} payload - { tripId, type ('outbound'|'inbound'), imageBase64, fileName }
 */
function uploadTripImage(payload) {
  const { tripId, type, imageBase64, fileName } = payload;

  if (!tripId || !type || !imageBase64) {
    return { status: 'error', message: '缺少必要參數 (tripId, type, imageBase64)' };
  }

  if (type !== 'outbound' && type !== 'inbound') {
    return { status: 'error', message: 'type 必須是 outbound 或 inbound' };
  }

  try {
    // 1. 解碼 Base64 → Blob
    // imageBase64 格式: "data:image/png;base64,iVBORw0KGgo..."
    const parts = imageBase64.split(',');
    const mimeMatch = parts[0].match(/data:(.*?);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
    const base64Data = parts.length > 1 ? parts[1] : parts[0];
    const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, fileName || 'trip_image.png');

    // 2. 存到 Google Drive 指定資料夾
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    const file = folder.createFile(blob);

    // 3. 設定為任何人可透過連結查看
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // 4. 產生可直接顯示的圖片 URL
    const fileId = file.getId();
    const imageUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1000';

    // 5. 將 URL 寫入 Trips_Info
    const fieldName = type === 'outbound' ? 'outboundImageUrl' : 'inboundImageUrl';
    const updateResult = updateTripInfo({
      tripId: tripId,
      data: { [fieldName]: imageUrl }
    });

    if (updateResult.status === 'error') {
      return updateResult;
    }

    return {
      status: 'success',
      message: '圖片上傳成功',
      imageUrl: imageUrl,
      fieldName: fieldName
    };
  } catch (err) {
    Logger.log('圖片上傳失敗: ' + err.message);
    return { status: 'error', message: '圖片上傳失敗: ' + err.message };
  }
}

/**
 * 刪除指定旅程及其所有相關關聯資料（Schedules 細項與 Trips_Info 航班備註）
 * @param {Object} payload - { tripId }
 * @param {string} userId - 當前操作的使用者 ID
 * @returns {Object} 執行結果狀態
 */
function deleteTrip(payload, userId) {
  const tripId = payload.tripId;
  if (!tripId) {
    return { status: 'error', message: '缺少 tripId 參數' };
  }

  // 1. 嚴格驗證擁有者權限
  if (!isTripOwner(tripId, userId)) {
    return { status: 'error', message: '無刪除權限或非此旅程擁有者' };
  }

  const ss = getMySpreadsheet();

  // 2. 從 Trips 工作表刪除該列
  const tripsSheet = ss.getSheetByName(SHEET_TRIPS);
  if (tripsSheet) {
    const values = tripsSheet.getDataRange().getValues();
    const tripIdCol = values[0].indexOf('tripId');
    for (let i = values.length - 1; i >= 1; i--) {
      if (String(values[i][tripIdCol]) === String(tripId)) {
        tripsSheet.deleteRow(i + 1);
        break;
      }
    }
  }

  // 3. 從 Trips_Info 工作表刪除該列
  const infoSheet = ss.getSheetByName(SHEET_TRIPS_INFO);
  if (infoSheet) {
    const values = infoSheet.getDataRange().getValues();
    const tripIdCol = values[0].indexOf('tripId');
    for (let i = values.length - 1; i >= 1; i--) {
      if (String(values[i][tripIdCol]) === String(tripId)) {
        infoSheet.deleteRow(i + 1);
        break;
      }
    }
  }

  // 4. 從 Schedules 工作表刪除所屬的所有行程列
  const schedulesSheet = ss.getSheetByName(SHEET_SCHEDULES);
  if (schedulesSheet) {
    const values = schedulesSheet.getDataRange().getValues();
    const tripIdCol = values[0].indexOf('tripId');
    for (let i = values.length - 1; i >= 1; i--) {
      if (String(values[i][tripIdCol]) === String(tripId)) {
        schedulesSheet.deleteRow(i + 1);
      }
    }
  }

  SpreadsheetApp.flush();
  return { status: 'success', message: '旅程已成功刪除' };
}

