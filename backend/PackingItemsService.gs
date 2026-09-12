// PackingItemsService.gs

/**
 * 取得特定使用者的行李攜帶清單（資料隔離）
 * @param {string} userId - 當前登入使用者 ID
 * @returns {Array<Object>} 行李清單陣列
 */
function getUserPackingItems(userId) {
  const sheet = ensureSheetHeaders(SHEET_PACKING_ITEMS, ['itemId', 'name', 'isEssential', 'checked', 'userId']);
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const allItems = parseSheetData(values);
  // 只回傳屬於目前登入者，或舊有尚未填入 userId 的項目（並自動認領）
  const headers = values[0].map(String);
  const userIdColIdx = headers.indexOf('userId');
  let needFlush = false;

  for (let i = 1; i < values.length; i++) {
    const rowUserId = values[i][userIdColIdx];
    if (!rowUserId && userId) {
      sheet.getRange(i + 1, userIdColIdx + 1).setValue(userId);
      values[i][userIdColIdx] = userId;
      needFlush = true;
    }
  }

  if (needFlush) {
    SpreadsheetApp.flush();
  }

  return parseSheetData(values).filter(item => String(item.userId) === String(userId));
}

/**
 * 處理行李清單的各項異動操作（新增、切換勾選狀態、刪除）
 * 包含 userId 權限隔離驗證
 * @param {string} action - 操作名稱 ('addPackingItem' | 'togglePackingItem' | 'deletePackingItem')
 * @param {Object} payload - 前端傳來的負載資料
 * @param {string} userId - 當前操作的使用者 ID
 * @returns {Object} 執行結果
 */
function handlePackingItem(action, payload, userId) {
  const sheet = ensureSheetHeaders(SHEET_PACKING_ITEMS, ['itemId', 'name', 'isEssential', 'checked', 'userId']);

  if (action === 'addPackingItem') {
    const newItem = {
      itemId: Utilities.getUuid(),
      name: payload.name || '',
      isEssential: payload.isEssential === true || payload.isEssential === 'true',
      checked: false,
      userId: userId
    };
    appendDataToSheet(sheet, newItem);
    SpreadsheetApp.flush();
    return { status: 'success', message: '新增品項成功', item: newItem };
  }

  const itemId = payload.itemId;
  if (!itemId) {
    return { status: 'error', message: '缺少 itemId 參數' };
  }

  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) {
    return { status: 'error', message: '找不到指定品項' };
  }

  const headers = values[0].map(String);
  const itemIdCol = headers.indexOf('itemId');
  const userIdCol = headers.indexOf('userId');
  const checkedCol = headers.indexOf('checked');

  // 尋找目標列
  let targetRow = -1;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][itemIdCol]) === String(itemId)) {
      // 驗證是否屬於此使用者（或是未認領舊項目）
      const rowUserId = values[i][userIdCol];
      if (rowUserId && String(rowUserId) !== String(userId)) {
        return { status: 'error', message: '無權限修改或刪除此品項' };
      }
      targetRow = i + 1; // 1-based
      break;
    }
  }

  if (targetRow === -1) {
    return { status: 'error', message: `找不到 itemId: ${itemId}` };
  }

  if (action === 'togglePackingItem') {
    const checked = payload.checked === true || payload.checked === 'true';
    sheet.getRange(targetRow, checkedCol + 1).setValue(checked);
    SpreadsheetApp.flush();
    return { status: 'success', message: '切換勾選狀態成功' };
  }

  if (action === 'deletePackingItem') {
    sheet.deleteRow(targetRow);
    SpreadsheetApp.flush();
    return { status: 'success', message: '刪除品項成功' };
  }

  return { status: 'error', message: '未知的行李品項操作: ' + action };
}
