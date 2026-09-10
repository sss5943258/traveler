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

/**
 * 依據群組與排序規則整理當天行程群組
 * 協助將當天的所有卡片整理為主行程與備案的二維分組結構
 * 
 * @param {Array} daySchedules - 當天所有卡片清單
 * @returns {Array} 排序後的群組陣列，每一項為 { id: string, items: Array }
 */
export const groupAndSortDaySchedules = (daySchedules = []) => {
  if (!Array.isArray(daySchedules) || daySchedules.length === 0) return [];

  // 使用 Map 依照 groupId (或自身 id) 將主方案與備案分群
  const groupMap = new Map();
  daySchedules.forEach((item) => {
    const gid = item.groupId || item.id;
    if (!groupMap.has(gid)) groupMap.set(gid, []);
    groupMap.get(gid).push(item);
  });

  // 排序各群組 (依據主方案的 sortOrder 與 startTime)
  const sortedGroupIds = Array.from(groupMap.keys()).sort((gidA, gidB) => {
    const pA = groupMap.get(gidA).find((i) => Number(i.altOrder) === 0) || groupMap.get(gidA)[0];
    const pB = groupMap.get(gidB).find((i) => Number(i.altOrder) === 0) || groupMap.get(gidB)[0];

    const orderA = pA.sortOrder !== undefined && pA.sortOrder !== '' ? Number(pA.sortOrder) : 999;
    const orderB = pB.sortOrder !== undefined && pB.sortOrder !== '' ? Number(pB.sortOrder) : 999;

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    const aStart = timeToMinutes(pA.startTime);
    const bStart = timeToMinutes(pB.startTime);

    if (!isNaN(aStart) && !isNaN(bStart) && aStart !== bStart) {
      return aStart - bStart;
    }
    if (!isNaN(aStart) && isNaN(bStart)) return -1;
    if (isNaN(aStart) && !isNaN(bStart)) return 1;

    return 0;
  });

  // 依序輸出群組，且群組內部依照 altOrder (主方案 0 在前，備案 1, 2 在後) 排序
  const groups = [];
  sortedGroupIds.forEach((gid) => {
    const gItems = groupMap.get(gid);
    gItems.sort((a, b) => (Number(a.altOrder) || 0) - (Number(b.altOrder) || 0));
    groups.push({ id: gid, items: gItems });
  });

  return groups;
};

/**
 * 計算交通時間造成的後續行程「骨牌連鎖推移」
 * 
 * 核心業務邏輯：
 * 1. 僅在時間衝突時推移：若「前卡結束時間 + 交通時間 > 當前卡片開始時間」，才需要將當前卡片順延。
 * 2. 停留時長維持不變：推移後的新結束時間 = 新開始時間 + (原結束時間 - 原開始時間)。
 * 3. 骨牌連鎖反應：當前卡片推延後若又擠壓到下一張卡片（考慮下一張卡片自身交通時間），則繼續連鎖推移，直到某處有足夠空檔為止。
 * 4. 備案連動：同群組內的彈性備案 (altOrder > 0) 會跟隨主方案以相同的位移量同步更新。
 * 5. 跨日防呆：若任何卡片推移後超過 23:59 (1439分鐘)，判定為 hasOverflow: true 進行防呆攔截。
 * 
 * @param {Object} params
 * @param {Object} params.currentItem - 當前設定交通資訊的目標行程卡片 (前往此卡片)
 * @param {number} params.transportMinutes - 本次設定的交通預估花費分鐘數
 * @param {Array} params.daySchedules - 當天所有的行程卡片陣列
 * @returns {Object} { hasOverflow: boolean, currentItemUpdatedTimes: { startTime, endTime } | null, shiftedItems: Array }
 */
