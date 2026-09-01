import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Plus, X, Save, Star, Loader } from 'lucide-react'
import { apiService } from '../services/apiService'
import DeleteConfirmModal from './DeleteConfirmModal'
import './PackingListPage.css'

// ─── 新增品項 Modal ────────────────────────────────────────────
function AddItemModal({ onClose, onAdd, isSaving }) {
  const [name, setName] = useState('')
  const [isEssential, setIsEssential] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('品項名稱為必填欄位')
      return
    }
    onAdd({ name: name.trim(), isEssential })
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass form-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="form-modal-header">
          <div>
            <h2 className="modal-title">新增攜帶品項</h2>
            <p className="modal-subtitle">新增一個需要攜帶的物品</p>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="form-modal-body">
          <form className="schedule-form" id="addPackingItemForm" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>
                品項名稱 <span className="required">*</span>
              </label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例：護照、充電器、換洗衣物"
                disabled={isSaving}
              />
            </div>

            {/* 必備 checkbox — 統一色彩系統 */}
            <div className="packing-essential-check">
              <label
                className="packing-checkbox-label"
                style={{ cursor: isSaving ? 'not-allowed' : 'pointer' }}
                onClick={() => !isSaving && setIsEssential((v) => !v)}
              >
                {/* 自訂外框 */}
                <span
                  style={{
                    display: 'inline-flex',
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    border: isEssential ? '2px solid var(--primary)' : '2px solid rgba(88,63,36,0.2)',
                    background: isEssential
                      ? 'linear-gradient(135deg, var(--primary-dark), var(--primary))'
                      : 'rgba(255,255,255,0.7)',
                    flexShrink: 0,
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                    position: 'relative',
                  }}
                >
                  {isEssential && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className="packing-check-text">
                  <Star
                    size={13}
                    style={{
                      display: 'inline',
                      marginRight: 4,
                      verticalAlign: 'middle',
                      color: isEssential ? '#f6ad55' : 'var(--text-muted)',
                    }}
                  />
                  標記為必備品項
                </span>
              </label>
            </div>

            {error && <p className="form-error">{error}</p>}
          </form>
        </div>

        {/* Footer */}
        <div className="form-modal-footer">
          <button type="button" className="btn-cancel" onClick={onClose} disabled={isSaving}>
            取消
          </button>
          <button type="submit" form="addPackingItemForm" className="btn-save" disabled={isSaving}>
            {isSaving ? <Loader size={16} className="spin-icon" /> : <Save size={16} />}
            {isSaving ? '新增中...' : '新增'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── 主元件 ────────────────────────────────────────────────────
export default function PackingListPage({ onBack }) {
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [deletingItem, setDeletingItem] = useState(null) // { itemId, name }

  // ── 載入清單 ──────────────────────────────────────────────────
  const fetchItems = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await apiService.getPackingItems()
      // 確保 isEssential 和 checked 為 boolean
      const normalized = (Array.isArray(data) ? data : []).map((item) => ({
        ...item,
        isEssential: typeof item.isEssential === 'boolean' ? item.isEssential : String(item.isEssential).toUpperCase() === 'TRUE',
        checked: typeof item.checked === 'boolean' ? item.checked : String(item.checked).toUpperCase() === 'TRUE',
      }))
      setItems(normalized)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchItems() }, [])

  // ── 新增 ──────────────────────────────────────────────────────
  const handleAdd = async ({ name, isEssential }) => {
    setIsSaving(true)
    try {
      await apiService.addPackingItem({ name, isEssential })
      await fetchItems()
      setShowAddModal(false)
    } catch (err) {
      console.error('新增失敗:', err)
    } finally {
      setIsSaving(false)
    }
  }

  // ── 勾選切換 ─────────────────────────────────────────────────
  const handleToggle = async (item) => {
    const newChecked = !item.checked
    // Optimistic update
    setItems((prev) =>
      prev.map((i) => (i.itemId === item.itemId ? { ...i, checked: newChecked } : i))
    )
    try {
      await apiService.togglePackingItem(item.itemId, newChecked)
    } catch (err) {
      // rollback
      setItems((prev) =>
        prev.map((i) => (i.itemId === item.itemId ? { ...i, checked: item.checked } : i))
      )
      console.error('切換失敗:', err)
    }
  }

  // ── 刪除（交給 DeleteConfirmModal 執行） ──────────────────────
  const handleDeleteConfirm = async () => {
    await apiService.deletePackingItem(deletingItem.itemId)
  }

  const handleDeleteDone = () => {
    setItems((prev) => prev.filter((i) => i.itemId !== deletingItem.itemId))
    setDeletingItem(null)
  }

  const checkedCount = items.filter((i) => i.checked).length
  const totalCount = items.length

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="packing-page">
      {/* ── Header ───────────────────────────────────────── */}
      <header className="packing-header glass">
        <div className="packing-header-row">
          <button className="back-btn" onClick={onBack} title="返回">
            ←
          </button>
          <div className="packing-title-wrap">
            <h1 className="packing-title">旅行攜帶清單</h1>
            {!isLoading && (
              <span className="packing-progress">
                {checkedCount} / {totalCount} 已確認
              </span>
            )}
          </div>
        </div>
        {!isLoading && totalCount > 0 && (
          <div className="packing-progress-bar-wrap">
            <div
              className="packing-progress-bar"
              style={{ width: `${(checkedCount / totalCount) * 100}%` }}
            />
          </div>
        )}
      </header>

      {/* ── Body ─────────────────────────────────────────── */}
      <main className="packing-body">
        {isLoading ? (
          <div className="loading-content-box py-20 mx-auto">
            <Loader size={36} className="spin-icon text-[var(--primary-dark)]" />
            <span className="loading-text">載入中...</span>
          </div>
        ) : error ? (
          <div className="packing-empty">
            <p style={{ color: '#e53e3e' }}>載入失敗：{error}</p>
            <button className="btn-cancel" style={{ marginTop: '1rem' }} onClick={fetchItems}>
              重試
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="packing-empty">
            <p>清單是空的，快新增第一項攜帶物品吧！</p>
          </div>
        ) : (
          <ul className="packing-list">
            {items.map((item) => (
              <li
                key={item.itemId}
                className={`packing-item glass${item.checked ? ' packing-item--checked' : ''}`}
              >
                {/* 自訂 Checkbox — 統一深木褐質感 */}
                <label
                  className="packing-item-check-label"
                  onClick={() => handleToggle(item)}
                  style={{ cursor: 'pointer' }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      border: item.checked ? '2px solid var(--primary)' : '2px solid rgba(88,63,36,0.2)',
                      background: item.checked
                        ? 'linear-gradient(135deg, var(--primary-dark), var(--primary))'
                        : 'rgba(255,255,255,0.7)',
                      flexShrink: 0,
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s',
                    }}
                  >
                    {item.checked && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                </label>

                {/* 品項名稱 */}
                <span className="packing-item-name">
                  {item.isEssential && (
                    <Star size={12} className="packing-essential-star" title="必備品項" />
                  )}
                  {item.name}
                </span>

                {/* 刪除按鈕 */}
                <button
                  className="packing-delete-btn"
                  onClick={() => setDeletingItem(item)}
                  title="刪除"
                >
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer className="packing-footer">
        <button
          className="home-add-trip-btn"
          onClick={() => setShowAddModal(true)}
          disabled={isLoading}
        >
          <Plus size={24} />
          <span>新增品項</span>
        </button>
      </footer>

      {/* ── 新增 Modal ────────────────────────────────────── */}
      {showAddModal && (
        <AddItemModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAdd}
          isSaving={isSaving}
        />
      )}

      {/* ── 刪除確認 Modal ────────────────────────────────── */}
      {deletingItem && (
        <DeleteConfirmModal
          item={{ attractionName: deletingItem.name }}
          onClose={() => setDeletingItem(null)}
          onConfirm={handleDeleteConfirm}
          onDeleted={handleDeleteDone}
        />
      )}
    </div>
  )
}
