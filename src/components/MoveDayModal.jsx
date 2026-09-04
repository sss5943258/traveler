import { createPortal } from 'react-dom'
import { X, Calendar, ArrowRightLeft } from 'lucide-react'
import './Modals.css'

/**
 * MoveDayModal 元件 (將行程移動至其他天數之選擇彈窗)
 * @param {Object} props.item 欲移動的行程物件
 * @param {number} props.currentDay 目前行程所在的天數
 * @param {Array} props.journeys 旅行計畫中所有的天數行程資料陣列
 * @param {Function} props.onSelectDay 選擇目標天數後的回呼函式 (targetDay, targetDate)
 * @param {Function} props.onClose 關閉彈窗的回呼函式
 */
export default function MoveDayModal({ item, currentDay, journeys = [], onSelectDay, onClose }) {
  // 過濾掉 Day 0 (旅程資訊)，只保留實際天數 (Day 1, Day 2...)
  const validJourneys = journeys.filter(j => j.day > 0)

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass move-day-modal" onClick={(e) => e.stopPropagation()}>
        {/* 彈窗頂部 */}
        <div className="form-modal-header">
          <div>
            <h2 className="modal-title flex items-center gap-2">
              <ArrowRightLeft size={20} className="text-[var(--primary-dark)]" />
              移動行程至其他天
            </h2>
            <p className="modal-subtitle">
              將「{item?.attractionName}」移動至指定那一天的最後
            </p>
          </div>
          <button className="close-btn" onClick={onClose} title="關閉">
            <X size={20} />
          </button>
        </div>

        {/* 彈窗內文：天數列表 */}
        <div className="move-day-body">
          <div className="move-day-list">
            {validJourneys.map((j) => {
              const isCurrent = j.day === currentDay
              return (
                <button
                  key={j.day}
                  type="button"
                  className={`move-day-btn ${isCurrent ? 'is-current' : ''}`}
                  disabled={isCurrent}
                  onClick={() => onSelectDay(j.day, j.date)}
                >
                  <div className="move-day-btn-left">
                    <Calendar size={18} className="move-day-icon" />
                    <div className="move-day-info">
                      <span className="move-day-title">Day {j.day}</span>
                      <span className="move-day-date">{j.date || '無日期'}</span>
                    </div>
                  </div>
                  {isCurrent && <span className="move-day-tag">當前天數</span>}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
