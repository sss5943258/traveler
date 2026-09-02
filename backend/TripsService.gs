// TripsService.gs

function getTripDetails(id) {
  const ss = getMySpreadsheet();

  // 1. 找旅程基本資訊：先用 tripId 找，找不到再用 readOnlyId 找
  const tripsData = parseSheetData(ss.getSheetByName(SHEET_TRIPS).getDataRange().getValues());

  let trip = tripsData.find(t => t.tripId === id);
  let isReadOnly = false;
  let tripId = id; // 用於後續查詢 Schedules 的真實 tripId

  if (!trip) {
    trip = tripsData.find(t => t.readOnlyId === id);
    if (trip) {
      isReadOnly = true;
      tripId = trip.tripId; // 取得真實 tripId 供後續使用
    }
  }

  if (!trip) return { error: `找不到 tripId: ${id}` };

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
