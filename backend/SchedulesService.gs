// ═══════════════════════════════════════════════
// 行程時間解析、衝突分析與自動排序工具函式 (GAS 後端專屬)
// ═══════════════════════════════════════════════

function gasTimeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return NaN;
  var parts = String(timeStr).trim().split(':');
  if (parts.length !== 2) return NaN;
  var hours = parseInt(parts[0], 10);
  var minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return NaN;
  return hours * 60 + minutes;
}

function gasMinutesToTime(totalMinutes) {
  if (isNaN(totalMinutes) || totalMinutes < 0) return '00:00';
  var hours = Math.floor(totalMinutes / 60) % 24;
  var mins = totalMinutes % 60;
  var hStr = hours < 10 ? '0' + hours : String(hours);
  var mStr = mins < 10 ? '0' + mins : String(mins);
  return hStr + ':' + mStr;
}

function gasAnalyzeTimeConflict(newCard, daySchedules) {
  if (!newCard || !newCard.startTime || !newCard.endTime) {
    return { status: 'NONE' };
  }

  var nStart = gasTimeToMinutes(newCard.startTime);
  var nEnd = gasTimeToMinutes(newCard.endTime);

  if (isNaN(nStart) || isNaN(nEnd) || nStart >= nEnd) {
    return { status: 'NONE' };
  }

  var otherSchedules = (daySchedules || []).filter(function(s) {
    return s && String(s.id) !== String(newCard.id);
  });

  var overlappingCards = [];
  for (var i = 0; i < otherSchedules.length; i++) {
    var s = otherSchedules[i];
    if (!s.startTime || !s.endTime) continue;
    var sStart = gasTimeToMinutes(s.startTime);
    var sEnd = gasTimeToMinutes(s.endTime);
    if (isNaN(sStart) || isNaN(sEnd)) continue;

    if (nStart < sEnd && nEnd > sStart) {
      overlappingCards.push({ card: s, sStart: sStart, sEnd: sEnd });
    }
  }

  if (overlappingCards.length === 0) {
    return { status: 'NONE' };
  }

  if (overlappingCards.length > 1) {
    overlappingCards.sort(function(a, b) { return a.sStart - b.sStart; });
    return {
      status: 'SEVERE',
      conflictedCardTitle: overlappingCards[0].card.attractionName || overlappingCards[0].card.title || '行程',
      overlappingCount: overlappingCards.length
    };
  }

  var targetObj = overlappingCards[0];
  var targetCard = targetObj.card;
  var sStart = targetObj.sStart;
  var sEnd = targetObj.sEnd;
  var targetTitle = targetCard.attractionName || targetCard.title || '行程';

  if (sStart >= nStart) {
    if (nEnd < sEnd) {
      var proposedNewStartTime = gasMinutesToTime(nEnd);
      return {
        status: 'ADJUSTABLE',
        targetCard: targetCard,
        targetCardId: targetCard.id,
        conflictedCardTitle: targetTitle,
        adjustType: 'START_TIME',
        proposedNewTime: proposedNewStartTime,
        proposedField: 'startTime'
      };
    } else {
      return {
        status: 'SEVERE',
        targetCard: targetCard,
        targetCardId: targetCard.id,
        conflictedCardTitle: targetTitle
      };
    }
  } else {
    if (nStart > sStart) {
      var proposedNewEndTime = gasMinutesToTime(nStart);
      return {
        status: 'ADJUSTABLE',
        targetCard: targetCard,
        targetCardId: targetCard.id,
        conflictedCardTitle: targetTitle,
        adjustType: 'END_TIME',
        proposedNewTime: proposedNewEndTime,
        proposedField: 'endTime'
      };
    } else {
      return {
        status: 'SEVERE',
        targetCard: targetCard,
        targetCardId: targetCard.id,
        conflictedCardTitle: targetTitle
      };
    }
  }
}

function gasUpdateSingleField(sheet, id, fieldName, newValue) {
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var colIndex = headers.indexOf(fieldName) + 1;
  if (colIndex === 0) return;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][3]) === String(id)) {
      sheet.getRange(i + 1, colIndex).setValue(newValue);
      return;
    }
  }
}

