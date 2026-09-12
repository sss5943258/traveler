import { useState, useEffect, useRef } from 'react'
import { Loader, Plane, CheckSquare, ChevronRight, Plus, Trash2, LogOut } from 'lucide-react'
import { message } from 'antd'
import { apiService } from '../services/apiService'
import { useAuthStore } from '../stores/authStore'
import { logoutFromServer } from '../services/authService'
import NewTripModal from './NewTripModal'
import DeleteConfirmModal from './DeleteConfirmModal'
import LogoutConfirmModal from './LogoutConfirmModal'
import './HomePage.css'

// ─── 單個可左滑的行程項目 ───────────────────────────────────────
const DELETE_BTN_WIDTH = 80 // px

/**
 * TripSwipeItem 元件 (單個可左滑刪除的行程項目)
 * @param {Object} props.trip 行程的資料物件
 * @param {Function} props.onSelect 點擊選取行程的 callback 函式
 * @param {Function} props.onDeleteRequest 點擊刪除按鈕時觸發的 callback 函式
 */
function TripSwipeItem({ trip, onSelect, onDeleteRequest }) {
  // offsetX 狀態：控制行程按鈕向左偏移的像素值 (X 軸位移量)
  const [offsetX, setOffsetX] = useState(0)

  // isDragging 狀態：標記目前是否正在被拖曳中，用來動態關閉 CSS transition 動畫以防延遲感
  const [isDragging, setIsDragging] = useState(false)

  // Ref 用於在觸控/滑鼠拖曳事件之間，跨渲染保存點擊起點的 X 座標
  const startXRef = useRef(null)

  // Ref 記錄目前拖曳的累計偏移量
  const currentXRef = useRef(0)

  // Ref 取得該元件的最外層 DOM 節點，用於點擊外部縮回的偵測
  const containerRef = useRef(null)

  /**
   * clamp 限制數值邊界函式
   * 用於將數值限制在最小與最大值之間 (避免向右拖曳，且向左最大只能拖曳出刪除按鈕寬度)
   */
  const clamp = (val, min, max) => Math.max(min, Math.min(max, val))

  /**
   * onTouchStart 觸控開始處理函式
   * 當手機端使用者觸碰螢幕時觸發，記錄當下的觸碰起點 X 座標
   */
  const onTouchStart = (e) => {
    startXRef.current = e.touches[0].clientX
    setIsDragging(true)
  }

  /**
   * onTouchMove 觸控移動處理函式
   * 計算目前滑動的距離並即時更新 offsetX 狀態，產生跟手滑動的效果
   */
  const onTouchMove = (e) => {
    if (startXRef.current === null) return
    const delta = e.touches[0].clientX - startXRef.current
    const next = clamp(currentXRef.current + delta, -DELETE_BTN_WIDTH, 0)
    setOffsetX(next)
  }

  /**
   * onTouchEnd 觸控結束處理函式
   * 當使用者手指離開螢幕時，依據滑動距離決定要完全展開刪除按鈕，還是彈回原點
   */
  const onTouchEnd = (e) => {
    const delta = e.changedTouches[0].clientX - startXRef.current
    settle(delta)
    startXRef.current = null
    setIsDragging(false)
  }

  /**
   * onMouseDown 滑鼠按下處理函式 (主要用於電腦版測試拖曳)
   * 註冊滑鼠移動及放開事件，以實現與手機端相同的拖曳體驗
   */
  const onMouseDown = (e) => {
    startXRef.current = e.clientX
    setIsDragging(true)

    // 滑鼠移動時即時計算位移
    const onMouseMove = (ev) => {
      if (startXRef.current === null) return
      const delta = ev.clientX - startXRef.current
      const next = clamp(currentXRef.current + delta, -DELETE_BTN_WIDTH, 0)
      setOffsetX(next)
    }

    // 滑鼠放開時結算位置，並移除監聽器避免浪費資源
    const onMouseUp = (ev) => {
      const delta = ev.clientX - startXRef.current
      settle(delta)
      startXRef.current = null
      setIsDragging(false)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  /**
   * settle 位置結算邏輯函式
   * 如果向左拖曳超過 30px，自動將位移拉滿至刪除按鈕寬度 (-80px)，否則彈回原點 (0px)
   */
  const settle = (totalDelta) => {
    if (totalDelta < -30) {
      currentXRef.current = -DELETE_BTN_WIDTH
      setOffsetX(-DELETE_BTN_WIDTH)
    } else {
      currentXRef.current = 0
      setOffsetX(0)
    }
  }

  // 監聽器 Hook：若當前行程處於左滑展開狀態，使用者點選其他地方 (外部) 時，會自動收回
  useEffect(() => {
    const handleOutside = (e) => {
      if (offsetX !== 0 && containerRef.current && !containerRef.current.contains(e.target)) {
        currentXRef.current = 0
        setOffsetX(0)
      }
    }
    document.addEventListener('pointerdown', handleOutside)
    return () => document.removeEventListener('pointerdown', handleOutside)
  }, [offsetX])

  return (
    <div ref={containerRef} className="trip-swipe-wrap">
      {/* 背景紅色刪除區塊 */}
      <button
        className="trip-delete-reveal"
        style={{ width: DELETE_BTN_WIDTH, visibility: offsetX < 0 ? 'visible' : 'hidden' }}
        onClick={() => {
          currentXRef.current = 0
          setOffsetX(0)
          onDeleteRequest(trip)
        }}
      >
        <Trash2 size={20} />
        <span>刪除</span>
      </button>

      {/* 主行程按鈕 */}
      <button
        className="home-btn glass trip-btn trip-swipe-item"
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isDragging ? 'none' : 'transform 0.25s ease',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onClick={() => {
          if (offsetX === 0) onSelect(trip.tripId)
        }}
      >
        <div className="home-btn-left">
          <div className="home-btn-icon trip-icon">
            <Plane size={22} />
          </div>
          <div className="home-btn-text">
            <span className="home-btn-label">{trip.name}</span>
            <span className="home-btn-desc">
              {trip.startDate && trip.endDate
                ? `${trip.startDate} ~ ${trip.endDate}`
                : '點擊查看行程'}
            </span>
          </div>
        </div>
        <ChevronRight size={20} className="home-btn-arrow" />
      </button>
    </div>
  )
}

// ─── 首頁主元件 ───────────────────────────────────────────────────
/**
 * HomePage 元件 (首頁行程清單)
 * @param {Function} props.onSelectTrip 當使用者選取行程時的路由切換處理函式
 * @param {Function} props.onOpenPackingList 開啟攜帶清單的 callback 函式
 */
function HomePage({ onSelectTrip, onOpenPackingList }) {
  // trips 狀態：儲存自後端取得的旅行計畫清單
  const [trips, setTrips] = useState([])
  // isLoading 狀態：控制是否顯示載入中的旋轉圖示
  const [isLoading, setIsLoading] = useState(true)
  // error 狀態：儲存讀取 API 發生錯誤時的訊息內容
  const [error, setError] = useState(null)
  // showNewTripModal 狀態：控制「新增行程」彈出視窗的顯示與隱藏
  const [showNewTripModal, setShowNewTripModal] = useState(false)
  // deletingTrip 狀態：儲存當下正準備進行刪除確認的行程物件
  const [deletingTrip, setDeletingTrip] = useState(null)

  // isLoggingOut 狀態：標記是否正在執行後端登出請求
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  // showLogoutModal 狀態：控制「確認登出」彈出視窗的顯示與隱藏
  const [showLogoutModal, setShowLogoutModal] = useState(false)

  // 取得目前全域登入狀態與登出方法
  const user = useAuthStore((state) => state.user)
  const accessToken = useAuthStore((state) => state.accessToken)
  const logout = useAuthStore((state) => state.logout)

  /**
   * handleLogout 登出處理函式
   * 向後端發送登出 API 請求，徹底清除 Sessions 資料表中的登入紀錄，
   * 完成後清除本機授權狀態並自動導向登入頁
   */
  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      if (accessToken) {
        // 等待後端 API 完成資料庫 Session 刪除
        await logoutFromServer(accessToken)
      }
      logout()
      message.success('已成功清除登入資訊並登出')
    } catch (err) {
      console.error('[HomePage] 後端登出請求失敗:', err)
      // 即使後端連線異常，亦安全清除本地 Token 避免卡死
      logout()
    } finally {
      setIsLoggingOut(false)
    }
  }

  /**
   * fetchTrips 非同步資料取得函式
   * 向 GAS 請求行程列表，GAS 沒有傳統的 RESTful 路由，
   * 因此以 query 參數 `?action=getTrips` 來指示 GAS 執行對應的讀取邏輯。
   */
  const fetchTrips = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await apiService.getTrips()
      setTrips(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('[HomePage] 讀取行程發生錯誤:', err)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  // 網頁首次載入 (Mount) 時，自動呼叫 fetchTrips 取得行程列表
  useEffect(() => {
    fetchTrips()
  }, [])

  /**
   * handleTripCreated 建立成功處理函式
   * 當 NewTripModal 新增行程完成後呼叫。關閉視窗，並直接導向新行程詳情，或是重新刷清單
   */
  const handleTripCreated = (newTrip) => {
    setShowNewTripModal(false)
    if (newTrip?.tripId) {
      onSelectTrip(newTrip.tripId)
    } else {
      fetchTrips()
    }
  }

  /**
   * handleDeleteConfirm 刪除確認 API 請求函式
   * 當使用者在確認視窗中點選「確認刪除」時呼叫
   */
  const handleDeleteConfirm = async () => {
    await apiService.deleteTrip(deletingTrip.tripId)
  }

  /**
   * handleDeletedDone 刪除完成回呼函式
   * 當後端刪除成功且關閉確認視窗後觸發，重新載入首頁最新清單
   */
  const handleDeletedDone = () => {
    setDeletingTrip(null)
    fetchTrips()
  }

  // 1. 載入中畫面
  if (isLoading) {
    return (
      <div className="loading-screen-full">
        <div className="loading-content-box">
          <Loader size={40} className="spin-icon text-[var(--primary-dark)]" />
          <span className="loading-text">正在載入旅程清單...</span>
        </div>
      </div>
    )
  }

  // 2. 錄取失敗 → 不全頁覆蓋，就地顯示 warning banner（不要防礙使用者縼續創建行程）
  // error 穿透到下方正常第 3 區塊一起渲染
  // 3. 正常首頁畫面
  return (
    <div className="home-container">
      <div className="home-inner">
        <header className="home-header">
          {/* 右上角登出按鈕：點擊開啟專案統一風格之 LogoutConfirmModal */}
          <button
            type="button"
            className="home-logout-btn group"
            onClick={() => setShowLogoutModal(true)}
            aria-label="登出"
          >
            <LogOut size={18} className="transition-transform group-hover:scale-110" />
          </button>

          <Plane size={28} className="home-logo-icon" />
          <h1 className="home-title">我的旅遊計畫</h1>
          <p className="home-subtitle">選擇一趟旅程開始吧！</p>
        </header>

        {/* 行程讀取失敗提示（API 異常才顯示，不阻止使用者繼續操作）*/}
        {error && (
          <div
            className="mx-4 mb-2 px-4 py-3 rounded-xl text-sm flex items-center gap-2"
            style={{
              background: 'rgba(234, 179, 8, 0.08)',
              border: '1px solid rgba(234, 179, 8, 0.25)',
              color: 'var(--text-muted)',
            }}
          >
            ⚠️ 行程讀取失敗，可能是網路問題。你仍可新增行程或使用攜帶清單。
          </div>
        )}

        {/* 固定區：旅行攜帶清單入口 */}
        <div className="home-fixed-top">
          <button className="home-btn glass packing-btn" onClick={onOpenPackingList}>
            <div className="home-btn-left">
              <div className="home-btn-icon packing-icon">
                <CheckSquare size={22} />
              </div>
              <div className="home-btn-text">
                <span className="home-btn-label">旅行攜帶清單</span>
                <span className="home-btn-desc">打包不遺漏</span>
              </div>
            </div>
            <ChevronRight size={20} className="home-btn-arrow" />
          </button>
        </div>

        {/* 可滾動的行程清單 */}
        <div className="home-trip-list">
          {trips.map((trip, idx) => (
            <TripSwipeItem
              key={trip.tripId || idx}
              trip={trip}
              onSelect={onSelectTrip}
              onDeleteRequest={(t) => setDeletingTrip(t)}
            />
          ))}

          {trips.length === 0 && (
            <div className="home-empty">
              <p>目前沒有任何行程，快新增第一趟旅程吧！</p>
            </div>
          )}
        </div>

        {/* 置底：新增行程按鈕 */}
        <div className="home-fixed-bottom">
          <button
            className="home-add-trip-btn"
            onClick={() => setShowNewTripModal(true)}
            title="新增行程"
          >
            <Plus size={24} />
            <span>新增行程</span>
          </button>
        </div>
      </div>

      {showNewTripModal && (
        <NewTripModal
          onClose={() => setShowNewTripModal(false)}
          onCreated={handleTripCreated}
        />
      )}

      {deletingTrip && (
        <DeleteConfirmModal
          item={{ attractionName: deletingTrip.name }}
          onClose={() => setDeletingTrip(null)}
          onConfirm={handleDeleteConfirm}
          onDeleted={handleDeletedDone}
        />
      )}

      {/* 專案統一風格的登出確認彈跳視窗 */}
      {showLogoutModal && (
        <LogoutConfirmModal
          onClose={() => setShowLogoutModal(false)}
          onConfirm={async () => {
            await handleLogout()
            setShowLogoutModal(false)
          }}
          isLoggingOut={isLoggingOut}
          user={user}
        />
      )}
    </div>
  )
}

export default HomePage
