/**
 * 行程時間解析、衝突分析與自動排序工具函式庫
 */

/**
 * 將時間字串 "HH:mm" 轉換為當天從 00:00 開始計算的總分鐘數。
 * 若輸入格式不符合，傳回 NaN。
 * @param {string} timeStr - 時間字串 (格式如 "HH:mm")
 * @returns {number} 總分鐘數
 */
export const timeToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return NaN;
  const parts = timeStr.trim().split(':');
  if (parts.length !== 2) return NaN;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return NaN;
  return hours * 60 + minutes;
};

/**
 * 將總分鐘數格式化為 "HH:mm" 時間字串。
 * @param {number} totalMinutes 
 * @returns {string} "HH:mm" 時間字串
 */
export const minutesToTime = (totalMinutes) => {
  if (isNaN(totalMinutes) || totalMinutes < 0) return '00:00';
  const hours = Math.floor(totalMinutes / 60) % 24;
  const mins = totalMinutes % 60;
  const hStr = hours.toString().padStart(2, '0');
  const mStr = mins.toString().padStart(2, '0');
  return `${hStr}:${mStr}`;
};

/**
 * 分析新增/編輯的行程卡片與當天既有行程之間的時間衝突狀況。
 *
 * 衝突類型說明：
 * - 'NONE': 無時間重疊，可以直接依起始時間插入並自動排序。
 * - 'ADJUSTABLE': 與單一卡片衝突，且可透過調整該卡片的起始時間 (startTime) 或結束時間 (endTime) 來解決。
 *   1) 若 targetCard 開頭被 newCard 覆蓋 (sStart >= nStart)：嘗試將 targetCard 的 startTime 延後至 newCard.endTime (nEnd)。
 *   2) 若 targetCard 結尾被 newCard 覆蓋 (sStart < nStart)：嘗試將 targetCard 的 endTime 提前至 newCard.startTime (nStart)。
 * - 'SEVERE': 衝突無法透過時間調整解決或同時與多張卡片衝突。
 *
 * @param {Object} newCard - 新增或編輯的行程卡片物件 { id, startTime, endTime, title, ... }
 * @param {Array} daySchedules - 當天已有的行程資料陣列
 * @returns {Object} { status: 'NONE'|'ADJUSTABLE'|'SEVERE', targetCard?: Object, adjustType?: 'START_TIME'|'END_TIME', proposedNewTime?: string, proposedField?: string }
 */
export const analyzeTimeConflict = (newCard, daySchedules = []) => {
  if (!newCard || !newCard.startTime || !newCard.endTime) {
    return { status: 'NONE' };
  }

  const nStart = timeToMinutes(newCard.startTime);
  const nEnd = timeToMinutes(newCard.endTime);

  if (isNaN(nStart) || isNaN(nEnd) || nStart >= nEnd) {
    return { status: 'NONE' };
  }

  // 過濾掉正在編輯的卡片本身
  const otherSchedules = (daySchedules || []).filter(s => s && s.id !== newCard.id);

  // 尋找所有與 newCard 時間重疊的行程卡片 (nStart < sEnd && nEnd > sStart)
  const overlappingCards = [];

  for (const s of otherSchedules) {
    if (!s.startTime || !s.endTime) continue;
    const sStart = timeToMinutes(s.startTime);
    const sEnd = timeToMinutes(s.endTime);
    if (isNaN(sStart) || isNaN(sEnd)) continue;

    // 檢查重疊狀況
    if (nStart < sEnd && nEnd > sStart) {
      overlappingCards.push({ card: s, sStart, sEnd });
    }
  }

  if (overlappingCards.length === 0) {
    return { status: 'NONE' };
  }

  if (overlappingCards.length > 1) {
    // 與多張卡片衝突 -> 依開始時間升冪排序後判定為嚴重衝突
    overlappingCards.sort((a, b) => a.sStart - b.sStart);
    return {
      status: 'SEVERE',
      conflictedCardTitle: overlappingCards[0].card.attractionName || overlappingCards[0].card.title || '行程',
      overlappingCount: overlappingCards.length
    };
  }

  // 單一衝突卡片
  const { card: targetCard, sStart, sEnd } = overlappingCards[0];
  const targetTitle = targetCard.attractionName || targetCard.title || '行程';

  // 判斷衝突方向：
  // 1) targetCard 起始時間在 newCard 起始時間之後或相同 -> 調整 targetCard 的 startTime 至 nEnd
  if (sStart >= nStart) {
    if (nEnd < sEnd) {
      const proposedNewStartTime = minutesToTime(nEnd);
      return {
        status: 'ADJUSTABLE',
        targetCard,
        conflictedCardTitle: targetTitle,
        adjustType: 'START_TIME',
        proposedNewTime: proposedNewStartTime,
        proposedField: 'startTime'
      };
    } else {
      return {
        status: 'SEVERE',
        targetCard,
        conflictedCardTitle: targetTitle
      };
    }
  } else {
    // 2) targetCard 起始時間在 newCard 起始時間之前 -> 調整 targetCard 的 endTime 至 nStart
    if (nStart > sStart) {
      const proposedNewEndTime = minutesToTime(nStart);
      return {
        status: 'ADJUSTABLE',
        targetCard,
        conflictedCardTitle: targetTitle,
        adjustType: 'END_TIME',
        proposedNewTime: proposedNewEndTime,
        proposedField: 'endTime'
      };
    } else {
      return {
        status: 'SEVERE',
        targetCard,
        conflictedCardTitle: targetTitle
      };
    }
  }
};

/**
 * 將行程卡片陣列依照起始時間 (startTime) 升冪重新排序，並賦予從 1 開始的 sortOrder。
 * 若起始時間相同，則維持原有相對順序或 sortOrder。
 *
 * @param {Array} schedules - 欲重新排序的行程卡片陣列
 * @returns {Array} 重新排序並更新 sortOrder 欄位後的新陣列
 */
export const reorderSchedulesByTime = (schedules = []) => {
  if (!Array.isArray(schedules) || schedules.length === 0) return [];

  const copy = [...schedules];
  copy.sort((a, b) => {
    const aStart = timeToMinutes(a.startTime);
    const bStart = timeToMinutes(b.startTime);

    if (isNaN(aStart) && isNaN(bStart)) return (a.sortOrder || 0) - (b.sortOrder || 0);
    if (isNaN(aStart)) return 1;
    if (isNaN(bStart)) return -1;

    if (aStart !== bStart) {
      return aStart - bStart;
    }
    return (a.sortOrder || 0) - (b.sortOrder || 0);
  });

  return copy.map((item, index) => ({
    ...item,
    sortOrder: index + 1
  }));
};
