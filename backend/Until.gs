// ============================================
// 工具函式區塊
// ============================================

// 👉 【解決 CORS 的最大功臣】(剛才漏給導致報錯兇手就是它！)
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function parseSheetData(dataArray) {
  if (dataArray.length <= 1) return [];
  const headers = dataArray[0];
  const result = [];
  for (let i = 1; i < dataArray.length; i++) {
    let rowData = {};
    for (let j = 0; j < headers.length; j++) {
      rowData[headers[j]] = dataArray[i][j];
    }
    result.push(rowData);
  }
  return result;
}

/**
 * 將物件資料依照工作表表頭對應並寫入最後一列
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - 目標 Google Sheet 工作表
 * @param {Object} objData - 要寫入的資料物件（key 對應表頭名稱）
 */
function appendDataToSheet(sheet, objData) {
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return;
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const newRow = headers.map(h => (objData[h] !== undefined && objData[h] !== null) ? objData[h] : "");
  sheet.appendRow(newRow);
}

/**
 * 自動檢查並補齊工作表第一列缺少的表頭欄位
 * 例如 Trips 或 PackingItems 缺少 userId 或 readOnlyId 欄位時會自動在末端追加標題
 * @param {string} sheetName - 工作表名稱
 * @param {Array<string>} requiredHeaders - 必須存在的欄位名稱清單
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} 目標工作表物件
 */
function ensureSheetHeaders(sheetName, requiredHeaders) {
  const ss = getMySpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(requiredHeaders);
    return sheet;
  }
  
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) {
    sheet.appendRow(requiredHeaders);
    return sheet;
  }
  
  const currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  const missingHeaders = requiredHeaders.filter(h => !currentHeaders.includes(h));
  
  if (missingHeaders.length > 0) {
    // 依序在最後一欄之後追加缺少的表頭
    missingHeaders.forEach((header, idx) => {
      sheet.getRange(1, lastCol + idx + 1).setValue(header);
    });
  }
  return sheet;
}

function groupToJourneys(flatData) {
  const journeyMap = {};
  const result = [];
  
  flatData.forEach(item => {
    const day = parseInt(item.day, 10);
    if (!journeyMap[day]) {
         const newJourney = { day, date: item.date, schedule: [] };
         journeyMap[day] = newJourney;
         result.push(newJourney);
    }
    
    journeyMap[day].schedule.push({
      id: item.id,
      groupId: item.groupId,
      altOrder: item.altOrder,
      sortOrder: item.sortOrder,
      day,
      date: item.date,
      startTime: item.startTime,
      endTime: item.endTime,
      attractionName: item.attractionName,
      remark: item.remark,
      googleMapLink: item.googleMapLink,
      transportType: item.transportType || '',
      transportCustomName: item.transportCustomName || '',
      transportDurationMinutes: Number(item.transportDurationMinutes) || 0,
      transportRemark: item.transportRemark || ''
    });
  });
  
  result.sort((a, b) => a.day - b.day);
  // 我們已經在外面由 sortOrder 排列過了，因此不再依據 startTime 強制排序
  // result.forEach(j => j.schedule.sort((a, b) => a.startTime.localeCompare(b.startTime)));
  return result;
}