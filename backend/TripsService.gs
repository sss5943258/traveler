// TripsService.gs

/**
 * 取得當前使用者在 Users 資料表中的 Email
 * @param {string} userId - 使用者 ID
 * @returns {string} 使用者 Email (小寫)
 */
function getUserEmailById(userId) {
  if (!userId) return '';
  const ss = getMySpreadsheet();
  const usersSheet = ss.getSheetByName(SHEET_USERS);
  if (!usersSheet) return '';
  const usersData = parseSheetData(usersSheet.getDataRange().getValues());
  const found = usersData.find(u => String(u.userId) === String(userId));
  return found && found.email ? String(found.email).toLowerCase().trim() : '';
}

/**
 * 取得指定使用者的所有旅程清單（包含個人擁有的旅程與受邀共編的旅程）
 * 若發現現有舊資料尚未設定 userId，將自動綁定給當前登入者（實現平滑無痛遷移）
 * @param {string} userId - 當前登入的使用者 ID
 * @returns {Array<Object>} 該使用者的旅程物件陣列 (附帶 isOwner 欄位)
 */
function getUserTrips(userId) {
  const ss = getMySpreadsheet();
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

  // 取得當前使用者的 Email
  const userEmail = getUserEmailById(userId);

  // 掃描 Trip_Collaborators 工作表，比對當前使用者受邀共編的旅程，並執行延遲綁定 (Lazy Linking)
  const collabSheet = ensureSheetHeaders(SHEET_TRIP_COLLABORATORS, ['tripId', 'userEmail', 'userId', 'role', 'createdAt']);
  const collabValues = collabSheet.getDataRange().getValues();
  const userCollabTripIds = new Set();

  if (collabValues.length > 1) {
    const cHeaders = collabValues[0].map(String);
    const cTripIdIdx = cHeaders.indexOf('tripId');
    const cEmailIdx = cHeaders.indexOf('userEmail');
    const cUserIdIdx = cHeaders.indexOf('userId');

    for (let j = 1; j < collabValues.length; j++) {
      const rowTripId = String(collabValues[j][cTripIdIdx]);
      const rowEmail = String(collabValues[j][cEmailIdx] || '').toLowerCase().trim();
      const rowUserId = String(collabValues[j][cUserIdIdx] || '');

      const isMatch = (rowUserId && rowUserId === String(userId)) || (userEmail && rowEmail === userEmail);
      if (isMatch) {
        userCollabTripIds.add(rowTripId);
        // 若受邀時尚未登入過無 userId，於首次登入時自動補上
        if (!rowUserId && userId && cUserIdIdx !== -1) {
          collabSheet.getRange(j + 1, cUserIdIdx + 1).setValue(userId);
          needFlush = true;
        }
      }
    }
  }

  if (needFlush) {
    SpreadsheetApp.flush();
  }

  const allTrips = parseSheetData(values);
  const resultTrips = [];

  // 1. 撈取自己擁有的旅程 (標示 isOwner = true)
  allTrips.forEach(t => {
    if (String(t.userId) === String(userId)) {
      t.isOwner = true;
      resultTrips.push(t);
    }
  });

  // 2. 撈取受邀共編的旅程 (標示 isOwner = false)
  allTrips.forEach(t => {
    if (userCollabTripIds.has(String(t.tripId)) && String(t.userId) !== String(userId)) {
      t.isOwner = false;
      resultTrips.push(t);
    }
  });

  return resultTrips;
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
 * 驗證指定 tripId 是否為當前登入者具備共編權限之旅程
 * @param {string} tripId - 旅程 ID
 * @param {string} userId - 當前登入者 ID
 * @param {string} [userEmail] - 當前登入者 Email (可選，未傳入自動反查)
 * @returns {boolean} 是否為共編者
 */
function isTripCollaborator(tripId, userId, userEmail) {
  if (!tripId || !userId) return false;
  const email = userEmail || getUserEmailById(userId);
  const sheet = ensureSheetHeaders(SHEET_TRIP_COLLABORATORS, ['tripId', 'userEmail', 'userId', 'role', 'createdAt']);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return false;

  const data = parseSheetData(values);
  return data.some(row => 
    String(row.tripId) === String(tripId) && (
      String(row.userId) === String(userId) ||
      (email && String(row.userEmail).toLowerCase().trim() === email)
    )
  );
}

/**
 * 取得特定旅程的擁有者與共編者完整名單 (含頭像與名稱)
 * @param {string} tripId - 旅程 ID
 * @param {string} userId - 當前操作者 ID (需為 Owner 或 Collaborator)
 * @returns {Object} { status: 'success', owner: Object, collaborators: Array }
 */
function getTripCollaborators(tripId, userId) {
  if (!tripId || !userId) {
    return { status: 'error', message: '缺少必要參數' };
  }

  // 驗證是否有權限查看（Owner 或 Collaborator 皆可查看名單）
  if (!isTripOwner(tripId, userId) && !isTripCollaborator(tripId, userId)) {
    return { status: 'error', message: '無權限查看此旅程的共編者名單' };
  }

  const ss = getMySpreadsheet();
  const tripsSheet = ensureSheetHeaders(SHEET_TRIPS, ['tripId', 'name', 'startDate', 'endDate', 'coverUrl', 'readOnlyId', 'userId']);
  const trips = parseSheetData(tripsSheet.getDataRange().getValues());
  const trip = trips.find(t => String(t.tripId) === String(tripId));
  if (!trip) {
    return { status: 'error', message: '找不到旅程' };
  }

  const usersSheet = ensureSheetHeaders(SHEET_USERS, ['userId', 'email', 'name', 'picture', 'createdAt']);
  const users = parseSheetData(usersSheet.getDataRange().getValues());

  // 1. 取得 Owner 資料
  const ownerUser = users.find(u => String(u.userId) === String(trip.userId)) || {};
  const ownerInfo = {
    userId: trip.userId,
    email: ownerUser.email || '',
    name: ownerUser.name || ownerUser.email || '旅程建立者',
    picture: ownerUser.picture || '',
    isOwner: true
  };

  // 2. 取得所有共編者
  const collabSheet = ensureSheetHeaders(SHEET_TRIP_COLLABORATORS, ['tripId', 'userEmail', 'userId', 'role', 'createdAt']);
  const collabData = parseSheetData(collabSheet.getDataRange().getValues());
  const tripCollabs = collabData.filter(c => String(c.tripId) === String(tripId));

  const collaborators = tripCollabs.map(c => {
    const email = String(c.userEmail || '').toLowerCase().trim();
    const matchedUser = users.find(u => 
      (c.userId && String(u.userId) === String(c.userId)) ||
      (email && String(u.email || '').toLowerCase().trim() === email)
    );

    return {
      tripId: c.tripId,
      userEmail: c.userEmail,
      userId: c.userId || (matchedUser ? matchedUser.userId : ''),
      role: c.role || 'editor',
      createdAt: c.createdAt,
      name: matchedUser ? matchedUser.name : (c.userEmail.split('@')[0]),
      picture: matchedUser ? (matchedUser.picture || '') : '',
      isRegistered: !!matchedUser
    };
  });

  return {
    status: 'success',
    tripName: trip.name,
    owner: ownerInfo,
    collaborators: collaborators
  };
}

/**
 * 為指定旅程新增共編者 (僅限 Owner)
 * @param {string} tripId - 旅程 ID
 * @param {string} targetEmail - 要邀請的共編者 Google Email
 * @param {string} operatorUserId - 操作者 ID (必須為 Owner)
 * @returns {Object} 執行結果狀態
 */
function addTripCollaborator(tripId, targetEmail, operatorUserId) {
  if (!tripId || !targetEmail || !operatorUserId) {
    return { status: 'error', message: '缺少必要參數' };
  }

  // 1. 嚴格驗證操作者必須是旅程 Owner
  if (!isTripOwner(tripId, operatorUserId)) {
    return { status: 'error', message: '只有旅程擁有者可以新增共編者' };
  }

  const cleanEmail = String(targetEmail).toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(cleanEmail)) {
    return { status: 'error', message: '請輸入正確的 Email 格式' };
  }

  // 2. 檢查是否為 Owner 自己的 Email
  const ownerEmail = getUserEmailById(operatorUserId);
  if (ownerEmail && ownerEmail === cleanEmail) {
    return { status: 'error', message: '你已經是此旅程的擁有者，不需將自己加入共編' };
  }

  // 3. 檢查是否已經在共編者名單中
  const collabSheet = ensureSheetHeaders(SHEET_TRIP_COLLABORATORS, ['tripId', 'userEmail', 'userId', 'role', 'createdAt']);
  const collabValues = collabSheet.getDataRange().getValues();
  if (collabValues.length > 1) {
    const existing = parseSheetData(collabValues);
    const isDuplicate = existing.some(c => 
      String(c.tripId) === String(tripId) && 
      String(c.userEmail).toLowerCase().trim() === cleanEmail
    );
    if (isDuplicate) {
      return { status: 'error', message: '該使用者已經在此旅程的共編者名單中' };
    }
  }

  // 4. 檢查該 Email 是否已經在 Users 資料表中註冊過（若有則直接帶入其 userId）
  const ss = getMySpreadsheet();
  const usersSheet = ss.getSheetByName(SHEET_USERS);
  let matchedUserId = '';
  if (usersSheet) {
    const users = parseSheetData(usersSheet.getDataRange().getValues());
    const matched = users.find(u => String(u.email || '').toLowerCase().trim() === cleanEmail);
    if (matched) matchedUserId = matched.userId;
  }

  // 5. 寫入 Trip_Collaborators
  appendDataToSheet(collabSheet, {
    tripId: tripId,
    userEmail: cleanEmail,
    userId: matchedUserId,
    role: 'editor',
    createdAt: new Date().toISOString()
  });

  SpreadsheetApp.flush();

  // 操作成功後，直接撈取最新完整共編名單回傳，避免前端額外發起第二次 GET 請求
  const latest = getTripCollaborators(tripId, operatorUserId);
  return {
    status: 'success',
    message: '已成功新增共編者',
    tripName: latest.tripName,
    owner: latest.owner,
    collaborators: latest.collaborators
  };
}