export const calculateCascadingTimeShift = ({ currentItem, transportMinutes = 0, daySchedules = [] }) => {
  // 預設回傳結果物件
  const defaultResult = {
    hasOverflow: false,
    currentItemUpdatedTimes: null,
    shiftedItems: []
  };

  // 參數驗證：若無目標卡片、交通時間小於等於 0 或當天無其他行程，則無需推移
  if (!currentItem || transportMinutes <= 0 || !Array.isArray(daySchedules) || daySchedules.length <= 1) {
    return defaultResult;
  }

  // 將當天所有行程整理為排序後的群組列表
  const groups = groupAndSortDaySchedules(daySchedules);
  if (groups.length <= 1) return defaultResult;

  // 尋找目標卡片所在的群組索引
  const targetGroupIndex = groups.findIndex((g) =>
    g.id === (currentItem.groupId || currentItem.id) || g.items.some((i) => i.id === currentItem.id)
  );

  // 若找不到目標群組，或是目標為當天第一個行程（前面沒有卡片提供出發結束時間），則無法依前卡推移
  if (targetGroupIndex <= 0) {
    return defaultResult;
  }

  // 取得前一個行程的主卡片 (作為出發地)
  const prevGroup = groups[targetGroupIndex - 1];
  const prevMainItem = prevGroup.items.find((i) => Number(i.altOrder) === 0) || prevGroup.items[0];
  const prevEndMinutes = timeToMinutes(prevMainItem?.endTime);

  // 若前一張卡片沒有填寫結束時間，無法推估抵達時間，故不推移
  if (isNaN(prevEndMinutes)) {
    return defaultResult;
  }

  // 計算預計抵達目標卡片的時間 (前卡結束 + 交通時間)
  const expectedArrivalAtTarget = prevEndMinutes + transportMinutes;

  // 記錄所有被推移調整的卡片 (包含目標卡片與後續卡片)
  const shiftedItemsMap = new Map();
  let currentItemUpdatedTimes = null;
  let hasOverflow = false;

  // 記錄前一個卡片更新後的結束時間 (分鐘數)，用於遞迴檢查下一張卡片
  let previousEffectiveEndMinutes = null;

  // 從目標群組開始，向後遍歷所有後續群組
  for (let gIdx = targetGroupIndex; gIdx < groups.length; gIdx++) {
    const currentGroup = groups[gIdx];
    const mainItem = currentGroup.items.find((i) => Number(i.altOrder) === 0) || currentGroup.items[0];

    const origStartMinutes = timeToMinutes(mainItem?.startTime);
    const origEndMinutes = timeToMinutes(mainItem?.endTime);

    // 若該卡片未填寫起始時間，依規則略過該卡片，繼續往後比對
    if (isNaN(origStartMinutes)) {
      continue;
    }

    // 計算抵達當前卡片的預期時間：
    // 若為目標卡片，使用本次設定的 expectedArrivalAtTarget；
    // 若為後續卡片，使用前一卡片的新結束時間 + 當前卡片自身設定的交通時間 (若有的話)
    let arrivalMinutes;
    if (gIdx === targetGroupIndex) {
      arrivalMinutes = expectedArrivalAtTarget;
    } else {
      const selfTransport = Number(mainItem.transportDurationMinutes) || 0;
      arrivalMinutes = previousEffectiveEndMinutes + selfTransport;
    }

    // 衝突檢測：僅在「預計抵達時間 > 原起始時間」時才需要往後順延
    if (arrivalMinutes > origStartMinutes) {
      const shiftDiff = arrivalMinutes - origStartMinutes;
      const newStartMinutes = arrivalMinutes;

      // 計算停留時長，若原先有結束時間則維持相同時長；若無結束時間則僅平移開始時間
      let newEndMinutes = NaN;
      if (!isNaN(origEndMinutes) && origEndMinutes > origStartMinutes) {
        const stayDuration = origEndMinutes - origStartMinutes;
        newEndMinutes = newStartMinutes + stayDuration;
      } else if (!isNaN(origEndMinutes)) {
        newEndMinutes = origEndMinutes + shiftDiff;
      }

      // 跨日邊界檢查：若開始時間或結束時間超過 23:59 (1439分鐘)，標記溢出並中斷
      if (newStartMinutes > 1439 || (!isNaN(newEndMinutes) && newEndMinutes > 1439)) {
        hasOverflow = true;
        break;
      }

      const formattedNewStart = minutesToTime(newStartMinutes);
      const formattedNewEnd = !isNaN(newEndMinutes) ? minutesToTime(newEndMinutes) : mainItem.endTime;

      // 更新同群組的所有卡片 (主方案與備案同步位移)
      currentGroup.items.forEach((item) => {
        const updated = {
          ...item,
          startTime: formattedNewStart,
          endTime: formattedNewEnd
        };
        shiftedItemsMap.set(item.id, updated);
      });

      // 若為目標卡片本身，額外記錄其更新時間
      if (gIdx === targetGroupIndex) {
        currentItemUpdatedTimes = {
          startTime: formattedNewStart,
          endTime: formattedNewEnd
        };
      }

      // 將當前卡片的新結束時間傳遞給下一個循環檢查
      previousEffectiveEndMinutes = !isNaN(newEndMinutes) ? newEndMinutes : newStartMinutes;
    } else {
      // 若無時間衝突 (原本的空檔已足夠容納交通時間)，骨牌效應終止，停止後續推移
      break;
    }
  }

  // 若發生跨日溢出，不回傳任何推移結果，直接回報 hasOverflow: true
  if (hasOverflow) {
    return {
      hasOverflow: true,
      currentItemUpdatedTimes: null,
      shiftedItems: []
    };
  }

  return {
    hasOverflow: false,
    currentItemUpdatedTimes,
    shiftedItems: Array.from(shiftedItemsMap.values())
  };
};
