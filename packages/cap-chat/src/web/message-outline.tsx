import { memo, useMemo, useSyncExternalStore } from 'react'
import {
  bindSessionView,
  deriveChatOutline,
  getChatOutlineFilter,
  getChatOutlineOpen,
  requestChatOutlineGo,
  setChatOutlineOpen,
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
  const open = useSyncExternalStore(subscribeChatOutline, getChatOutlineOpen, () => true)
  const filter = useSyncExternalStore(subscribeChatOutline, getChatOutlineFilter, (): ChatOutlineFilter => 'user')
  const items = useMemo(() => deriveChatOutline(nodes, filter), [nodes, filter])

  if (!open) {
    return (
      <aside className="chat-outline is-collapsed" aria-label="消息大纲">
        <button
          type="button"
          className="chat-outline-fab"
          title="打开消息大纲"
          aria-label="打开消息大纲"
          data-testid="chat-outline-open"
          onClick={() => setChatOutlineOpen(true)}
        >
          <OutlineGlyph className="size-4" />
        </button>
      </aside>
    )
  }

  return (
    <aside className="chat-outline" aria-label="消息大纲" data-testid="chat-outline">
      <div className="chat-outline-head">
        <span className="chat-outline-title">消息</span>
        <button
          type="button"
          className="chat-outline-icon-btn"
          title="收起消息大纲"
          aria-label="收起消息大纲"
          data-testid="chat-outline-close"
          onClick={() => setChatOutlineOpen(false)}
        >
          <OutlineGlyph className="size-3.5" />
        </button>
      </div>
      <nav className="chat-outline-list">
        {items.length ? (
          items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`chat-outline-item${item.robot ? ' is-robot' : ''}`}
              title={item.text}
              data-testid={`chat-outline-item-${item.id}`}
              onClick={() => requestChatOutlineGo(item.id)}
            >
              <span className="chat-outline-dot" aria-hidden />
              <span className="chat-outline-label">{item.text}</span>
            </button>
          ))
        ) : (
          <div className="chat-outline-empty">还没有消息</div>
        )}
      </nav>
    </aside>
  )
})