function gasReorderAndSaveSchedules(sheet, tripId, targetDay, forcedLastCardId) {
  var dataRange = sheet.getDataRange();
  var values = dataRange.getValues();
  var headers = values[0];

  var tripIdIdx = headers.indexOf('tripId');
  var dayIdx = headers.indexOf('day');
  var idIdx = headers.indexOf('id');
  var groupIdIdx = headers.indexOf('groupId');
  var altOrderIdx = headers.indexOf('altOrder');
  var sortOrderIdx = headers.indexOf('sortOrder');
  var startTimeIdx = headers.indexOf('startTime');

  if (sortOrderIdx === -1) return;

  var mainCards = [];
  for (var i = 1; i < values.length; i++) {
    var rowTripId = values[i][tripIdIdx];
    var rowDay = Number(values[i][dayIdx]);
    var rowAlt = Number(values[i][altOrderIdx]) || 0;

    if (String(rowTripId) === String(tripId) && rowDay === targetDay && rowAlt === 0) {
      mainCards.push({
        id: values[i][idIdx],
        groupId: values[i][groupIdIdx],
        startTime: values[i][startTimeIdx],
        originalIndex: i
      });
    }
  }

  if (mainCards.length === 0) return;

  var sortedMainCards;
  if (forcedLastCardId) {
    var regularCards = mainCards.filter(function(c) { return String(c.id) !== String(forcedLastCardId); });
    regularCards.sort(function(a, b) {
      var aStart = gasTimeToMinutes(a.startTime);
      var bStart = gasTimeToMinutes(b.startTime);
      if (isNaN(aStart) && isNaN(bStart)) return 0;
      if (isNaN(aStart)) return 1;
      if (isNaN(bStart)) return -1;
      return aStart - bStart;
    });
    var forcedCard = mainCards.find(function(c) { return String(c.id) === String(forcedLastCardId); });
    sortedMainCards = forcedCard ? regularCards.concat([forcedCard]) : regularCards;
  } else {
    mainCards.sort(function(a, b) {
      var aStart = gasTimeToMinutes(a.startTime);
      var bStart = gasTimeToMinutes(b.startTime);
      if (isNaN(aStart) && isNaN(bStart)) return 0;
      if (isNaN(aStart)) return 1;
      if (isNaN(bStart)) return -1;
      return aStart - bStart;
    });
    sortedMainCards = mainCards;
  }

  var groupOrderMap = {};
  sortedMainCards.forEach(function(card, idx) {
    groupOrderMap[card.groupId || card.id] = idx + 1;
  });

  var newSortOrders = [];
  for (var i = 1; i < values.length; i++) {
    var gId = values[i][groupIdIdx];
    if (groupOrderMap.hasOwnProperty(gId)) {
      newSortOrders.push([groupOrderMap[gId]]);
    } else {
      newSortOrders.push([values[i][sortOrderIdx]]);
    }
  }
  sheet.getRange(2, sortOrderIdx + 1, newSortOrders.length, 1).setValues(newSortOrders);
  SpreadsheetApp.flush();
}

