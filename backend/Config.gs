const SHEET_TRIPS = 'Trips';
const SHEET_SCHEDULES = 'Schedules';
const SHEET_TRIPS_INFO = 'Trips_Info';

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