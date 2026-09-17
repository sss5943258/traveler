import React, { useState, useEffect, useCallback } from 'react'
import { Modal, Input, Button, List, Avatar, Tag, Popconfirm, Spin, Tooltip, message } from 'antd'
import { UserPlus, Users, Trash2, Mail, Crown, ShieldAlert } from 'lucide-react'
import { apiService } from '../services/apiService'

/**
 * CollaboratorsModal 元件 (編輯旅程共編者彈窗)
 * 
 * 核心功能：
 * 1. 顯示旅程擁有者 (Owner) 與現有共編者名單 (Collaborators)
 * 2. 透過 Google Email 邀請新夥伴加入共編
 * 3. 支援移除共編者，並透過 Ant Design Popconfirm 進行防呆二次確認
 * 
 * @param {Object} props
 * @param {Object} props.trip - 當前選定之旅程物件 (包含 tripId, name 等)
 * @param {Function} props.onClose - 關閉 Modal 的 callback 函式
 */
export default function CollaboratorsModal({ trip, onClose }) {
  // tripId 與旅程名稱提取
  const tripId = trip?.tripId
  const tripName = trip?.name || '旅遊計畫'

  // emailInput 狀態：記錄輸入框中的 Email 字串
  const [emailInput, setEmailInput] = useState('')

  // owner 狀態：儲存旅程擁有者資訊 { userId, email, name, picture }
  const [owner, setOwner] = useState(null)

  // collaborators 狀態：儲存當前旅程的共編者列表
  const [collaborators, setCollaborators] = useState([])

  // isLoading 狀態：控制初始讀取名單時的載入旋轉圖示
  const [isLoading, setIsLoading] = useState(true)

  // isSubmitting 狀態：標記是否正在呼叫「新增共編者」API
  const [isSubmitting, setIsSubmitting] = useState(false)

  // removingEmail 狀態：記錄當下正在被移除的共編者 Email，用於單一按鈕的 Loading 顯示
  const [removingEmail, setRemovingEmail] = useState(null)

  // errorMessage 狀態：記錄全域錯誤提示
  const [errorMessage, setErrorMessage] = useState(null)

  /**
   * fetchCollaborators 函式
   * 向後端 API 取得此旅程的擁有者與共編者清單
   * 使用 useCallback 包裹，確保在 useEffect 或新增/刪除後可重複呼叫
   */
  const fetchCollaborators = useCallback(async () => {
    if (!tripId) return
    setIsLoading(true)
    setErrorMessage(null)

    try {
      const res = await apiService.getCollaborators(tripId)
      if (res.status === 'success') {
        setOwner(res.owner || null)
        setCollaborators(Array.isArray(res.collaborators) ? res.collaborators : [])
      } else {
        setErrorMessage(res.message || '無法取得共編者名單')
      }
    } catch (err) {
      console.error('[CollaboratorsModal] 讀取共編者失敗:', err)
      setErrorMessage(err.message || '網路連線異常，無法讀取共編者名單')
    } finally {
      setIsLoading(false)
    }
  }, [tripId])

  // 元件掛載 (Mount) 時觸發一次名單查詢
  useEffect(() => {
    fetchCollaborators()
  }, [fetchCollaborators])

  /**
   * handleAddCollaborator 函式
   * 驗證 Email 格式與重複性，並呼叫 API 新增共編者
   */
  const handleAddCollaborator = async () => {
    const targetEmail = emailInput.trim().toLowerCase()

    // 1. 基本非空驗證
    if (!targetEmail) {
      message.warning('請輸入共編者的 Google Email')
      return
    }

    // 2. Email 格式正規表達式驗證
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(targetEmail)) {
      message.warning('Email 格式不正確，請重新輸入')
      return
    }

    // 3. 防呆：不可將擁有者自己加入共編
    if (owner?.email && owner.email.toLowerCase() === targetEmail) {
      message.warning('你已經是此旅程的擁有者，不需重複加入！')
      return
    }

    // 4. 防呆：不可重複加入已在清單中的共編者
    const isAlreadyCollab = collaborators.some(
      (c) => (c.userEmail || '').toLowerCase() === targetEmail
    )
    if (isAlreadyCollab) {
      message.warning('該 Email 已經在共編者名單中！')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await apiService.addCollaborator(tripId, targetEmail)
      if (res.status === 'success') {
        message.success('已成功新增共編者！')
        setEmailInput('') // 清空輸入框
        // 若後端直接回傳最新名單，直接覆蓋 State（省去二次 GET 請求）
        if (res.collaborators) {
          setCollaborators(res.collaborators)
          if (res.owner) setOwner(res.owner)
        } else {
          await fetchCollaborators() // 相容舊版 fallback
        }
      } else {
        message.error(res.message || '新增共編者失敗')
      }
    } catch (err) {
      console.error('[CollaboratorsModal] 新增共編者失敗:', err)
      message.error(err.message || '新增共編者時發生錯誤')
    } finally {
      setIsSubmitting(false)
    }
  }

  /**
   * handleRemoveCollaborator 函式
   * 當使用者在 Popconfirm 中確認移除時呼叫
   * @param {string} targetEmail - 要移除的共編者 Email
   */
  const handleRemoveCollaborator = async (targetEmail) => {
    setRemovingEmail(targetEmail)
    try {
      const res = await apiService.removeCollaborator(tripId, targetEmail)
      if (res.status === 'success') {
        message.success('已成功移除共編者')
        // 若後端直接回傳最新名單，直接覆蓋 State（省去二次 GET 請求）
        if (res.collaborators) {
          setCollaborators(res.collaborators)
          if (res.owner) setOwner(res.owner)
        } else {
          await fetchCollaborators() // 相容舊版 fallback
        }
      } else {
        message.error(res.message || '移除共編者失敗')
      }
    } catch (err) {
      console.error('[CollaboratorsModal] 移除共編者失敗:', err)
      message.error(err.message || '移除共編者時發生錯誤')
    } finally {
      setRemovingEmail(null)
    }
  }

  /**
   * getInitials 輔助函式
   * 當使用者沒有頭像圖片時，取姓名或 Email 的前兩個字母作為 Avatar 預設顯示文字
   * @param {string} name - 使用者名稱或 Email
   * @returns {string} 縮寫字元
   */
  const getInitials = (name) => {
    if (!name) return '?'
    return name.slice(0, 2).toUpperCase()
  }

  return (
    <Modal
      open={true}
      onCancel={onClose}
      footer={null}
      centered
      width={520}
      destroyOnClose
      maskClosable={!isSubmitting && !removingEmail}
      className="collaborators-modal"
      title={
        <div className="flex flex-col text-base font-semibold text-[var(--text-main,#2C2A29)]">
          <span>編輯共編者</span>
          <span className="text-xs font-normal text-[var(--text-muted,#78716c)] truncate max-w-[340px]">
            {tripName}
          </span>
        </div>
      }
    >
      <div className="py-2 flex flex-col gap-4">
        {/* 新增共編者區塊 */}
        <div className="p-3 rounded-xl bg-[rgba(88,63,36,0.03)] border border-[rgba(88,63,36,0.1)] flex flex-col gap-2">
          <label className="text-xs font-medium text-[var(--text-muted,#78716c)] flex items-center gap-1.5">
            <UserPlus size={14} />
            <span>邀請夥伴共同編輯 (Google Email)</span>
          </label>
          <div className="flex gap-2">
            <Input
              prefix={<Mail size={15} className="text-gray-400" />}
              placeholder="輸入夥伴的 Gmail / Google Email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onPressEnter={handleAddCollaborator}
              disabled={isSubmitting}
              allowClear
              className="rounded-lg h-10 text-sm"
            />
            <Button
              type="primary"
              onClick={handleAddCollaborator}
              loading={isSubmitting}
              className="h-10 px-4 rounded-lg font-medium bg-[var(--primary,#583f24)] hover:!bg-[var(--primary-dark,#432f1a)] border-none text-white shrink-0 flex items-center justify-center"
            >
              <span>新增</span>
            </Button>
          </div>
          <p className="text-[11px] text-[var(--text-muted,#a8a29e)] m-0 leading-tight">
            💡 被邀請者使用該 Google 帳號登入系統後，將自動在首頁看見此行程並參與編輯。
          </p>
        </div>

        {/* 錯誤提示 Banner */}
        {errorMessage && (
          <div className="px-3 py-2 rounded-lg text-xs bg-red-50 border border-red-200 text-red-700 flex items-center gap-2">
            <ShieldAlert size={16} className="shrink-0 text-red-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 名單區塊 */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-muted,#78716c)] tracking-wide uppercase">
              成員名單 ({1 + collaborators.length})
            </span>
            {isLoading && <Spin size="small" />}
          </div>

          <div className="max-h-[300px] overflow-y-auto pr-1 flex flex-col gap-1.5">
            {/* 1. 擁有者 (Owner) 列 */}
            {owner && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[rgba(0,0,0,0.06)] shadow-sm hover:border-[rgba(88,63,36,0.2)] transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar
                    src={owner.picture}
                    className="bg-[var(--primary,#583f24)] text-white shrink-0"
                    size={38}
                  >
                    {getInitials(owner.name || owner.email)}
                  </Avatar>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--text-main,#2C2A29)] truncate">
                        {owner.name || '旅程擁有者'}
                      </span>
                      <Tag
                        color="#583f24"
                        className="m-0 text-[10px] px-1.5 py-0.5 rounded font-medium flex items-center gap-1 leading-none"
                      >
                        <Crown size={11} />
                        <span>擁有者</span>
                      </Tag>
                    </div>
                    <span className="text-xs text-[var(--text-muted,#78716c)] truncate">
                      {owner.email || '—'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 2. 共編者 (Collaborators) 清單 */}
            {collaborators.map((c) => {
              const isItemRemoving = removingEmail === c.userEmail
              return (
                <div
                  key={c.userEmail}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-[rgba(0,0,0,0.06)] shadow-sm hover:border-[rgba(88,63,36,0.2)] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar
                      src={c.picture}
                      className="bg-stone-500 text-white shrink-0"
                      size={38}
                    >
                      {getInitials(c.name || c.userEmail)}
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-medium text-[var(--text-main,#2C2A29)] truncate max-w-[150px]">
                          {c.name || c.userEmail.split('@')[0]}
                        </span>
                        <Tag color="blue" className="m-0 text-[10px] px-1.5 py-0.5 rounded leading-none">
                          共編者
                        </Tag>
                        {!c.isRegistered && (
                          <Tooltip title="該帳號尚未於本系統登入過，對方下次登入時會自動生效">
                            <Tag color="default" className="m-0 text-[10px] px-1.5 py-0.5 rounded text-gray-500 leading-none">
                              待啟用
                            </Tag>
                          </Tooltip>
                        )}
                      </div>
                      <span className="text-xs text-[var(--text-muted,#78716c)] truncate">
                        {c.userEmail}
                      </span>
                    </div>
                  </div>

                  {/* 移除共編者操作（帶 Ant Design Popconfirm 防呆） */}
                  <Popconfirm
                    title="移除共編者"
                    description={`確定要將「${c.name || c.userEmail}」自此旅程共編名單中移除嗎？`}
                    okText="確認移除"
                    cancelText="取消"
                    okButtonProps={{ danger: true, loading: isItemRemoving }}
                    onConfirm={() => handleRemoveCollaborator(c.userEmail)}
                    disabled={isItemRemoving}
                  >
                    <Button
                      type="text"
                      danger
                      loading={isItemRemoving}
                      className="h-8 w-8 p-0 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-500 shrink-0"
                      title="移除共編者"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </Popconfirm>
                </div>
              )
            })}

            {/* 無共編者時的提示 */}
            {!isLoading && collaborators.length === 0 && (
              <div className="p-6 text-center text-xs text-[var(--text-muted,#a8a29e)] bg-stone-50 rounded-xl border border-dashed border-stone-200">
                目前尚無其他共編者。上方輸入 Email 即可邀請親友一同安排行程！
              </div>
            )}
          </div>
        </div>

        {/* 底部關閉按鈕 */}
        <div className="pt-2 flex justify-end border-t border-[rgba(0,0,0,0.06)]">
          <Button
            onClick={onClose}
            className="h-9 px-5 rounded-lg border-stone-300 text-stone-700 hover:border-stone-400"
          >
            完成
          </Button>
        </div>
      </div>
    </Modal>
  )
}
