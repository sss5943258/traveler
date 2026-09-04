import { createPortal } from 'react-dom';
import { AlertTriangle, Clock, X } from 'lucide-react';
import './Modals.css';

/**
 * ConflictModal 元件 (行程時間衝突提示與選擇彈窗)
 *
 * @param {boolean} props.isOpen - 是否顯示彈窗
 * @param {Object} props.conflictData - 衝突資訊 { status: 'ADJUSTABLE'|'SEVERE', conflictedCardTitle: string, adjustType?: 'START_TIME'|'END_TIME', proposedNewTime?: string }
 * @param {Function} props.onConfirmAdjust - 選擇「是」(自動調整 conflict card 之時間)
 * @param {Function} props.onDeclineAdjust - 選擇「否」/「確定」(不調整 conflict card，將新卡片放於當天最後)
 * @param {Function} props.onClose - 取消關閉彈窗
 */
export default function ConflictModal({
  isOpen,
  conflictData,
  onConfirmAdjust,
  onDeclineAdjust,
  onClose
}) {
  if (!isOpen || !conflictData || conflictData.status === 'NONE') {
    return null;
  }

  const isAdjustable = conflictData.status === 'ADJUSTABLE';
  const { conflictedCardTitle = '行程', adjustType, proposedNewTime } = conflictData;
  const isEndTimeAdjust = adjustType === 'END_TIME';

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass conflict-modal" onClick={(e) => e.stopPropagation()}>
        {/* 彈窗標頭 */}
        <div className="form-modal-header">
          <div>
            <h2 className="modal-title flex items-center gap-2 text-amber-600">
              {isAdjustable ? (
                <Clock size={22} className="text-amber-500" />
              ) : (
                <AlertTriangle size={22} className="text-red-500" />
              )}
              {isAdjustable ? '行程時間衝突調整' : '行程時間嚴重衝突'}
            </h2>
          </div>
          <button className="close-btn" onClick={onClose} title="關閉">
            <X size={20} />
          </button>
        </div>

        {/* 彈窗內文 */}
        <div className="conflict-modal-body">
          {isAdjustable ? (
            <p className="conflict-message">
              與<strong>「{conflictedCardTitle}」</strong>行程的{isEndTimeAdjust ? '結束時間' : '起始時間'}衝突，要幫你將<strong>「{conflictedCardTitle}」</strong>的{isEndTimeAdjust ? '結束時間' : '起始時間'}改為 <strong>{proposedNewTime}</strong> 嗎？
            </p>
          ) : (
            <p className="conflict-message severe">
              與<strong>「{conflictedCardTitle}」</strong>{conflictData?.overlappingCount > 1 ? '等多個' : ''}行程時間嚴重衝突，將置於當天最後面。
            </p>
          )}
        </div>

        {/* 按鈕區域 */}
        <div className="conflict-modal-actions">
          {isAdjustable ? (
            <>
              <button
                type="button"
                className="modal-btn secondary-btn"
                onClick={onDeclineAdjust}
              >
                否 (置於當天最後)
              </button>
              <button
                type="button"
                className="modal-btn primary-btn"
                onClick={onConfirmAdjust}
              >
                是 (調整時間)
              </button>
            </>
          ) : (
            <button
              type="button"
              className="modal-btn primary-btn"
              onClick={onDeclineAdjust}
            >
              確定
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
