// ═══════════════════════════════════════════════
// CRUD: 新增行程
// ═══════════════════════════════════════════════
function addSchedule(payload) {
  const ss = getMySpreadsheet();
  const sheet = ss.getSheetByName(SHEET_SCHEDULES);

  // 自動產生唯一 GUID
  const newId = payload.id || Utilities.getUuid();
  // 若為備案則前端會傳 groupId，否則自己當老大
  const groupId = payload.groupId || newId;

  const row = [
    payload.tripId,
    Number(payload.day),
    payload.date,
    newId,
    groupId,
    payload.altOrder || 0,
    999, // 預設的 sortOrder (墊底)
    payload.startTime     || '',
    payload.endTime       || '',
    payload.attractionName || '',
    payload.remark        || '',
    payload.googleMapLink || '',
    payload.transportType || '',
    payload.transportCustomName || '',
    Number(payload.transportDurationMinutes) || 0,
    payload.transportRemark || '',
  ];

  sheet.appendRow(row);
  // 同樣設成純文字格式，避免時間被自動轉換
  const lastRow = sheet.getLastRow();
  sheet.getRange(lastRow, 1, 1, row.length).setNumberFormat('@');

  return { success: true, id: newId };
}

// ═══════════════════════════════════════════════
// CRUD: 編輯行程（依 id 找到該列後整行更新）
// ═══════════════════════════════════════════════
function updateSchedule(payload) {
  const ss = getMySpreadsheet();
  const sheet = ss.getSheetByName(SHEET_SCHEDULES);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const colMap = {};
  headers.forEach((h, idx) => colMap[h] = idx + 1);

  // 第 0 列是 header，從第 1 列起找 id（第 4 欄，index 3）
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][3]) === String(payload.id)) {
      const rowIndex = i + 1;
      if (payload.startTime !== undefined) sheet.getRange(rowIndex, colMap['startTime'] || 8).setValue(payload.startTime);
      if (payload.endTime !== undefined) sheet.getRange(rowIndex, colMap['endTime'] || 9).setValue(payload.endTime);
      if (payload.attractionName !== undefined) sheet.getRange(rowIndex, colMap['attractionName'] || 10).setValue(payload.attractionName);
      if (payload.remark !== undefined) sheet.getRange(rowIndex, colMap['remark'] || 11).setValue(payload.remark);
      if (payload.googleMapLink !== undefined) sheet.getRange(rowIndex, colMap['googleMapLink'] || 12).setValue(payload.googleMapLink);
      if (payload.transportType !== undefined) sheet.getRange(rowIndex, colMap['transportType'] || 13).setValue(payload.transportType);
      if (payload.transportCustomName !== undefined) sheet.getRange(rowIndex, colMap['transportCustomName'] || 14).setValue(payload.transportCustomName);
      if (payload.transportDurationMinutes !== undefined) sheet.getRange(rowIndex, colMap['transportDurationMinutes'] || 15).setValue(Number(payload.transportDurationMinutes) || 0);
      if (payload.transportRemark !== undefined) sheet.getRange(rowIndex, colMap['transportRemark'] || 16).setValue(payload.transportRemark);
      return { success: true };
    }
  }

  return { error: `找不到 id: ${payload.id}` };
}

// ═══════════════════════════════════════════════
// CRUD: 刪除行程（依 id 找到該列後整列刪除）
// ═══════════════════════════════════════════════
function deleteSchedule(payload) {
  const ss = getMySpreadsheet();
  const sheet = ss.getSheetByName(SHEET_SCHEDULES);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][3]) === String(payload.id)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }

  return { error: `找不到 id: ${payload.id}` };
}

// ═══════════════════════════════════════════════
// CRUD: 改變多筆行程順序 (拖曳排序用)
// ═══════════════════════════════════════════════
function updateScheduleOrder(payload) {
  const orderedIds = payload.orderedIds; // e.g. ["id-2", "id-1", "id-3"]
  
  const ss = getMySpreadsheet();
  const sheet = ss.getSheetByName(SHEET_SCHEDULES);
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  const headers = values[0];
  
  const idIndex = headers.indexOf("id");
  let sortOrderIndex = headers.indexOf("sortOrder");
  // 若使用 groupId 作為排序列
  let groupIdIndex = headers.indexOf("groupId");
  
  // 保險起見若無此欄補上
  if (sortOrderIndex === -1) {
    sortOrderIndex = headers.length;
    sheet.getRange(1, sortOrderIndex + 1).setValue("sortOrder");
  }

  const orderMap = {};
  orderedIds.forEach((id, index) => orderMap[id] = index);

  const newOrderValues = [];
  for (let i = 1; i < values.length; i++) {
    // 這裡我們需要比對的是傳入的 groupId 陣列，所以我們抓出當下的 groupId！
    // 前端如果只排 groupId (即原本主卡片的 id)，就會一次移動整個群組。
    const rowGroupId = values[i][groupIdIndex];
    
    if (orderMap.hasOwnProperty(rowGroupId)) {
      newOrderValues.push([orderMap[rowGroupId]]);
    } else {
      const oldVal = values[i][sortOrderIndex];
      newOrderValues.push([oldVal !== undefined && oldVal !== "" ? oldVal : 999]);
    }
  }

  sheet.getRange(2, sortOrderIndex + 1, newOrderValues.length, 1).setValues(newOrderValues);
  return { success: true, message: "群組順序更新成功" };
}