/**
 * 移除指定旅程的共編者 (僅限 Owner)
 * @param {string} tripId - 旅程 ID
 * @param {string} targetEmail - 要移除的共編者 Email
 * @param {string} operatorUserId - 操作者 ID (必須為 Owner)
 * @returns {Object} 執行結果狀態 (含最新共編者名單)
 */
function removeTripCollaborator(tripId, targetEmail, operatorUserId) {
  if (!tripId || !targetEmail || !operatorUserId) {
    return { status: 'error', message: '缺少必要參數' };
  }

  // 1. 嚴格驗證操作者必須是旅程 Owner
  if (!isTripOwner(tripId, operatorUserId)) {
    return { status: 'error', message: '只有旅程擁有者可以移除共編者' };
  }

  const cleanEmail = String(targetEmail).toLowerCase().trim();
  const collabSheet = ensureSheetHeaders(SHEET_TRIP_COLLABORATORS, ['tripId', 'userEmail', 'userId', 'role', 'createdAt']);
  const values = collabSheet.getDataRange().getValues();
  if (values.length <= 1) {
    return { status: 'error', message: '找不到指定的共編者紀錄' };
  }

  const headers = values[0].map(String);
  const tripIdCol = headers.indexOf('tripId');
  const emailCol = headers.indexOf('userEmail');

  let deleted = false;
  for (let i = values.length - 1; i >= 1; i--) {
    if (
      String(values[i][tripIdCol]) === String(tripId) &&
      String(values[i][emailCol]).toLowerCase().trim() === cleanEmail
    ) {
      collabSheet.deleteRow(i + 1);
      deleted = true;
      break;
    }
  }

  if (!deleted) {
    return { status: 'error', message: '找不到該共編者紀錄' };
  }

  SpreadsheetApp.flush();

  // 操作成功後，直接撈取最新完整共編名單回傳，避免前端額外發起第二次 GET 請求
  const latest = getTripCollaborators(tripId, operatorUserId);
  return {
    status: 'success',
    message: '已成功移除共編者',
    tripName: latest.tripName,
    owner: latest.owner,
    collaborators: latest.collaborators
  };
}

