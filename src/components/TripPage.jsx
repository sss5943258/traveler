import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { MapPin, X, Info, Loader, MoreHorizontal, Plus, Pencil, Trash2, Copy, Share2, Plane, Calendar, ArrowDown, ChevronRight, ChevronLeft, FileText, Footprints, Car, Bus, Train, Navigation, ArrowRightLeft } from 'lucide-react'
import { DndContext, closestCorners, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { apiService } from '../services/apiService'
import ScheduleFormModal, { ScheduleForm } from './ScheduleFormModal'
import TripInfoFormModal, { TripInfoForm } from './TripInfoFormModal'
import TransportFormModal, { TransportForm } from './TransportFormModal'
import DeleteConfirmModal from './DeleteConfirmModal'
import MoveDayModal from './MoveDayModal'
import { timeToMinutes } from '../utils/timeSortUtils'
import './TripPage.css'

// 輔助函式：簡化過長文字
const truncateText = (text, maxLength = 80) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};

// 輔助函式：格式化日期時間為 yyyy/MM/dd HH:mm
const formatDisplayDatetime = (val) => {
  if (!val) return '未定';
  const str = String(val).trim();
  if (!str) return '未定';

  const simpleMatch = str.match(/^(\d{4})[-/](\d{2})[-/](\d{2})[T ](\d{2}):(\d{2})/);
  if (simpleMatch && !str.includes('Z') && !str.includes('+') && !str.includes('GMT')) {
    return `${simpleMatch[1]}/${simpleMatch[2]}/${simpleMatch[3]} ${simpleMatch[4]}:${simpleMatch[5]}`;
  }

  const date = new Date(str);
  if (!isNaN(date.getTime())) {
    const yyyy = date.getFullYear();
    const MM = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const MathHH = String(date.getHours()).padStart(2, '0');
    const Mathmm = String(date.getMinutes()).padStart(2, '0');
    return `${yyyy}/${MM}/${dd} ${MathHH}:${Mathmm}`;
  }
  return str.replace('T', ' ').replace(/-/g, '/').slice(0, 16);
};

// 輔助函式：將總分鐘數轉為手繪圖樣式文字 (如 "15m" 或 "1h 20m")
const formatTransportDuration = (totalMinutes) => {
  const mins = Number(totalMinutes) || 0;
  if (mins <= 0) return '';
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  if (hours > 0 && remainingMins > 0) return `${hours}h ${remainingMins}m`;
  if (hours > 0) return `${hours}h`;
  return `${remainingMins}m`;
};

// 輔助函式：依交通方式取得對應 Icon 與顯示名稱
const getTransportMeta = (type, customName) => {
  switch (type) {
    case 'walk':
      return { label: '步行', icon: <Footprints size={20} /> };
    case 'car':
      return { label: '開車', icon: <Car size={20} /> };
    case 'bus':
      return { label: '公車', icon: <Bus size={20} /> };
    case 'subway':
      return { label: '地鐵', icon: <Train size={20} /> };
    case 'custom':
      return { label: customName || '自訂', icon: <Navigation size={20} /> };
    default:
      return null;
  }
};

/**
 * TransportArrow 元件 (景點間的交通箭頭)
 */
function TransportArrow({ targetItem, onEditTransport, isReadOnly }) {
  const meta = targetItem ? getTransportMeta(targetItem.transportType, targetItem.transportCustomName) : null;
  const durationText = targetItem ? formatTransportDuration(targetItem.transportDurationMinutes) : '';
  const hasTransport = Boolean(meta);

  return (
    <div
      className="transport-arrow-container cursor-pointer my-2 flex flex-col items-center justify-center transition-all group"
      onClick={(e) => {
        e.stopPropagation();
        if (!isReadOnly && targetItem && onEditTransport) {
          onEditTransport(targetItem);
        }
      }}
      title={hasTransport ? (targetItem.transportRemark ? `交通備註：${targetItem.transportRemark}` : '點擊編輯交通方式') : '點擊新增交通方式'}
    >
      {hasTransport ? (
        <div className="flex flex-col items-center text-[var(--primary-dark)] hover:scale-105 transition-transform">
          <div className="flex items-center gap-1 text-gray-700 font-medium text-xs bg-white/70 px-2 py-1 rounded-full border border-amber-200/60 shadow-sm mb-0.5">
            {meta.icon}
            {targetItem.transportType === 'custom' && <span className="text-[11px] font-semibold">{meta.label}</span>}
          </div>
          {durationText && (
            <span className="text-[11px] font-bold text-gray-600 mb-0.5 tracking-tight">
              {durationText}
            </span>
          )}
          <ArrowDown size={18} className="opacity-80 text-[var(--primary-dark)]" />
        </div>
      ) : (
        <div className="flex flex-col items-center opacity-40 hover:opacity-100 text-[var(--primary-dark)] transition-opacity py-1">
          <span className="text-[10px] font-medium text-gray-500 hidden group-hover:block mb-0.5">新增交通</span>
          <ArrowDown size={18} />
        </div>
      )}
    </div>
  );
}

/**
 * CardMenu 元件 (卡片操作選單)
 * 當點擊卡片右上角的「...」時彈出的操作選單，提供「新增備案」、「編輯」、「刪除」選項
 * 採用 React Portal 機制，防止下拉選單被父層 CSS overflow: hidden 遮擋
 */
