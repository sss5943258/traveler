// AuthService.gs
// 負責 Google OAuth 登入、Session 管理、Token 驗證
// 常數定義請看 Config.gs（SHEET_USERS, SHEET_SESSIONS, GOOGLE_CLIENT_ID）

// ============================================
// 《輔助》取得 Users / Sessions Sheet
// ============================================
function getUsersSheet() {
  return getMySpreadsheet().getSheetByName(SHEET_USERS);
}

function getSessionsSheet() {
  return getMySpreadsheet().getSheetByName(SHEET_SESSIONS);
}

// ============================================
// 【輔助】驗證 Google id_token 真實性
// 呼叫 Google tokeninfo API 確認 token 由 Google 簽發且 audience 正確
// @param {string} idToken - 前端 GIS SDK 拿到的 JWT id_token
// @returns {{ sub, email, name, picture }} Google 使用者資訊
// ============================================
function verifyGoogleIdToken(idToken) {
  const url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken);
  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });

  if (response.getResponseCode() !== 200) {
    throw new Error('Google id_token 驗證失敗，token 可能已過期或無效');
  }

  const info = JSON.parse(response.getContentText());

  // 確認 audience 是我們的 Client ID，防止其他應用的 token 被使用
  if (info.aud !== GOOGLE_CLIENT_ID) {
    throw new Error('Google id_token audience 不符，拒絕登入');
  }

  if (!info.email_verified || info.email_verified === 'false') {
    throw new Error('Google 帳號 email 尚未驗證');
  }

  return info; // { sub, email, name, picture, ... }
}

// ============================================
// 【輔助】驗證 accessToken 有效性
// 每次需要登入的 API 呼叫都必須先執行此函式
// @param {string} accessToken - 前端帶來的 token
// @returns {string} userId - 驗證成功後回傳 userId 供後續使用
// ============================================
function validateAccessToken(accessToken) {
  if (!accessToken) throw new Error('未提供 token，請先登入');

  const sheet = getSessionsSheet();
  if (!sheet) throw new Error('Sessions 工作表不存在，請先建立');

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) throw new Error('TOKEN_NOT_FOUND');

  const headers = data[0];
  const colOf = (name) => headers.indexOf(name);

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[colOf('accessToken')]) === String(accessToken)) {
      // 已被撤銷（登出或強制失效）
      const isRevoked = row[colOf('isRevoked')];
      if (isRevoked === true || isRevoked === 'true' || isRevoked === 'TRUE') {
        throw new Error('TOKEN_REVOKED');
      }
      // 檢查過期時間
      const expiresAt = new Date(row[colOf('accessExpiresAt')]);
      if (isNaN(expiresAt.getTime()) || new Date() > expiresAt) {
        throw new Error('TOKEN_EXPIRED');
      }
      // 回傳 userId
      return String(row[colOf('userId')]);
    }
  }
  throw new Error('TOKEN_NOT_FOUND');
}

