import { useState, useEffect, useRef } from 'react'
import { Loader, Plane, CheckSquare, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { API_URL } from '../config'
import { cachedFetch } from '../utils/api'
import NewTripModal from './NewTripModal'
import DeleteConfirmModal from './DeleteConfirmModal'

// ─── 單個可左滑的行程項目 ───────────────────────────────────────
const DELETE_BTN_WIDTH = 80 // px

function TripSwipeItem({ trip, onSelect, onDeleteRequest }) {
  const [offsetX, setOffsetX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const startXRef = useRef(null)
  const currentXRef = useRef(0)
  const containerRef = useRef(null)

  const clamp = (val, min, max) => Math.max(min, Math.min(max, val))

  // ── touch ──────────────────────────────────────────────────
  const onTouchStart = (e) => {
    startXRef.current = e.touches[0].clientX
    setIsDragging(true)
  }

  const onTouchMove = (e) => {
    if (startXRef.current === null) return
    const delta = e.touches[0].clientX - startXRef.current
    const next = clamp(currentXRef.current + delta, -DELETE_BTN_WIDTH, 0)
    setOffsetX(next)
  }

  const onTouchEnd = (e) => {
    const delta = e.changedTouches[0].clientX - startXRef.current
    settle(delta)
    startXRef.current = null
    setIsDragging(false)
  }

  // ── mouse (桌面測試用) ──────────────────────────────────────
  const onMouseDown = (e) => {
    startXRef.current = e.clientX
    setIsDragging(true)

    const onMouseMove = (ev) => {
      if (startXRef.current === null) return
      const delta = ev.clientX - startXRef.current
      const next = clamp(currentXRef.current + delta, -DELETE_BTN_WIDTH, 0)
      setOffsetX(next)
    }
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

  const settle = (totalDelta) => {
    // 往左拖超過 30px → 完全展開；否則縮回
    if (totalDelta < -30) {
      currentXRef.current = -DELETE_BTN_WIDTH
      setOffsetX(-DELETE_BTN_WIDTH)
    } else {
      currentXRef.current = 0
      setOffsetX(0)
    }
  }

  // 點擊外部時縮回
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
      {/* 背景刪除按鈕 */}
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

// ─── 主元件 ───────────────────────────────────────────────────
function HomePage({ onSelectTrip, onOpenPackingList }) {
  const [trips, setTrips] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showNewTripModal, setShowNewTripModal] = useState(false)
  const [deletingTrip, setDeletingTrip] = useState(null)

  const fetchTrips = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`${API_URL}/trips`)
      if (!res.ok) throw new Error('網路請求發生錯誤')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setTrips(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTrips()
  }, [])

  const handleTripCreated = (newTrip) => {
    setShowNewTripModal(false)
    if (newTrip?.tripId) {
      onSelectTrip(newTrip.tripId)
    } else {
      fetchTrips()
    }
  }

  const handleDeleteConfirm = async () => {
    const res = await cachedFetch(`${API_URL}/trips/${deletingTrip.tripId}`, {
      method: 'DELETE',
    })
    if (!res.ok) throw new Error('刪除失敗')
  }

  const handleDeletedDone = () => {
    setDeletingTrip(null)
    fetchTrips()
  }

  if (isLoading) {
    return (
      <div className="home-container">
        <div className="home-loading">
          <Loader size={32} className="spin-icon" />
          <span>正在載入旅程清單...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="home-container">
        <div className="home-error">
          <h2>讀取失敗 🥲</h2>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="home-container">
      <div className="home-inner">
        <header className="home-header">
          <Plane size={28} className="home-logo-icon" />
          <h1 className="home-title">我的旅遊計畫</h1>
          <p className="home-subtitle">選擇一趟旅程開始吧！</p>
        </header>

        {/* 固定區：旅行攜帶清單 */}
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
    </div>
  )
}

export default HomePage