function CardMenu({ item, onEdit, onDelete, onCopy, onAddBackup, onMoveDay, showDelete, showAddBackup }) {
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef(null)
  const menuRef = useRef(null)

  const isCoreFlight = item?.id ? (item.id.startsWith('info-outbound') || item.id.startsWith('info-inbound')) : false
  const actualShowAddBackup = showAddBackup !== undefined ? showAddBackup : !isCoreFlight
  const actualShowDelete = showDelete !== undefined ? showDelete : !isCoreFlight

  /**
   * handleToggle 點擊切換選單開啟/關閉狀態
   * 利用 getBoundingClientRect 取得按鈕在螢幕上的绝对位置，動態計算選單顯示坐標
   */
  const handleToggle = (e) => {
    e.stopPropagation()
    if (open) { setOpen(false); return }
    const r = btnRef.current.getBoundingClientRect()
    setMenuPos({ top: r.bottom + window.scrollY + 6, left: Math.max(4, r.right - 150) })
    setOpen(true)
  }

  // 監聽全域點擊事件，當點選選單以外的區域時，自動將選單收合 (關閉)
  useEffect(() => {
    if (!open) return
    const close = (e) => {
      if (menuRef.current?.contains(e.target)) return
      if (btnRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', close, true)
    return () => document.removeEventListener('pointerdown', close, true)
  }, [open])

  return (
    <div className="card-menu-wrap">
      <button ref={btnRef} className="icon-btn" title="操作" onClick={handleToggle}>
        <MoreHorizontal size={18} />
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          className="card-menu-dropdown glass"
          style={{ position: 'absolute', top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
        >
          {actualShowAddBackup && (
            <button className="menu-item" onClick={() => { setOpen(false); onAddBackup(item) }}>
              <Plus size={14} /> 新增備案
            </button>
          )}
          <button className="menu-item" onClick={() => { setOpen(false); onEdit(item) }}>
            <Pencil size={14} /> {item?.isPlaceholder ? '新增' : '編輯'}
          </button>
          {onCopy && (
            <button className="menu-item" onClick={() => { setOpen(false); onCopy(item) }}>
              <Copy size={14} /> 複製
            </button>
          )}
          {onMoveDay && (
            <button className="menu-item" onClick={() => { setOpen(false); onMoveDay(item) }}>
              <ArrowRightLeft size={14} /> 移動至其他天
            </button>
          )}
          {actualShowDelete && (
            <button className="menu-item danger" onClick={() => { setOpen(false); onDelete(item) }}>
              <Trash2 size={14} /> 刪除
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}

/**
 * ShareMenu 元件 (分享選單)
 * 點選分享按鈕後彈出，包含分享連結、文字行程、下載 CSV 檔案功能
 */
function ShareMenu({ onShareLink, onShareText, onShareCSV }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)
  const btnRef = useRef(null)

  /**
   * handleToggle 切換選單顯示狀態
   */
  const handleToggle = (e) => {
    e.stopPropagation()
    setOpen(!open)
  }

  // 監聽全域點擊事件，點擊選單外部時關閉下拉選單
  useEffect(() => {
    if (!open) return
    const close = (e) => {
      if (menuRef.current?.contains(e.target)) return
      if (btnRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  return (
    <div className="share-menu-wrap" style={{ position: 'relative' }}>
      <button ref={btnRef} className="icon-btn share-btn" title="分享行程" onClick={handleToggle}>
        <Share2 size={16} />
      </button>
      {open && (
        <div
          ref={menuRef}
          className="card-menu-dropdown glass share-dropdown"
          style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 100 }}
        >
          <button className="menu-item" onClick={() => { setOpen(false); onShareLink() }}>
            分享行程
          </button>
          <button className="menu-item" onClick={() => { setOpen(false); onShareText() }}>
            分享文字行程
          </button>
          <button className="menu-item" onClick={() => { setOpen(false); onShareCSV() }}>
            分享 CSV
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Card 元件 (單個行程卡片)
 * 渲染行程名稱、起訖時間、備註圖示，並處理點選卡片觸發的 callback
 */
function Card({ item, onClick, onMap, onEdit, onDelete, onCopy, onAddBackup, onMoveDay, isReadOnly, isActive }) {
  const hasTime = Boolean((item.startTime && item.startTime.trim() !== '') || (item.endTime && item.endTime.trim() !== ''))

  return (
    <div
      className={`card glass clickable ${isActive ? 'active-card border-[var(--primary-dark)] shadow-md translate-y-[-2px]' : ''}`}
      onClick={onClick}
    >
      <div className="card-header">
        {hasTime ? (
          <span className="time">{item.startTime}{item.endTime ? ` - ${item.endTime}` : ''}</span>
        ) : (
          <div />
        )}
        <div className="card-actions" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
          {item.altOrder > 0 && <span style={{ fontSize: '0.75rem', color: '#9e7a4e', marginRight: '6px', fontWeight: '800' }}>#備案 {item.altOrder}</span>}
          <button
            className="icon-btn"
            onClick={onMap}
            title="Google Maps"
            style={{ opacity: item.googleMapLink ? 1 : 0.3, cursor: item.googleMapLink ? 'pointer' : 'default' }}
          >
            <MapPin size={18} />
          </button>
          {!isReadOnly && <CardMenu item={item} onEdit={onEdit} onDelete={onDelete} onCopy={onCopy} onAddBackup={onAddBackup} onMoveDay={onMoveDay} />}
        </div>
      </div>
      <h3 className="attraction-name">{item.attractionName}</h3>
      <div className="card-footer">
        <Info size={14} />
        <span>點擊查看備註</span>
      </div>
    </div>
  )
}

/**
 * SortableGroup 元件
 * 用於排序列表中的 Dnd-Kit 排序群組包裹元件，處理橫向彈性備案滑動與拖曳排程
 */
function SortableGroup({ id, groupItems, onClick, onMap, onEdit, onDelete, onCopy, onAddBackup, onMoveDay, isReadOnly, activeItemId }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const containerRef = useRef(null)
  const scrollRef = useRef(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const hasBackups = groupItems.length > 1

  // 合併 React Ref 指標，以利於長按拖曳時的 DOM 控制
  const handleRef = (node) => {
    setNodeRef(node)
    containerRef.current = node
  }

  // 計算與記錄目前滾動位置對應的卡片索引
  const handleScroll = () => {
    if (!scrollRef.current) return
    const width = scrollRef.current.clientWidth
    if (width > 0) {
      const idx = Math.round(scrollRef.current.scrollLeft / width)
      setActiveIndex(idx)
    }
  }

  // 滾動至指定的卡片索引
  const scrollToIndex = (index) => {
    if (!scrollRef.current) return
    const width = scrollRef.current.clientWidth
    scrollRef.current.scrollTo({
      left: index * width,
      behavior: 'smooth'
    })
  }

  // 行程列表拖曳手勢判定邏輯 (避免干擾手機滑動滾網頁的體驗)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let timer = null
    let touchActionApplied = false
    let startX = 0
    let startY = 0

    const handleStart = (e) => {
      if (timer) clearTimeout(timer)
      touchActionApplied = false
      const touch = e.touches?.[0]
      if (touch) {
        startX = touch.clientX
        startY = touch.clientY
      }
      timer = setTimeout(() => {
        el.style.touchAction = 'none'
        touchActionApplied = true
        timer = null
      }, 150)
    }

    const handleMove = (e) => {
      if (!touchActionApplied) {
        const touch = e.touches?.[0]
        if (touch) {
          const deltaX = Math.abs(touch.clientX - startX)
          const deltaY = Math.abs(touch.clientY - startY)
          if (deltaX > 6 || deltaY > 6) {
            if (timer) {
              clearTimeout(timer)
              timer = null
            }
            el.style.touchAction = ''
          }
        }
      }
    }

    const handleEnd = () => {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      touchActionApplied = false
      el.style.touchAction = ''
    }

    el.addEventListener('touchstart', handleStart, { passive: true })
    el.addEventListener('touchmove', handleMove, { passive: true })
    el.addEventListener('touchend', handleEnd, { passive: true })
    el.addEventListener('touchcancel', handleEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', handleStart)
      el.removeEventListener('touchmove', handleMove)
      el.removeEventListener('touchend', handleEnd)
      el.removeEventListener('touchcancel', handleEnd)
      if (timer) clearTimeout(timer)
    }
  }, [])

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : 1,
    position: 'relative',
  }

  return (
    <div ref={handleRef} style={style} {...attributes} {...listeners} className="sortable-group w-full relative">
      {/* 右上角計數器 Badge (僅在有備案時顯示 1/2) */}
      {hasBackups && (
        <div className="backup-badge-header">
          <span className="backup-count-badge">
            {activeIndex + 1} / {groupItems.length}
          </span>
        </div>
      )}

      {/* 左右導覽箭頭按鈕 (點擊切換備案) */}
      {hasBackups && activeIndex > 0 && (
        <button
          type="button"
          className="backup-nav-arrow left-arrow"
          onClick={(e) => {
            e.stopPropagation()
            scrollToIndex(activeIndex - 1)
          }}
          title="上一項"
        >
          <ChevronLeft size={18} />
        </button>
      )}

      {hasBackups && activeIndex < groupItems.length - 1 && (
        <button
          type="button"
          className="backup-nav-arrow right-arrow"
          onClick={(e) => {
            e.stopPropagation()
            scrollToIndex(activeIndex + 1)
          }}
          title="下一項"
        >
          <ChevronRight size={18} />
        </button>
      )}

      <div
        ref={scrollRef}
        className="horizontal-scroll"
        onScroll={handleScroll}
      >
        {groupItems.map((item, idx) => (
          <div key={item.id} className="card-wrapper w-full">
            <Card
              item={item}
              isActive={activeItemId === item.id}
              onClick={() => onClick(item)}
              onMap={(e) => onMap(e, item)}
              onEdit={() => onEdit(item)}
              onDelete={() => onDelete(item)}
              onCopy={() => onCopy && onCopy(item)}
              onAddBackup={() => onAddBackup(item)}
              onMoveDay={() => onMoveDay && onMoveDay(item)}
              isReadOnly={isReadOnly}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * AddCard 元件 (點選新增行程卡片按鈕)
 */
function AddCard({ onClick }) {
  return (
    <div className="card glass add-card cursor-pointer border-dashed border-2 flex flex-col items-center justify-center py-6 text-[var(--text-muted)]" onClick={onClick}>
      <Plus size={24} />
      <span>新增行程</span>
    </div>
  )
}

/**
 * TripPage 主頁面元件 (包含響應式三欄切板)
 * @param {string} props.tripId 當前載入的旅行計畫 ID
 * @param {Function} props.onBack 回首頁的 callback
 */
export default function TripPage({ tripId, onBack }) {
  // --- 狀態定義 ---
  const [tripInfo, setTripInfo] = useState(null)          // 儲存行程大綱/唯讀狀態
  const [tripsInfo, setTripsInfo] = useState(null)        // 儲存 Day 0 航班與備註
  const [journeys, setJourneys] = useState([])            // 儲存完整多日行程陣列
  const [selectedDay, setSelectedDay] = useState(0)       // 當前選取的天數 (0 代表「旅程資訊」)
  const [isLoading, setIsLoading] = useState(true)        // 是否正在讀取 API 資料
  const [error, setError] = useState(null)                // 儲存資料加載時的異常訊息
  const [isReadOnly, setIsReadOnly] = useState(false)    // 是否為唯讀模式

  // --- 表單與操作狀態 ---
  const [actionLoading, setActionLoading] = useState(null)    // 全域快捷 API 操作加載提示 (如 '複製行程中...')
  const [remarkItem, setRemarkItem] = useState(null)      // 當前在手機版查看詳情備註的行程
  const [formModal, setFormModal] = useState(null)        // 行程表單狀態：{ mode, item, day, date, groupId, altOrder }
  const [tripInfoModal, setTripInfoModal] = useState(null) // 航班資訊表單狀態：{ type } (outbound/inbound/remark)
  const [transportModalItem, setTransportModalItem] = useState(null) // 手機版交通方式編輯彈窗
  const [transportFormItem, setTransportFormItem] = useState(null)   // 網頁版交通方式右側編輯欄位
  const [deleteItem, setDeleteItem] = useState(null)      // 待刪除行程物件
  const [deleteTripInfoType, setDeleteTripInfoType] = useState(null) // 待刪除航班/備註類別
  const [moveModalItem, setMoveModalItem] = useState(null) // 待跨天移動的行程物件

  // --- 手機與桌面響應式偵測 ---
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const mainContentRef = useRef(null)
  const [slideAnimation, setSlideAnimation] = useState('')

  // 當天數切換時，自動將行程列表滾動容器歸零頂部，並觸發 300ms 滑動動畫重置
  useEffect(() => {
    if (mainContentRef.current) {
      mainContentRef.current.scrollTop = 0
    }
    const timer = setTimeout(() => setSlideAnimation(''), 300)
    return () => clearTimeout(timer)
  }, [selectedDay])

  // 監聽螢幕寬度變化，切換 `isMobile` 狀態以即時適應手機與桌面版版面
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // 手機版在非備案卡片區域左右滑動切換天數
  useEffect(() => {
    const el = mainContentRef.current
    if (!el || !isMobile) return

    let startX = 0
    let startY = 0
    let isBackupTouch = false

    const handleTouchStart = (e) => {
      const touch = e.touches?.[0]
      if (!touch) return
      startX = touch.clientX
      startY = touch.clientY

      // 檢查觸控點是否位於帶有備案的卡片內 (含有 .backup-count-badge)
      const sortableGroup = e.target.closest('.sortable-group')
      if (sortableGroup && sortableGroup.querySelector('.backup-count-badge')) {
        isBackupTouch = true
        return
      }
      isBackupTouch = false
    }

    const handleTouchEnd = (e) => {
      if (isBackupTouch) return
      const touch = e.changedTouches?.[0]
      if (!touch) return

      const deltaX = touch.clientX - startX
      const deltaY = touch.clientY - startY

      // 手勢判點：距離 > 50px 且 水平距離為垂直距離 1.5 倍以上
      if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
        const currentIndex = journeys.findIndex(j => j.day === selectedDay)
        if (deltaX < 0) {
          // 向左滑動 ➔ 切換至下一天
          if (currentIndex !== -1 && currentIndex < journeys.length - 1) {
            const nextDay = journeys[currentIndex + 1].day
            setSlideAnimation('slide-left')
            setSelectedDay(nextDay)
            const tabBtn = document.querySelector(`.date-tab[data-day="${nextDay}"]`)
            tabBtn?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
          }
        } else if (deltaX > 0) {
          // 向右滑動 ➔ 切換至上一天
          if (currentIndex > 0) {
            const prevDay = journeys[currentIndex - 1].day
            setSlideAnimation('slide-right')
            setSelectedDay(prevDay)
            const tabBtn = document.querySelector(`.date-tab[data-day="${prevDay}"]`)
            tabBtn?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
          }
        }
      }
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isMobile, selectedDay, journeys])

  // --- Dnd-kit sensors 觸控與滑鼠拖曳參數配置 ---
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  /**
   * fetchTripData 資料讀取函式
   * 向 GAS 發送 action=getTripDetails 載入特定 ID 行程的全部細節
   */
  const fetchTripData = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await apiService.getTripDetails(tripId)

      let updatedJourneys = data.journeys || []
      const hasDayZero = updatedJourneys.some(j => j.day === 0)
      if (!hasDayZero) {
        // 若缺少 Day 0 (旅程資訊)，前端手動塞入一筆作為占位
        updatedJourneys = [{ day: 0, date: '旅程資訊', schedule: [] }, ...updatedJourneys]
      } else {
        const d0Index = updatedJourneys.findIndex(j => j.day === 0)
        updatedJourneys[d0Index] = { ...updatedJourneys[d0Index], schedule: [] }
      }

      setTripInfo(data)
      setIsReadOnly(data.isReadOnly || false)
      setTripsInfo(data.tripInfo || null)
      setJourneys(updatedJourneys)
      setSelectedDay(0)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  // 當元件載入或 tripId 變更時，立即重新讀取遠端行程資料
  useEffect(() => {
    fetchTripData()
  }, [tripId])

  /**
   * handleDragEnd 拖曳完成回撥邏輯
   * 負責計算拖曳後群組的新順序並透過 API 保存排序
   */
  const handleDragEnd = async (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const jIdx = journeys.findIndex((j) => j.day === selectedDay)
    if (jIdx === -1) return

    const currentJ = journeys[jIdx]
    const schedule = currentJ.schedule || []

    const groupMap = new Map()
    schedule.forEach(item => {
      const gid = item.groupId || item.id
      if (!groupMap.has(gid)) groupMap.set(gid, [])
      groupMap.get(gid).push(item)
    })

    const groupIds = Array.from(groupMap.keys()).sort((gidA, gidB) => {
      const pA = groupMap.get(gidA).find(i => Number(i.altOrder) === 0) || groupMap.get(gidA)[0]
      const pB = groupMap.get(gidB).find(i => Number(i.altOrder) === 0) || groupMap.get(gidB)[0]
      return (pA.sortOrder ?? 999) - (pB.sortOrder ?? 999)
    })

    const oldIndex = groupIds.indexOf(active.id)
    const newIndex = groupIds.indexOf(over.id)

    if (oldIndex === -1 || newIndex === -1) return

    const newGroupOrder = arrayMove(groupIds, oldIndex, newIndex)
    const newSchedule = []
    newGroupOrder.forEach((gid, index) => {
      const items = groupMap.get(gid)
      items.forEach(it => {
        newSchedule.push({ ...it, sortOrder: index })
      })
    })

    setJourneys((prev) => {
      const draft = [...prev]
      draft[jIdx] = { ...draft[jIdx], schedule: newSchedule }
      return draft
    })

    try {
      await apiService.updateScheduleOrder(tripId, selectedDay, newGroupOrder)
    } catch (err) {
      console.error('更新順序失敗:', err)
    }
  }

  // 以下為各式按鈕的事件代理處理 (包含分享機制)
  const handleMap = (e, item) => {
    e.stopPropagation()
    if (item.googleMapLink) window.open(item.googleMapLink, '_blank')
  }

  const handleAddBackup = (item) => {
    const groupItems = scheduleGroups.find(g => g.id === (item.groupId || item.id))?.items || [];
    const maxAltOrder = Math.max(0, ...groupItems.map(i => i.altOrder || 0));
    const targetState = {
      mode: 'addBackup',
      item,
      day: item.day,
      date: item.date,
      groupId: item.groupId || item.id,
      altOrder: maxAltOrder + 1
    };

    setFormModal(targetState);
    setTripInfoModal(null);
    setTransportFormItem(null);
    setRemarkItem(null);
  }

  const handleCopySchedule = async (item) => {
    setActionLoading('複製行程中...')
    try {
      const currentJourney = journeys.find(j => j.day === item.day)
      const currentSchedules = currentJourney?.schedule || []
      const maxSortOrder = currentSchedules.reduce((max, s) => Math.max(max, Number(s.sortOrder) || 0), 0)

      const newGroupId = 'g-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6)
      const tempId = `t3-d${item.day}-${Date.now()}`

      const newScheduleDto = {
        id: tempId,
        tripId,
        day: item.day,
        date: item.date,
        attractionName: item.attractionName || '',
        startTime: '',
        endTime: '',
        remark: item.remark || '',
        googleMapLink: item.googleMapLink || '',
        groupId: newGroupId,
        altOrder: 0,
        sortOrder: maxSortOrder + 1
      }

      const res = await apiService.addSchedule(newScheduleDto)

      const createdItem = {
        ...newScheduleDto,
        id: res?.id || res?.data?.id || tempId
      }

      setJourneys(prev => prev.map(j => {
        if (j.day === item.day) {
          return {
            ...j,
            schedule: [...(j.schedule || []), createdItem]
          }
        }
        return j
      }))
    } catch (err) {
      console.error('複製行程失敗:', err)
      alert('複製行程失敗，請稍後再試：' + (err.message || err))
    } finally {
      setActionLoading(null)
    }
  }

  /**
   * handleMoveGroupToDay 跨天數移動行程群組處理函式
   * 將傳入的行程（及其附屬彈性備案）一併移動至指定目標天數 (targetDay) 的末端
   */
  const handleMoveGroupToDay = async (targetDay, targetDate) => {
    if (!moveModalItem) return
    const sourceItem = moveModalItem
    setMoveModalItem(null)

    setActionLoading('移動行程中...')
    try {
      const sourceDay = sourceItem.day
      const gid = sourceItem.groupId || sourceItem.id

      // 1. 找出原天數中同 groupId 的所有卡片 (主行程 + 所有備案)
      const sourceJourney = journeys.find(j => j.day === sourceDay)
      const groupItemsToMove = (sourceJourney?.schedule || []).filter(
        i => (i.groupId || i.id) === gid
      )

      if (groupItemsToMove.length === 0) return

      // 2. 取得目標天數目前行程清單，計算目標天數最高 sortOrder
      const targetJourney = journeys.find(j => j.day === targetDay)
      const targetSchedule = targetJourney?.schedule || []
      const maxSortOrder = targetSchedule.reduce(
        (max, s) => Math.max(max, Number(s.sortOrder) || 0),
        0
      )
      const newSortOrder = targetSchedule.length > 0 ? maxSortOrder + 1 : 0

      // 3. 準備要更新的資料（同 groupId 的所有卡片都更新 day, date, sortOrder）
      const updatedGroupItems = groupItemsToMove.map(item => ({
        ...item,
        day: targetDay,
        date: targetDate,
        sortOrder: newSortOrder
      }))

      // 4. 呼叫 API 更新後端
      await Promise.all(
        updatedGroupItems.map(item =>
          apiService.updateSchedule(item.id, {
            day: targetDay,
            date: targetDate,
            sortOrder: newSortOrder
          })
        )
      )

      // 5. 更新前端 journeys state：自原天數移除，加到目標天數末端
      setJourneys(prev =>
        prev.map(j => {
          if (j.day === sourceDay) {
            return {
              ...j,
              schedule: (j.schedule || []).filter(i => (i.groupId || i.id) !== gid)
            }
          }
          if (j.day === targetDay) {
            return {
              ...j,
              schedule: [...(j.schedule || []), ...updatedGroupItems]
            }
          }
          return j
        })
      )
    } catch (err) {
      console.error('移動行程失敗:', err)
      alert('移動行程失敗，請稍後再試：' + (err.message || err))
    } finally {
      setActionLoading(null)
    }
  }

  const handleShareLink = () => {
    const readOnlyId = tripInfo?.readOnlyId
    const shareUrl = new URL(window.location.href)
    if (readOnlyId) {
      shareUrl.searchParams.set('id', readOnlyId)
    }
    const shareUrlStr = shareUrl.toString()

    if (navigator.share) {
      navigator.share({ title: tripInfo?.name || '我的旅遊計畫', url: shareUrlStr })
        .catch(err => console.log('Share canceled or failed:', err))
    } else {
      navigator.clipboard.writeText(shareUrlStr)
        .then(() => alert(readOnlyId ? '已複製唯讀分享連結到剪貼簿！' : '已複製行程連結到剪貼簿！'))
        .catch(() => alert('複製連結失敗，請手動複製網址。'))
    }
  }

  const handleShareText = () => {
    const text = journeys.map(j => {
      const dateStr = j.date;
      const dayHeader = `Day ${j.day} (${dateStr})`;
      const schedule = j.schedule || [];
      const groupMap = new Map();
      schedule.forEach(item => {
        const gid = item.groupId || item.id;
        if (!groupMap.has(gid)) groupMap.set(gid, []);
        groupMap.get(gid).push(item);
      });
      const sortedGids = Array.from(groupMap.keys()).sort((gidA, gidB) => {
        const pA = groupMap.get(gidA).find(i => Number(i.altOrder) === 0) || groupMap.get(gidA)[0];
        const pB = groupMap.get(gidB).find(i => Number(i.altOrder) === 0) || groupMap.get(gidB)[0];
        return (pA.sortOrder ?? 999) - (pB.sortOrder ?? 999);
      });
      const dayBody = sortedGids.map(gid => {
        const items = groupMap.get(gid);
        items.sort((a, b) => (Number(a.altOrder) || 0) - (Number(b.altOrder) || 0));
        return items.map(item => {
          const time = item.startTime + (item.endTime ? ` - ${item.endTime}` : '');
          const prefix = item.altOrder > 0 ? `  [備案 ${item.altOrder}]` : '-';
          const remarkStr = item.remark ? ` (${item.remark})` : '';
          return `${prefix} ${time} ${item.attractionName}${remarkStr}`;
        }).join('\n');
      }).join('\n');
      return `${dayHeader}\n${dayBody || '(無行程)'}`;
    }).join('\n\n');
    const title = tripInfo?.name || '我的旅遊計畫';
    const fullText = `--- ${title} ---\n\n${text}`;
    navigator.clipboard.writeText(fullText)
      .then(() => alert('已複製文字行程到剪貼簿！'))
      .catch(() => alert('複製失敗，請重試。'));
  }

  const handleShareCSV = () => {
    const headers = ['天數', '日期', '時間', '景點名稱', '是否為備案', '備忘/備註'];
    const rows = [];
    journeys.forEach(j => {
      const schedule = j.schedule || [];
      const groupMap = new Map();
      schedule.forEach(item => {
        const gid = item.groupId || item.id;
        if (!groupMap.has(gid)) groupMap.set(gid, []);
        groupMap.get(gid).push(item);
      });
      const sortedGids = Array.from(groupMap.keys()).sort((gidA, gidB) => {
        const pA = groupMap.get(gidA).find(i => Number(i.altOrder) === 0) || groupMap.get(gidA)[0];
        const pB = groupMap.get(gidB).find(i => Number(i.altOrder) === 0) || groupMap.get(gidB)[0];
        return (pA.sortOrder ?? 999) - (pB.sortOrder ?? 999);
      });
      sortedGids.forEach(gid => {
        const items = groupMap.get(gid);
        items.sort((a, b) => (Number(a.altOrder) || 0) - (Number(b.altOrder) || 0));
        items.forEach(item => {
          const time = item.startTime + (item.endTime ? ` - ${item.endTime}` : '');
          rows.push([`Day ${j.day}`, j.date, time, item.attractionName, item.altOrder > 0 ? `是 (備案 ${item.altOrder})` : '否', item.remark || '']);
        });
      });
    });
    const csvContent = [
      headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','),
      ...rows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${tripInfo?.name || 'travel_plan'}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // --- 資料加載/錯誤狀態處理渲染 ---
  if (isLoading) {
    return (
      <div className="loading-screen-full">
        <div className="loading-content-box">
          <Loader size={44} className="spin-icon text-[var(--primary-dark)] mb-2" />
          <h2 className="loading-title">
            正在載入行程，請稍候...
          </h2>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="loading-screen-full">
        <div className="loading-content-box">
          <h2 className="loading-title text-2xl">
            讀取失敗 🥲
          </h2>
          <p className="loading-subtitle mb-4">{error}</p>
          <button className="btn-esence-outline px-6 py-2" onClick={onBack}>返回首頁</button>
        </div>
      </div>
    )
  }

  // 取得目前選定天數對應的旅程資訊
  const currentJourney = journeys.find((j) => j.day === selectedDay) || journeys[0]

  // === 分組備案行程資料 ===
  const scheduleGroups = [];
  if (currentJourney?.schedule) {
    const groupMap = new Map();
    currentJourney.schedule.forEach(item => {
      const gid = item.groupId || item.id;
      if (!groupMap.has(gid)) groupMap.set(gid, []);
      groupMap.get(gid).push(item);
    });
    const sortedGroupIds = Array.from(groupMap.keys()).sort((gidA, gidB) => {
      const pA = groupMap.get(gidA).find(i => Number(i.altOrder) === 0) || groupMap.get(gidA)[0];
      const pB = groupMap.get(gidB).find(i => Number(i.altOrder) === 0) || groupMap.get(gidB)[0];
      
      const orderA = pA.sortOrder !== undefined && pA.sortOrder !== "" ? Number(pA.sortOrder) : 999;
      const orderB = pB.sortOrder !== undefined && pB.sortOrder !== "" ? Number(pB.sortOrder) : 999;

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
    sortedGroupIds.forEach(gid => {
      const gItems = groupMap.get(gid);
      gItems.sort((a, b) => (Number(a.altOrder) || 0) - (Number(b.altOrder) || 0));
      scheduleGroups.push({ id: gid, items: gItems });
    });
  }

  /**
   * handleCardSelect 點擊卡片動作
   * 在手機版會顯示彈出備註視窗，在網頁版（Desktop）則切換至右側表單編輯狀態
   */
  const handleCardSelect = (item) => {
    if (isMobile) {
      setRemarkItem(item)
    } else {
      // 網頁版：直接在右側顯示編輯表單
      setFormModal({
        mode: 'edit',
        item,
        day: item.day,
        date: item.date
      });
      setTripInfoModal(null);
      setTransportFormItem(null);
      setRemarkItem(null);
    }
  }

  // --- 決定當前選取的 ID (用於高亮顯示目前選取的卡片) ---
  const activeItemId = formModal?.mode === 'edit' ? formModal.item?.id : null;

  return (
    <div className="app-container min-h-screen bg-[#FAF8F5]">
      {/* ─── 全域頂部導覽列 (跨越整個畫面最上方) ─── */}
      <div className="top-navbar w-full flex items-center px-4 bg-white/70 glass border-b border-[var(--glass-border)] shrink-0" style={{ height: '56px' }}>
        {/* 左側 10%：返回按鈕 */}
        <div style={{ width: '10%', display: 'flex', justifyContent: 'flex-start', alignItems: 'center', flexShrink: 0 }}>
          <button
            className="back-btn flex items-center justify-center w-6 h-6 text-sm bg-[rgba(88,63,36,0.05)] border border-[rgba(88,63,36,0.1)] text-[var(--primary)] rounded cursor-pointer hover:bg-[var(--primary)] hover:text-white transition-colors"
            onClick={onBack}
            title="回首頁"
          >
            ←
          </button>
        </div>
        {/* 中間 80%：標題，超長顯示 ... */}
        <div style={{ width: '80%', overflow: 'hidden', padding: '0 0.5rem', flexShrink: 0 }}>
          <h1
            title={tripInfo?.name || '我的旅遊計畫'}
            style={{
              fontSize: '1.2rem',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              textAlign: 'center',
              color: 'var(--primary)',
              fontFamily: 'Noto Serif TC, serif',
              margin: 0,
            }}
          >
            {tripInfo?.name || '我的旅遊計畫'}
          </h1>
        </div>
        {/* 右側 10%：分享按鈕 */}
        <div style={{ width: '10%', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexShrink: 0 }}>
          <ShareMenu
            onShareLink={handleShareLink}
            onShareText={handleShareText}
            onShareCSV={handleShareCSV}
          />
        </div>
      </div>

      {/* ─── 下方主體版面配置 (在桌機版會呈現左右並排) ─── */}
      <div className="trip-main-layout flex-1 flex flex-col md:flex-row md:min-h-0 md:overflow-hidden">
        {/* ─── 左側天數欄 (手機版顯示在頂部，網頁版自動為 300px sidebar) ─── */}
        <header className="header glass bg-white/70 md:border-r border-[var(--glass-border)] shrink-0 flex flex-col">
          <div className="date-selector flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto px-4 py-3 shrink-0">
            {journeys.map((j) => {
              const isActive = selectedDay === j.day;
              if (j.day === 0) {
                return (
                  <button
                    key={j.day}
                    data-day={j.day}
                    className={`date-tab shrink-0 w-auto md:w-full min-h-[52px] ${isActive ? 'active' : ''}`}
                    onClick={(e) => {
                      setSelectedDay(j.day);
                      e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                      if (!isMobile) {
                        setFormModal(null);
                        setTripInfoModal(null);
                        setTransportFormItem(null);
                      }
                    }}
                  >
                    旅程資訊
                  </button>
                )
              }
              return (
                <button
                  key={j.day}
                  data-day={j.day}
                  className={`date-tab shrink-0 w-auto md:w-full min-h-[52px] ${isActive ? 'active' : ''}`}
                  onClick={(e) => {
                    setSelectedDay(j.day);
                    e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                    if (!isMobile) {
                      setFormModal(null);
                      setTripInfoModal(null);
                      setTransportFormItem(null);
                    }
                  }}
                >
                  <span>Day {j.day}</span>
                  <span className="date-sub">
                    {j.date ? j.date.slice(5) : ''}
                  </span>
                </button>
              )
            })}
          </div>
        </header>

        {/* ─── 中間與右側混合內容區 (Desktop 為並排 layout) ─── */}
        <div className="trip-content-wrapper flex-1 flex flex-col md:flex-row md:min-h-0 md:overflow-hidden">
          {/* 中間：行程卡片垂直列表 */}
          <main ref={mainContentRef} className="main-content flex-1 w-full md:w-1/2 md:overflow-y-auto px-4 md:px-6 py-6 md:border-r border-[var(--glass-border)]">
            <div className={`schedule-list flex flex-col gap-4 ${slideAnimation}`}>
              {selectedDay === 0 ? (
                <>
                  {/* 去程航班卡片 */}
                  <div className="card-wrapper w-full">
                    {tripsInfo && (tripsInfo.outboundFlightNo || tripsInfo.outboundAirline || tripsInfo.outboundDepartureTime || tripsInfo.outboundArrivalTime || tripsInfo.outboundDepAirport || tripsInfo.outboundArrAirport) ? (
                      <div
                        className={`card glass clickable flex flex-col relative ${!isReadOnly ? 'hover:border-[var(--primary-dark)]' : ''
                          } ${!isMobile && tripInfoModal?.type === 'outbound' ? 'active-card border-[var(--primary-dark)] shadow-md translate-y-[-2px]' : ''}`}
                        onClick={() => {
                          if (isMobile) {
                            if (!isReadOnly) setTripInfoModal({ type: 'outbound' });
                          } else {
                            setTripInfoModal({ type: 'outbound' });
                            setFormModal(null);
                          }
                        }}
                      >
                        <div className="card-header">
                          <span className="time">去程航班</span>
                          {!isReadOnly && (
                            <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                              <CardMenu
                                showAddBackup={false}
                                item={{ id: 'info-outbound' }}
                                onEdit={() => {
                                  if (isMobile) setTripInfoModal({ type: 'outbound' });
                                  else { setTripInfoModal({ type: 'outbound' }); setFormModal(null); }
                                }}
                                onDelete={() => setDeleteTripInfoType('outbound')}
                              />
                            </div>
                          )}
                        </div>
                        <div className="flight-row flex items-center gap-2 mt-2">
                          <Calendar size={16} className="text-[var(--text-muted)] shrink-0" />
                          <span className="flight-time-text font-semibold text-sm">
                            {tripsInfo.outboundDepartureTime ? formatDisplayDatetime(tripsInfo.outboundDepartureTime) : '起飛未定'}
                            {tripsInfo.outboundArrivalTime ? ` - ${formatDisplayDatetime(tripsInfo.outboundArrivalTime)}` : ''}
                          </span>
                        </div>
                        <div className="flight-row flex items-center gap-2 mt-1">
                          <Plane size={16} className="text-[var(--text-muted)] shrink-0" />
                          <span className="text-sm font-semibold">
                            {tripsInfo.outboundDepAirport || '?'} → {tripsInfo.outboundArrAirport || '?'}
                            <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">
                              {tripsInfo.outboundAirline || ''} {tripsInfo.outboundFlightNo || '未定航班'}
                            </span>
                          </span>
                        </div>
                        <hr className="card-divider mt-3 border-t border-dashed border-[var(--glass-border)]" />
                        <div className="flight-remark-wrap flex gap-1 text-xs text-[var(--text-muted)] mt-2">
                          <Info size={14} className="shrink-0 mt-0.5" />
                          <span className="remark-text white-space-pre-line">{tripsInfo.outboundFlightRemark ? truncateText(tripsInfo.outboundFlightRemark, 80) : '（無去程班機備註）'}</span>
                        </div>
                      </div>
                    ) : (
                      !isReadOnly && (
                        <div
                          className={`card glass info-card-placeholder flex flex-col items-center justify-center border-dashed border-2 py-6 cursor-pointer text-[var(--text-muted)] ${!isMobile && tripInfoModal?.type === 'outbound' ? 'border-[var(--primary-dark)] bg-white shadow-md' : ''
                            }`}
                          onClick={() => {
                            if (isMobile) setTripInfoModal({ type: 'outbound' });
                            else { setTripInfoModal({ type: 'outbound' }); setFormModal(null); }
                          }}
                        >
                          <span className="time mb-2">去程航班</span>
                          <Plus size={24} />
                          <span className="text-xs">新增去程航班資訊</span>
                        </div>
                      )
                    )}
                  </div>

                  {/* 回程航班卡片 */}
                  <div className="card-wrapper w-full">
                    {tripsInfo && (tripsInfo.inboundFlightNo || tripsInfo.inboundAirline || tripsInfo.inboundDepartureTime || tripsInfo.inboundArrivalTime || tripsInfo.inboundDepAirport || tripsInfo.inboundArrAirport) ? (
                      <div
                        className={`card glass clickable flex flex-col relative ${!isReadOnly ? 'hover:border-[var(--primary-dark)]' : ''
                          } ${!isMobile && tripInfoModal?.type === 'inbound' ? 'active-card border-[var(--primary-dark)] shadow-md translate-y-[-2px]' : ''}`}
                        onClick={() => {
                          if (isMobile) {
                            if (!isReadOnly) setTripInfoModal({ type: 'inbound' });
                          } else {
                            setTripInfoModal({ type: 'inbound' });
                            setFormModal(null);
                          }
                        }}
                      >
                        <div className="card-header">
                          <span className="time">回程航班</span>
                          {!isReadOnly && (
                            <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                              <CardMenu
                                showAddBackup={false}
                                item={{ id: 'info-inbound' }}
                                onEdit={() => {
                                  if (isMobile) setTripInfoModal({ type: 'inbound' });
                                  else { setTripInfoModal({ type: 'inbound' }); setFormModal(null); }
                                }}
                                onDelete={() => setDeleteTripInfoType('inbound')}
                              />
                            </div>
                          )}
                        </div>
                        <div className="flight-row flex items-center gap-2 mt-2">
                          <Calendar size={16} className="text-[var(--text-muted)] shrink-0" />
                          <span className="flight-time-text font-semibold text-sm">
                            {tripsInfo.inboundDepartureTime ? formatDisplayDatetime(tripsInfo.inboundDepartureTime) : '起飛未定'}
                            {tripsInfo.inboundArrivalTime ? ` - ${formatDisplayDatetime(tripsInfo.inboundArrivalTime)}` : ''}
                          </span>
                        </div>
                        <div className="flight-row flex items-center gap-2 mt-1">
                          <Plane size={16} className="text-[var(--text-muted)] shrink-0" />
                          <span className="text-sm font-semibold">
                            {tripsInfo.inboundDepAirport || '?'} → {tripsInfo.inboundArrAirport || '?'}
                            <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">
                              {tripsInfo.inboundAirline || ''} {tripsInfo.inboundFlightNo || '未定航班'}
                            </span>
                          </span>
                        </div>
                        <hr className="card-divider mt-3 border-t border-dashed border-[var(--glass-border)]" />
                        <div className="flight-remark-wrap flex gap-1 text-xs text-[var(--text-muted)] mt-2">
                          <Info size={14} className="shrink-0 mt-0.5" />
                          <span className="remark-text white-space-pre-line">{tripsInfo.inboundFlightRemark ? truncateText(tripsInfo.inboundFlightRemark, 80) : '（無回程班機備註）'}</span>
                        </div>
                      </div>
                    ) : (
                      !isReadOnly && (
                        <div
                          className={`card glass info-card-placeholder flex flex-col items-center justify-center border-dashed border-2 py-6 cursor-pointer text-[var(--text-muted)] ${!isMobile && tripInfoModal?.type === 'inbound' ? 'border-[var(--primary-dark)] bg-white shadow-md' : ''
                            }`}
                          onClick={() => {
                            if (isMobile) setTripInfoModal({ type: 'inbound' });
                            else { setTripInfoModal({ type: 'inbound' }); setFormModal(null); }
                          }}
                        >
                          <span className="time mb-2">回程航班</span>
                          <Plus size={24} />
                          <span className="text-xs">新增回程航班資訊</span>
                        </div>
                      )
                    )}
                  </div>

                  {/* 行程備註卡片 */}
                  <div className="card-wrapper w-full">
                    {tripsInfo && tripsInfo.tripRemark ? (
                      <div
                        className={`card glass clickable flex flex-col relative ${!isReadOnly ? 'hover:border-[var(--primary-dark)]' : ''
                          } ${!isMobile && tripInfoModal?.type === 'remark' ? 'active-card border-[var(--primary-dark)] shadow-md translate-y-[-2px]' : ''}`}
                        onClick={() => {
                          if (isMobile) {
                            if (!isReadOnly) setTripInfoModal({ type: 'remark' });
                          } else {
                            setTripInfoModal({ type: 'remark' });
                            setFormModal(null);
                          }
                        }}
                      >
                        <div className="card-header">
                          <span className="time">行程備註</span>
                          {!isReadOnly && (
                            <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                              <CardMenu
                                showAddBackup={false}
                                item={{ id: 'info-remark' }}
                                onEdit={() => {
                                  if (isMobile) setTripInfoModal({ type: 'remark' });
                                  else { setTripInfoModal({ type: 'remark' }); setFormModal(null); }
                                }}
                                onDelete={() => setDeleteTripInfoType('remark')}
                              />
                            </div>
                          )}
                        </div>
                        <hr className="card-divider mt-2 border-t border-dashed border-[var(--glass-border)]" />
                        <div className="flight-remark-wrap flex gap-2 text-sm mt-2 text-[var(--text-main)]">
                          <Info size={16} className="shrink-0 mt-0.5 text-[var(--text-muted)]" />
                          <span className="remark-text whitespace-pre-line leading-relaxed">{truncateText(tripsInfo.tripRemark, 120)}</span>
                        </div>
                      </div>
                    ) : (
                      !isReadOnly && (
                        <div
                          className={`card glass info-card-placeholder flex flex-col items-center justify-center border-dashed border-2 py-6 cursor-pointer text-[var(--text-muted)] ${!isMobile && tripInfoModal?.type === 'remark' ? 'border-[var(--primary-dark)] bg-white shadow-md' : ''
                            }`}
                          onClick={() => {
                            if (isMobile) setTripInfoModal({ type: 'remark' });
                            else { setTripInfoModal({ type: 'remark' }); setFormModal(null); }
                          }}
                        >
                          <span className="time mb-2">行程備註</span>
                          <Plus size={24} />
                          <span className="text-xs">新增行程備註</span>
                        </div>
                      )
                    )}
                  </div>
                </>
              ) : (
                // ─── 當選取特定 Day 時，渲染行程排序清單 ───
                isReadOnly ? (
                  scheduleGroups.map((group, idx) => {
                    const nextTargetItem = scheduleGroups[idx + 1]?.items?.find(i => Number(i.altOrder) === 0) || scheduleGroups[idx + 1]?.items?.[0];
                    return (
                      <div key={group.id} className="sortable-group-wrapper w-full flex flex-col">
                        <div className="horizontal-scroll w-full">
                          {group.items.map((item, altIdx) => (
                            <div key={item.id} className="card-wrapper w-full">
                              <Card
                                item={item}
                                isActive={activeItemId === item.id}
                                onClick={() => handleCardSelect(item)}
                                onMap={(e) => handleMap(e, item)}
                                isReadOnly={true}
                              />
                            </div>
                          ))}
                        </div>
                        {/* 卡片之間的連接交通箭頭 */}
                        {idx < scheduleGroups.length - 1 && (
                          <TransportArrow
                            targetItem={nextTargetItem}
                            onEditTransport={(it) => {
                              if (isMobile) {
                                setTransportModalItem(it);
                              } else {
                                setTransportFormItem(it);
                                setFormModal(null);
                                setTripInfoModal(null);
                              }
                            }}
                            isReadOnly={true}
                          />
                        )}
                      </div>
                    )
                  })
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
                    <SortableContext items={scheduleGroups.map(g => g.id)} strategy={verticalListSortingStrategy}>
                      {scheduleGroups.map((group, idx) => {
                        const nextTargetItem = scheduleGroups[idx + 1]?.items?.find(i => Number(i.altOrder) === 0) || scheduleGroups[idx + 1]?.items?.[0];
                        return (
                          <div key={group.id} className="sortable-group-wrapper w-full flex flex-col">
                            <SortableGroup
                              id={group.id}
                              groupItems={group.items}
                              activeItemId={activeItemId}
                              onClick={handleCardSelect}
                              onMap={handleMap}
                              onEdit={(it) => {
                                if (isMobile) setFormModal({ mode: 'edit', item: it });
                                else { setFormModal({ mode: 'edit', item: it }); setTripInfoModal(null); setTransportFormItem(null); }
                              }}
                              onDelete={(it) => setDeleteItem(it)}
                              onCopy={handleCopySchedule}
                              onAddBackup={handleAddBackup}
                              onMoveDay={(it) => setMoveModalItem(it)}
                              isReadOnly={isReadOnly}
                            />
                            {/* 卡片之間的連接交通箭頭 */}
                            {idx < scheduleGroups.length - 1 && (
                              <TransportArrow
                                targetItem={nextTargetItem}
                                onEditTransport={(it) => {
                                  if (isMobile) {
                                    setTransportModalItem(it);
                                  } else {
                                    setTransportFormItem(it);
                                    setFormModal(null);
                                    setTripInfoModal(null);
                                  }
                                }}
                                isReadOnly={isReadOnly}
                              />
                            )}
                          </div>
                        )
                      })}
                    </SortableContext>
                  </DndContext>
                )
              )}

              {/* 若當天無行程，顯示提示文字 */}
              {selectedDay !== 0 && (!scheduleGroups || scheduleGroups.length === 0) && (
                <div className="add-card-container text-center py-8 opacity-60">
                  <div className="card glass py-8">
                    <h3 className="attraction-name font-serif text-[var(--primary)] text-lg">這天還沒有安排行程喔！</h3>
                  </div>
                </div>
              )}

              {/* 新增行程按鈕 */}
              {selectedDay !== 0 && !isReadOnly && (
                <div className="add-card-container w-full mt-2">
                  <AddCard onClick={() => {
                    const targetState = { mode: 'add', day: currentJourney?.day, date: currentJourney?.date };
                    if (isMobile) setFormModal(targetState);
                    else { setFormModal(targetState); setTripInfoModal(null); }
                  }} />
                </div>
              )}
            </div>
          </main>

          {/* ─── 右側編輯欄位區 (限網頁版/桌面版顯示) ─── */}
          {!isMobile && (
            <aside className="edit-panel w-full md:w-1/2 shrink-0 border-l border-[var(--glass-border)] bg-white flex flex-col h-full overflow-hidden">
              {formModal ? (
                // 渲染行程表單
                <ScheduleForm
                  key={`${formModal.mode}-${formModal.item?.id || formModal.day}-${formModal.altOrder || 0}`}
                  mode={formModal.mode}
                  item={formModal.item}
                  day={formModal.mode === 'add' ? formModal.day : formModal.item?.day}
                  date={formModal.mode === 'add' ? formModal.date : formModal.item?.date}
                  groupId={formModal.groupId}
                  altOrder={formModal.altOrder}
                  tripId={tripId}
                  daySchedules={journeys.find(j => j.day === (formModal.mode === 'add' ? formModal.day : formModal.item?.day))?.schedule || []}
                  setActionLoading={setActionLoading}
                  onSaved={(savedItem, updatedDaySchedules) => {
                    setJourneys(prev => prev.map(j => {
                      if (j.day === savedItem.day) {
                        return {
                          ...j,
                          schedule: updatedDaySchedules || (formModal.mode === 'edit'
                            ? j.schedule.map(si => si.id === savedItem.id ? { ...si, ...savedItem, isDefaultPlaceholder: false } : si)
                            : [...(j.schedule || []), savedItem])
                        };
                      }
                      return j;
                    }));
                    setFormModal(null);
                  }}
                  onCancel={() => setFormModal(null)}
                />
              ) : tripInfoModal ? (
                // 渲染航班/備註資訊表單
                <TripInfoForm
                  type={tripInfoModal.type}
                  tripId={tripId}
                  initialData={tripsInfo}
                  onSaved={(updatedFields) => {
                    setTripsInfo(prev => ({
                      ...prev,
                      ...updatedFields
                    }));
                    setTripInfoModal(null);
                  }}
                  onCancel={() => setTripInfoModal(null)}
                />
              ) : transportFormItem ? (
                // 渲染交通方式表單 (網頁版右側欄位)
                <TransportForm
                  item={transportFormItem}
                  onSaved={(savedItem) => {
                    setJourneys(prev => prev.map(j => {
                      if (j.day === savedItem.day) {
                        const newSchedule = j.schedule.map(si => si.id === savedItem.id ? { ...si, ...savedItem } : si);
                        return { ...j, schedule: newSchedule };
                      }
                      return j;
                    }));
                    setTransportFormItem(null);
                  }}
                  onCancel={() => setTransportFormItem(null)}
                />
              ) : (
                // 預設空區塊狀態 (顯示 Placeholder，使用 margin: auto 置中並加上精緻金屬色虛線框)
                <div className="edit-placeholder text-center">
                  <FileText size={48} className="text-[var(--primary-dark)] opacity-50 mb-4" />
                  <h3 className="text-[var(--primary)] font-serif text-lg font-semibold mb-2">請選擇行程</h3>
                  <p className="text-xs text-[var(--text-muted)] max-w-[240px] leading-relaxed">
                    點選左側行程卡片或新增按鈕，即可在此區塊直接編輯行程、航班與備註內容。
                  </p>
                </div>
              )}
            </aside>
          )}
        </div>
      </div> {/* ─── 關閉下方主體版面配置 trip-main-layout ─── */}

      {/* ─── 以下為手機版/特定操作所需的 Dialog Modals ─── */}

      {/* 備註彈窗（對齊原版 travel-app Modal 架構，套用新版統一色調） */}
      {remarkItem && (
        <div className="modal-overlay" onClick={() => setRemarkItem(null)}>
          <div className="modal-content glass" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setRemarkItem(null)}>
              <X size={20} />
            </button>
            <h2 className="modal-title">{remarkItem.attractionName}</h2>
            <hr className="modal-divider" />
            <p className="modal-text">{remarkItem.remark || '（無備註）'}</p>
          </div>
        </div>
      )}

      {/* 手機版：行程編輯彈窗 */}
      {isMobile && formModal && (
        <ScheduleFormModal
          key={`${formModal.mode}-${formModal.item?.id || formModal.day}-${formModal.altOrder || 0}`}
          mode={formModal.mode}
          item={formModal.item}
          day={formModal.mode === 'add' ? formModal.day : formModal.item?.day}
          date={formModal.mode === 'add' ? formModal.date : formModal.item?.date}
          groupId={formModal.groupId}
          altOrder={formModal.altOrder}
          tripId={tripId}
          daySchedules={journeys.find(j => j.day === (formModal.mode === 'add' ? formModal.day : formModal.item?.day))?.schedule || []}
          setActionLoading={setActionLoading}
          onClose={() => setFormModal(null)}
          onSaved={(savedItem, updatedDaySchedules) => {
            setJourneys(prev => prev.map(j => {
              if (j.day === savedItem.day) {
                return {
                  ...j,
                  schedule: updatedDaySchedules || (formModal.mode === 'edit'
                    ? j.schedule.map(si => si.id === savedItem.id ? { ...si, ...savedItem, isDefaultPlaceholder: false } : si)
                    : [...(j.schedule || []), savedItem])
                };
              }
              return j;
            }));
            setFormModal(null);
          }}
        />
      )}

      {/* 手機版：去回程/備註編輯彈窗 */}
      {isMobile && tripInfoModal && (
        <TripInfoFormModal
          type={tripInfoModal.type}
          tripId={tripId}
          initialData={tripsInfo}
          onClose={() => setTripInfoModal(null)}
          onSaved={(updatedFields) => {
            setTripsInfo(prev => ({
              ...prev,
              ...updatedFields
            }));
            setTripInfoModal(null);
          }}
        />
      )}

      {/* 刪除行程項目確認 Modal (無論網頁或手機版均可沿用 Dialog 以確保安全) */}
      {deleteItem && (
        <DeleteConfirmModal
          item={deleteItem}
          onClose={() => setDeleteItem(null)}
          onDeleted={() => {
            setJourneys(prev => prev.map(j => ({ ...j, schedule: j.schedule?.filter(si => si.id !== deleteItem.id) || [] })));
            setDeleteItem(null);
          }}
        />
      )}

      {/* 刪除去回程或備註確認 Modal */}
      {deleteTripInfoType && (
        <DeleteConfirmModal
          item={{
            id: deleteTripInfoType,
            attractionName: deleteTripInfoType === 'outbound' ? '去程航班資訊' : deleteTripInfoType === 'inbound' ? '回程航班資訊' : '行程備註'
          }}
          onClose={() => setDeleteTripInfoType(null)}
          onDeleted={() => setDeleteTripInfoType(null)}
          onConfirm={async () => {
            const dataToClear = {};
            if (deleteTripInfoType === 'outbound') {
              dataToClear.outboundFlightNo = '';
              dataToClear.outboundAirline = '';
              dataToClear.outboundDepartureTime = '';
              dataToClear.outboundArrivalTime = '';
              dataToClear.outboundDepAirport = '';
              dataToClear.outboundArrAirport = '';
              dataToClear.outboundFlightRemark = '';
            } else if (deleteTripInfoType === 'inbound') {
              dataToClear.inboundFlightNo = '';
              dataToClear.inboundAirline = '';
              dataToClear.inboundDepartureTime = '';
              dataToClear.inboundArrivalTime = '';
              dataToClear.inboundDepAirport = '';
              dataToClear.inboundArrAirport = '';
              dataToClear.inboundFlightRemark = '';
            } else if (deleteTripInfoType === 'remark') {
              dataToClear.tripRemark = '';
            }

            await apiService.updateTripInfo(tripId, dataToClear);

            setTripsInfo(prev => ({
              ...prev,
              ...dataToClear
            }));
            if (!isMobile) {
              setTripInfoModal(null);
            }
          }}
        />
      )}

      {/* 交通方式編輯彈窗 */}
      {transportModalItem && (
        <TransportFormModal
          item={transportModalItem}
          onClose={() => setTransportModalItem(null)}
          onSaved={(savedItem) => {
            setJourneys(prev => prev.map(j => {
              if (j.day === savedItem.day) {
                const newSchedule = j.schedule.map(si => si.id === savedItem.id ? { ...si, ...savedItem } : si);
                return { ...j, schedule: newSchedule };
              }
              return j;
            }));
            setTransportModalItem(null);
          }}
        />
      )}

      {/* 跨天數移動行程彈窗 */}
      {moveModalItem && (
        <MoveDayModal
          item={moveModalItem}
          currentDay={moveModalItem.day}
          journeys={journeys}
          onSelectDay={handleMoveGroupToDay}
          onClose={() => setMoveModalItem(null)}
        />
      )}

      {/* ─── 全域快捷 API 操作 Loading 遮罩 ─── */}
      {actionLoading && (
        <div className="action-loading-overlay">
          <div className="action-loading-card">
            <Loader size={20} className="spin-icon" style={{ display: 'inline' }} />
            <span>{actionLoading}</span>
          </div>
        </div>
      )}
    </div>
  )
}
