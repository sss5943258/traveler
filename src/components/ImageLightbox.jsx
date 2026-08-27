import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, ZoomIn } from 'lucide-react'

/**
 * ImageLightbox
 *
 * Props:
 *   src      {string}   Image URL to display full-screen.
 *   alt      {string}   Alt text for the image.
 *   onClose  {function} Callback to close the lightbox.
 */
export default function ImageLightbox({ src, alt = '圖片', onClose }) {
  // Close on Escape key
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Prevent body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  return createPortal(
    <div
      className="lightbox-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      <button className="lightbox-close" onClick={onClose} aria-label="關閉">
        <X size={24} />
      </button>

      <div className="lightbox-img-wrap" onClick={(e) => e.stopPropagation()}>
        <img
          src={src}
          alt={alt}
          className="lightbox-img"
          draggable={false}
        />
      </div>

      <p className="lightbox-hint">點擊圖片外側或按 Esc 關閉</p>
    </div>,
    document.body
  )
}
