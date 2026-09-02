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

function appendDataToSheet(sheet, objData) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const newRow = headers.map(h => objData[h] || "");
  sheet.appendRow(newRow);
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
      googleMapLink: item.googleMapLink
    });
  });
  
  result.sort((a, b) => a.day - b.day);
  // 我們已經在外面由 sortOrder 排列過了，因此不再依據 startTime 強制排序
  // result.forEach(j => j.schedule.sort((a, b) => a.startTime.localeCompare(b.startTime)));
  return result;
}