/**
 * 讀取特定旅程詳情（支援 owner、共編者與唯讀分享連結）
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
    // 使用真實 tripId 查詢：必須驗證是否為 owner 或共編者
    if (!trip.userId && userId) {
      // 舊資料自動綁定
      isTripOwner(trip.tripId, userId);
      trip.userId = userId;
    } else if (trip.userId && String(trip.userId) !== String(userId)) {
      // 若不是 owner，檢查是否為共編者
      const isCollab = isTripCollaborator(trip.tripId, userId);
      if (!isCollab) {
        return { error: '無權限存取此旅程' };
      }
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

  // 3. 組成巢狀結構 (傳入起訖日以自動保全空天數 Day 1 ~ Day N)
  const journeys = groupToJourneys(filtered, trip.startDate, trip.endDate);

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
    isOwner: !isReadOnly && isTripOwner(trip.tripId, userId),
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

  // 5. 從 Trip_Collaborators 工作表刪除該旅程的所有共編紀錄
  const collabSheet = ss.getSheetByName(SHEET_TRIP_COLLABORATORS);
  if (collabSheet) {
    const values = collabSheet.getDataRange().getValues();
    const tripIdCol = values[0].indexOf('tripId');
    for (let i = values.length - 1; i >= 1; i--) {
      if (String(values[i][tripIdCol]) === String(tripId)) {
        collabSheet.deleteRow(i + 1);
      }
    }
  }

  SpreadsheetApp.flush();
  return { status: 'success', message: '旅程已成功刪除' };
}