// ============================================
// 【Action】login
// 流程：驗證 Google id_token → 建立/查詢使用者 → 發行 accessToken + refreshToken
// @param {Object} payload - { idToken }
// @returns {{ status, accessToken, refreshToken, accessExpiresAt, user }}
// ============================================
function handleLogin(payload) {
  const { idToken } = payload;
  if (!idToken) throw new Error('缺少 idToken 參數');

  // 1. 驗證 Google id_token
  const googleUser = verifyGoogleIdToken(idToken);
  const userId  = googleUser.sub;   // Google 的使用者唯一識別碼
  const email   = googleUser.email;
  const name    = googleUser.name   || email;
  const picture = googleUser.picture || '';

  // 2. 查詢或建立使用者（Users Sheet）
  const usersSheet = getUsersSheet();
  if (!usersSheet) throw new Error('Users 工作表不存在，請先建立');

  const usersData = parseSheetData(usersSheet.getDataRange().getValues());
  const existingUser = usersData.find(u => String(u.userId) === String(userId));

  if (!existingUser) {
    // 新使用者：寫入 Users Sheet（欄位順序需與 Sheet 標題列一致）
    appendDataToSheet(usersSheet, {
      userId:    userId,
      email:     email,
      name:      name,
      picture:   picture,
      createdAt: new Date().toISOString()
    });
  }

  // 3. 產生 accessToken (15 分鐘) 與 refreshToken (30 天)
  const accessToken     = Utilities.getUuid();
  const refreshToken    = Utilities.getUuid();
  const now             = new Date();
  const accessExpiresAt = new Date(now.getTime() + 15 * 60 * 1000);           // +15 分鐘
  const refreshExpiresAt= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // +30 天

  // 4. 寫入 Sessions Sheet
  const sessionsSheet = getSessionsSheet();
  if (!sessionsSheet) throw new Error('Sessions 工作表不存在，請先建立');

  appendDataToSheet(sessionsSheet, {
    sessionId:        Utilities.getUuid(),
    userId:           userId,
    accessToken:      accessToken,
    accessExpiresAt:  accessExpiresAt.toISOString(),
    refreshToken:     refreshToken,
    refreshExpiresAt: refreshExpiresAt.toISOString(),
    isRevoked:        false
  });

  SpreadsheetApp.flush(); // 確保寫入完成

  return {
    status:          'success',
    accessToken:     accessToken,
    refreshToken:    refreshToken,
    accessExpiresAt: accessExpiresAt.getTime(), // Unix timestamp ms，供前端計算剩餘時間
    user: { userId, email, name, picture }
  };
}

// ============================================
// 【Action】refreshToken
// 用 refreshToken 換取新的 accessToken（無感刷新）
// @param {Object} payload - { refreshToken }
// @returns {{ status, accessToken, accessExpiresAt }}
// ============================================
function handleRefreshToken(payload) {
  const { refreshToken } = payload;
  if (!refreshToken) throw new Error('缺少 refreshToken 參數');

  const sheet = getSessionsSheet();
  if (!sheet) throw new Error('Sessions 工作表不存在');

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) throw new Error('REFRESH_TOKEN_NOT_FOUND');

  const headers = data[0];
  const colOf = (name) => headers.indexOf(name);

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[colOf('refreshToken')]) !== String(refreshToken)) continue;

    // 檢查是否被撤銷
    const isRevoked = row[colOf('isRevoked')];
    if (isRevoked === true || isRevoked === 'true' || isRevoked === 'TRUE') {
      throw new Error('REFRESH_TOKEN_REVOKED');
    }

    // 檢查 refreshToken 是否過期
    const refreshExpiresAt = new Date(row[colOf('refreshExpiresAt')]);
    if (isNaN(refreshExpiresAt.getTime()) || new Date() > refreshExpiresAt) {
      throw new Error('REFRESH_TOKEN_EXPIRED');
    }

    // 發行新 accessToken
    const newAccessToken  = Utilities.getUuid();
    const newExpiresAt    = new Date(new Date().getTime() + 15 * 60 * 1000); // +15 分鐘
    const rowNumber       = i + 1; // Sheet row (1-based，+1 因為有 header row)

    sheet.getRange(rowNumber, colOf('accessToken') + 1).setValue(newAccessToken);
    sheet.getRange(rowNumber, colOf('accessExpiresAt') + 1).setValue(newExpiresAt.toISOString());
    SpreadsheetApp.flush();

    return {
      status:          'success',
      accessToken:     newAccessToken,
      accessExpiresAt: newExpiresAt.getTime() // Unix timestamp ms
    };
  }

  throw new Error('REFRESH_TOKEN_NOT_FOUND');
}

// ============================================
// 【Action】logout
// 將 Session 標記為已撤銷，token 立即失效
// @param {Object} payload - { accessToken }
// ============================================
function handleLogout(payload) {
  const { accessToken } = payload;
  if (!accessToken) return { status: 'success' }; // 沒帶 token 也視為登出成功

  const sheet = getSessionsSheet();
  if (!sheet) return { status: 'success' };

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const colOf = (name) => headers.indexOf(name);

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][colOf('accessToken')]) === String(accessToken)) {
      sheet.getRange(i + 1, colOf('isRevoked') + 1).setValue(true);
      SpreadsheetApp.flush();
      break;
    }
  }

  return { status: 'success', message: '已成功登出' };
}
