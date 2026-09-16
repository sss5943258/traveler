// ============================================
// 工具函式區塊
// ============================================
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

/**
 * 將扁平的行程資料轉換為依 Day 分組的巢狀結構 (Journeys)
 * 
 * [架構設計與天數保全機制]
 * 1. 依據 startDate 與 endDate 計算出該旅程完整的 Day 1 ~ Day N（包含各天實際 YYYY-MM-DD 日期）。
 * 2. 同時比對既有卡片資料 (flatData) 中的最大天數 (maxCardDay)，取兩者最大值，兼顧日期展開與歷史資料不丟失。
 * 3. 預先建立每一天的空天數架構（schedule: []），再將卡片依 day 填入。
 * 4. 這樣即使某天沒有任何卡片，或使用者手動將卡片全部刪除，該天數依舊會常駐並回傳給前端，不會突然消失。
 * 
 * @param {Array<Object>} flatData - 資料表中的原始 Schedule 明細列表
 * @param {string} [startDate] - 旅程出發日期 (YYYY-MM-DD)
 * @param {string} [endDate] - 旅程回程日期 (YYYY-MM-DD)
 * @returns {Array<Object>} 依天數排序的每日行程陣列 [{ day, date, schedule }]
 */
/**
 * 安全解析任何形式的日期 (支援 'YYYY-MM-DD', 'YYYY/MM/DD', ISO 8601 如 '2027-01-07T16:00:00.000Z', 或 Date 物件)
 * 轉為當地的 { year, month, day } (month 為 1-based: 1~12)
 */
function parseLocalDate(val) {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return {
      year: val.getFullYear(),
      month: val.getMonth() + 1,
      day: val.getDate()
    };
  }
  const str = String(val).trim();
  if (!str) return null;
  const plainMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (plainMatch) {
    return {
      year: parseInt(plainMatch[1], 10),
      month: parseInt(plainMatch[2], 10),
      day: parseInt(plainMatch[3], 10)
    };
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate()
    };
  }
  const fallbackMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (fallbackMatch) {
    return {
      year: parseInt(fallbackMatch[1], 10),
      month: parseInt(fallbackMatch[2], 10),
      day: parseInt(fallbackMatch[3], 10)
    };
  }
  return null;
}

/**
 * 將扁平的行程資料轉換為依 Day 分組的巢狀結構 (Journeys)
 * 
 * [架構設計與天數保全機制]
 * 1. 依據 startDate 與 endDate 計算出該旅程完整的 Day 1 ~ Day N（包含各天實際 YYYY-MM-DD 日期）。
 * 2. 同時比對既有卡片資料 (flatData) 中的最大天數 (maxCardDay)，取兩者最大值，兼顧日期展開與歷史資料不丟失。
 * 3. 預先建立每一天的空天數架構（schedule: []），再將卡片依 day 填入。
 * 4. 這樣即使某天沒有任何卡片，或使用者手動將卡片全部刪除，該天數依舊會常駐並回傳給前端，不會突然消失。
 * 
 * @param {Array<Object>} flatData - 資料表中的原始 Schedule 明細列表
 * @param {string|Date} [startDate] - 旅程出發日期
 * @param {string|Date} [endDate] - 旅程回程日期
 * @returns {Array<Object>} 依天數排序的每日行程陣列 [{ day, date, schedule }]
 */
function groupToJourneys(flatData, startDate, endDate) {
  const journeyMap = {};
  const result = [];
  
  // 1. 若有起訖日期，先計算總天數並預先填入空天數架構 (支援純文字、ISO 字串或 Date 物件)
  const startParsed = parseLocalDate(startDate);
  const endParsed = parseLocalDate(endDate);

  if (startParsed && endParsed) {
    const start = new Date(startParsed.year, startParsed.month - 1, startParsed.day);
    const end = new Date(endParsed.year, endParsed.month - 1, endParsed.day);
    const diffTime = end.getTime() - start.getTime();
    
    if (diffTime >= 0) {
      const dateDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
      // 計算既有卡片中的最大 day (避免歷史舊資料被截斷)
      let maxCardDay = 0;
      (flatData || []).forEach(item => {
        const d = parseInt(item.day, 10);
        if (!isNaN(d) && d > maxCardDay) maxCardDay = d;
      });
      
      const totalDays = Math.max(dateDays, maxCardDay);
      
      for (let i = 1; i <= totalDays; i++) {
        const curDate = new Date(startParsed.year, startParsed.month - 1, startParsed.day + (i - 1));
        const yyyy = curDate.getFullYear();
        const mm = String(curDate.getMonth() + 1).padStart(2, '0');
        const dd = String(curDate.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        
        const newJourney = { day: i, date: dateStr, schedule: [] };
        journeyMap[i] = newJourney;
        result.push(newJourney);
      }
    }
  }

  // 2. 將既有行程明細填入對應天數
  (flatData || []).forEach(item => {
    const day = parseInt(item.day, 10);
    if (isNaN(day)) return;

    if (!journeyMap[day]) {
      const newJourney = { day, date: item.date || '', schedule: [] };
      journeyMap[day] = newJourney;
      result.push(newJourney);
    }
    
    journeyMap[day].schedule.push({
      id: item.id,
      groupId: item.groupId,
      altOrder: item.altOrder,
      sortOrder: item.sortOrder,
      day,
      date: item.date || journeyMap[day].date,
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
  return result;
}