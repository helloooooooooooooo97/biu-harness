import { memo, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import {
  bindSessionView,
  deriveChatOutline,
  getChatOutlineFilter,
  requestChatOutlineGo,
  subscribeChatOutline,
  type ChatOutlineFilter,
  type SessionViewService,
} from '@biu/web-session-view'

function OutlineGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden className={className}>
      <rect x="1.25" y="3.4" width="13.5" height="1.7" rx="0.85" fill="currentColor" opacity="0.38" />
      <rect x="1.25" y="7.15" width="13.5" height="1.7" rx="0.85" fill="currentColor" />
      <rect x="1.25" y="10.9" width="13.5" height="1.7" rx="0.85" fill="currentColor" opacity="0.38" />
    </svg>
  )
}

export const ChatMessageOutline = memo(function ChatMessageOutline({
  useSessionView,
}: {
  useSessionView: ReturnType<typeof bindSessionView>
  sessionView?: SessionViewService
}) {
  const nodes = useSessionView((state) => state.nodes)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLElement>(null)
  const filter = useSyncExternalStore(subscribeChatOutline, getChatOutlineFilter, (): ChatOutlineFilter => 'user')
  const items = useMemo(() => deriveChatOutline(nodes, filter), [nodes, filter])

  useEffect(() => {
    if (!open) return
    function onPointer(event: MouseEvent) {
      const target = event.target as Node
      if (rootRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [open])

  return (
    <aside className="chat-outline" aria-label="消息大纲" ref={rootRef}>
      <button
        type="button"
        className={`chat-outline-icon-btn${open ? ' is-open' : ''}`}
        title={open ? '收起消息大纲' : '打开消息大纲'}
        aria-label={open ? '收起消息大纲' : '打开消息大纲'}
        aria-expanded={open}
        data-testid="chat-outline-toggle"
        onClick={() => setOpen((value) => !value)}
      >
        <OutlineGlyph className="chat-outline-glyph" />
      </button>
      {open ? (
        <nav className="chat-outline-panel" data-testid="chat-outline">
          {items.length ? (
            items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`chat-outline-item${item.robot ? ' is-robot' : ''}`}
                title={item.text}
                data-testid={`chat-outline-item-${item.id}`}
                onClick={() => {
                  requestChatOutlineGo(item.id)
                  setOpen(false)
                }}
              >
                <span className="chat-outline-dot" aria-hidden />
                <span className="chat-outline-label">{item.text}</span>
              </button>
            ))
          ) : (
            <div className="chat-outline-empty">还没有消息</div>
          )}
        </nav>
      ) : null}
    </aside>
  )
})