// ═══════════════════════════════════════════════
// CRUD: 新增行程
// ═══════════════════════════════════════════════
function addSchedule(payload) {
  const ss = getMySpreadsheet();
  const sheet = ss.getSheetByName(SHEET_SCHEDULES);

  const tripId = payload.tripId;
  const targetDay = Number(payload.day) || 0;
  const altOrder = Number(payload.altOrder) || 0;

  // 僅針對主行程 (day > 0 且 altOrder == 0) 進行時間衝突檢查
  if (targetDay > 0 && altOrder === 0 && payload.startTime && payload.endTime) {
    const isConfirm = payload.confirmAdjust === true;
    const isSkip = payload.skipConflictCheck === true;

    if (!isConfirm && !isSkip) {
      const allSchedules = parseSheetData(sheet.getDataRange().getValues());
      const dayMainSchedules = allSchedules.filter(function(s) {
        return String(s.tripId) === String(tripId) && Number(s.day) === targetDay && (Number(s.altOrder) || 0) === 0;
      });

      const tempId = payload.id || 'temp-id';
      const newCardObj = {
        id: tempId,
        startTime: payload.startTime,
        endTime: payload.endTime,
        attractionName: payload.attractionName
      };
      const conflictResult = gasAnalyzeTimeConflict(newCardObj, dayMainSchedules);

      if (conflictResult.status === 'ADJUSTABLE' || conflictResult.status === 'SEVERE') {
        return {
          success: true,
          hasConflict: true,
          conflictResult: conflictResult
        };
      }
    }

    if (isConfirm && payload.targetCardId && payload.proposedNewTime && payload.proposedField) {
      gasUpdateSingleField(sheet, payload.targetCardId, payload.proposedField, payload.proposedNewTime);
    }
  }

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
    payload.sortOrder !== undefined ? Number(payload.sortOrder) : 999, // 預設的 sortOrder (墊底)
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
  SpreadsheetApp.flush();

  // 若為當天主行程，執行 auto-sort 並寫入最新 sortOrder
  if (targetDay > 0 && altOrder === 0) {
    const forcedLastId = payload.skipConflictCheck ? newId : null;
    gasReorderAndSaveSchedules(sheet, tripId, targetDay, forcedLastId);
  }

  return { success: true, hasConflict: false, id: newId };
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

  let existingRowIndex = -1;
  let existingItem = null;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][3]) === String(payload.id)) {
      existingRowIndex = i + 1;
      existingItem = {
        tripId: data[i][colMap['tripId'] - 1],
        day: Number(data[i][colMap['day'] - 1]),
        date: data[i][colMap['date'] - 1],
        altOrder: Number(data[i][colMap['altOrder'] - 1]) || 0,
        startTime: payload.startTime !== undefined ? payload.startTime : data[i][colMap['startTime'] - 1],
        endTime: payload.endTime !== undefined ? payload.endTime : data[i][colMap['endTime'] - 1],
        attractionName: payload.attractionName !== undefined ? payload.attractionName : data[i][colMap['attractionName'] - 1],
      };
      break;
    }
  }

  if (existingRowIndex === -1) {
    return { error: `找不到 id: ${payload.id}` };
  }

  const tripId = existingItem.tripId;
  const targetDay = payload.day !== undefined ? Number(payload.day) : existingItem.day;
  const altOrder = payload.altOrder !== undefined ? Number(payload.altOrder) : existingItem.altOrder;

  // 僅針對主行程進行衝突檢測
  if (targetDay > 0 && altOrder === 0 && existingItem.startTime && existingItem.endTime) {
    const isConfirm = payload.confirmAdjust === true;
    const isSkip = payload.skipConflictCheck === true;

    if (!isConfirm && !isSkip) {
      const allSchedules = parseSheetData(data);
      const dayMainSchedules = allSchedules.filter(function(s) {
        return String(s.tripId) === String(tripId) && Number(s.day) === targetDay && (Number(s.altOrder) || 0) === 0;
      });

      const newCardObj = {
        id: payload.id,
        startTime: existingItem.startTime,
        endTime: existingItem.endTime,
        attractionName: existingItem.attractionName
      };

      const conflictResult = gasAnalyzeTimeConflict(newCardObj, dayMainSchedules);
      if (conflictResult.status === 'ADJUSTABLE' || conflictResult.status === 'SEVERE') {
        return {
          success: true,
          hasConflict: true,
          conflictResult: conflictResult
        };
      }
    }

    if (isConfirm && payload.targetCardId && payload.proposedNewTime && payload.proposedField) {
      gasUpdateSingleField(sheet, payload.targetCardId, payload.proposedField, payload.proposedNewTime);
    }
  }

  if (payload.day !== undefined) sheet.getRange(existingRowIndex, colMap['day'] || 2).setValue(Number(payload.day));
  if (payload.date !== undefined) sheet.getRange(existingRowIndex, colMap['date'] || 3).setValue(payload.date);
  if (payload.sortOrder !== undefined) sheet.getRange(existingRowIndex, colMap['sortOrder'] || 7).setValue(Number(payload.sortOrder));
  if (payload.startTime !== undefined) sheet.getRange(existingRowIndex, colMap['startTime'] || 8).setValue(payload.startTime);
  if (payload.endTime !== undefined) sheet.getRange(existingRowIndex, colMap['endTime'] || 9).setValue(payload.endTime);
  if (payload.attractionName !== undefined) sheet.getRange(existingRowIndex, colMap['attractionName'] || 10).setValue(payload.attractionName);
  if (payload.remark !== undefined) sheet.getRange(existingRowIndex, colMap['remark'] || 11).setValue(payload.remark);
  if (payload.googleMapLink !== undefined) sheet.getRange(existingRowIndex, colMap['googleMapLink'] || 12).setValue(payload.googleMapLink);
  if (payload.transportType !== undefined) sheet.getRange(existingRowIndex, colMap['transportType'] || 13).setValue(payload.transportType);
  if (payload.transportCustomName !== undefined) sheet.getRange(existingRowIndex, colMap['transportCustomName'] || 14).setValue(payload.transportCustomName);
  if (payload.transportDurationMinutes !== undefined) sheet.getRange(existingRowIndex, colMap['transportDurationMinutes'] || 15).setValue(Number(payload.transportDurationMinutes) || 0);
  if (payload.transportRemark !== undefined) sheet.getRange(existingRowIndex, colMap['transportRemark'] || 16).setValue(payload.transportRemark);

  SpreadsheetApp.flush();

  if (targetDay > 0 && altOrder === 0) {
    const forcedLastId = payload.skipConflictCheck ? payload.id : null;
    gasReorderAndSaveSchedules(sheet, tripId, targetDay, forcedLastId);
  }

  return { success: true, hasConflict: false };
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
      SpreadsheetApp.flush();
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
  let groupIdIndex = headers.indexOf("groupId");
  
  if (sortOrderIndex === -1) {
    sortOrderIndex = headers.length;
    sheet.getRange(1, sortOrderIndex + 1).setValue("sortOrder");
  }

  const orderMap = {};
  orderedIds.forEach((id, index) => orderMap[id] = index + 1);

  const newOrderValues = [];
  for (let i = 1; i < values.length; i++) {
    const rowGroupId = values[i][groupIdIndex];
    
    if (orderMap.hasOwnProperty(rowGroupId)) {
      newOrderValues.push([orderMap[rowGroupId]]);
    } else {
      const oldVal = values[i][sortOrderIndex];
      newOrderValues.push([oldVal !== undefined && oldVal !== "" ? oldVal : 999]);
    }
  }

  sheet.getRange(2, sortOrderIndex + 1, newOrderValues.length, 1).setValues(newOrderValues);
  SpreadsheetApp.flush();
  return { success: true, message: "群組順序更新成功" };
}

