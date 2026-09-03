import { useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { listenOutsideDismiss } from './outside-dismiss.ts'

const RECORD_EMOJI_PRESETS = ['⭐', '🔥', '✅', '📌', '💡', '🎯', '📦', '🧩', '📄', '⚡']

export function RecordEmojiBoard({
  anchor,
  draft,
  onDraft,
  onPick,
  onClear,
  onClose,
}: {
  anchor: HTMLElement
  draft: string
  onDraft: (next: string) => void
  onPick: (emoji: string) => void
  onClear: () => void
  onClose: () => void
}) {
  const [pos, setPos] = useState({ left: 0, top: 0 })
  useLayoutEffect(() => {
    const place = () => {
      const box = anchor.getBoundingClientRect()
      const width = 168
      setPos({
        left: Math.min(box.left, Math.max(8, window.innerWidth - width - 8)),
        top: box.bottom + 4,
      })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [anchor])
  useEffect(() => {
    return listenOutsideDismiss(onClose, (target) => {
      if (anchor.contains(target)) return true
      return target instanceof Element && Boolean(target.closest('.fsdb-emoji-picker'))
    })
  }, [anchor, onClose])
  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      className="fsdb-emoji-picker is-fixed"
      data-biu-ignore
      role="dialog"
      aria-label="选择图标"
      style={{ left: pos.left, top: pos.top }}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="fsdb-emoji-picker-presets">
        {RECORD_EMOJI_PRESETS.map((item) => (
          <button key={item} type="button" className="fsdb-emoji-picker-item" onClick={() => onPick(item)}>
            {item}
          </button>
        ))}
      </div>
      <input
        className="fsdb-emoji-picker-input"
        value={draft}
        placeholder="输入 emoji"
        maxLength={8}
        onChange={(event) => onDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            onPick(draft)
          }
          if (event.key === 'Escape') onClose()
        }}
      />
      <button type="button" className="fsdb-emoji-picker-clear" onClick={onClear}>
        恢复默认
      </button>
    </div>,
    document.body,
  )
}
