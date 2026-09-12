const SHEET_TRIPS      = 'Trips';
const SHEET_SCHEDULES  = 'Schedules';
const SHEET_TRIPS_INFO = 'Trips_Info';
const SHEET_USERS         = 'Users';        // 使用者資料表 (userId, email, name, picture, createdAt)
const SHEET_SESSIONS      = 'Sessions';     // Session 資料表 (sessionId, userId, accessToken, accessExpiresAt, refreshToken, refreshExpiresAt, isRevoked)
const SHEET_PACKING_ITEMS = 'PackingItems'; // 攜帶清單資料表 (itemId, name, isEssential, checked, userId)

// Google OAuth 2.0 Client ID
// 和前端 .env 的 VITE_GOOGLE_CLIENT_ID 相同
const GOOGLE_CLIENT_ID = '18017695333-i0v1r4ehar0ec80drh7lqs4a0v50f38h.apps.googleusercontent.com';

// 👑 Google Drive 資料夾 ID（用來儲存上傳的圖片）
// 請在 Google Drive 建立資料夾 → 右鍵「共用」→「知道連結的人皆可查看」→ 複製資料夾 ID 貼到這裡
const DRIVE_FOLDER_ID = '1HUpZXwBvpX5v2REoc1JFrcWjVfbDlpJR';

// 👑 記得一定要把這裡換成你正在用的 Google 試算表網址！
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1lYFckblUd1aXMOKwM_c-aahlK_gxOQQDqrVwToQ6Bk0/edit';

function getMySpreadsheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
        return SpreadsheetApp.openByUrl(SHEET_URL);
    }
    return ss;
}